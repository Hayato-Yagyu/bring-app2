// src/lib/emailjs.ts
import emailjs from "@emailjs/browser";

// .env から読み込み
const PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;

// ← ここで確認用ログを出します
console.log("ENV PUBLIC KEY =", PUBLIC_KEY);

if (PUBLIC_KEY) {
  emailjs.init({ publicKey: PUBLIC_KEY });
  console.log("✅ EmailJS initialized with public key");
} else {
  console.warn("⚠️ EmailJS public key is not set. Check your .env file.");
}

export default emailjs;
