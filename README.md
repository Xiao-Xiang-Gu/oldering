# 🌌 星空茶會 Starry Tea Party

> **多人即時線上飲料揪團點餐系統**  
> 本專案為基於 **Java (Spring Boot) + H2 Database** 的後端，結合 **Vanilla HTML / CSS / JS** 的輕量且現代化 Web 應用程式。支援多人跨分頁、跨裝置即時同步，並具備豐富的防呆與安全防禦設計。

---

## 🛠️ 技術棧與系統架構 (Tech Stack)

### 後端技術 (Backend)
* **核心框架**：Spring Boot 3.5.4
* **資料庫**：H2 Database (採用檔案持久化模式，路徑設定於 `./data/drinkdb`)
* **持久層框架**：Spring Data JPA + Hibernate
* **快取管理**：Spring Cache (用於最佳化店家與菜單資料的實時查詢)
* **排程任務**：Spring Scheduler (負責背景自動推進訂單外送狀態)

### 前端技術 (Frontend)
* **架構**：Vanilla HTML5 & CSS3
* **邏輯與通訊**：Vanilla Javascript (ES6+)，採用非同步 `fetch` API 進行短輪詢與後端同步。
* **身分管理**：`sessionStorage` (實現同瀏覽器不同分頁的身分隔離測試)

---

## 📁 專案目錄結構 (Project Directory)

```text
├── .git/                  # Git 版本控制目錄
├── .gitignore             # 忽略提交清單
├── pom.xml                # Maven 依賴與建置設定
├── README.md              # 專案說明文件 (您正在閱讀的文件)
├── data/                  # 本地 H2 資料庫檔案儲存區
│   └── drinkdb.mv.db      # H2 資料庫持久化實體檔案
└── src/
    └── main/
        ├── java/com/example/drinkparty/
        │   ├── DrinkPartyApplication.java       # 專案啟動入口
        │   ├── config/
        │   │   └── DataInitializer.java         # 資料庫預載資料 (店家與菜單初始化)
        │   ├── controller/                      # RESTful API 控制層
        │   │   ├── CartController.java          # 購物車相關 API (新增/移除/提交)
        │   │   ├── GroupOrderController.java    # 揪團房間 API (開團/加入/狀態流轉)
        │   │   └── StoreController.java         # 店家與菜單 API
        │   ├── exception/
        │   │   └── SecurityAccessDeniedException.java # 安全性異常定義
        │   ├── model/                           # JPA 實體層 (Entity Models)
        │   │   ├── Store.java / Product.java / CustomOption.java
        │   │   ├── GroupOrder.java / UserCart.java / CartItem.java / CartTopping.java
        │   ├── repository/                      # 數據庫持久持久層 (Spring Data JPA)
        │   └── service/                         # 核心業務邏輯服務層
        │       ├── CartService.java / GroupOrderService.java
        │       └── OrderStatusScheduler.java    # 背景排程狀態更新器
        └── resources/
            ├── application.properties           # 系統全域設定檔 (H2 Console, 埠號等)
            └── static/                          # 前端網頁靜態資源
                ├── index.html                   # 主揪端 / 店家大廳首頁
                ├── join.html                    # 跟團者點餐頁面
                ├── app.js                       # 主揪端前端互動邏輯
                ├── join.js                      # 跟團端前端互動邏輯
                └── style.css                    # 系統全域樣式表 (星空主題 UI)
```

---

## 🚀 系統核心功能與進度 (Core Features)

1. **探索店家與發起揪團**：
   * 大廳提供合作店家列表與詳細菜單，飲料外送低消門檻**統一修改為 200 元**。
   * **發起即開團流程**：主揪發起後房間狀態直接為 `active`（已開團/點餐中），直接開放並顯示複製跟團分享連結。

2. **跟團者自動加入與身分隔離**：
   * 跟團者透過分享連結進入後，系統會自動分配隨機匿名與獨立 `user_id` 靜默加入房間。
   * 使用 **`sessionStorage`** 保存身分，實現**「同瀏覽器、不同分頁」相互獨立**。方便在單台電腦開啟多個 Tab 模擬多人（跟團者 A、B、C）點餐。
   * 權限隔離：跟團者只能點餐並修改/刪除自己購物車的品項；只有主揪能在大總覽進行全局管理。

3. **外送運費階梯式計算**：
   * 運費依據店家距離（`distance`）階梯式計算：
     * 2 公里內：20 元
     * 2 到 3 公里：30 元
     * 超過 3 公里：每加 1 公里多 5 元。

4. **未達低消自動補差額機制**：
   * 若商品小計未滿 $200 低消門檻，大總覽（主揪與跟團者端）會自動顯示「未達低消差額補貼」列，並自動補足差額至實付總計中，防止被店家退單。

5. **後台狀態自動流轉**：
   * 訂單送出後，後台排程器（Scheduler）每 15 秒會自動在背景推進狀態：`processing` (製作中) $\rightarrow$ `delivering` (外送中) $\rightarrow$ `completed` (已完成)，無須人工點擊。

6. **商品限量庫存扣除閉環**：
   * 針對限量商品（如楊枝甘露限 5 杯），在點餐加入購物車時會安全扣除庫存，若刪除商品或解鎖修改則自動返還。

---

## 🔒 安全性與防禦性設計 (Security)

1. **🚫 越權訪問防禦 (BOLA / IDOR)**：
   * 後端實作 `X-User-Id` Header 權限查驗。
   * 跟團者只能讀取/修改自己的購物車。
   * 大總覽數據僅在房間 `status !== 'active'`（結單後）才對跟團者開放。
   * 只有房間發起人（主揪）擁有全局管理與成員購物車代操作（提交/解鎖/刪除）權限。

2. **👥 LocalStorage 改為 SessionStorage**：
   * 解決了同瀏覽器分頁測試時 `user_id` 覆蓋與購物車衝突的問題。

3. **⚠️ 語法崩潰排錯**：
   * 修正了跟團端 `join.js` 因多出右花括號 `}` 造成的 SyntaxError，確保頁面載入穩定。

---

## 💾 本地資料庫配置與除錯 (H2 Console)

本專案啟用 H2 Database 的 Web 管理控制台，方便在開發時直接進入資料庫查表。

* **H2-Console 路徑**：`http://localhost:8080/h2-console`
* **資料庫連結設定**：
  * **JDBC URL**：`jdbc:h2:file:./data/drinkdb`
  * **User Name**：`sa`
  * **Password**：*(空白，不需輸入)*

---

## 📊 主要 API 設計概覽 (API Endpoints)

### 店家模組 (Stores)
* `GET /api/stores` - 獲取所有店家及其菜單 (支援 Spring Cache)

### 揪團模組 (Groups)
* `POST /api/groups/start` - 發起揪團房間
* `GET /api/groups/{groupId}` - 獲取特定房間的基礎資訊 (店家、狀態、主揪名)
* `POST /api/groups/{groupId}/join` - 跟團者加入房間
* `GET /api/groups/{groupId}/carts` - 獲取該房所有人的購物車 (需 `X-User-Id` Header 權限驗證)
* `POST /api/groups/{groupId}/status` - 截止揪團或送出訂單 (限主揪操作，需 `X-User-Id` Header 驗證)

### 購物車模組 (Carts)
* `GET /api/carts/{groupId}/{userId}` - 獲取個人的購物車明細 (需 `X-User-Id` 驗證)
* `POST /api/carts/add` - 點餐加入購物車 (含後端計價安全校驗與限量扣除庫存)
* `POST /api/carts/remove` - 從個人購物車中移除品項
* `POST /api/carts/submit` - 跟團者提交並鎖定購物車

---

## 🔮 未來展望與擴充方向

1. **💰 運費/低消差額自動平攤計算器**：在結單時，大總覽自動根據「已提交購物車的人數」將運費與差額平攤至各團員明細，並顯示個人應付金額與收款 QR Code。
2. **⚡ 即時 WebSockets / SSE 同步**：引入 WebSocket 或 Server-Sent Events (SSE) 取代目前的短輪詢，實現秒級同步並降低伺服器負載。
3. **📅 店家營業時間限制**：在資料庫中增加店家營業時間段設定，或對特定商品增加「已售完」切換開關，前端菜單即時呈現售罄狀態且不允許點餐。
4. **💳 金流支付 API 整合**：串接綠界科技（ECPay）或 LINE Pay API，讓跟團者直接在跟團網頁完成付款。

---

## 🛠️ 本地啟動與開發指引

1. **運行後端**：
   ```bash
   mvn spring-boot:run
   ```
2. **訪問系統**：
   * 主揪端 / 首頁：`http://localhost:8080/index.html`
   * 分享給局域網他人（同 Wi-Fi）：請用 `ipconfig` 取得您電腦的 IPv4 地址，讓他人透過 `http://<您的IP>:8080/join.html?groupId=G-xxxx` 訪問。
