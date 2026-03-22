import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBOpDK7WKkfK6rABkuVvLMqMgLAJXmtQII",
  authDomain: "cms-seller-product.firebaseapp.com",
  projectId: "cms-seller-product",
  storageBucket: "cms-seller-product.firebasestorage.app",
  messagingSenderId: "1084607472094",
  appId: "1:1084607472094:web:4da4e1035349c69fe03d4f",
  measurementId: "G-DLL02PFHHP"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
