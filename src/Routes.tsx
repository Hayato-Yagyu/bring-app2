// src/Routes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import React, { useEffect, ReactNode  } from 'react';
import App from "./App"
import Auth from "./Auth"
import NewPost from "./components/NewPost"
import BringList from "./components/BringList"
import { UserProvider, useUser  } from './components/UserContext';
import { auth } from './firebase';




export const AppRoutes = () => {
    return (
        <UserProvider> 
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/Auth" element={<Auth />} />
            <Route path="/NewPost" element={<NewPost />} />
            <Route path="/BringList" element={<PrivateRoute><BringList /></PrivateRoute>} />
          </Routes>
        </UserProvider>
    )
}
interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user } = useUser();

  return user ? <>{children}</> : <Navigate to="/" />;
};
