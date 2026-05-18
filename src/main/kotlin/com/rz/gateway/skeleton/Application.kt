package com.rz.gateway.skeleton

import com.rz.gateway.skeleton.auth.AuthConfig
import com.rz.gateway.skeleton.auth.AuthRepository
import com.rz.gateway.skeleton.auth.AuthService
import com.rz.gateway.skeleton.auth.adminRoutes
import com.rz.gateway.skeleton.auth.authRoutes
import com.rz.gateway.skeleton.auth.installAuthInterceptor
import com.rz.gateway.skeleton.config.DatabaseFactory
import com.rz.gateway.skeleton.redis.Redis
import com.rz.gateway.skeleton.response.R
import com.rz.gateway.skeleton.routes.exampleBusinessRoutes
import com.rz.gateway.skeleton.routes.healthRoutes
import com.rz.gateway.skeleton.service.ExampleService
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStopping
import io.ktor.server.application.install
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.response.respond
import io.ktor.server.routing.routing
import kotlinx.serialization.json.Json

fun Application.module() {
    install(ContentNegotiation) {
        json(
            Json {
                ignoreUnknownKeys = true
                explicitNulls = true
            }
        )
    }

    install(CallLogging)

    install(StatusPages) {
        exception<Throwable> { call, cause ->
            this@module.environment.log.error("Unhandled request error", cause)
            call.respond(HttpStatusCode.InternalServerError, R.error("internal server error"))
        }
    }

    DatabaseFactory.init(this)
    val authConfig = AuthConfig.from(this)
    val authService = if (authConfig.enabled) {
        AuthService(authConfig, AuthRepository(DatabaseFactory.requireDataSource())).also {
            it.bootstrap()
            installAuthInterceptor(it)
        }
    } else {
        null
    }
    Redis.init(this)

    environment.monitor.subscribe(ApplicationStopping) {
        Redis.shutdown()
        DatabaseFactory.shutdown()
    }

    routing {
        healthRoutes()
        if (authService != null) {
            authRoutes(authService)
            adminRoutes(authService)
        }
        exampleBusinessRoutes(ExampleService())
    }
}
