import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'

const pinia = createPinia()

pinia.use(({ store }) => {
  if (store.$id === 'auth') return

  const storageKey = `rz-judgment-system:${store.$id}`
  const savedState = window.localStorage.getItem(storageKey)
  const defaultState = JSON.parse(JSON.stringify(store.$state))

  if (savedState) {
    try {
      const parsedState = JSON.parse(savedState)
      if (store.$id === 'app' && Array.isArray(parsedState.viewpoints) && Array.isArray(defaultState.viewpoints)) {
        const reviewViewpoints = defaultState.viewpoints.filter((item: { id?: string }) =>
          item.id?.startsWith('vp-review-'),
        )
        const preservedViewpoints = parsedState.viewpoints.filter(
          (item: { id?: string }) => !item.id?.startsWith('vp-review-'),
        )
        parsedState.viewpoints = [...preservedViewpoints, ...reviewViewpoints]
      }
      store.$patch(parsedState)
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }

  store.$subscribe((_mutation, state) => {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  })
})

createApp(App).use(pinia).use(router).mount('#app')
