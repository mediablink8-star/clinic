/**
 * Shared axios instance with automatic token refresh on 401.
 * Import this instead of raw axios for all authenticated requests.
 */
import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: API_BASE, withCredentials: true });

// Token stored in module scope — set via setAuthToken() after login
let _token = null;
let _refreshing = null; // in-flight refresh promise

export function setAuthToken(token) {
    _token = token;
}

export function clearAuthToken() {
    _token = null;
}

// Inject Bearer token on every request
api.interceptors.request.use((config) => {
    if (_token) config.headers['Authorization'] = `Bearer ${_token}`;
    return config;
});

// On 401 — attempt one silent refresh, then retry original request
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
                // Deduplicate concurrent refresh calls
                if (!_refreshing) {
                    _refreshing = axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
                }
                const refreshPromise = _refreshing;
                refreshPromise.finally(() => { _refreshing = null; });
                const { data } = await refreshPromise;
                _token = data.token;
                original.headers['Authorization'] = `Bearer ${_token}`;
                return api(original);
            } catch {
                // Refresh failed — clear token, let caller handle
                _token = null;
                return Promise.reject(err);
            }
        }
        return Promise.reject(err);
    }
);

export default api;
