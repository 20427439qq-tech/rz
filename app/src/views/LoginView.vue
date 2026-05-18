<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LockKeyhole, LogIn, ShieldCheck } from '@lucide/vue'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({
  username: '',
  password: '',
})

const busy = ref(false)
const message = ref('')

const redirectTo = computed(() => {
  const value = String(route.query.redirect || '/')
  return value.startsWith('/') && !value.startsWith('//') ? value : '/'
})

async function submitLogin(target: 'home' | 'admin') {
  message.value = ''
  busy.value = true
  try {
    const user = await auth.login({
      username: form.username,
      password: form.password,
    })
    if (target === 'admin') {
      if (user.role !== 'admin') {
        message.value = '只有超管账号可以进入管理模块'
        await auth.logout()
        return
      }
      await router.push('/admin/users')
      return
    }
    await router.push(redirectTo.value)
  } catch (error) {
    message.value = error instanceof Error ? error.message : '登录失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="login-screen">
    <div class="login-panel">
      <div class="login-brand">
        <span><LockKeyhole :size="22" stroke-width="2" /></span>
        <div>
          <p class="eyebrow">判断系统</p>
          <h1>登录</h1>
        </div>
      </div>

      <form class="login-form" @submit.prevent="submitLogin('home')">
        <label>
          <span>账号</span>
          <input v-model.trim="form.username" autocomplete="username" type="text" placeholder="admin / wfwd" />
        </label>
        <label>
          <span>密码</span>
          <input v-model="form.password" autocomplete="current-password" type="password" placeholder="请输入密码" />
        </label>

        <p v-if="message" class="login-message">{{ message }}</p>

        <button class="primary-link" type="submit" :disabled="busy">
          <LogIn :size="18" stroke-width="2" />
          <span>{{ busy ? '登录中' : '进入系统' }}</span>
        </button>
        <button class="secondary-link" type="button" :disabled="busy" @click="submitLogin('admin')">
          <ShieldCheck :size="18" stroke-width="2" />
          <span>管理</span>
        </button>
      </form>
    </div>
  </section>
</template>
