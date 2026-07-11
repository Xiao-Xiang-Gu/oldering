// 飲料揪團點餐系統 - 前端 API 串接與 UI 渲染邏輯 (存取控制安全防禦版)

// ==========================================
// 1. 全域變數與初始化
// ==========================================
let STORES = []; 
let currentGroupId = null;
let currentUserId = null;
let currentRole = null; // 'initiator' 或 'joiner'
let selectedProduct = null;
let activeCustomization = {
  size: null,
  ice: null,
  sweetness: null,
  toppings: []
};
let modalQty = 1;
let pollInterval = null; 

let backendGroupData = null;
let backendGroupCarts = [];
let backendMyCart = null;

// 自定義 API Fetch 封裝：自動在 Headers 中攜帶 X-User-Id 進行權限查驗
async function apiFetch(url, options = {}) {
  options.headers = options.headers || {};
  options.headers['X-User-Id'] = currentUserId;
  return fetch(url, options);
}

document.addEventListener('DOMContentLoaded', async () => {
  initUser();
  await fetchStores(); 
  checkRoute();
  setupEventListeners();
});

function initUser() {
  let userId = sessionStorage.getItem('user_id');
  // 清理舊模擬廣留下的硬寫 ID，避免 localStorage 氙染
  if (!userId || userId === 'user-initiator' || userId === 'user-joiner-a' || userId === 'user-joiner-b') {
    userId = 'U-' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('user_id', userId);
    sessionStorage.removeItem('user_name'); // 同步清除舊名字
  }
  currentUserId = userId;
  
  let userName = sessionStorage.getItem('user_name');
  window.currentUserName = userName || "";
}

// ==========================================
// 2. 後端 API 串接與安全同步
// ==========================================

async function fetchStores() {
  try {
    const res = await apiFetch('/api/stores');
    STORES = await res.json();
  } catch (err) {
    console.error("無法獲取店家資料:", err);
    showToast("❌ 無法連接後端伺服器！");
  }
}

async function checkRoute() {
  const urlParams = new URLSearchParams(window.location.search);
  const groupId = urlParams.get('groupId');
  
  if (groupId) {
    try {
      const res = await apiFetch(`/api/groups/${groupId}`);
      if (res.ok) {
        currentGroupId = groupId;
        const group = await res.json();
        
        if (group.initiatorId === currentUserId) {
          currentRole = 'initiator';
        } else {
          // 重新導向到跟團者專屬網頁
          window.location.href = `/join.html?groupId=${groupId}`;
          return;
        }
        
        showSection('room-section');
        await syncWithBackend();
        startPolling();
      } else {
        showToast("⚠️ 該揪團房間不存在！");
        clearRoute();
      }
    } catch (err) {
      showToast("❌ 連線錯誤，返回首頁。");
      clearRoute();
    }
  } else {
    stopPolling();
    currentGroupId = null;
    currentRole = null;
    showSection('lobby-section');
    renderLobby();
  }
}

function clearRoute() {
  window.history.replaceState({}, document.title, window.location.pathname);
  currentGroupId = null;
  currentRole = null;
  showSection('lobby-section');
  renderLobby();
}

function showSection(sectionId) {
  document.getElementById('lobby-section').style.display = sectionId === 'lobby-section' ? 'block' : 'none';
  document.getElementById('room-section').style.display = sectionId === 'room-section' ? 'block' : 'none';
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    await syncWithBackend();
  }, 3000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// 與後端安全同步 (處理 403 越權防禦攔截)
async function syncWithBackend() {
  if (!currentGroupId) return;
  
  try {
    // 1. 公共資訊：確認房間與店家
    const groupRes = await apiFetch(`/api/groups/${currentGroupId}`);
    if (!groupRes.ok) {
      if (groupRes.status === 404) {
        showToast("⚠️ 房間不存在！");
        clearRoute();
      }
      return;
    }
    backendGroupData = await groupRes.json();

    // 2. 敏感資訊安全查驗：拉取大總覽
    const cartsRes = await apiFetch(`/api/groups/${currentGroupId}/carts`);
    
    if (cartsRes.status === 403) {
      // ⚠️ 403 Forbidden: 代表未加入！隱藏點餐與大總覽，顯示註冊加入卡片
      backendGroupCarts = [];
      backendMyCart = null;
      renderRoomForGuest(); // 訪客渲染模式
      return;
    }
    
    if (cartsRes.ok) backendGroupCarts = await cartsRes.json();
    
    // 3. 拉取個人購物車
    const myCartRes = await apiFetch(`/api/carts/${currentGroupId}/${currentUserId}`);
    if (myCartRes.ok) {
      backendMyCart = await myCartRes.json();
    } else {
      backendMyCart = null;
    }
    
    // 正常渲染
    renderRoom();
  } catch (err) {
    console.error("同步失敗:", err);
  }
}

// ==========================================
// 3. UI 渲染邏輯
// ==========================================

function calculateDeliveryFee(distance) {
  if (distance <= 2.0) {
    return 20;
  } else if (distance <= 3.0) {
    return 30;
  } else {
    return 30 + Math.ceil(distance - 3.0) * 5;
  }
}

function renderLobby() {
  const storeGrid = document.getElementById('store-grid');
  storeGrid.innerHTML = '';
  
  STORES.forEach(store => {
    const card = document.createElement('div');
    card.className = 'store-card';
    card.innerHTML = `
      <img class="store-img" src="${store.image}" alt="${store.name}" />
      <div class="store-content">
        <span class="store-tag">${store.category}</span>
        <h3 class="store-title">${store.name}</h3>
        <div class="store-details">
          <span>📞 電話：${store.phone}</span>
          <span>💰 外送門檻：$${store.minDeliveryCharge}</span>
          <span style="display:block; margin-top:4px;">📍 距離：${store.distance ? store.distance.toFixed(1) : '0.0'} 公里</span>
          <span>🛵 運費：$${store.distance ? calculateDeliveryFee(store.distance) : '0'}</span>
        </div>
        <div class="store-footer">
          <span class="store-rating">⭐ ${store.rating}</span>
          <button class="btn-primary btn-start-group" data-store-id="${store.id}">
            發起揪團
          </button>
        </div>
      </div>
    `;
    
    card.querySelector('.btn-start-group').addEventListener('click', (e) => {
      e.stopPropagation();
      startGroup(store.id);
    });
    
    storeGrid.appendChild(card);
  });
  
  renderSimBar();
}

async function startGroup(storeId) {
  const store = STORES.find(s => s.id === storeId);
  if (!store) return;
  
  const groupId = 'G-' + Date.now();
  currentGroupId = groupId;
  // 主揪使用真實的 localStorage UUID，不再硬寫為 'user-initiator'
  currentRole = 'initiator';
  
  if (!window.currentUserName) {
    window.currentUserName = "主揪";
    sessionStorage.setItem('user_name', window.currentUserName);
  }
  
  try {
    const res = await apiFetch('/api/groups/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: groupId,
        storeId: storeId,
        initiatorId: currentUserId,
        initiatorName: window.currentUserName
      })
    });
    
    if (res.ok) {
      const newUrl = `${window.location.pathname}?groupId=${groupId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
      showSection('room-section');
      
      await syncWithBackend();
      startPolling();
      showToast("🎉 揪團房已成功建立！您已自動註冊為主揪。");
    } else {
      const data = await res.json();
      showToast(`❌ 發起失敗: ${data.error}`);
    }
  } catch (err) {
    showToast("❌ 無法與伺服器建立連接！");
  }
}

// 訪客模式渲染 (未加入、未授權時隱藏所有敏感明細與點餐面板，僅顯示加入卡片)
function renderRoomForGuest() {
  const store = STORES.find(s => s.id === backendGroupData.storeId);
  if (!store) return;
  
  document.getElementById('room-store-name').innerText = store.name;
  document.getElementById('room-id-text').innerText = `房間號：${backendGroupData.id}`;
  document.getElementById('share-link-display').innerText = `${window.location.origin}${window.location.pathname}?groupId=${backendGroupData.id}`;
  
  renderTimeline(backendGroupData.status);
  
  // 顯示加入卡片，隱藏其他點餐與總覽面板，落實「不加入即無法訪問我的訂單」防禦
  document.getElementById('join-section').style.display = 'block';
  document.getElementById('join-store-title').innerText = `加入 ${store.name} 揪團`;
  
  document.getElementById('menu-panel').style.display = 'none';
  document.getElementById('cart-panel').style.display = 'none';
  document.getElementById('members-panel').style.display = 'none';
  document.getElementById('total-summary-panel').style.display = 'none';
  
  renderProgressBar([], store);
  renderSimBar();
  renderDBViewer();
}

// 正常授權模式渲染
function renderRoom() {
  if (!backendGroupData) return;
  
  const store = STORES.find(s => s.id === backendGroupData.storeId);
  if (!store) return;
  
  document.getElementById('room-store-name').innerText = store.name;
  document.getElementById('room-id-text').innerText = `房間號：${backendGroupData.id}`;
  
  const shareLink = `${window.location.origin}/join.html?groupId=${backendGroupData.id}`;
  document.getElementById('share-link-display').innerText = shareLink;
  document.getElementById('btn-copy-link').style.display = 'inline-block';
  
  renderTimeline(backendGroupData.status);
  
  const joinSection = document.getElementById('join-section');
  const menuPanel = document.getElementById('menu-panel');
  const cartPanel = document.getElementById('cart-panel');
  const membersPanel = document.getElementById('members-panel');
  const totalSummaryPanel = document.getElementById('total-summary-panel');
  
  joinSection.style.display = 'none';
  menuPanel.style.display = 'none';
  cartPanel.style.display = 'none';
  membersPanel.style.display = 'none';
  totalSummaryPanel.style.display = 'none';
  
  if (currentRole === 'initiator') {
    menuPanel.style.display = 'block';
    cartPanel.style.display = 'block';
    membersPanel.style.display = 'block';
    totalSummaryPanel.style.display = 'block';
    
    renderMenu(store, backendGroupData.status);
    renderPersonalCart(backendMyCart, backendGroupData.status);
    renderMemberList(backendGroupCarts);
    renderTotalSummary(backendGroupCarts, store, backendGroupData.status);
  } else {
    // 跟團者如果資料庫沒購物車，就是未加入
    if (!backendMyCart) {
      joinSection.style.display = 'block';
      document.getElementById('join-store-title').innerText = `加入 ${store.name} 揪團`;
    } else {
      menuPanel.style.display = 'block';
      cartPanel.style.display = 'block';
      membersPanel.style.display = 'block';
      
      if (backendGroupData.status !== 'active') {
        totalSummaryPanel.style.display = 'block';
        renderTotalSummary(backendGroupCarts, store, backendGroupData.status);
      }
      
      renderMenu(store, backendGroupData.status);
      renderPersonalCart(backendMyCart, backendGroupData.status);
      renderMemberList(backendGroupCarts);
    }
  }
  
  renderProgressBar(backendGroupCarts, store);
  renderSimBar();
  renderDBViewer();
}

function renderProgressBar(carts, store) {
  let totalAmount = 0;
  carts.forEach(userCart => {
    userCart.items.forEach(item => {
      totalAmount += item.price * item.quantity;
    });
  });
  
  const minDelivery = store.minDeliveryCharge;
  const percent = Math.min(100, (totalAmount / minDelivery) * 100);
  
  const barFill = document.getElementById('progress-bar-fill');
  barFill.style.width = `${percent}%`;
  
  document.getElementById('progress-total-display').innerText = `$${totalAmount}`;
  document.getElementById('progress-min-display').innerText = `$${minDelivery}`;
  
  const hintDisplay = document.getElementById('progress-hint-display');
  if (totalAmount >= minDelivery) {
    hintDisplay.innerHTML = `<span style="color:var(--accent);">🎉 已達外送門檻，可以下單囉！</span>`;
    barFill.style.background = `linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)`;
  } else {
    const diff = minDelivery - totalAmount;
    hintDisplay.innerHTML = `還差 <span style="color:var(--secondary); font-weight:700;">$${diff}</span> 即可外送`;
    barFill.style.background = `linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)`;
  }
}

function renderTimeline(status) {
  const steps = ['active', 'locked', 'processing', 'delivering', 'completed'];
  const labels = ['揪團中', '已結單', '店家製作中', '外送中', '已送達'];
  const timeline = document.getElementById('timeline-container');
  timeline.innerHTML = '';
  
  let currentStepIdx = steps.indexOf(status);
  
  steps.forEach((step, idx) => {
    const stepEl = document.createElement('div');
    stepEl.className = 'timeline-step';
    if (idx === currentStepIdx) {
      stepEl.classList.add('active');
    } else if (idx < currentStepIdx) {
      stepEl.classList.add('completed');
    }
    
    stepEl.innerHTML = `
      <div class="timeline-dot">${idx + 1}</div>
      <div class="timeline-label">${labels[idx]}</div>
    `;
    timeline.appendChild(stepEl);
  });
}

function renderMenu(store, status) {
  const container = document.getElementById('menu-items-container');
  container.innerHTML = '';
  
  const categories = {};
  store.menu.forEach(item => {
    if (!categories[item.category]) {
      categories[item.category] = [];
    }
    categories[item.category].push(item);
  });
  
  Object.keys(categories).forEach(cat => {
    const catSection = document.createElement('div');
    catSection.className = 'menu-category-section';
    catSection.innerHTML = `<h4 class="menu-category-title">${cat}</h4>`;
    
    const grid = document.createElement('div');
    grid.className = 'menu-grid';
    
    categories[cat].forEach(item => {
      const card = document.createElement('div');
      card.className = 'menu-item-card';
      const canOrder = (status === 'active' || status === 'private');
      card.innerHTML = `
        <div class="menu-item-info">
          <div class="menu-item-name">${item.name}</div>
          <div class="menu-item-desc">${item.description}</div>
          <div class="menu-item-price">$${item.basePrice} 起</div>
        </div>
        <button class="btn-primary btn-add-item" ${!canOrder ? 'disabled' : ''}>
          ${!canOrder ? '已截止' : '點餐'}
        </button>
      `;
      
      if (canOrder) {
        card.querySelector('.btn-add-item').addEventListener('click', () => {
          openCustomizationModal(item);
        });
      }
      grid.appendChild(card);
    });
    
    catSection.appendChild(grid);
    container.appendChild(catSection);
  });
}

function renderPersonalCart(userCart, status) {
  const cartList = document.getElementById('cart-list');
  cartList.innerHTML = '';
  
  const cartContent = document.getElementById('cart-active-content');
  const lockedOverlay = document.getElementById('cart-locked-overlay');
  
  if (!userCart || userCart.items.length === 0) {
    cartList.innerHTML = `<div class="empty-state">購物車空空的，快去選取飲料吧！</div>`;
    document.getElementById('cart-total-price').innerText = '$0';
    document.getElementById('btn-submit-cart').disabled = true;
    
    cartContent.style.display = 'block';
    lockedOverlay.style.display = 'none';
    return;
  }
  
  let cartTotal = 0;
  userCart.items.forEach(item => {
    const subtotal = item.price * item.quantity;
    cartTotal += subtotal;
    
    const el = document.createElement('div');
    el.className = 'cart-item';
    
    const toppingsList = item.toppings.map(t => t.toppingName);
    const toppingsText = toppingsList.length > 0 ? ` + 加料: ${toppingsList.join(', ')}` : '';
    const details = `${item.size} / ${item.ice} / ${item.sweetness}${toppingsText}`;
    
    el.innerHTML = `
      <div class="cart-item-header">
        <span>${item.productName}</span>
        <span>x ${item.quantity}</span>
      </div>
      <div class="cart-item-details">${details}</div>
      <div class="cart-item-footer">
        <span class="cart-item-price">$${subtotal}</span>
        ${(status === 'active' || status === 'private') && userCart.status === 'pending' ? `
          <button class="btn-danger btn-remove-cart" data-item-id="${item.id}">刪除</button>
        ` : ''}
      </div>
    `;
    
    if ((status === 'active' || status === 'private') && userCart.status === 'pending') {
      el.querySelector('.btn-remove-cart').addEventListener('click', () => {
        removeFromCart(item.id);
      });
    }
    cartList.appendChild(el);
  });
  
  document.getElementById('cart-total-price').innerText = `$${cartTotal}`;
  
  const submitBtn = document.getElementById('btn-submit-cart');
  if (userCart.status === 'submitted') {
    cartContent.style.display = 'none';
    lockedOverlay.style.display = 'block';
    lockedOverlay.innerHTML = `
      <div class="locked-overlay">
        <svg width="40" height="40" fill="#10b981" viewBox="0 0 16 16" style="margin-bottom:12px;"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
        <h3>您的訂單已提交鎖定</h3>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:15px;">已將點餐結果同步至主揪，請耐心等候！</p>
        ${status === 'active' || status === 'private' ? `
          <button class="btn-secondary" id="btn-unlock-cart" style="width:100%;">修改餐點 (解鎖)</button>
        ` : `<span style="color:var(--secondary); font-size:12px; font-weight:600;">揪團已截止，無法解鎖修改</span>`}
      </div>
    `;
    
    if (status === 'active' || status === 'private') {
      document.getElementById('btn-unlock-cart').addEventListener('click', unlockCart);
    }
  } else {
    cartContent.style.display = 'block';
    lockedOverlay.style.display = 'none';
    submitBtn.disabled = false;
    
    if (status !== 'active' && status !== 'private') {
      submitBtn.disabled = true;
      submitBtn.innerText = "已截止";
    } else {
      submitBtn.innerText = "確認提交 (鎖定購物車)";
    }
  }
}

function renderMemberList(carts) {
  const container = document.getElementById('member-list-container');
  container.innerHTML = '';
  
  document.getElementById('member-count-title').innerText = `跟團成員 (${carts.length} 人)`;
  
  carts.forEach(user => {
    let drinkCount = 0;
    user.items.forEach(it => drinkCount += it.quantity);
    
    const el = document.createElement('div');
    el.className = `member-item ${user.status === 'submitted' ? 'submitted' : ''}`;
    el.style.flexDirection = 'column';
    el.style.alignItems = 'stretch';
    el.style.cursor = 'pointer';
    
    const statusText = user.status === 'submitted' ? '已確認' : '點餐中';
    const statusClass = user.status === 'submitted' ? 'done' : 'pending';
    
    let label = "";
    if (user.userId === currentUserId) label += " (我)";
    if (user.userId === 'user-initiator') label += " [主揪]";
    
    // 主揪代為提交/解鎖的管理按鈕 (排除自己)
    let adminBtnHtml = "";
    if (currentRole === 'initiator' && user.userId !== currentUserId && (backendGroupData.status === 'active' || backendGroupData.status === 'private')) {
      if (user.status === 'submitted') {
        adminBtnHtml = `<button class="btn-secondary btn-member-action" data-action="unlock" data-user-id="${user.userId}" style="padding: 2px 8px; font-size: 11px; height: auto; margin-left: 8px;">🔓 幫他解鎖</button>`;
      } else {
        adminBtnHtml = `<button class="btn-primary btn-member-action" data-action="submit" data-user-id="${user.userId}" style="padding: 2px 8px; font-size: 11px; height: auto; margin-left: 8px;">🔒 幫他提交</button>`;
      }
    }
    
    // 主內容區塊
    const mainDiv = document.createElement('div');
    mainDiv.style.display = 'flex';
    mainDiv.style.justifyContent = 'space-between';
    mainDiv.style.alignItems = 'center';
    mainDiv.style.width = '100%';
    mainDiv.innerHTML = `
      <div class="member-info">
        <span class="member-name">${user.userName}${label}</span>
        <span style="color:var(--text-muted); font-size:11px;">(${drinkCount} 杯)</span>
      </div>
      <div style="display:flex; align-items:center;">
        <span class="member-status ${statusClass}">${statusText}</span>
        ${adminBtnHtml}
      </div>
    `;
    
    el.appendChild(mainDiv);
    
    // 綁定管理按鈕點擊事件
    if (adminBtnHtml) {
      mainDiv.querySelectorAll('.btn-member-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation(); // 阻止展開/折疊
          const action = btn.getAttribute('data-action');
          const uid = btn.getAttribute('data-user-id');
          doMemberAction(uid, action);
        });
      });
    }

    // 展開明細容器
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'member-detail-items';
    detailsDiv.style.display = 'none'; // 預設折疊
    detailsDiv.style.width = '100%';
    detailsDiv.style.padding = '10px';
    detailsDiv.style.background = 'rgba(255,255,255,0.03)';
    detailsDiv.style.borderRadius = '6px';
    detailsDiv.style.marginTop = '8px';
    detailsDiv.style.borderTop = '1px solid rgba(255,255,255,0.05)';
    
    if (user.items.length === 0) {
      detailsDiv.innerHTML = `<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:5px 0;">購物車尚無任何餐點</div>`;
    } else {
      user.items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.style.display = 'flex';
        itemEl.style.justifyContent = 'space-between';
        itemEl.style.alignItems = 'center';
        itemEl.style.fontSize = '12px';
        itemEl.style.padding = '6px 0';
        itemEl.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
        
        const toppingsList = item.toppings.map(t => t.toppingName);
        const toppingsText = toppingsList.length > 0 ? ` + 加料: ${toppingsList.join(', ')}` : '';
        const spec = `${item.size} / ${item.ice} / ${item.sweetness}${toppingsText}`;
        
        itemEl.innerHTML = `
          <div style="flex: 1; text-align: left;">
            <div style="font-weight:600; color:#fff;">${item.productName} <span style="color:var(--primary);">x ${item.quantity}</span></div>
            <div style="color:var(--text-muted); font-size:11px; margin-top:2px;">${spec}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:var(--accent); font-weight:600;">$${item.price * item.quantity}</span>
            ${(currentRole === 'initiator' && (backendGroupData.status === 'active' || backendGroupData.status === 'private')) ? `
              <button class="btn-danger btn-remove-member-item" data-user-id="${user.userId}" data-item-id="${item.id}" style="padding: 2px 6px; font-size:10px; height:auto;">刪除</button>
            ` : ''}
          </div>
        `;
        
        if (currentRole === 'initiator' && (backendGroupData.status === 'active' || backendGroupData.status === 'private')) {
          itemEl.querySelector('.btn-remove-member-item').addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止折疊
            removeMemberItem(user.userId, item.id);
          });
        }
        detailsDiv.appendChild(itemEl);
      });
    }
    
    el.appendChild(detailsDiv);
    
    // 點擊展開/折疊
    el.addEventListener('click', () => {
      const isHidden = detailsDiv.style.display === 'none';
      detailsDiv.style.display = isHidden ? 'block' : 'none';
    });
    
    container.appendChild(el);
  });
}

function renderTotalSummary(carts, store, status) {
  const tableBody = document.getElementById('summary-table-body');
  tableBody.innerHTML = '';
  
  const deliveryFee = backendGroupData ? (backendGroupData.deliveryFee || 0) : 0;
  const distance = store ? (store.distance || 0) : 0;
  
  let grandTotal = 0;
  let grandQty = 0;
  
  const groups = {};
  
  carts.forEach(userCart => {
    userCart.items.forEach(item => {
      const toppingsList = item.toppings.map(t => t.toppingName);
      const sortedToppings = [...toppingsList].sort().join(',');
      const groupKey = `${item.productId}|${item.size}|${item.ice}|${item.sweetness}|${sortedToppings}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          productName: item.productName,
          size: item.size,
          ice: item.ice,
          sweetness: item.sweetness,
          toppings: toppingsList,
          price: item.price,
          quantity: 0,
          buyers: []
        };
      }
      
      groups[groupKey].quantity += item.quantity;
      if (!groups[groupKey].buyers.includes(userCart.userName)) {
        groups[groupKey].buyers.push(userCart.userName);
      }
      
      grandTotal += item.price * item.quantity;
      grandQty += item.quantity;
    });
  });
  
  const groupList = Object.values(groups);
  if (groupList.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty-state" style="text-align:center;">尚無任何提交品項</td></tr>`;
    document.getElementById('summary-subtotal-price').innerText = '$0';
    document.getElementById('summary-delivery-distance').innerText = distance.toFixed(1);
    document.getElementById('summary-delivery-fee').innerText = `$${deliveryFee}`;
    document.getElementById('summary-grand-total').innerText = `$${deliveryFee}`;
    document.getElementById('summary-grand-qty').innerText = '0 杯';
    
    const initActionBtn = document.getElementById('btn-initiator-action');
    if (initActionBtn) {
      initActionBtn.disabled = true;
      initActionBtn.innerText = "等待成員點餐中";
    }
    const secondaryBtn = document.getElementById('btn-initiator-secondary-action');
    if (secondaryBtn) secondaryBtn.remove();
    return;
  }
  
  groupList.forEach(grp => {
    const subtotal = grp.price * grp.quantity;
    const toppingsText = grp.toppings.length > 0 ? `+ 加料: ${grp.toppings.join(', ')}` : '無加料';
    const spec = `${grp.size} / ${grp.ice} / ${grp.sweetness} / ${toppingsText}`;
    const buyersHtml = grp.buyers.map(b => `<span class="summary-buyer">${b}</span>`).join('');
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div class="summary-name">${grp.productName}</div>
        <div class="summary-details">${spec}</div>
        <div style="margin-top:4px;">${buyersHtml}</div>
      </td>
      <td class="summary-qty">${grp.quantity}</td>
      <td style="font-size:13px; color:var(--text-muted);">$${grp.price}</td>
      <td class="summary-subtotal">$${subtotal}</td>
    `;
    tableBody.appendChild(row);
  });
  
  const minDelivery = store ? store.minDeliveryCharge : 200;
  const subsidy = Math.max(0, minDelivery - grandTotal);
  const subsidyRow = document.getElementById('summary-low-subsidy-row');
  if (subsidyRow) {
    if (subsidy > 0) {
      subsidyRow.style.display = 'table-row';
      document.getElementById('summary-low-subsidy').innerText = `$${subsidy}`;
    } else {
      subsidyRow.style.display = 'none';
    }
  }

  document.getElementById('summary-subtotal-price').innerText = `$${grandTotal}`;
  document.getElementById('summary-delivery-distance').innerText = distance.toFixed(1);
  document.getElementById('summary-delivery-fee').innerText = `$${deliveryFee}`;
  document.getElementById('summary-grand-total').innerText = `$${grandTotal + deliveryFee + subsidy}`;
  document.getElementById('summary-grand-qty').innerText = `${grandQty} 杯`;
  
  const initActionBtn = document.getElementById('btn-initiator-action');
  if (!initActionBtn) return;
  
  const secondaryBtn = document.getElementById('btn-initiator-secondary-action');
  if (secondaryBtn) secondaryBtn.remove();
  
  initActionBtn.disabled = false;
  initActionBtn.style.background = ""; // 重設背景
  
  if (currentRole === 'initiator') {
    initActionBtn.style.display = 'block';
    if (status === 'active') {
      initActionBtn.className = "btn-primary btn-full";
      initActionBtn.innerText = "🔒 截止揪團 (限制所有人點餐)";
      initActionBtn.onclick = () => changeRoomStatus('locked');
      
      // 直接送出訂單按鈕 (方便不開團/自己吃或直接送出)
      const extraBtn = document.createElement('button');
      extraBtn.id = 'btn-initiator-secondary-action';
      extraBtn.className = "btn-secondary btn-full";
      extraBtn.style.marginTop = "12px";
      extraBtn.style.justifyContent = "center";
      extraBtn.style.fontSize = "15px";
      extraBtn.innerText = "🏪 直接送出訂單，店家開始製作";
      extraBtn.onclick = () => {
        if (confirm("確認要直接送出訂單給店家製作嗎？")) {
          changeRoomStatus('processing');
        }
      };
      initActionBtn.parentNode.appendChild(extraBtn);
    } else if (status === 'locked') {
      initActionBtn.className = "btn-primary btn-full";
      initActionBtn.style.background = "linear-gradient(135deg, var(--secondary) 0%, #db2777 100%)";
      initActionBtn.innerText = "🏪 送出訂單，店家開始製作";
      initActionBtn.onclick = () => changeRoomStatus('processing');
    } else if (status === 'processing') {
      initActionBtn.className = "btn-primary btn-full";
      initActionBtn.style.background = "linear-gradient(135deg, var(--accent) 0%, #059669 100%)";
      initActionBtn.innerText = "🚴 店家已外送中";
      initActionBtn.onclick = () => changeRoomStatus('delivering');
    } else if (status === 'delivering') {
      initActionBtn.className = "btn-primary btn-full";
      initActionBtn.style.background = "linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)";
      initActionBtn.innerText = "✅ 確認飲料已送達";
      initActionBtn.onclick = () => changeRoomStatus('completed');
    } else if (status === 'completed') {
      initActionBtn.className = "btn-secondary btn-full";
      initActionBtn.innerText = "🎉 揪團已完成";
      initActionBtn.disabled = true;
    }
  } else {
    initActionBtn.style.display = 'none';
  }
}

async function changeRoomStatus(newStatus) {
  try {
    const res = await apiFetch(`/api/groups/${currentGroupId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus: newStatus })
    });
    
    if (res.ok) {
      await syncWithBackend();
      let msg = "房間狀態已更新！";
      if (newStatus === 'locked') msg = "🔒 揪團已截止，所有成員已無法修改與提交！";
      if (newStatus === 'processing') msg = "🏪 訂單已送出，店家正在製作中！";
      if (newStatus === 'delivering') msg = "🚴 飲料已經在外送途中囉！";
      if (newStatus === 'completed') msg = "🎉 飲料已送達，感謝本次的跟團！";
      showToast(msg);
    } else {
      const data = await res.json();
      showToast(`❌ 狀態變更失敗: ${data.error}`);
    }
  } catch (err) {
    showToast("❌ 無法與伺服器連接！");
  }
}

// 主揪幫忙成員刪除品項之 API 呼叫
async function removeMemberItem(userId, itemId) {
  if (!confirm("確定要幫該成員刪除此品項嗎？")) return;
  
  try {
    const res = await apiFetch('/api/carts/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: currentGroupId,
        userId: userId,
        itemId: itemId
      })
    });
    
    if (res.ok) {
      await syncWithBackend();
      showToast("🗑️ 已成功幫成員移除品項");
    } else {
      const data = await res.json();
      showToast(`❌ 移除失敗: ${data.error}`);
    }
  } catch (err) {
    showToast("❌ 連線錯誤！");
  }
}

// 主揪幫忙成員提交/解鎖之 API 呼叫
async function doMemberAction(userId, action) {
  const url = action === 'unlock' ? '/api/carts/unlock' : '/api/carts/submit';
  try {
    const res = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: currentGroupId,
        userId: userId
      })
    });
    
    if (res.ok) {
      await syncWithBackend();
      showToast(action === 'unlock' ? "🔓 已成功幫成員解鎖購物車" : "🔒 已成功幫成員提交購物車");
    } else {
      const data = await res.json();
      showToast(`❌ 操作失敗: ${data.error}`);
    }
  } catch (err) {
    showToast("❌ 連線錯誤！");
  }
}

// ==========================================
// 4. 點餐選取客製化 (Modal) 與購物車操作
// ==========================================

function openCustomizationModal(product) {
  selectedProduct = product;
  modalQty = 1;
  
  const sizes = product.customOptions.filter(o => o.type === 'SIZE');
  const ices = product.customOptions.filter(o => o.type === 'ICE');
  const sweets = product.customOptions.filter(o => o.type === 'SWEETNESS');
  
  activeCustomization = {
    size: sizes.length > 0 ? sizes[0].name : null,
    ice: ices.length > 0 ? ices[0].name : null,
    sweetness: sweets.length > 0 ? sweets[0].name : null,
    toppings: []
  };
  
  document.getElementById('modal-prod-name').innerText = product.name;
  document.getElementById('modal-prod-desc').innerText = product.description;
  
  renderCustomizationOptions(product, sizes, ices, sweets);
  updateModalPrice();
  
  document.getElementById('custom-modal').classList.add('active');
}

function renderCustomizationOptions(product, sizes, ices, sweets) {
  const container = document.getElementById('modal-custom-options');
  container.innerHTML = '';
  
  if (sizes.length > 0) {
    const sizeSec = document.createElement('div');
    sizeSec.className = 'custom-section';
    sizeSec.innerHTML = `<div class="custom-section-title">選擇規格 <span>單選</span></div>`;
    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'option-group';
    
    sizes.forEach(size => {
      const btn = document.createElement('button');
      btn.className = `option-btn ${activeCustomization.size === size.name ? 'selected' : ''}`;
      btn.innerText = `${size.name} ${size.extraPrice > 0 ? `(+$${size.extraPrice})` : ''}`;
      btn.onclick = () => {
        activeCustomization.size = size.name;
        sizeGroup.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateModalPrice();
      };
      sizeGroup.appendChild(btn);
    });
    sizeSec.appendChild(sizeGroup);
    container.appendChild(sizeSec);
  }
  
  if (ices.length > 0) {
    const iceSec = document.createElement('div');
    iceSec.className = 'custom-section';
    iceSec.innerHTML = `<div class="custom-section-title">溫度冰量 <span>單選</span></div>`;
    const iceGroup = document.createElement('div');
    iceGroup.className = 'option-group';
    
    ices.forEach(ice => {
      const btn = document.createElement('button');
      btn.className = `option-btn ${activeCustomization.ice === ice.name ? 'selected' : ''}`;
      btn.innerText = ice.name;
      btn.onclick = () => {
        activeCustomization.ice = ice.name;
        iceGroup.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
      iceGroup.appendChild(btn);
    });
    iceSec.appendChild(iceGroup);
    container.appendChild(iceSec);
  }
  
  if (sweets.length > 0) {
    const sweetSec = document.createElement('div');
    sweetSec.className = 'custom-section';
    sweetSec.innerHTML = `<div class="custom-section-title">甜度冰量 <span>單選</span></div>`;
    const sweetGroup = document.createElement('div');
    sweetGroup.className = 'option-group';
    
    sweets.forEach(sweet => {
      const btn = document.createElement('button');
      btn.className = `option-btn ${activeCustomization.sweetness === sweet.name ? 'selected' : ''}`;
      btn.innerText = sweet.name;
      btn.onclick = () => {
        activeCustomization.sweetness = sweet.name;
        sweetGroup.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
      sweetGroup.appendChild(btn);
    });
    sweetSec.appendChild(sweetGroup);
    container.appendChild(sweetSec);
  }
  
  const toppings = product.customOptions.filter(o => o.type === 'TOPPING');
  if (toppings.length > 0) {
    const topSec = document.createElement('div');
    topSec.className = 'custom-section';
    topSec.innerHTML = `<div class="custom-section-title">加料 <span>可複選</span></div>`;
    const topGroup = document.createElement('div');
    topGroup.className = 'option-group';
    
    toppings.forEach(top => {
      const isSelected = activeCustomization.toppings.includes(top.name);
      const btn = document.createElement('button');
      btn.className = `option-btn ${isSelected ? 'selected' : ''}`;
      btn.innerText = `${top.name} (+$${top.extraPrice})`;
      btn.onclick = () => {
        const idx = activeCustomization.toppings.indexOf(top.name);
        if (idx > -1) {
          activeCustomization.toppings.splice(idx, 1);
          btn.classList.remove('selected');
        } else {
          activeCustomization.toppings.push(top.name);
          btn.classList.add('selected');
        }
        updateModalPrice();
      };
      topGroup.appendChild(btn);
    });
    topSec.appendChild(topGroup);
    container.appendChild(topSec);
  }
}

function updateModalPrice() {
  if (!selectedProduct) return;
  
  let unitPrice = selectedProduct.basePrice;
  
  const sizeOption = selectedProduct.customOptions.find(o => o.type === 'SIZE' && o.name === activeCustomization.size);
  if (sizeOption) unitPrice += sizeOption.extraPrice;
  
  activeCustomization.toppings.forEach(topName => {
    const topOption = selectedProduct.customOptions.find(o => o.type === 'TOPPING' && o.name === topName);
    if (topOption) unitPrice += topOption.extraPrice;
  });
  
  const totalPrice = unitPrice * modalQty;
  document.getElementById('modal-qty-text').innerText = modalQty;
  document.getElementById('modal-total-price').innerText = `$${totalPrice}`;
}

function closeModal() {
  document.getElementById('custom-modal').classList.remove('active');
  selectedProduct = null;
}

// 飲料數量變更
function changeModalQty(change) {
  modalQty = Math.max(1, modalQty + change);
  updateModalPrice();
}

// 確定加入購物車 (發送點餐) - 含防重複點擊保護
async function addSelectedToCart() {
  if (!selectedProduct) return;
  
  const addBtn = document.getElementById('modal-add-btn');
  if (addBtn.disabled) return; // 防止重複點擊
  addBtn.disabled = true;
  addBtn.innerText = '加入中...';
  
  const payload = {
    groupId: currentGroupId,
    userId: currentUserId,
    userName: window.currentUserName || "主揪",
    productId: selectedProduct.id,
    size: activeCustomization.size,
    ice: activeCustomization.ice,
    sweetness: activeCustomization.sweetness,
    toppings: activeCustomization.toppings || [],
    quantity: modalQty
  };
  
  try {
    const res = await apiFetch('/api/carts/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (res.ok) {
      await syncWithBackend();
      closeModal();
      showToast(`🛒 已將 ${selectedProduct.name} 加入您的購物車！`);
    } else {
      showToast(`⚠️ 加入失敗: ${data.error}`);
      addBtn.disabled = false;
      addBtn.innerText = '加入購物車';
    }
  } catch (err) {
    showToast("❌ 連線後端錯誤！");
    addBtn.disabled = false;
    addBtn.innerText = '加入購物車';
  }
}

async function removeFromCart(itemId) {
  try {
    const res = await apiFetch('/api/carts/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: currentGroupId,
        userId: currentUserId,
        itemId: itemId
      })
    });
    
    if (res.ok) {
      await syncWithBackend();
      showToast("🗑️ 已從購物車移除品項");
    } else {
      const data = await res.json();
      showToast(`⚠️ 移除失敗: ${data.error}`);
    }
  } catch (err) {
    showToast("❌ 連線錯誤！");
  }
}

async function submitCart() {
  try {
    const res = await apiFetch('/api/carts/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: currentGroupId,
        userId: currentUserId
      })
    });
    
    if (res.ok) {
      await syncWithBackend();
      showToast("🔒 您的餐點已提交，購物車已鎖定！");
    } else {
      const data = await res.json();
      showToast(`⚠️ 提交失敗: ${data.error}`);
    }
  } catch (err) {
    showToast("❌ 連線錯誤！");
  }
}

async function unlockCart() {
  try {
    const res = await apiFetch('/api/carts/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: currentGroupId,
        userId: currentUserId
      })
    });
    
    if (res.ok) {
      await syncWithBackend();
      showToast("🔓 購物車已解鎖，您可以修改餐點。");
    } else {
      const data = await res.json();
      showToast(`⚠️ 解鎖失敗: ${data.error}`);
    }
  } catch (err) {
    showToast("❌ 連線錯誤！");
  }
}

// 點擊「加入房間」：向後端正式發起註冊 API
async function joinGroupRoom() {
  const nameInput = document.getElementById('join-name-input');
  const name = nameInput.value.trim();
  
  if (!name) {
    showToast("⚠️ 請輸入名字以加入揪團！");
    return;
  }
  
  try {
    const res = await apiFetch(`/api/groups/${currentGroupId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        userName: name
      })
    });
    
    if (res.ok) {
      window.currentUserName = name;
      sessionStorage.setItem('user_name', name);
      
      // 註冊成功，同步後端並正式渲染房間
      await syncWithBackend();
      showToast(`👋 歡迎 ${name}！您已成功加入房間。`);
    } else {
      const data = await res.json();
      showToast(`❌ 加入失敗: ${data.error}`);
    }
  } catch (err) {
    showToast("❌ 連線後端錯誤！");
  }
}

// ==========================================
// 5. 輔助與除錯控制
// ==========================================

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function copyShareLink() {
  const text = document.getElementById('share-link-display').innerText;
  if (text.startsWith("http")) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("📋 團購分享連結已複製到剪貼簿，快傳給朋友吧！");
    }).catch(err => {
      showToast("無法複製，請手動複製網址列。");
    });
  } else {
    showToast("⚠️ 目前尚未開團，點擊「分享點餐」將自動開團！");
  }
}

function renderSimBar() {
  // 多角色模擬控制列已移除
}

async function shareParty() {
  if (!currentGroupId) return;
  
  // 1. 如果是 private，先開啟揪團 (轉為 active)
  if (backendGroupData && backendGroupData.status === 'private') {
    try {
      const res = await apiFetch(`/api/groups/${currentGroupId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus: 'active' })
      });
      
      if (res.ok) {
        await syncWithBackend();
        showToast("🚀 已為您自動開啟揪團房間！");
      } else {
        const data = await res.json();
        showToast(`❌ 開團失敗: ${data.error}`);
        return;
      }
    } catch (err) {
      showToast("❌ 連線錯誤！");
      return;
    }
  }
  
  // 2. 複製分享連結
  const shareLink = `${window.location.origin}/join.html?groupId=${currentGroupId}`;
  navigator.clipboard.writeText(shareLink).then(() => {
    showToast("📋 團購分享連結已複製到剪貼簿，快傳給朋友吧！");
  }).catch(err => {
    console.error("無法複製:", err);
    showToast("⚠️ 瀏覽器限制，請手動選取複製連結。");
  });
}

function resetSystem() {
  sessionStorage.removeItem('user_name');
  initUser();
  clearRoute();
}

function renderDBViewer() {
  const dbContent = document.getElementById('db-content');
  if (dbContent) {
    const dataStream = {
      roomMetadata: backendGroupData,
      allCartsInRoom: backendGroupCarts,
      myCurrentCart: backendMyCart
    };
    dbContent.innerText = JSON.stringify(dataStream, null, 2);
  }
}

function toggleDBViewer() {
  const viewer = document.getElementById('db-viewer');
  const indicator = document.getElementById('db-indicator');
  
  if (viewer.classList.contains('expanded')) {
    viewer.classList.remove('expanded');
    indicator.innerText = '展開檢視 ▴';
  } else {
    viewer.classList.add('expanded');
    indicator.innerText = '收合檢視 ▾';
  }
}

// ==========================================
// 6. 事件監聽
// ==========================================
function setupEventListeners() {
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  
  document.getElementById('btn-qty-minus').addEventListener('click', () => changeModalQty(-1));
  document.getElementById('btn-qty-plus').addEventListener('click', () => changeModalQty(1));
  
  document.getElementById('modal-add-btn').addEventListener('click', addSelectedToCart);
  
  const btnJoin = document.getElementById('btn-join-room');
  if (btnJoin) {
    btnJoin.addEventListener('click', joinGroupRoom);
  }
  
  const btnSubmitCart = document.getElementById('btn-submit-cart');
  if (btnSubmitCart) {
    btnSubmitCart.addEventListener('click', submitCart);
  }
  
  const btnCopy = document.getElementById('btn-copy-link');
  if (btnCopy) {
    btnCopy.addEventListener('click', copyShareLink);
  }

  const btnShareParty = document.getElementById('btn-share-party');
  if (btnShareParty) {
    btnShareParty.addEventListener('click', shareParty);
  }
  
  document.getElementById('logo-title').addEventListener('click', () => {
    if (confirm("要返回首頁嗎？目前的揪團仍會保留在後端資料庫中。")) {
      clearRoute();
    }
  });
}
