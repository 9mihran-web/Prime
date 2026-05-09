import { AuthTokens } from '@/types/auth'

const TOKEN_KEY = 'prime_access_token'
const REFRESH_KEY = 'prime_refresh_token'

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_KEY)
}

export function storeTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, tokens.accessToken)
  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
  }
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1]
    if (!payload) return true
    const decoded = JSON.parse(atob(payload))
    const exp = decoded.exp as number | undefined
    if (!exp) return false
    return Date.now() >= exp * 1000
  } catch {
    return true
  }
}

export function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}
