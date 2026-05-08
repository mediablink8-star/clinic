/**
 * Shared axios instance with automatic token refresh on 401.
 * Import this instead of raw axios for all authenticated requests.
 * Manages the access token and silent refresh promise to avoid duplicate calls.
 */
import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: API_BASE, withCredentials: true });

// Token stored in module scope — set via setAccessToken() after login
let _token = null;
let refreshPromise = null;

export function setAccessToken(token) {
    _token = token || null;
}

export function clearAccessToken() {
    _token = null;
}

export const refreshAccessToken = async (retries = 2) => {
    if (!refreshPromise) {
        refreshPromise = (async () => {
            for (let attempt = 0; attempt <= retries; attempt++) {
                try {
                    const response = await axios.post(
                        `${API_BASE}/auth/refresh`,
                        {},
                        { withCredentials: true, timeout: 15000 }
                    );
                    setAccessToken(response.data.token);
                    return response.data.token;
                } catch (err) {
                    if (attempt < retries && (err.code === 'ECONNABORTED' || err.response?.status >= 500)) {
                        // Server cold-starting — wait and retry
                        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
                        continue;
                    }
                    throw err;
                }
            }
        })().finally(() => { refreshPromise = null; });
    }

    return refreshPromise;
};

// Inject Bearer token on every request
api.interceptors.request.use((config) => {
    if (_token) config.headers['Authorization'] = `Bearer ${_token}`;
    return config;
});

// On 401 — attempt one silent refresh (deduplicates concurrent calls via refreshPromise)
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
