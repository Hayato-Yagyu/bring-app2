import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"
import { getAuth } from 'firebase/auth';
import { getStorage } from "firebase/storage";



const firebaseConfig = {
  apiKey: "AIzaSyCwyAGeMfaw5ZiwNBtkwZ4-vBsUC4w2iUM",
  authDomain: "react-post-app-f1d28.firebaseapp.com",
  projectId: "react-post-app-f1d28",
  storageBucket: "react-post-app-f1d28.appspot.com",
  messagingSenderId: "594602312298",
  appId: "1:594602312298:web:e1de05b4df3ddecfaa8013",
  measurementId: "G-QFYGQ5L253"
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const db = getFirestore(app);


