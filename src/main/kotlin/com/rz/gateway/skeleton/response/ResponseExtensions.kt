package com.rz.gateway.skeleton.response

import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond

suspend fun ApplicationCall.ok() {
    respond(R.ok())
}

suspend inline fun <reified T> ApplicationCall.data(data: T) {
    respond(R.data(data))
}

suspend fun ApplicationCall.error(msg: String) {
    respond(R.error(msg))
}

suspend fun ApplicationCall.error(code: Int, msg: String) {
    respond(R.error(code, msg))
}
