# 專案設定與除錯進度總結

這份文件旨在記錄我們對 `cave-story-web` 專案進行除錯和設定的完整流程。

### 初始狀態

*   **專案目標**：讓網頁版的《洞窟物語》能透過 Google Drive 進行雲端存檔。
*   **主要問題**：使用者登入 Google 帳號時，OAuth 流程因各種設定錯誤而失敗。

---

## 第一階段：本地端除錯 (Local Debugging)

### 步驟一：解決 `redirect_uri_mismatch` 錯誤

*   **問題**：Google OAuth 錯誤 `400: redirect_uri_mismatch`。
*   **原因**：執行應用的網址 (如 `http://localhost:8080`) 未被加入到 Google Cloud Console 的授權清單。
*   **解決**：指導使用者將本地開發網址加入到 OAuth Client ID 的「已授權的重新導向 URI」清單中。

### 步驟二：處理 `Cannot GET /oauth` 錯誤

*   **問題**：使用 `npx http-server` 測試時，從 Google 導向回 `/oauth` 路徑會出現 404 錯誤。
*   **原因**：靜態伺服器無法處理虛擬路徑。
*   **解決**：初步將 `redirect_uri` 改為 `location.origin`，讓其導向回首頁。

### 步驟三：建立後端伺服器以交換權杖 (Token)

*   **問題**：前端 JavaScript 無法安全地用 `code` 交換 `access_token`，因為這需要 `Client Secret`，而密鑰不能暴露在前端。
*   **解決**：
    1.  建立了一個 `server.js` 檔案，使用 Node.js 和 Express 框架處理 API 請求。
    2.  建立了 `.env` 檔案來安全地儲存 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`。
    3.  `server.js` 中包含了 `/google-login` (交換權杖) 和 `/oauth-refresh` (刷新權杖) 的端點。

### 步驟四：修正後端重新導向流程

*   **問題**：有了後端，但從 Google 登入後導向到 `.../oauth` 仍然失敗。
*   **解決**：
    1.  在 `server.js` 中新增 `GET /oauth` 路由，攔截來自 Google 的請求，然後將 `code` 作為查詢參數重新導向回前端首頁 (`/`)。
    2.  在 `.env` 中新增 `FRONTEND_ORIGIN` 變數，告知後端應將使用者導向到何處。

### 步驟五：統一 `redirect_uri`

*   **問題**：再次出現 `redirect_uri_mismatch`，以及權杖交換失敗 (`Login expired`)。
*   **原因**：前端請求 `code` 時使用的 `redirect_uri` (`.../oauth`) 與後端交換權杖時使用的 `redirect_uri` (`.../`) 不一致。
*   **解決**：修改 `server.js` 和 `cloudSaveSync.js`，確保在請求授權碼和交換權杖的兩個階段，傳遞給 Google 的 `redirect_uri` **完全相同**，均為 `.../oauth`。

### 步驟六：解決 `refresh_token` 遺失與後端 `fetch` 錯誤

*   **問題**：Google 不再發放 `refresh_token`；後端出現 `fetch is not a function` 錯誤。
*   **解決**：
    1.  指導使用者前往 Google 帳戶手動撤銷應用程式權限，以強制重新獲取 `refresh_token`。
    2.  透過 `npm install node-fetch@2` 將 `node-fetch` 套件降級到與 CommonJS (`require`) 語法相容的 v2 版本。

**本地端最終狀態**：所有 OAuth2 流程在本地端均已正常運作。

---

## 第二階段：準備 Cloudflare 部署

### 步驟七：支援本地與線上環境並存

*   **需求**：使用者希望在新增 Cloudflare 部署設定的同時，保留原有的本地端 `server.js` 測試環境。
*   **解決方案**：
    1.  **建立 Cloudflare Function**：
        *   建立了 `functions/api/[[path]].js` 檔案。
        *   將 `server.js` 中的所有 Express 路由邏輯 (GET `/oauth`, POST `/google-login`, POST `/oauth-refresh`) 轉譯成 Cloudflare Function 的 `onRequest` 格式。
        *   此 Function 從 `context.env` (由 Cloudflare 平台提供) 讀取環境變數。
    2.  **改造前端 `cloudSaveSync.js`**：
        *   在檔案開頭加入邏輯，透過 `location.hostname` 判斷當前是在 `localhost` 還是線上環境。
        *   根據環境動態設定 `apiPrefix` (本地為 `''`，線上為 `'/api'`) 和 `oauthRedirectPath` (本地為 `'/oauth'`，線上為 `'/api/oauth'`)。
        *   所有對後端的 `fetch` 請求和 `redirect_uri` 的產生，都使用上述動態變數，實現了單一程式碼庫支援雙環境。
    3.  **同步修改 `server.js`**：
        *   修改本地的 `server.js`，使其 `/google-login` 端點也從前端請求的查詢參數中直接讀取 `redirect_uri`，而不是依賴 `.env` 檔案。
        *   這使得本地伺服器和 Cloudflare Function 的行為完全一致，增強了系統的穩定性。

### 最終交付狀態

*   **程式碼**：已完成所有修改，專案現在既可以透過 `node server.js` 在本地執行，也可以直接推送到 GitHub 以部署到 Cloudflare Pages。
*   **文件**：已更新 `README.md`，包含最新的本地執行指南和詳細的 Cloudflare 部署步驟。
*   **下一步**：使用者只需將程式碼推送到 GitHub，並在 Cloudflare 儀表板上完成環境變數設定即可完成部署。