# Cave Story (洞窟物語) - Web Version

*(繁體中文與日本語說明位於文件底部)*
*(日本語と繁体字中国語の説明はファイルの末尾にあります)*

A web-based port of the classic indie game Cave Story, running directly in your browser.

**[>> Play the game here! <<](https://cave-story-web.pages.dev)**

## Features

*   **Play Instantly:** No installation required, runs on modern web browsers on desktop and mobile.
*   **Cloud Saves:** Log in with your Google Account to automatically sync your save files with Google Drive. Your progress can be continued across different devices.
*   **Keyboard and Touch Controls:** Supports both keyboard input for desktop and touch controls for mobile devices.

## Controls

### Keyboard Controls

The default keyboard controls are as follows. They can be changed in the in-game **Options** menu.

| Action          | Key         |
| --------------- | ----------- |
| Move            | Arrow Keys  |
| Jump            | `Z`         |
| Fire            | `X`         |
| Strafe          | `C`         |
| Previous Weapon | `A`         |
| Next Weapon     | `S`         |
| Inventory       | `Q`         |
| Map             | `W`         |
| Pause / Menu    | `Escape`    |

### Touch Controls (Mobile)

*   **Movement:** Use the virtual joystick on the left side of the screen.
*   **Jump/Fire:** Use the virtual buttons on the right side of the screen.
*   **Change Weapon:** Use the top-left area of the screen.

## How It Works

This project uses [NXEngine-evo](https://github.com/nxengine/nxengine-evo), a source-available clone of the Cave Story game engine, compiled to WebAssembly using [Emscripten](https://emscripten.org/).

Save files are stored locally in the browser's IndexedDB. The `cloudSaveSync.js` script handles the Google OAuth flow and synchronizes the save data to the user's personal Google Drive `appDataFolder`, which is a special folder that only this application can access.

## Local Development

To run this project on your local machine with the complete cloud sync functionality, you need to run both a frontend and a backend server.

### 1. Prerequisites

*   You must have [Node.js](https://nodejs.org/) installed.
*   A Google Client ID and Client Secret.

### 2. Setup

1.  **Install dependencies:** In the project's root directory, run the following command to install the necessary packages for the server:
    ```bash
    npm install
    ```
2.  **Configure credentials:** Create a file named `.env` in the root directory. Add your Google credentials and specify the local frontend origin:
    ```
    GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
    GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
    FRONTEND_ORIGIN=http://localhost:8080
    ```
3.  **Configure Google Cloud Console:** Ensure that `http://localhost:8080/oauth` is listed under "Authorized redirect URIs" for your OAuth 2.0 Client ID.

### 3. Running the Servers

You will need to open **two separate terminals** in the project's root directory.

**In Terminal 1 (Frontend):**

Start the frontend static server by running:
```bash
npx http-server -p 8080
```

**In Terminal 2 (Backend):**

Start the backend server by running:
```bash
node server.js
```
You should see a message like `Backend server listening on port 3000`.

### 4. Accessing the Game

Open your web browser and go to `http://localhost:8080`. The frontend will automatically connect to the backend running on port 3000.

Before logging in for the first time, it is recommended to go to your [Google Account Permissions](https://myaccount.google.com/permissions) and remove access for "cave-story-web" if it exists. This ensures you receive a new `refresh_token`.

---

## Deployment to Cloudflare Pages

This project is configured for easy deployment to [Cloudflare Pages](https://pages.cloudflare.com/).

### 1. Push to GitHub

Commit and push all your code to a GitHub repository. Cloudflare will automatically build and deploy upon detecting a new push.

### 2. Create a Cloudflare Pages Project

1.  Log in to your Cloudflare dashboard and create a new Pages project.
2.  Connect it to your GitHub repository.
3.  Use the "None" framework preset. No build command or output directory is needed.

### 3. Configure Environment Variables

This is the most critical step for the deployed version to work.

1.  In your Pages project, go to **Settings** > **Environment variables**.
2.  Under **Production**, add the following three variables:
    *   `GOOGLE_CLIENT_ID`: Your Google Client ID.
    *   `GOOGLE_CLIENT_SECRET`: Your Google Client Secret.
    *   `FRONTEND_ORIGIN`: Your full Cloudflare Pages URL (e.g., `https://cave-story-web.pages.dev`).

### 4. Update Google Cloud Console

1.  Go back to your Google Cloud Console's "Authorized redirect URIs".
2.  Add the Cloudflare redirect URI: `https://your-project-name.pages.dev/api/oauth` (replace `your-project-name.pages.dev` with your actual URL).

Once configured, the `functions/api/[[path]].js` file will be automatically detected and deployed as your backend API.

---
*This project is for educational and demonstration purposes. Cave Story (洞窟物語) is the property of its creator, Daisuke "Pixel" Amaya.*

---

## 語言 (Languages)

### 繁體中文 (Traditional Chinese)

這是一個經典獨立遊戲《洞窟物語》的網頁移植版，可直接在您的瀏覽器中執行。

**[>> 點此立即遊玩 <<](https://cave-story-web.pages.dev)**

#### 特色
*   **立即遊玩：** 無需安裝，可在桌機與行動裝置的現代瀏覽器上執行。
*   **雲端存檔：** 使用您的 Google 帳號登入，即可透過 Google Drive 自動同步您的存檔。您可以在不同裝置間接續您的遊戲進度。
*   **支援鍵盤與觸控：** 支援桌機的鍵盤輸入與行動裝置的觸控操作。

### 日本語 (Japanese)

クラシックなインディーゲーム「洞窟物語」のウェブ移植版で、ブラウザで直接プレイできます。

**[>> ここでゲームをプレイ <<](https://cave-story-web.pages.dev)**

#### 特徴
*   **すぐにプレイ：** インストール不要。デスクトップおよびモバイルのモダンブラウザで動作します。
*   **クラウドセーブ：** Googleアカウントでログインすると、Googleドライブ経由でセーブデータが自動的に同期されます。異なるデバイス間で進行状況を引き継ぐことができます。
*   **キーボード＆タッチ操作対応：** デスクトップ向けのキーボード入力と、モバイルデバイス向けのタッチ操作に対応しています。
