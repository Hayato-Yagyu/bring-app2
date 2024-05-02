// src/Routes.tsx
import { Routes, Route } from "react-router-dom";
import App from "./App"
import Auth from "./Auth"
import NewPost from "./components/NewPost"
import BringList from "./components/BringList"

export const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<App />} />
            <Route path="/Auth" element={<Auth />} />
            <Route path="/NewPost" element={<NewPost />} />
            <Route path="/BringList" element={<BringList />} />
            
        </Routes>
    )
}