'use client'

import { useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { auth as authApi } from '@/lib/api'
import { storeTokens } from '@/lib/auth'
import type { BackendTokenResponse, User } from '@/types/auth'

interface AuthResult {
  success: boolean
  error?: string
}

function mapBackendUser(raw: Record<string, unknown>): User {
  return {
    id:          String(raw.id),
    email:       String(raw.email),
    username:    String(raw.username),
    displayName: (raw.display_name ?? raw.displayName) as string | undefined,
    avatarUrl:   (raw.avatar_url   ?? raw.avatarUrl)   as string | undefined,
    createdAt:   (raw.created_at   ?? raw.createdAt   ?? new Date().toISOString()) as string,
    updatedAt:   (raw.updated_at   ?? raw.updatedAt   ?? new Date().toISOString()) as string,
  }
}

// FastAPI can return detail as a string (409) or array of objects (422 validation)
function extractErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d.msg ?? String(d)).join(', ')
  }
  return fallback
}

export function useAuth() {
  // Use individual selectors so callbacks don't re-create on unrelated state changes
  const user            = useAuthStore((s) => s.user)
  const token           = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading       = useAuthStore((s) => s.isLoading)
  const setUser         = useAuthStore((s) => s.setUser)
  const setToken        = useAuthStore((s) => s.setToken)
  const setLoading      = useAuthStore((s) => s.setLoading)
  const logoutStore     = useAuthStore((s) => s.logout)

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      setLoading(true)
      try {
        const res = await authApi.login({ email, password })
        const raw: BackendTokenResponse = res.data
        const tokens = {
          accessToken:  raw.access_token,
          refreshToken: raw.refresh_token,
          tokenType:    raw.token_type ?? 'bearer',
          expiresIn:    raw.expires_in,
        }
        storeTokens(tokens)
        setToken(tokens.accessToken)
        const meRes = await authApi.me()
        setUser(mapBackendUser(meRes.data as unknown as Record<string, unknown>))
        return { success: true }
      } catch (err: unknown) {
        return { success: false, error: extractErrorMessage(err, 'Login failed. Please check your credentials.') }
      } finally {
        setLoading(false)
      }
    },
    [setLoading, setToken, setUser]
  )

  const register = useCallback(
    async (email: string, password: string, username: string): Promise<AuthResult> => {
      setLoading(true)
      try {
        const res = await authApi.register({ email, password, username })
        const raw: BackendTokenResponse = res.data
        const tokens = {
          accessToken:  raw.access_token,
          refreshToken: raw.refresh_token,
          tokenType:    raw.token_type ?? 'bearer',
          expiresIn:    raw.expires_in,
        }
        storeTokens(tokens)
        setToken(tokens.accessToken)
        const meRes = await authApi.me()
        setUser(mapBackendUser(meRes.data as unknown as Record<string, unknown>))
        return { success: true }
      } catch (err: unknown) {
        return { success: false, error: extractErrorMessage(err, 'Registration failed. Please try again.') }
      } finally {
        setLoading(false)
      }
    },
    [setLoading, setToken, setUser]
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    } finally {
      logoutStore()
    }
  }, [logoutStore])

  const checkAuth = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const meRes = await authApi.me()
      setUser(mapBackendUser(meRes.data as unknown as Record<string, unknown>))
    } catch {
      logoutStore()
    } finally {
      setLoading(false)
    }
  }, [token, setLoading, setUser, logoutStore])

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    checkAuth,
  }
}
