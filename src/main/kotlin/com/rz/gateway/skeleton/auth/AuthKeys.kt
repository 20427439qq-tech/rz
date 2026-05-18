package com.rz.gateway.skeleton.auth

import io.ktor.server.application.ApplicationCall
import io.ktor.util.AttributeKey

val CurrentUserKey = AttributeKey<PublicUser>("CurrentUser")

fun ApplicationCall.currentUser(): PublicUser =
    attributes[CurrentUserKey]
