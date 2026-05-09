import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
// IMPORT V3 PROVIDER
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyAVZHO-avENaKejMjAUexsaem-Dusljvzo",
  authDomain: "hope-homeo-care.firebaseapp.com",
  projectId: "hope-homeo-care",
  storageBucket: "hope-homeo-care.firebasestorage.app",
  messagingSenderId: "962992614809",
  appId: "1:962992614809:web:8d61d27c8881588c59f708"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 1. Set Debug Flag FIRST
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// 2. Initialize App Check SECOND (Must happen before Auth/Firestore)
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6Lcw_ZsqAAAAAH02a3P6iXF_LgD7R1z1K3hD_lB1'),
  isTokenAutoRefreshEnabled: true 
});

// 3. Initialize Auth & DB THIRD
const auth = getAuth(app);
const db = getFirestore(app);

auth.useDeviceLanguage();

export { app, auth, db };
