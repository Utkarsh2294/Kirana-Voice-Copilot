import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

it('shares a single refresh and retries concurrent requests with the new access token', async () => {
  vi.resetModules();
  const { api, setAccessToken, onSessionChange } = await import('./api.js');
  const changed = vi.fn();
  onSessionChange(changed);
  setAccessToken('old');
  const fetch = vi.fn(async (url, options) => {
    if (url.endsWith('/auth/refresh'))
      return json({ accessToken: 'new', merchant: { id: 'test' } });
    return options.headers.Authorization === 'Bearer new'
      ? json({ ok: true })
      : json({ code: 'UNAUTHENTICATED' }, 401);
  });
  vi.stubGlobal('fetch', fetch);
  const results = await Promise.all([api('/merchants/me'), api('/merchant-items')]);
  expect(results).toEqual([{ ok: true }, { ok: true }]);
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
  expect(changed).toHaveBeenCalledWith({ id: 'test' });
  expect(
    fetch.mock.calls.every(
      ([, options]) =>
        options.credentials === 'include' && options.headers['x-kirana-client'] === 'web',
    ),
  ).toBe(true);
});

it('does not loop when refresh fails and gives network failures a stable code', async () => {
  vi.resetModules();
  const { api, setAccessToken } = await import('./api.js');
  setAccessToken('old');
  const fetch = vi.fn(async () => json({ code: 'UNAUTHENTICATED' }, 401));
  vi.stubGlobal('fetch', fetch);
  await expect(api('/merchants/me')).rejects.toMatchObject({ status: 401 });
  expect(fetch).toHaveBeenCalledTimes(2);
  fetch.mockRejectedValue(new Error('connection lost'));
  await expect(api('/auth/otp/request', { method: 'POST', body: {} })).rejects.toMatchObject({
    code: 'NETWORK_ERROR',
  });
});
