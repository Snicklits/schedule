import axios from "axios";
import { getToken, clearToken } from "../auth.js";

// In production, VITE_API_URL points to the deployed Express backend (e.g. Railway).
// In dev, the Vite proxy forwards /api → localhost:3000.
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const api = axios.create({ baseURL });

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => {
    // Vercel SPA rewrites return index.html (content-type: text/html) for
    // unmatched paths including /api/*. Treat that as a config error so
    // component .catch() handlers fire instead of crashing on undefined.map().
    const ct = String(r.headers["content-type"] ?? "");
    if (!ct.includes("json")) {
      return Promise.reject(new Error("Backend not reachable — check VITE_API_URL"));
    }
    return r;
  },
  (err) => {
    if (err.response?.status === 401) {
      clearToken();
    }
    return Promise.reject(err);
  }
);

export default api;
