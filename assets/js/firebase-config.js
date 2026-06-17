// assets/js/firebase-config.js
// Firebase SDK แบบ Modular (ES Modules)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Config ของโปรเจกต์
export const firebaseConfig = {
  apiKey: "AIzaSyD6KySxJ_tPDKG-dOnmbUd3npnoIyVxOEA",
  authDomain: "it-information-3c4aa.firebaseapp.com",
  projectId: "it-information-3c4aa",
  storageBucket: "it-information-3c4aa.firebasestorage.app",
  messagingSenderId: "290860273066",
  appId: "1:290860273066:web:e45409cf15f33553792fd3",
  measurementId: "G-RBGPQPS9K7"
};

// กัน initializeApp ซ้ำ กรณีกลับหน้า/โหลดซ้ำ
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
