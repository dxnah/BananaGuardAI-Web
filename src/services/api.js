// src/services/api.js

import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://bananaguardai-backend-production.up.railway.app",
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// ── Attach access token to every request ──────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auto-refresh when access token expires ────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // FastAPI sends validation errors as a list; turn it into one readable sentence
    const detail = error.response?.data?.detail;
    if (Array.isArray(detail)) {
      error.response.data.detail = detail
        .map((d) => String(d.msg || "").replace(/^Value error, /, ""))
        .filter(Boolean)
        .join(". ") || "Please check the form and try again.";
    }

    // if 401 and we haven't already retried
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");

      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refresh_token: refreshToken }
          );
          localStorage.setItem("token", data.access_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original); // retry the failed request
        } catch {
          // refresh also failed — log out
          logout();
        }
      } else {
        logout();
      }
    }

    return Promise.reject(error);
  }
);


// ── Dashboard ──────────────────────────────────────────────────────────────────

export const getDashboardSummary = () =>
  api.get("/dashboard/summary").then((r) => r.data);


// ── Farmers (Users) ────────────────────────────────────────────────────────────

export const getFarmers = () =>
  api.get("/users").then((r) => r.data);

export const getFarmer = (id) =>
  api.get(`/users/${id}`).then((r) => r.data);

export const createFarmer = (payload) =>
  api.post("/users", payload).then((r) => r.data);

export const updateFarmer = (id, payload) =>
  api.put(`/users/${id}`, payload).then((r) => r.data);

export const deleteFarmer = (id) =>
  api.delete(`/users/${id}`);


// ── UAV Detections ─────────────────────────────────────────────────────────────

export const getDetections = (anomalyOnly) =>
  api.get("/detections", {
    params: anomalyOnly !== undefined ? { anomaly_only: anomalyOnly } : {},
  }).then((r) => r.data);

export const getDetection = (id) =>
  api.get(`/detections/${id}`).then((r) => r.data);

export const createDetection = (payload) =>
  api.post("/detections", payload).then((r) => r.data);


// ── Scan Logs ──────────────────────────────────────────────────────────────────

export const getScans = () =>
  api.get("/scans").then((r) => r.data);

export const createScan = (payload) =>
  api.post("/scans", payload).then((r) => r.data);


// ── Notifications (Alerts) ─────────────────────────────────────────────────────

export const getAlerts = (acknowledged) =>
  api.get("/alerts", {
    params: acknowledged !== undefined ? { acknowledged } : {},
  }).then((r) => r.data);

export const getAlert = (id) =>
  api.get(`/alerts/${id}`).then((r) => r.data);

export const createAlert = (payload) =>
  api.post("/alerts", payload).then((r) => r.data);

export const acknowledgeAlert = (id) =>
  api.patch(`/alerts/${id}/acknowledge`).then((r) => r.data);


// ── Auth helpers ───────────────────────────────────────────────────────────────

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
  window.location.href = "/login";
};

export const isLoggedIn = () => !!localStorage.getItem("token");

export default api;


// ── Admin profile & password ───────────────────────────────────────────────────

// payload: { full_name?, username? }
export const updateProfile = (payload) =>
  api.put("/auth/profile", payload).then((r) => r.data);

// payload: { current_password, new_password, confirm_password }
export const changePassword = (payload) =>
  api.put("/auth/change-password", payload).then((r) => r.data);


// ── App settings (notifications + farmer preferences) ─────────────────────────

export const getSettings = () =>
  api.get("/settings").then((r) => r.data);

// payload: { auto_notify?, alert_threshold?, alert_cooldown_hours?, farmers_can_acknowledge? }
export const updateSettings = (payload) =>
  api.put("/settings", payload).then((r) => r.data);
