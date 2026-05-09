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

// Backend returns snake_case; map to our camelCase User type
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

export function useAuth() {
  const store = useAuthStore()

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      store.setLoading(true)
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
        store.setToken(tokens.accessToken)

        // Fetch user profile with the new token
        const meRes = await authApi.me()
        store.setUser(mapBackendUser(meRes.data))

        return { success: true }
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Login failed. Please check your credentials.'
        return { success: false, error: message }
      } finally {
        store.setLoading(false)
      }
    },
    [store]
  )

  const register = useCallback(
    async (email: string, password: string, username: string): Promise<AuthResult> => {
      store.setLoading(true)
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
        store.setToken(tokens.accessToken)

        // Fetch user profile with the new token
        const meRes = await authApi.me()
        store.setUser(mapBackendUser(meRes.data))

        return { success: true }
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Registration failed. Please try again.'
        return { success: false, error: message }
      } finally {
        store.setLoading(false)
      }
    },
    [store]
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore logout errors — clear local state regardless
    } finally {
      store.logout()
    }
  }, [store])

  const checkAuth = useCallback(async () => {
    if (!store.token) return
    store.setLoading(true)
    try {
      const meRes = await authApi.me()
      store.setUser(mapBackendUser(meRes.data))
    } catch {
      store.logout()
    } finally {
      store.setLoading(false)
    }
  }, [store])

  return {
    user:            store.user,
    token:           store.token,
    isAuthenticated: store.isAuthenticated,
    isLoading:       store.isLoading,
    login,
    register,
    logout,
    checkAuth,
  }
}
