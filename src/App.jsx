import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UAVDetections from "./pages/UAVDetections";
import FarmMap from "./pages/FarmMap";
import Farmers from "./pages/Farmers";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Live from "./pages/Live";
import api, { logout } from "./services/api";

const pageTitles = {
  "/":              "Dashboard",
  "/detections":    "UAV Detections",
  "/live":          "Live Drone Feed",
  "/map":           "Farm Map",
  "/farmers":       "Farmers",
  "/notifications": "Notifications",
  "/settings":      "Settings",
};

function Layout({ admin, onLogout, onAdminUpdate }) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "BananaGuard AI";

  return (
    <div className="flex min-h-screen bg-offwhite">
      <Sidebar admin={admin} onLogout={onLogout} />
      <div className="ml-60 flex-1 flex flex-col min-h-screen">
        <Navbar title={title} />
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/detections"    element={<UAVDetections />} />
            <Route path="/live"          element={<Live />} />
            <Route path="/map"           element={<FarmMap />} />
            <Route path="/farmers"       element={<Farmers />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings"      element={<Settings admin={admin} onLogout={onLogout} onAdminUpdate={onAdminUpdate} />} />
            <Route path="*"              element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));
  const [admin, setAdmin] = useState(null);

  // Fetch admin info when logged in
  useEffect(() => {
    if (isLoggedIn) {
      api.get("/auth/me")
        .then(({ data }) => setAdmin(data))
        .catch(() => {
          // token invalid — log out
          logout();
          setIsLoggedIn(false);
        });
    }
  }, [isLoggedIn]);

  function handleLogin() {
    setIsLoggedIn(true);
  }

  function handleLogout() {
    setAdmin(null);
    setIsLoggedIn(false);
    logout();
  }

  return (
    <BrowserRouter>
      {!isLoggedIn ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Layout admin={admin} onLogout={handleLogout} onAdminUpdate={setAdmin} />
      )}
    </BrowserRouter>
  );
}