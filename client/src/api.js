import axios from "axios";

// In dev, Vite proxies "/api" to localhost:5000 (see vite.config.js).
// In production (Vercel), there is no proxy, so we must point at the
// deployed backend URL directly via VITE_SERVER_URL.
const baseURL = import.meta.env.VITE_SERVER_URL
  ? `${import.meta.env.VITE_SERVER_URL}/api`
  : "/api";

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
