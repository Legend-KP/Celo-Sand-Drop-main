// src/lib/firebase.ts

import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getDatabase } from "firebase/database";

let app: any = null;
let db: any = null;
let auth: any = null;
let authReady: Promise<void> | null = null;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBLlPjjvPFVaKOQlNBPkBH8l-P_7ZgtE1I",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sand-drop-minipay.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sand-drop-minipay",
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    "https://sand-drop-minipay-default-rtdb.firebaseio.com/",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sand-drop-minipay.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "639826879545",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:639826879545:web:70e91fdf58723836a819e8",
};

// Function-based init (NOT auto-run)
export function initFirebase() {
  if (typeof window === "undefined") return;

  if (app) return; // already initialized

  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  db = getDatabase(app, firebaseConfig.databaseURL);
  auth = getAuth(app);

  let resolveAuthReady!: () => void;

  authReady = new Promise<void>((resolve) => {
    resolveAuthReady = resolve;
  });

  signInAnonymously(auth).catch((error) => {
    console.error("Firebase anonymous auth failed:", error);
    resolveAuthReady();
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Firebase Ready:", user.uid);
      resolveAuthReady();
    }
  });
}

// getters (safe)
export function getFirebase() {
  return { app, db, auth, authReady };
}
