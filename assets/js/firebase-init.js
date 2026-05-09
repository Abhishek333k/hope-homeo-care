import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app-check.js";

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

// --- APP CHECK INITIALIZATION ---
// Note: You must replace 'YOUR_RECAPTCHA_SITE_KEY' with the key from your Firebase Console
// Path: Project Settings -> App Check -> Apps -> Choose your app -> Register/Manage
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6Lcw_ZsqAAAAAH02a3P6iXF_LgD7R1z1K3hD_lB1'), // Using default/placeholder for now
  isTokenAutoRefreshEnabled: true
});

// Set language to default to the user's device
auth.useDeviceLanguage();

export { app, auth, db, appCheck };

