import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import {
  clearAccessToken,
  decodeToken,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from './authSession';

vi.mock('axios', () => ({
  default: { post: vi.fn() },
}));

const makeToken = (payload) => {
  const encoded = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `header.${encoded}.signature`;
};

describe('authSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAccessToken();
  });

  it('sets, returns and clears the access token', () => {
    setAccessToken('token-123');
    expect(getAccessToken()).toBe('token-123');
    setAccessToken('');
    expect(getAccessToken()).toBeNull();
    setAccessToken('another-token');
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it('decodes JWT payloads and safely rejects invalid tokens', () => {
    expect(decodeToken(makeToken({ userId: 'u1', clinicId: 'c1' }))).toEqual({ userId: 'u1', clinicId: 'c1' });
    expect(decodeToken(null)).toBeNull();
    expect(decodeToken('not-a-jwt')).toBeNull();
    expect(decodeToken('header.not-base64-json.signature')).toBeNull();
  });

  it('refreshes the access token and stores the returned value', async () => {
    axios.post.mockResolvedValue({ data: { token: 'fresh-token' } });

    await expect(refreshAccessToken(0)).resolves.toBe('fresh-token');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/refresh$/),
      {},
      { withCredentials: true, timeout: 15000 },
    );
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('shares one in-flight refresh request across concurrent callers', async () => {
    let resolveRequest;
    axios.post.mockImplementation(() => new Promise(resolve => { resolveRequest = resolve; }));

    const first = refreshAccessToken(0);
    const second = refreshAccessToken(0);
    expect(axios.post).toHaveBeenCalledTimes(1);

    resolveRequest({ data: { token: 'shared-token' } });
    await expect(Promise.all([first, second])).resolves.toEqual(['shared-token', 'shared-token']);
    expect(getAccessToken()).toBe('shared-token');
  });

  it('rejects a failed refresh without retrying non-retryable responses', async () => {
    const error = { response: { status: 401 } };
    axios.post.mockRejectedValue(error);

    await expect(refreshAccessToken(0)).rejects.toBe(error);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });
});
