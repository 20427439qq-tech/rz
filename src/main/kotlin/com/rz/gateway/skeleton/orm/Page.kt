package com.rz.gateway.skeleton.orm

import kotlinx.serialization.Serializable

@Serializable
data class Page<T>(
    val page: Int,
    val size: Int,
    val totalPages: Int,
    val data: List<T>
)
