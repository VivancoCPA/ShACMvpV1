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
