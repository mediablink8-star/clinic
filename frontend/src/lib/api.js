/**
 * Shared axios instance with automatic token refresh on 401.
 * Import this instead of raw axios for all authenticated requests.
 * Token refresh is delegated to authSession.js to avoid duplicate refresh calls.
 */
import axios from 'axios';
import { refreshAccessToken, setAccessToken } from './authSession';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: API_BASE, withCredentials: true });

// Token stored in module scope — set via setAuthToken() after login
let _token = null;

export function setAuthToken(token) {
    _token = token;
    setAccessToken(token); // Sync with authSession
}

export function clearAuthToken() {
    _token = null;
    clearAccessToken();
}

// Inject Bearer token on every request
api.interceptors.request.use((config) => {
    if (_token) config.headers['Authorization'] = `Bearer ${_token}`;
    return config;
});

// On 401 — attempt one silent refresh via authSession (deduplicates concurrent calls)
api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const original = err.config;
        if (
            err.response?.status === 401 &&
            !original._retry &&
            !original.url?.includes('/auth/refresh') &&
            !original.url?.includes('/auth/login')
        ) {
            original._retry = true;
            try {
                const newToken = await refreshAccessToken();
                _token = newToken;
                setAccessToken(newToken);
                original.headers['Authorization'] = `Bearer ${_token}`;
                return api(original);
            } catch {
                _token = null;
                return Promise.reject(err);
            }
        }
        return Promise.reject(err);
    }
);

export default api;
