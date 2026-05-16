package com.rz.gateway.skeleton.gateway

import io.ktor.server.application.ApplicationCall
import kotlinx.serialization.Serializable

@Serializable
data class GatewayUserContext(
    val userId: Int?,
    val username: String?,
    val roles: List<String>
)

fun ApplicationCall.gatewayUserContext(): GatewayUserContext {
    val userId = request.headers["X-User-Id"]?.toIntOrNull()
    val username = request.headers["X-Username"]
    val roles = request.headers["X-Roles"]
        ?.split(',')
        ?.map { it.trim() }
        ?.filter { it.isNotBlank() }
        ?: emptyList()

    return GatewayUserContext(userId, username, roles)
}
