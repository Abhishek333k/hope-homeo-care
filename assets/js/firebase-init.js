import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAVZHO-avENaKejMjAUexsaem-Dusljvzo",
  authDomain: "hope-homeo-care.firebaseapp.com",
  projectId: "hope-homeo-care",
  storageBucket: "hope-homeo-care.firebasestorage.app",
  messagingSenderId: "962992614809",
  appId: "1:962992614809:web:8d61d27c8881588c59f708"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = typeof getAuth === "function" ? getAuth(app) : null;
const db = getFirestore(app);
const storage = getStorage(app);

if (auth) auth.useDeviceLanguage();

export { app, auth, db, storage };
