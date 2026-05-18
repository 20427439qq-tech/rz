package com.rz.gateway.skeleton.auth

import com.rz.gateway.skeleton.response.R
import com.rz.gateway.skeleton.response.data
import com.rz.gateway.skeleton.response.ok
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route

fun Route.authRoutes(authService: AuthService) {
    route("/api/auth") {
        post("/login") {
            val request = call.receive<LoginRequest>()
            val user = authService.authenticate(request.username, request.password)
            if (user == null) {
                call.respond(HttpStatusCode.Unauthorized, R.error(401, "用户名或密码错误"))
                return@post
            }
            authService.login(call, user)
            call.data(user)
        }

        get("/me") {
            val user = authService.currentUser(call)
            if (user == null) {
                call.respond(HttpStatusCode.Unauthorized, R.error(401, "未登录"))
                return@get
            }
            call.data(user)
        }

        post("/logout") {
            authService.logout(call)
            call.ok()
        }
    }
}

fun Route.adminRoutes(authService: AuthService) {
    route("/api/admin/users") {
        get {
            val actor = call.requireAdmin() ?: return@get
            call.data(authService.listUsers())
        }

        post {
            call.requireAdmin() ?: return@post
            val request = call.receive<UserUpsertRequest>()
            runCatching {
                authService.createUser(request)
            }.onSuccess {
                call.data(it)
            }.onFailure {
                call.respond(HttpStatusCode.BadRequest, R.error(400, it.message ?: "账号创建失败"))
            }
        }

        put("/{id}") {
            val actor = call.requireAdmin() ?: return@put
            val id = call.parameters["id"]?.toIntOrNull()
            if (id == null) {
                call.respond(HttpStatusCode.BadRequest, R.error(400, "账号 ID 无效"))
                return@put
            }
            val request = call.receive<UserUpsertRequest>()
            runCatching {
                authService.updateUser(id, request, actor)
            }.onSuccess {
                call.data(it)
            }.onFailure {
                call.respond(HttpStatusCode.BadRequest, R.error(400, it.message ?: "账号更新失败"))
            }
        }

        delete("/{id}") {
            val actor = call.requireAdmin() ?: return@delete
            val id = call.parameters["id"]?.toIntOrNull()
            if (id == null) {
                call.respond(HttpStatusCode.BadRequest, R.error(400, "账号 ID 无效"))
                return@delete
            }
            runCatching {
                authService.deleteUser(id, actor)
            }.onSuccess {
                call.ok()
            }.onFailure {
                call.respond(HttpStatusCode.BadRequest, R.error(400, it.message ?: "账号删除失败"))
            }
        }

        post("/{id}/reset-password") {
            call.requireAdmin() ?: return@post
            val id = call.parameters["id"]?.toIntOrNull()
            if (id == null) {
                call.respond(HttpStatusCode.BadRequest, R.error(400, "账号 ID 无效"))
                return@post
            }
            runCatching {
                authService.resetPassword(id)
            }.onSuccess {
                call.data(it)
            }.onFailure {
                call.respond(HttpStatusCode.BadRequest, R.error(400, it.message ?: "密码重置失败"))
            }
        }
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.requireAdmin(): PublicUser? {
    val user = currentUser()
    if (user.role != "admin") {
        respond(HttpStatusCode.Forbidden, R.error(403, "无权访问管理模块"))
        return null
    }
    return user
}
