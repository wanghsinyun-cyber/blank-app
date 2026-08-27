/* ==========================================================================
   KAIROS — Firebase 專案設定
   專案：eternal-wavelet-460814-h2（My First Project，隸屬 nycu.edu.tw 組織）
   方案：Spark（免費）
   Firestore 位置：asia-east1（台灣）— 此設定永久不可變更
   Auth：電子郵件／密碼（已啟用）
   Web SDK：12.18.0（gstatic CDN）

   關於 apiKey：Firebase 的網頁 apiKey **設計上就是公開的**，它只用來辨識專案，
   不授予任何資料存取權限。真正的存取控制在 Firestore 安全性規則與 Auth。
   因此這個檔案可以安全進版控。

   仍建議做的一件事：到 Google Cloud Console → API 和服務 → 憑證，
   為這把金鑰加上「HTTP 參照網址」限制（只允許 wanghsinyun-cyber.github.io
   與 localhost），避免別人拿去消耗你的配額。
   ========================================================================== */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAhEXNbxaUYtc__a_onBS2lPYm0psrtNck",
  authDomain: "eternal-wavelet-460814-h2.firebaseapp.com",
  projectId: "eternal-wavelet-460814-h2",
  storageBucket: "eternal-wavelet-460814-h2.firebasestorage.app",
  messagingSenderId: "197312886461",
  appId: "1:197312886461:web:a0f144451c868e90e8e9d4",
  measurementId: "G-5LQFC8S4CW"
};

/* Firebase Web SDK 的 ES module 進入點（不需要打包工具） */
const FIREBASE_SDK = {
  version: "12.18.0",
  app:       "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js",
  auth:      "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js",
  firestore: "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"
};

/* 已授權網域（Authentication → 設定 → 已授權網域）目前為：
     localhost                                   Default
     eternal-wavelet-460814-h2.firebaseapp.com   Default
     eternal-wavelet-460814-h2.web.app           Default
     wanghsinyun-cyber.github.io                 Custom   ← 2026-08-27 已加入
   線上版（GitHub Pages）的登入因此可以正常運作。                            */
