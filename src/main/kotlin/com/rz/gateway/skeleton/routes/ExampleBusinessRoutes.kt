package com.rz.gateway.skeleton.routes

import com.rz.gateway.skeleton.dto.ExampleCreateRequest
import com.rz.gateway.skeleton.gateway.gatewayUserContext
import com.rz.gateway.skeleton.response.data
import com.rz.gateway.skeleton.service.ExampleService
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route

fun Route.exampleBusinessRoutes(exampleService: ExampleService) {
    route("/api/examples") {
        get("/me") {
            call.data(call.gatewayUserContext())
        }

        post("/echo") {
            val request = call.receive<ExampleCreateRequest>()
            val response = exampleService.echo(request, call.gatewayUserContext())
            call.data(response)
        }
    }
}
