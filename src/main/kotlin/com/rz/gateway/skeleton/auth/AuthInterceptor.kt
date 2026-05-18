package com.rz.gateway.skeleton.auth

import com.rz.gateway.skeleton.response.R
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCallPipeline
import io.ktor.server.request.path
import io.ktor.server.response.respond

fun Application.installAuthInterceptor(authService: AuthService) {
    intercept(ApplicationCallPipeline.Plugins) {
        val call = context
        if (!authService.config.enabled) return@intercept
        val path = call.request.path()
        val protectedApi = path.startsWith("/api/") &&
            !path.startsWith("/api/auth/") &&
            !path.startsWith("/api/ai/")
        if (!protectedApi) return@intercept

        val user = authService.currentUser(call)
        if (user == null) {
            call.respond(HttpStatusCode.Unauthorized, R.error(401, "未登录"))
            finish()
            return@intercept
        }
        call.attributes.put(CurrentUserKey, user)
    }
}
