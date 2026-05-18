package com.rz.gateway.skeleton.orm

import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.statements.UpdateBuilder
import org.jetbrains.exposed.v1.javatime.datetime
import org.jetbrains.exposed.v1.jdbc.Query
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll as exposedSelectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.LocalDateTime
import kotlin.math.ceil

abstract class BaseTable<T : BaseEntity>(tableName: String) : Table(tableName) {
    val id: Column<Int> = integer("id").autoIncrement()
    val createTime: Column<LocalDateTime> = datetime("create_time").clientDefault { LocalDateTime.now() }
    val updateTime: Column<LocalDateTime> = datetime("update_time").clientDefault { LocalDateTime.now() }
    val deleteTime: Column<LocalDateTime?> = datetime("delete_time").nullable()
    val deleted: Column<Boolean> = bool("deleted").default(false)

    override val primaryKey = PrimaryKey(id)

    protected abstract fun toEntity(row: ResultRow): T

    protected open fun fillCreate(entity: T, statement: UpdateBuilder<*>) {
        statement[createTime] = LocalDateTime.now()
        statement[updateTime] = LocalDateTime.now()
        statement[deleted] = false
    }

    protected open fun fillUpdate(entity: T, statement: UpdateBuilder<*>) {
        statement[updateTime] = LocalDateTime.now()
    }

    fun selectById(value: Int): T? = transaction {
        baseQuery()
            .where { (deleted eq false) and (this@BaseTable.id eq value) }
            .singleOrNull()
            ?.let(::toEntity)
    }

    fun selectBy(where: () -> Op<Boolean>): List<T> = transaction {
        baseQuery()
            .where { (deleted eq false) and where() }
            .map(::toEntity)
    }

    fun selectAll(): List<T> = transaction {
        baseQuery()
            .where { deleted eq false }
            .map(::toEntity)
    }

    fun selectPage(page: Int, size: Int): Page<T> = transaction {
        val safePage = page.coerceAtLeast(1)
        val safeSize = size.coerceAtLeast(1)
        val total = baseQuery()
            .where { deleted eq false }
            .count()
        val data = baseQuery()
            .where { deleted eq false }
            .limit(safeSize)
            .offset(((safePage - 1) * safeSize).toLong())
            .map(::toEntity)

        Page(
            page = safePage,
            size = safeSize,
            totalPages = ceil(total.toDouble() / safeSize.toDouble()).toInt(),
            data = data
        )
    }

    fun create(entity: T): Int = transaction {
        val statement = insert {
            fillCreate(entity, it)
        }
        statement[this@BaseTable.id]
    }

    fun update(entity: T): Boolean {
        val entityId = entity.id ?: return false
        return transaction {
            update({ (this@BaseTable.id eq entityId) and (deleted eq false) }) {
                fillUpdate(entity, it)
            } > 0
        }
    }

    fun softDelete(value: Int): Boolean = transaction {
        update({ (this@BaseTable.id eq value) and (deleted eq false) }) {
            it[deleted] = true
            it[deleteTime] = LocalDateTime.now()
            it[updateTime] = LocalDateTime.now()
        } > 0
    }

    fun batchInsert(entities: Iterable<T>): List<Int> = transaction {
        batchInsert(entities) { entity ->
            fillCreate(entity, this)
        }.map { it[this@BaseTable.id] }
    }

    private fun baseQuery(): Query =
        this.exposedSelectAll()
}
