export interface User {
  id: string
  email: string
  username: string
  displayName?: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  tokenType: string
  expiresIn?: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  username: string
}

export interface AuthResponse {
  user: User
  tokens: AuthTokens
}

export interface AuthError {
  message: string
  field?: string
  code?: string
}

// Matches the backend's actual snake_case token response
export interface BackendTokenResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in?: number
}
