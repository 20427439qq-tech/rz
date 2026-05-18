<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogOut, ShieldCheck } from '@lucide/vue'
import BottomNav from '../components/BottomNav.vue'
import { useAuthStore } from '../stores/authStore'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isLoginPage = computed(() => route.path === '/login')

async function logout() {
  await auth.logout()
  await router.push('/login')
}
</script>

<template>
  <div class="app-frame" :class="{ 'app-frame--plain': isLoginPage }">
    <header v-if="!isLoginPage && auth.user" class="app-authbar">
      <div>
        <span>{{ auth.user.displayName }}</span>
        <em>{{ auth.user.role === 'admin' ? '超管' : '用户' }}</em>
      </div>
      <nav aria-label="账号操作">
        <RouterLink v-if="auth.isAdmin" class="authbar-button" to="/admin/users" title="账号配置" aria-label="账号配置">
          <ShieldCheck :size="17" stroke-width="2" />
        </RouterLink>
        <button class="authbar-button" type="button" title="退出登录" aria-label="退出登录" @click="logout">
          <LogOut :size="17" stroke-width="2" />
        </button>
      </nav>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
    <BottomNav v-if="!isLoginPage" />
  </div>
</template>
