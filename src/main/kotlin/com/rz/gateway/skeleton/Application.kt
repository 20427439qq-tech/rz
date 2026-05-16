package com.rz.gateway.skeleton

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
            environment.log.error("Unhandled request error", cause)
            call.respond(HttpStatusCode.InternalServerError, R.error("internal server error"))
        }
    }

    DatabaseFactory.init(this)
    Redis.init(this)

    environment.monitor.subscribe(ApplicationStopping) {
        Redis.shutdown()
        DatabaseFactory.shutdown()
    }

    routing {
        healthRoutes()
        exampleBusinessRoutes(ExampleService())
    }
}
