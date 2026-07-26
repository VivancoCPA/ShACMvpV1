// MSW's Service Worker intercepts fetch() with a synthetic Response object,
// and browsers do not apply a Set-Cookie header from that synthetic response
// to the real cookie jar (this only works reliably with msw/node, which
// intercepts at the network-module level). Because there is no real backend
// yet, the refresh token cannot be persisted as a true httpOnly cookie in the
// browser today, so this mock-only substitute stores it in localStorage and
// sends it explicitly on /api/auth/refresh instead of relying on the browser
// to attach a cookie automatically.
//
// This is naturally inert against a real backend without needing an env
// check: only the mock handlers ever put a value here (they're the only ones
// that return `mockRefreshToken` in the response body — see
// stores/authStore.ts). A real .NET backend never sends that field and must
// use a genuine httpOnly cookie instead (already wired via `withCredentials`
// in lib/axios.ts), so persistMockRefreshToken(undefined) clears the key and
// readMockRefreshToken() keeps returning null.
const MOCK_REFRESH_TOKEN_KEY = 'shac_mock_refresh_token'

export function persistMockRefreshToken(token: string | null): void {
  if (token) {
    localStorage.setItem(MOCK_REFRESH_TOKEN_KEY, token)
  } else {
    localStorage.removeItem(MOCK_REFRESH_TOKEN_KEY)
  }
}

export function readMockRefreshToken(): string | null {
  return localStorage.getItem(MOCK_REFRESH_TOKEN_KEY)
}

// Same mock-only rationale as the refresh token above: a real backend would
// carry `empresaActivaId` inside its own server-side session/JWT, not in
// localStorage. This value survives a full page reload so `bootstrap()` can
// ask `/api/auth/refresh` to resolve the effective role for the empresa that
// was active before the reload, instead of silently falling back to the
// user's first assigned empresa (see me-f2-sesion-rbac-login design.md, D7).
const ACTIVE_EMPRESA_ID_KEY = 'shac_active_empresa_id'

export function persistActiveEmpresaId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_EMPRESA_ID_KEY, id)
  } else {
    localStorage.removeItem(ACTIVE_EMPRESA_ID_KEY)
  }
}

export function readActiveEmpresaId(): string | null {
  return localStorage.getItem(ACTIVE_EMPRESA_ID_KEY)
}
