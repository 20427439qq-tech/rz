import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import TodayTrainingView from '../views/TodayTrainingView.vue'
import PoolsView from '../views/PoolsView.vue'
import ResultDetailView from '../views/ResultDetailView.vue'
import MatchView from '../views/MatchView.vue'
import ScoreView from '../views/ScoreView.vue'

export const routes: RouteRecordRaw[] = [
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
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '首页')} - 判断系统`
})

export default router
