import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'

const pinia = createPinia()

pinia.use(({ store }) => {
  const storageKey = `rz-judgment-system:${store.$id}`
  const savedState = window.localStorage.getItem(storageKey)

  if (savedState) {
    try {
      store.$patch(JSON.parse(savedState))
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }

  store.$subscribe((_mutation, state) => {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  })
})

createApp(App).use(pinia).use(router).mount('#app')
