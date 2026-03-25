import React, { useEffect, useState } from "react";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { LoadingProgress } from "@/page/loading";
import { LocalizationProvider } from "@mui/x-date-pickers";
import "react-toastify/dist/ReactToastify.css";
import { DialogView } from "./components/dialog";
import { ToastView } from "./components/toast";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBOpDK7WKkfK6rABkuVvLMqMgLAJXmtQII",
  authDomain: "cms-seller-product.firebaseapp.com",
  projectId: "cms-seller-product",
  storageBucket: "cms-seller-product.firebasestorage.app",
  messagingSenderId: "1084607472094",
  appId: "1:1084607472094:web:4da4e1035349c69fe03d4f",
  measurementId: "G-DLL02PFHHP",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

const App: React.FC = () => {
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  if (!isAuthReady) {
    return (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <LoadingProgress />
      </LocalizationProvider>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <RouterProvider router={router} />
      <LoadingProgress />
      <DialogView />
      <ToastView />
    </LocalizationProvider>
  );
};

export default App;