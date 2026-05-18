export interface ApiResponse<T> {
  code: number
  data: T
  msg: string
}

export interface AuthUser {
  id: number
  username: string
  displayName: string
  role: 'admin' | 'user'
  enabled: boolean
}

export interface LoginInput {
  username: string
  password: string
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.code >= 400) {
    throw new Error(String(payload.msg || payload.error || '请求失败'))
  }
  return payload.data as T
}

export async function login(input: LoginInput) {
  return readResponse<AuthUser>(
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

export async function me() {
  return readResponse<AuthUser>(await fetch('/api/auth/me'))
}

export async function logout() {
  return readResponse<void>(
    await fetch('/api/auth/logout', {
      method: 'POST',
    }),
  )
}
