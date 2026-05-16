package com.rz.gateway.skeleton.response

import kotlinx.serialization.Serializable

@Serializable
data class R<T>(
    val code: Int,
    val data: T?,
    val msg: String
) {
    companion object {
        fun ok(): R<Unit> = R(200, null, "success")
        fun <T> data(data: T): R<T> = R(200, data, "success")
        fun error(msg: String): R<Unit> = R(500, null, msg)
        fun error(code: Int, msg: String): R<Unit> = R(code, null, msg)
    }
}
