// src/Routes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import React, { ReactNode } from "react";
import App from "./App";
import BringList from "./components/BringList";
import { UserProvider, useUser } from "./components/UserContext";
import AuthRoute from "./routes/AuthRoute";
import UsersManagement from "./components/UsersManagement";
import EquipmentManagement from "./components/EquipmentManagement";

export const AppRoutes = () => {
  return (
    <UserProvider>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/Auth" element={<AuthRoute />} />
        <Route path="/users" element={<UsersManagement />} />
        <Route path="/equipment" element={<EquipmentManagement />} />
        <Route
          path="/BringList"
          element={
            <PrivateRoute>
              <BringList />
            </PrivateRoute>
          }
        />
      </Routes>
    </UserProvider>
  );
};
interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user } = useUser();

  return user ? <>{children}</> : <Navigate to="/" />;
};
