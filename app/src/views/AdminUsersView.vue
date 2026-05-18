<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Plus, RotateCcw, Save, Trash2, UserCog } from '@lucide/vue'
import { createUser, deleteUser, listUsers, resetPassword, updateUser } from '../services/adminService'
import type { UserInput } from '../services/adminService'
import type { AuthUser } from '../services/authService'

const users = ref<AuthUser[]>([])
const busy = ref(false)
const message = ref('')

const createForm = reactive<UserInput>({
  username: '',
  displayName: '',
  password: '',
  role: 'user',
  enabled: true,
})

const editForms = reactive<Record<number, UserInput>>({})

async function loadUsers() {
  busy.value = true
  message.value = ''
  try {
    users.value = await listUsers()
    users.value.forEach((user) => {
      editForms[user.id] = {
        displayName: user.displayName,
        password: '',
        role: user.role,
        enabled: user.enabled,
      }
    })
  } catch (error) {
    message.value = error instanceof Error ? error.message : '账号读取失败'
  } finally {
    busy.value = false
  }
}

async function addUser() {
  busy.value = true
  message.value = ''
  try {
    await createUser(createForm)
    createForm.username = ''
    createForm.displayName = ''
    createForm.password = ''
    createForm.role = 'user'
    createForm.enabled = true
    message.value = '账号已新增'
    await loadUsers()
  } catch (error) {
    message.value = error instanceof Error ? error.message : '账号新增失败'
  } finally {
    busy.value = false
  }
}

async function saveUser(user: AuthUser) {
  busy.value = true
  message.value = ''
  try {
    await updateUser(user.id, editForms[user.id])
    editForms[user.id].password = ''
    message.value = '账号已保存'
    await loadUsers()
  } catch (error) {
    message.value = error instanceof Error ? error.message : '账号保存失败'
  } finally {
    busy.value = false
  }
}

async function resetUserPassword(user: AuthUser) {
  busy.value = true
  message.value = ''
  try {
    await resetPassword(user.id)
    message.value = `${user.username} 的密码已设置为 2026`
  } catch (error) {
    message.value = error instanceof Error ? error.message : '密码重置失败'
  } finally {
    busy.value = false
  }
}

async function removeUser(user: AuthUser) {
  if (!window.confirm(`确认删除账号 ${user.username}？`)) return
  busy.value = true
  message.value = ''
  try {
    await deleteUser(user.id)
    message.value = '账号已删除'
    await loadUsers()
  } catch (error) {
    message.value = error instanceof Error ? error.message : '账号删除失败'
  } finally {
    busy.value = false
  }
}

onMounted(loadUsers)
</script>

<template>
  <section class="screen admin-screen">
    <header class="page-header">
      <p class="eyebrow">管理模块</p>
      <h1>账号配置</h1>
      <p>超管可以新增、编辑、删除账号，也可以把密码重置为默认密码 2026。</p>
    </header>

    <form class="admin-card admin-form" @submit.prevent="addUser">
      <div class="admin-card__head">
        <UserCog :size="20" stroke-width="2" />
        <h2>新增账号</h2>
      </div>
      <label>
        <span>账号</span>
        <input v-model.trim="createForm.username" type="text" placeholder="newuser" />
      </label>
      <label>
        <span>显示名</span>
        <input v-model.trim="createForm.displayName" type="text" placeholder="新用户" />
      </label>
      <label>
        <span>密码</span>
        <input v-model="createForm.password" type="password" placeholder="留空则为 2026" />
      </label>
      <label>
        <span>角色</span>
        <select v-model="createForm.role">
          <option value="user">普通用户</option>
          <option value="admin">超管</option>
        </select>
      </label>
      <label class="admin-check">
        <input v-model="createForm.enabled" type="checkbox" />
        <span>启用账号</span>
      </label>
      <button class="primary-link" type="submit" :disabled="busy">
        <Plus :size="18" stroke-width="2" />
        <span>新增</span>
      </button>
    </form>

    <p v-if="message" class="admin-message">{{ message }}</p>

    <div class="admin-list">
      <article v-for="user in users" :key="user.id" class="admin-card user-row">
        <div class="user-row__title">
          <strong>{{ user.username }}</strong>
          <span>{{ user.role === 'admin' ? '超管' : '普通用户' }}</span>
        </div>
        <div class="admin-form">
          <label>
            <span>显示名</span>
            <input v-model.trim="editForms[user.id].displayName" type="text" />
          </label>
          <label>
            <span>新密码</span>
            <input v-model="editForms[user.id].password" type="password" placeholder="留空不修改" />
          </label>
          <label>
            <span>角色</span>
            <select v-model="editForms[user.id].role">
              <option value="user">普通用户</option>
              <option value="admin">超管</option>
            </select>
          </label>
          <label class="admin-check">
            <input v-model="editForms[user.id].enabled" type="checkbox" />
            <span>启用账号</span>
          </label>
        </div>
        <div class="user-row__actions">
          <button class="secondary-link" type="button" :disabled="busy" @click="saveUser(user)">
            <Save :size="16" stroke-width="2" />
            <span>保存</span>
          </button>
          <button class="secondary-link" type="button" :disabled="busy" @click="resetUserPassword(user)">
            <RotateCcw :size="16" stroke-width="2" />
            <span>默认密码</span>
          </button>
          <button class="secondary-link secondary-link--danger" type="button" :disabled="busy" @click="removeUser(user)">
            <Trash2 :size="16" stroke-width="2" />
            <span>删除</span>
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
