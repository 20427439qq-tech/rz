package com.rz.gateway.skeleton.dto

import com.rz.gateway.skeleton.gateway.GatewayUserContext
import kotlinx.serialization.Serializable

@Serializable
data class ExampleCreateRequest(
    val title: String,
    val content: String
)

@Serializable
data class ExampleResponse(
    val id: Int,
    val title: String,
    val content: String,
    val operator: GatewayUserContext
)
