package com.rz.gateway.skeleton.auth

import io.ktor.server.application.Application

data class AuthConfig(
    val enabled: Boolean,
    val cookieName: String,
    val sessionTtlDays: Long,
    val cookieSecure: Boolean
) {
    companion object {
        fun from(application: Application): AuthConfig {
            val config = application.environment.config.config("auth")
            return AuthConfig(
                enabled = config.property("enabled").getString().toBoolean(),
                cookieName = config.property("cookieName").getString(),
                sessionTtlDays = config.property("sessionTtlDays").getString().toLong().coerceAtLeast(1),
                cookieSecure = config.property("cookieSecure").getString().toBoolean()
            )
        }
    }
}
