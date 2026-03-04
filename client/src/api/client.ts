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
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      clearToken();
    }
    return Promise.reject(err);
  }
);

export default api;
