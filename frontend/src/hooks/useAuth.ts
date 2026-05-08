'use client'

import { useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { auth as authApi } from '@/lib/api'
import { storeTokens } from '@/lib/auth'

interface AuthResult {
  success: boolean
  error?: string
}

export function useAuth() {
  const store = useAuthStore()

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      store.setLoading(true)
      try {
        const res = await authApi.login({ email, password })
        const { user, tokens } = res.data
        storeTokens(tokens)
        store.setToken(tokens.accessToken)
        store.setUser(user)
        return { success: true }
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string; message?: string } } })
            ?.response?.data?.detail ??
          (err as { response?: { data?: { message?: string } } })
            ?.response?.data?.message ??
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
        const { user, tokens } = res.data
        storeTokens(tokens)
        store.setToken(tokens.accessToken)
        store.setUser(user)
        return { success: true }
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string; message?: string } } })
            ?.response?.data?.detail ??
          (err as { response?: { data?: { message?: string } } })
            ?.response?.data?.message ??
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
      const res = await authApi.me()
      store.setUser(res.data)
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
