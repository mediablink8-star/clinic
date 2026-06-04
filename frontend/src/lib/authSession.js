import axios from 'axios';
import { API_BASE } from '../lib/constants';


let accessToken = null;
let refreshPromise = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const getAccessToken = () => accessToken;

export const clearAccessToken = () => {
  accessToken = null;
};

export const decodeToken = (token) => {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
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
