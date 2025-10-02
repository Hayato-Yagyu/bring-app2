// src/routes/AuthRoute.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import AuthDialog from "../components/AuthDialog";

const AuthRoute: React.FC = () => {
  const navigate = useNavigate();
  return (
    <AuthDialog
      open={true}
      onClose={() => navigate(-1)} // 背景では閉じないので、この明示ボタンで戻る
      onSuccess={() => navigate("/")}
    />
  );
};

export default AuthRoute;
