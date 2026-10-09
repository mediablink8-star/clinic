import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiInstance, requestHandlers, responseHandlers } = vi.hoisted(() => {
  const requestHandlers = [];
  const responseHandlers = [];
  const apiInstance = Object.assign(vi.fn(async config => ({ config })), {
    interceptors: {
      request: { use: vi.fn(handler => requestHandlers.push(handler)) },
      response: { use: vi.fn((onFulfilled, onRejected) => responseHandlers.push({ onFulfilled, onRejected })) },
    },
  });
  return { apiInstance, requestHandlers, responseHandlers };
});

vi.mock('axios', () => ({
  default: { create: vi.fn(() => apiInstance) },
}));

vi.mock('./authSession', () => ({
  refreshAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
}));

import api, { setAuthToken, clearAuthToken } from './api';
import { refreshAccessToken, setAccessToken as syncAccessToken, clearAccessToken as syncClearAccessToken } from './authSession';

describe('api client authentication interceptors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds the bearer token and synchronizes token state', () => {
    setAuthToken('token-abc');
    expect(syncAccessToken).toHaveBeenCalledWith('token-abc');

    const config = { headers: {} };
    expect(requestHandlers[0](config)).toBe(config);
    expect(config.headers.Authorization).toBe('Bearer token-abc');

    clearAuthToken();
    expect(syncClearAccessToken).toHaveBeenCalled();
    const anonymousConfig = { headers: {} };
    requestHandlers[0](anonymousConfig);
    expect(anonymousConfig.headers.Authorization).toBeUndefined();
  });

  it('passes successful responses through unchanged', () => {
    const response = { status: 200, data: { ok: true } };
    expect(responseHandlers[0].onFulfilled(response)).toBe(response);
  });

  it('refreshes once and retries an authenticated request after a 401', async () => {
    refreshAccessToken.mockResolvedValue('fresh-token');
    const original = { url: '/patients', headers: {} };

    await expect(responseHandlers[0].onRejected({
      response: { status: 401 },
      config: original,
    })).resolves.toEqual({ config: original });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(original._retry).toBe(true);
    expect(original.headers.Authorization).toBe('Bearer fresh-token');
    expect(api).toHaveBeenCalledWith(original);
  });

  it('does not retry login/refresh requests or already retried requests', async () => {
    const loginRequest = { url: '/auth/login', headers: {} };
    const retryRequest = { url: '/patients', headers: {}, _retry: true };

    await expect(responseHandlers[0].onRejected({
      response: { status: 401 },
      config: loginRequest,
    })).rejects.toBeDefined();
    await expect(responseHandlers[0].onRejected({
      response: { status: 401 },
      config: retryRequest,
    })).rejects.toBeDefined();

    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});
