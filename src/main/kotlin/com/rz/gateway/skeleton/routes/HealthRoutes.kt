package com.rz.gateway.skeleton.routes

import com.rz.gateway.skeleton.dto.HealthDto
import com.rz.gateway.skeleton.redis.Redis
import com.rz.gateway.skeleton.response.data
import io.ktor.server.application.call
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

fun Route.healthRoutes() {
    get("/health") {
        val serviceName = call.application.environment.config
            .propertyOrNull("business.serviceName")
            ?.getString()
            ?: "rbac-business-skeleton"

        call.data(
            HealthDto(
                service = serviceName,
                status = "UP",
                redisEnabled = Redis.enabled()
            )
        )
    }
}
