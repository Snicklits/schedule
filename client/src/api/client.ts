import axios from "axios";
import { getToken, clearToken } from "../auth.js";

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => {
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
