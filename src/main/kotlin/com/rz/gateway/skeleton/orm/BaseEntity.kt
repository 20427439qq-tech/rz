package com.rz.gateway.skeleton.orm

import java.time.LocalDateTime

interface BaseEntity {
    val id: Int?
    val createTime: LocalDateTime?
    val updateTime: LocalDateTime?
    val deleteTime: LocalDateTime?
    val deleted: Boolean
}
