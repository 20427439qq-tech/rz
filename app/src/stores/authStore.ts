import { defineStore } from 'pinia'
import { login as loginApi, logout as logoutApi, me as meApi } from '../services/authService'
import type { AuthUser, LoginInput } from '../services/authService'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    loaded: false,
    loading: false,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.user),
    isAdmin: (state) => state.user?.role === 'admin',
  },
  actions: {
    async ensureLoaded() {
      if (this.loaded || this.loading) return this.user
      this.loading = true
      try {
        this.user = await meApi()
      } catch {
        this.user = null
      } finally {
        this.loaded = true
        this.loading = false
      }
      return this.user
    },
    async login(input: LoginInput) {
      this.user = await loginApi(input)
      this.loaded = true
      return this.user
    },
    async logout() {
      try {
        await logoutApi()
      } finally {
        this.user = null
        this.loaded = true
      }
    },
  },
})
