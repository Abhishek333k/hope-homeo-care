import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyAVZHO-avENaKejMjAUexsaem-Dusljvzo",
  authDomain: "hope-homeo-care.firebaseapp.com",
  projectId: "hope-homeo-care",
  storageBucket: "hope-homeo-care.firebasestorage.app",
  messagingSenderId: "962992614809",
  appId: "1:962992614809:web:8d61d27c8881588c59f708"
};

// Refactored initialization to prevent HMR crashes during development/hot-reloading
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// 🛠️ THE FIX: Automatically trigger Debug Mode if running on local computer
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    console.log("🛠️ Local Development detected: Forcing App Check Debug Mode.");
}

// Initialize App Check AFTER the debug token is set
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider('6LfeauEsAAAAAINbj29w7QYks4oofV1CzV_MLOxZ'),
  isTokenAutoRefreshEnabled: true 
});

// Set language to default to the user's device
auth.useDeviceLanguage();

export { app, auth, db, appCheck };

