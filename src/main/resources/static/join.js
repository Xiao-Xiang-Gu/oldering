// 飲料揪團點餐系統 - 跟團者專屬 UI 渲染與 API 串接邏輯

// ==========================================
// 1. 全域變數與初始化
// ==========================================
let STORES = []; 
let currentGroupId = null;
let currentUserId = null;
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

// 自定義 API Fetch 封裝：自動在 Headers 中攜帶 X-User-Id
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
  // 跟團者頁面要避免使用主揪或舊模擬的硬寫 ID
  if (!userId || userId === 'user-initiator' || userId === 'user-joiner-a' || userId === 'user-joiner-b') {
    userId = 'U-' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('user_id', userId);
    sessionStorage.removeItem('user_name');
  }
  currentUserId = userId;
  
  let userName = sessionStorage.getItem('user_name');
  if (!userName || userName === '主揪' || userName === '主揪 (我)') {
    // 自動產生隨機匿名，落實「無手動輸入姓名加入」
    userName = '跟團者_' + Math.floor(1000 + Math.random() * 9000);
    sessionStorage.setItem('user_name', userName);
  }
  window.currentUserName = userName;
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
  
  if (!groupId) {
    showToast("⚠️ 未指定揪團房間，返回大廳。");
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
    return;
  }
  
  currentGroupId = groupId;
  await syncWithBackend();
  startPolling();
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

// 與後端安全同步
let isJoiningRoom = false;
let joinRoomFailed = false;

async function syncWithBackend() {
  if (!currentGroupId) return;
  if (joinRoomFailed) {
    // 若已確定加入失敗（例如已截止），則停止輪詢不再存取
    stopPolling();
    return;
  }
  
  try {
    // 1. 公共資訊：確認房間與店家
    const groupRes = await apiFetch(`/api/groups/${currentGroupId}`);
    if (!groupRes.ok) {
      if (groupRes.status === 404) {
        showToast("⚠️ 房間不存在，即將返回大廳。");
        stopPolling();
        setTimeout(() => { window.location.href = 'index.html'; }, 2000);
      }
      return;
    }
    backendGroupData = await groupRes.json();

    // 已經開團 (active 或其他狀態)，隱藏未開團遮罩
    document.getElementById('private-lock-overlay').style.display = 'none';
    document.getElementById('room-section').style.display = 'block';

    // 3. 拉取大總覽 (若 403 則代表未加入，自動加入)
    const cartsRes = await apiFetch(`/api/groups/${currentGroupId}/carts`);
    
    if (cartsRes.status === 403) {
      // ⚠️ 403 Forbidden: 代表未加入！自動進行靜默加入
      if (!isJoiningRoom) {
        isJoiningRoom = true;
        autoJoinRoom(); // 非同步呼叫，避免同步阻塞與遞迴
      }
      return;
    }
    
    if (cartsRes.ok) backendGroupCarts = await cartsRes.json();
    
    // 4. 拉取個人購物車
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

// 靜默自動加入揪團房間 (含重試機制)
async function autoJoinRoom(retryCount = 0) {
  const MAX_RETRIES = 3;
  try {
    const res = await apiFetch(`/api/groups/${currentGroupId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        userName: window.currentUserName
      })
    });
    
    if (res.ok) {
      isJoiningRoom = false;
      showToast(`👋 歡迎加入！系統已為您自動註冊為：${window.currentUserName}`);
      // 成功後非同步觸發一次同步以更新頁面，不在此處進行同步等待 (避免 pending 狀態被阻塞)
      setTimeout(syncWithBackend, 100);
    } else {
      const data = await res.json();
      if (retryCount < MAX_RETRIES) {
        // 失敗後等待 1 秒重試
        setTimeout(() => autoJoinRoom(retryCount + 1), 1000);
      } else {
        isJoiningRoom = false;
        joinRoomFailed = true; // 標記加入失敗，終止後續輪詢
        showToast(`❌ 自動加入失敗: ${data.error}`);
        renderJoinFailed(data.error);
      }
    }
  } catch (err) {
    if (retryCount < MAX_RETRIES) {
      setTimeout(() => autoJoinRoom(retryCount + 1), 1000);
    } else {
      isJoiningRoom = false;
      joinRoomFailed = true;
      showToast("❌ 無法與伺服器建立連接！");
      renderJoinFailed("無法與伺服器建立連接");
    }
  }
}

// 渲染加入失敗之友善提示 UI
function renderJoinFailed(errorMsg) {
  document.getElementById('private-lock-overlay').style.display = 'block';
  document.getElementById('room-section').style.display = 'none';
  
  const lockTitle = document.querySelector('#private-lock-overlay h2');
  if (lockTitle) lockTitle.innerText = "無法加入此揪團房間";
  
  const lockDesc = document.querySelector('#private-lock-overlay p');
  if (lockDesc) lockDesc.innerText = `原因：${errorMsg}。如果您是在主揪截止點餐後才嘗試加入，將無法再參與本次點餐。`;
  
  const lockSvg = document.querySelector('#private-lock-overlay div');
  if (lockSvg) lockSvg.innerHTML = "❌";
}


// 更新暱稱
async function updateNickname() {
  const nameInput = document.getElementById('my-name-input');
  const name = nameInput.value.trim();
  
  if (!name) {
    showToast("⚠️ 請輸入名字！");
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
      await syncWithBackend();
      showToast(`✅ 暱稱已成功更新為：${name}`);
    } else {
      const data = await res.json();
      showToast(`❌ 更新失敗: ${data.error}`);
    }
  } catch (err) {
    showToast("❌ 連線後端錯誤！");
  }
}

// ==========================================
// 3. UI 渲染邏輯
// ==========================================

function renderPrivateLock() {
  document.getElementById('private-lock-overlay').style.display = 'block';
  document.getElementById('room-section').style.display = 'none';
  renderSimBar();
}

function renderRoom() {
  if (!backendGroupData) return;
  
  const store = STORES.find(s => s.id === backendGroupData.storeId);
  if (!store) return;
  
  document.getElementById('room-store-name').innerText = store.name;
  document.getElementById('room-id-text').innerText = `房間號：${backendGroupData.id}`;
  
  const shareLink = `${window.location.origin}/join.html?groupId=${backendGroupData.id}`;
  document.getElementById('share-link-display').innerText = shareLink;
  
  renderTimeline(backendGroupData.status);
  
  // 跟團者姓名輸入框初始化 (避免每次更新重新聚焦)
  const nameInput = document.getElementById('my-name-input');
  if (nameInput && document.activeElement !== nameInput && nameInput.value !== window.currentUserName) {
    nameInput.value = window.currentUserName;
  }
  
  renderMenu(store, backendGroupData.status);
  renderPersonalCart(backendMyCart, backendGroupData.status);
  renderMemberList(backendGroupCarts);
  renderProgressBar(backendGroupCarts, store);
  
  // 截止後 (Locked/Processing/Delivering/Completed) 可看總彙整明細
  const totalSummaryPanel = document.getElementById('total-summary-panel');
  if (backendGroupData.status !== 'active') {
    totalSummaryPanel.style.display = 'block';
    renderTotalSummary(backendGroupCarts, store, backendGroupData.status);
  } else {
    totalSummaryPanel.style.display = 'none';
  }
  
  renderSimBar();
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
    hintDisplay.innerHTML = `<span style="color:var(--accent);">🎉 已達外送門檻，可以通知主揪下單囉！</span>`;
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
      const canOrder = (status === 'active');
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
        ${status === 'active' && userCart.status === 'pending' ? `
          <button class="btn-danger btn-remove-cart" data-item-id="${item.id}">刪除</button>
        ` : ''}
      </div>
    `;
    
    if (status === 'active' && userCart.status === 'pending') {
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
        ${status === 'active' ? `
          <button class="btn-secondary" id="btn-unlock-cart" style="width:100%;">修改餐點 (解鎖)</button>
        ` : `<span style="color:var(--secondary); font-size:12px; font-weight:600;">揪團已截止，無法解鎖修改</span>`}
      </div>
    `;
    
    if (status === 'active') {
      document.getElementById('btn-unlock-cart').addEventListener('click', unlockCart);
    }
  } else {
    cartContent.style.display = 'block';
    lockedOverlay.style.display = 'none';
    submitBtn.disabled = false;
    
    if (status !== 'active') {
      submitBtn.disabled = true;
      submitBtn.innerText = "揪團已截止";
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
    
    const statusText = user.status === 'submitted' ? '已確認' : '點餐中';
    const statusClass = user.status === 'submitted' ? 'done' : 'pending';
    
    let label = "";
    if (user.userId === currentUserId) label += " (我)";
    if (user.userId === 'user-initiator') label += " [主揪]";
    
    el.innerHTML = `
      <div class="member-info">
        <span class="member-name">${user.userName}${label}</span>
        <span style="color:var(--text-muted); font-size:11px;">(${drinkCount} 杯)</span>
      </div>
      <span class="member-status ${statusClass}">${statusText}</span>
    `;
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
}

// ==========================================
// 4. 客製化 Modal & 購物車操作
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
    sweetSec.innerHTML = `<div class="custom-section-title">糖量甜度 <span>單選</span></div>`;
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

function changeModalQty(change) {
  modalQty = Math.max(1, modalQty + change);
  updateModalPrice();
}

async function addSelectedToCart() {
  if (!selectedProduct) return;
  
  const addBtn = document.getElementById('modal-add-btn');
  if (addBtn.disabled) return; // 防止重複點擊
  addBtn.disabled = true;
  addBtn.innerText = '加入中...';
  
  const payload = {
    groupId: currentGroupId,
    userId: currentUserId,
    userName: window.currentUserName || "跟團者",
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
  navigator.clipboard.writeText(text).then(() => {
    showToast("📋 揪團連結已複製到剪貼簿！");
  }).catch(err => {
    showToast("無法複製，請手動複製。");
  });
}

function renderSimBar() {
  // 模擬列已移除
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
  
  const btnSubmitCart = document.getElementById('btn-submit-cart');
  if (btnSubmitCart) {
    btnSubmitCart.addEventListener('click', submitCart);
  }
  
  const btnCopy = document.getElementById('btn-copy-link');
  if (btnCopy) {
    btnCopy.addEventListener('click', copyShareLink);
  }

  // 暱稱修改更新
  const btnUpdateName = document.getElementById('btn-update-name');
  if (btnUpdateName) {
    btnUpdateName.addEventListener('click', updateNickname);
  }

  // 點擊標題返回大廳 (挑選餐廳)
  const logoTitle = document.getElementById('logo-title');
  if (logoTitle) {
    logoTitle.style.cursor = 'pointer';
    logoTitle.addEventListener('click', () => {
      if (confirm("確認要離開此揪團點餐，返回首頁大廳重新挑選餐廳嗎？")) {
        window.location.href = 'index.html';
      }
    });
  }
}
