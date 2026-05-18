package com.rz.gateway.skeleton.config

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.application.Application
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.jdbc.Database
import javax.sql.DataSource

object DatabaseFactory {
    private var dataSource: HikariDataSource? = null

    fun init(application: Application) {
        val config = application.environment.config.config("database")
        val enabled = config.property("enabled").getString().toBoolean()
        val authEnabled = application.environment.config
            .config("auth")
            .property("enabled")
            .getString()
            .toBoolean()
        if (!enabled) {
            if (authEnabled) {
                error("AUTH_ENABLED=true requires DB_ENABLED=true because users and sessions are stored in PostgreSQL.")
            }
            application.environment.log.info("Database is disabled. Set DB_ENABLED=true to enable PostgreSQL.")
            return
        }

        val hikariConfig = HikariConfig().apply {
            driverClassName = config.property("driver").getString()
            jdbcUrl = config.property("jdbcUrl").getString()
            username = config.property("username").getString()
            password = config.property("password").getString()
            maximumPoolSize = config.property("maximumPoolSize").getString().toInt()
            isAutoCommit = false
            transactionIsolation = "TRANSACTION_REPEATABLE_READ"
            validate()
        }

        dataSource = HikariDataSource(hikariConfig)
        Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .load()
            .migrate()
        Database.connect(dataSource!!)
        application.environment.log.info("Database connected: ${hikariConfig.jdbcUrl}")
    }

    fun requireDataSource(): DataSource =
        dataSource ?: error("Database is not initialized. Set DB_ENABLED=true before using database-backed features.")

    fun shutdown() {
        dataSource?.close()
        dataSource = null
    }
}
