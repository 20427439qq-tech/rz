package com.rz.gateway.skeleton.dto

import kotlinx.serialization.Serializable

@Serializable
data class HealthDto(
    val service: String,
    val status: String,
    val redisEnabled: Boolean
)
