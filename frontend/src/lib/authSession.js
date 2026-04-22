import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

let accessToken = null;
let refreshPromise = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const getAccessToken = () => accessToken;

export const clearAccessToken = () => {
  accessToken = null;
};

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
