package com.rz.gateway.skeleton.redis

import io.ktor.server.application.Application
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.redisson.Redisson
import org.redisson.api.RedissonClient
import org.redisson.config.Config
import java.time.Duration
import java.util.concurrent.TimeUnit

object Redis {
    @PublishedApi
    internal val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    private var client: RedissonClient? = null
    private var keyPrefix: String = ""

    fun init(application: Application) {
        val config = application.environment.config.config("redis")
        val enabled = config.property("enabled").getString().toBoolean()
        keyPrefix = config.property("keyPrefix").getString()

        if (!enabled) {
            application.environment.log.info("Redis is disabled. Set REDIS_ENABLED=true to enable Redisson.")
            return
        }

        val address = config.property("address").getString()
        val password = config.propertyOrNull("password")?.getString()?.takeIf { it.isNotBlank() }
        val database = config.property("database").getString().toInt()

        val redissonConfig = Config()
        redissonConfig.useSingleServer().apply {
            this.address = address
            this.database = database
            if (password != null) {
                this.password = password
            }
        }

        client = Redisson.create(redissonConfig)
        application.environment.log.info("Redis connected: $address")
    }

    inline fun <reified T> cache(key: String, value: T, ttl: Duration? = null) {
        val bucket = requireClient().getBucket<String>(normalizeKey(key))
        val encoded = json.encodeToString(value)
        if (ttl == null) {
            bucket.set(encoded)
        } else {
            bucket.set(encoded, ttl.toMillis(), TimeUnit.MILLISECONDS)
        }
    }

    inline fun <reified T> load(key: String): T? {
        val encoded = requireClient().getBucket<String>(normalizeKey(key)).get() ?: return null
        return json.decodeFromString(encoded)
    }

    fun deleteByPattern(pattern: String) {
        val normalizedPattern = normalizeKey(pattern)
        requireClient().keys.deleteByPattern(normalizedPattern)
    }

    fun shutdown() {
        client?.shutdown()
        client = null
    }

    fun enabled(): Boolean = client != null

    @PublishedApi
    internal fun normalizeKey(key: String): String =
        if (key.startsWith(keyPrefix)) key else "$keyPrefix$key"

    @PublishedApi
    internal fun requireClient(): RedissonClient =
        client ?: error("Redis is not initialized. Set REDIS_ENABLED=true before using cache operations.")
}
