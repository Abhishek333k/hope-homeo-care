import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

// STRICT V3 IMPORT
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

// LOCAL DEV BYPASS
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// V3 PROVIDER ENFORCEMENT WITH NEW SITE KEY
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LfodbwsAAAAAIeocZ4hd28rL9bp7hZNaxaIi9Yu'),
  isTokenAutoRefreshEnabled: true 
});

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

auth.useDeviceLanguage();

export { app, auth, db, storage };
