// Client side. The widget runs in a cross-site iframe where the session cookie is not
// sent, so it holds the session token itself and sends it as a Bearer header.
// Outside an iframe nothing is stored and requests rely on the cookie as before.
const KEY = 'solene_embed_token';
let memory: string | null = null;

export const isEmbedded = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // reading window.top threw: cross-origin parent
  }
};

export function getAuthToken(): string | null {
  if (memory) return memory;
  try {
    memory = sessionStorage.getItem(KEY);
  } catch {}
  return memory;
}

export function setAuthToken(token: string | null) {
  memory = token;
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {}
}

/** fetch() for this app's own /api routes: adds the Bearer token when there is one. */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = isEmbedded() ? getAuthToken() : null;
  if (!token) return fetch(input, init);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
