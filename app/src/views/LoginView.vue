<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, BookOpenText, EyeOff, FileCheck2, LockKeyhole, PenLine, ShieldCheck, UserRound } from '@lucide/vue'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const quoteSeeds = [
  '真正的成长，是让旧判断被重新看见。',
  '认知升维，从发现自己的默认反应开始。',
  '观点不急着证明，先拿到真实场景里校准。',
  '判断力不是更多答案，而是更清楚的边界。',
  '每天复盘一个判断，系统就多一层清醒。',
  '能被训练的认知，才会变成稳定的行动。',
]

const todayQuote = quoteSeeds[Math.floor(Math.random() * quoteSeeds.length)]

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
    <div class="login-paper">
      <div class="login-deco login-deco--left" aria-hidden="true">
        <span>观察</span>
        <b></b>
        <span>思考</span>
        <b></b>
        <span>校准</span>
        <b></b>
        <span>迭代</span>
      </div>
      <div class="login-deco login-deco--right" aria-hidden="true">
        <i></i>
        <i></i>
        <i></i>
      </div>

      <div class="login-hero-mark" aria-hidden="true">
        <div class="login-hero-card login-hero-card--back"></div>
        <div class="login-hero-card">
          <FileCheck2 :size="56" stroke-width="1.8" />
        </div>
        <span></span>
      </div>

      <div class="login-brand">
        <h1>认知升维训练</h1>
        <i aria-hidden="true"></i>
        <p>每天校准一次判断</p>
      </div>

      <form class="login-form" @submit.prevent="submitLogin('home')">
        <label class="login-field">
          <UserRound :size="24" stroke-width="2" />
          <input v-model.trim="form.username" aria-label="账号" autocomplete="username" type="text" placeholder="账号" />
        </label>
        <label class="login-field">
          <LockKeyhole :size="24" stroke-width="2" />
          <input v-model="form.password" autocomplete="current-password" type="password" placeholder="请输入密码" />
          <EyeOff :size="23" stroke-width="2" />
        </label>

        <p v-if="message" class="login-message">{{ message }}</p>

        <button class="primary-link" type="submit" :disabled="busy">
          <ArrowRight :size="18" stroke-width="2" />
          <span>{{ busy ? '登录中' : '进入训练' }}</span>
        </button>
        <button class="secondary-link" type="button" :disabled="busy" @click="submitLogin('admin')">
          <ShieldCheck :size="18" stroke-width="2" />
          <span>管理</span>
        </button>
      </form>

      <p class="login-helper">用账号继续你的训练记录</p>

      <footer class="login-quote" aria-label="今日观点">
        <BookOpenText :size="48" stroke-width="1.7" />
        <PenLine :size="34" stroke-width="1.8" />
        <div>
          <span>今日观点</span>
          <i aria-hidden="true"></i>
          <p>{{ todayQuote }}</p>
        </div>
      </footer>
    </div>
  </section>
</template>
