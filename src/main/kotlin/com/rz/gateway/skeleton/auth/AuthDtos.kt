package com.rz.gateway.skeleton.auth

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class PublicUser(
    val id: Int,
    val username: String,
    val displayName: String,
    val role: String,
    val enabled: Boolean
)

@Serializable
data class UserUpsertRequest(
    val username: String? = null,
    val displayName: String? = null,
    val password: String? = null,
    val role: String = "user",
    val enabled: Boolean = true
)
