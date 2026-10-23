let accessToken = null;
let refreshing = null;
let listener = () => {};
const base = import.meta.env.VITE_API_URL || '/api/v1';
export function setAccessToken(value) {
  accessToken = value;
}
export function onSessionChange(next) {
  listener = next;
  return () => {
    listener = () => {};
  };
}

async function send(path, options = {}) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      credentials: 'include',
      signal: options.signal || AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        'x-kirana-client': 'web',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (cause) {
    throw Object.assign(new Error('NETWORK_ERROR', { cause }), {
      code: 'NETWORK_ERROR',
      status: 0,
    });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(new Error(body.code || 'REQUEST_FAILED'), {
      status: response.status,
      code: body.code || 'REQUEST_FAILED',
    });
  }
  if (options.responseType === 'response') return response;
  return response.status === 204 ? null : response.json();
}
export function refreshSession() {
  if (!refreshing) {
    const rotate = () => send('/auth/refresh', { method: 'POST', body: {} });
    const request = navigator.locks ? navigator.locks.request('kirana-refresh', rotate) : rotate();
    refreshing = request
      .then((session) => {
        accessToken = session.accessToken;
        listener(session.merchant);
        return session;
      })
      .catch((error) => {
        accessToken = null;
        listener(null);
        throw error;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}
export async function api(path, options = {}) {
  const sentToken = accessToken;
  try {
    return await send(path, options);
  } catch (error) {
    if (error.status !== 401 || (path.startsWith('/auth/') && !path.startsWith('/auth/logout')))
      throw error;
    // A late 401 can arrive after another request already rotated the token.
    if (!accessToken || sentToken === accessToken) await refreshSession();
    return send(path, options);
  }
}
