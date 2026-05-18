import type { AuthUser } from './authService'

export interface UserInput {
  username?: string
  displayName?: string
  password?: string
  role: 'admin' | 'user'
  enabled: boolean
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.code >= 400) {
    throw new Error(String(payload.msg || payload.error || '请求失败'))
  }
  return payload.data as T
}

export async function listUsers() {
  return readResponse<AuthUser[]>(await fetch('/api/admin/users'))
}

export async function createUser(input: UserInput) {
  return readResponse<AuthUser>(
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

export async function updateUser(id: number, input: UserInput) {
  return readResponse<AuthUser>(
    await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

export async function deleteUser(id: number) {
  return readResponse<void>(
    await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
    }),
  )
}

export async function resetPassword(id: number) {
  return readResponse<AuthUser>(
    await fetch(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
    }),
  )
}
