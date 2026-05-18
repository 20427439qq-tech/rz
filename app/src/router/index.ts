import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import TodayTrainingView from '../views/TodayTrainingView.vue'
import PoolsView from '../views/PoolsView.vue'
import ResultDetailView from '../views/ResultDetailView.vue'
import MatchView from '../views/MatchView.vue'
import ScoreView from '../views/ScoreView.vue'
import LoginView from '../views/LoginView.vue'
import AdminUsersView from '../views/AdminUsersView.vue'
import { useAuthStore } from '../stores/authStore'

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { title: '登录', public: true },
  },
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: '首页' },
  },
  {
    path: '/training',
    name: 'training',
    component: TodayTrainingView,
    meta: { title: '今日训练' },
  },
  {
    path: '/pools',
    name: 'pools',
    component: PoolsView,
    meta: { title: '三个池' },
  },
  {
    path: '/results/:id',
    name: 'result-detail',
    component: ResultDetailView,
    meta: { title: '训练详情' },
  },
  {
    path: '/match',
    name: 'match',
    component: MatchView,
    meta: { title: '匹配' },
  },
  {
    path: '/score',
    name: 'score',
    component: ScoreView,
    meta: { title: '沉淀' },
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: AdminUsersView,
    meta: { title: '账号配置', admin: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.ensureLoaded()

  if (to.meta.public) {
    if (auth.isLoggedIn && to.name === 'login') return '/'
    return true
  }

  if (!auth.isLoggedIn) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.admin && !auth.isAdmin) return '/'

  return true
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '首页')} - 判断系统`
})

export default router
