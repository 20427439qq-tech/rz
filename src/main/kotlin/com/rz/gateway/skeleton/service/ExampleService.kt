package com.rz.gateway.skeleton.service

import com.rz.gateway.skeleton.dto.ExampleCreateRequest
import com.rz.gateway.skeleton.dto.ExampleResponse
import com.rz.gateway.skeleton.gateway.GatewayUserContext

class ExampleService {
    fun echo(request: ExampleCreateRequest, operator: GatewayUserContext): ExampleResponse =
        ExampleResponse(
            id = 1,
            title = request.title,
            content = request.content,
            operator = operator
        )
}
