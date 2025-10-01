// src/index.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { AppRoutes } from "./Routes";
import { BrowserRouter } from "react-router-dom";

import emailjs from "@emailjs/browser";

// CRA では REACT_APP_* を使う
const EMAILJS_PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;

if (EMAILJS_PUBLIC_KEY) {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
} else {
  console.warn("[EmailJS] Public Key が見つかりません。環境変数 REACT_APP_EMAILJS_PUBLIC_KEY を設定してください。");
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>
);
