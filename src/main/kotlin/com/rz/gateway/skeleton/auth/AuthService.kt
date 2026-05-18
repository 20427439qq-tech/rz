package com.rz.gateway.skeleton.auth

import io.ktor.http.Cookie
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.header
import io.ktor.server.request.userAgent

class AuthService(
    val config: AuthConfig,
    private val repository: AuthRepository
) {
    fun bootstrap() {
        if (config.enabled) repository.ensureDefaultUsers()
    }

    fun authenticate(username: String, password: String): PublicUser? {
        val record = repository.findByUsername(username.trim().lowercase()) ?: return null
        if (!record.enabled) return null
        if (!repository.verifyPassword(password, record.passwordHash)) return null
        return record.toPublicUser()
    }

    fun currentUser(call: ApplicationCall): PublicUser? {
        val token = call.request.cookies[config.cookieName] ?: return null
        return repository.findUserBySessionToken(token)
    }

    fun login(call: ApplicationCall, user: PublicUser) {
        val token = repository.createSession(
            user = user,
            ttlDays = config.sessionTtlDays,
            userAgent = call.request.userAgent(),
            ip = call.request.header("X-Forwarded-For")?.substringBefore(',')?.trim()
        )
        call.response.cookies.append(
            Cookie(
                name = config.cookieName,
                value = token,
                maxAge = (config.sessionTtlDays * 24 * 60 * 60).toInt(),
                path = "/",
                secure = config.cookieSecure,
                httpOnly = true,
                extensions = mapOf("SameSite" to "Lax")
            )
        )
    }

    fun logout(call: ApplicationCall) {
        call.request.cookies[config.cookieName]?.let(repository::revokeSession)
        call.response.cookies.append(
            Cookie(
                name = config.cookieName,
                value = "",
                maxAge = 0,
                path = "/",
                secure = config.cookieSecure,
                httpOnly = true,
                extensions = mapOf("SameSite" to "Lax")
            )
        )
    }

    fun listUsers(): List<PublicUser> = repository.listUsers()

    fun createUser(request: UserUpsertRequest): PublicUser =
        repository.createUser(request)

    fun updateUser(id: Int, request: UserUpsertRequest, actor: PublicUser): PublicUser {
        val current = repository.findById(id) ?: error("账号不存在")
        val nextRole = if (request.role == "admin") "admin" else "user"
        val nextEnabled = request.enabled
        if (current.role == "admin" && (!nextEnabled || nextRole != "admin") && repository.countEnabledAdmins(id) == 0) {
            error("不能禁用或降级最后一个超管")
        }
        if (actor.id == id && (!nextEnabled || nextRole != "admin")) {
            error("不能禁用或降级当前超管账号")
        }
        return repository.updateUser(id, request.copy(role = nextRole, enabled = nextEnabled))
    }

    fun deleteUser(id: Int, actor: PublicUser) {
        val current = repository.findById(id) ?: error("账号不存在")
        if (actor.id == id) error("不能删除当前登录账号")
        if (current.role == "admin" && repository.countEnabledAdmins(id) == 0) {
            error("不能删除最后一个超管")
        }
        repository.deleteUser(id)
    }

    fun resetPassword(id: Int): PublicUser =
        repository.resetPassword(id)
}
