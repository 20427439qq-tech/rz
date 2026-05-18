package com.rz.gateway.skeleton.auth

import at.favre.lib.crypto.bcrypt.BCrypt
import java.security.MessageDigest
import java.security.SecureRandom
import java.sql.Connection
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.LocalDateTime
import java.util.HexFormat
import javax.sql.DataSource

class AuthRepository(private val dataSource: DataSource) {
    private val random = SecureRandom()

    fun ensureDefaultUsers() {
        ensureUser("admin", "admin", "admin", "wfwd0725")
        ensureUser("wfwd", "wfwd", "user", "wfwd0725")
    }

    fun findByUsername(username: String): UserRecord? = connection { connection ->
        connection.prepareStatement(
            """
            select id, username, password_hash, display_name, role, enabled
            from users
            where username = ?
            """.trimIndent()
        ).use { statement ->
            statement.setString(1, username)
            statement.executeQuery().use { rows ->
                if (rows.next()) rows.toUserRecord() else null
            }
        }
    }

    fun findById(id: Int): PublicUser? = connection { connection ->
        connection.prepareStatement(
            """
            select id, username, display_name, role, enabled
            from users
            where id = ?
            """.trimIndent()
        ).use { statement ->
            statement.setInt(1, id)
            statement.executeQuery().use { rows ->
                if (rows.next()) rows.toPublicUser() else null
            }
        }
    }

    fun listUsers(): List<PublicUser> = connection { connection ->
        connection.prepareStatement(
            """
            select id, username, display_name, role, enabled
            from users
            order by role asc, username asc
            """.trimIndent()
        ).use { statement ->
            statement.executeQuery().use { rows ->
                buildList {
                    while (rows.next()) add(rows.toPublicUser())
                }
            }
        }
    }

    fun createUser(request: UserUpsertRequest): PublicUser {
        val username = normalizeUsername(request.username ?: "")
        require(username.isNotBlank()) { "用户名不能为空" }
        require(findByUsername(username) == null) { "用户名已存在" }
        val displayName = normalizeDisplayName(request.displayName, username)
        val role = normalizeRole(request.role)
        val passwordHash = hashPassword(request.password?.takeIf { it.isNotBlank() } ?: DEFAULT_PASSWORD)

        return connection { connection ->
            connection.prepareStatement(
                """
                insert into users (username, password_hash, display_name, role, enabled)
                values (?, ?, ?, ?, ?)
                returning id, username, display_name, role, enabled
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, username)
                statement.setString(2, passwordHash)
                statement.setString(3, displayName)
                statement.setString(4, role)
                statement.setBoolean(5, request.enabled)
                statement.executeQuery().use { rows ->
                    rows.next()
                    rows.toPublicUser()
                }
            }
        }
    }

    fun updateUser(id: Int, request: UserUpsertRequest): PublicUser {
        val current = findById(id) ?: error("账号不存在")
        val displayName = normalizeDisplayName(request.displayName, current.username)
        val role = normalizeRole(request.role)

        return connection { connection ->
            if (request.password.isNullOrBlank()) {
                connection.prepareStatement(
                    """
                    update users
                    set display_name = ?, role = ?, enabled = ?, updated_at = now()
                    where id = ?
                    returning id, username, display_name, role, enabled
                    """.trimIndent()
                ).use { statement ->
                    statement.setString(1, displayName)
                    statement.setString(2, role)
                    statement.setBoolean(3, request.enabled)
                    statement.setInt(4, id)
                    statement.executeQuery().use { rows ->
                        rows.next()
                        rows.toPublicUser()
                    }
                }
            } else {
                connection.prepareStatement(
                    """
                    update users
                    set display_name = ?, password_hash = ?, role = ?, enabled = ?, updated_at = now()
                    where id = ?
                    returning id, username, display_name, role, enabled
                    """.trimIndent()
                ).use { statement ->
                    statement.setString(1, displayName)
                    statement.setString(2, hashPassword(request.password))
                    statement.setString(3, role)
                    statement.setBoolean(4, request.enabled)
                    statement.setInt(5, id)
                    statement.executeQuery().use { rows ->
                        rows.next()
                        rows.toPublicUser()
                    }
                }
            }
        }
    }

    fun deleteUser(id: Int) {
        connection { connection ->
            connection.prepareStatement("delete from users where id = ?").use { statement ->
                statement.setInt(1, id)
                statement.executeUpdate()
            }
        }
    }

    fun resetPassword(id: Int): PublicUser = connection { connection ->
        connection.prepareStatement(
            """
            update users
            set password_hash = ?, updated_at = now()
            where id = ?
            returning id, username, display_name, role, enabled
            """.trimIndent()
        ).use { statement ->
            statement.setString(1, hashPassword(DEFAULT_PASSWORD))
            statement.setInt(2, id)
            statement.executeQuery().use { rows ->
                if (!rows.next()) error("账号不存在")
                rows.toPublicUser()
            }
        }
    }

    fun countEnabledAdmins(exceptUserId: Int? = null): Int = connection { connection ->
        val sql = if (exceptUserId == null) {
            "select count(*) from users where role = 'admin' and enabled = true"
        } else {
            "select count(*) from users where role = 'admin' and enabled = true and id <> ?"
        }
        connection.prepareStatement(sql).use { statement ->
            if (exceptUserId != null) statement.setInt(1, exceptUserId)
            statement.executeQuery().use { rows ->
                rows.next()
                rows.getInt(1)
            }
        }
    }

    fun createSession(user: PublicUser, ttlDays: Long, userAgent: String?, ip: String?): String {
        val token = newToken()
        val tokenHash = hashToken(token)
        val expiresAt = LocalDateTime.now().plusDays(ttlDays)
        connection { connection ->
            connection.prepareStatement(
                """
                insert into sessions (user_id, token_hash, expires_at, user_agent, ip)
                values (?, ?, ?, ?, ?)
                """.trimIndent()
            ).use { statement ->
                statement.setInt(1, user.id)
                statement.setString(2, tokenHash)
                statement.setTimestamp(3, Timestamp.valueOf(expiresAt))
                statement.setString(4, userAgent?.take(500))
                statement.setString(5, ip?.take(64))
                statement.executeUpdate()
            }
        }
        return token
    }

    fun findUserBySessionToken(token: String): PublicUser? = connection { connection ->
        connection.prepareStatement(
            """
            select u.id, u.username, u.display_name, u.role, u.enabled
            from sessions s
            join users u on u.id = s.user_id
            where s.token_hash = ?
              and s.revoked_at is null
              and s.expires_at > now()
              and u.enabled = true
            """.trimIndent()
        ).use { statement ->
            statement.setString(1, hashToken(token))
            statement.executeQuery().use { rows ->
                val user = if (rows.next()) rows.toPublicUser() else null
                if (user != null) touchSession(connection, token)
                user
            }
        }
    }

    fun revokeSession(token: String) {
        connection { connection ->
            connection.prepareStatement(
                """
                update sessions
                set revoked_at = now()
                where token_hash = ? and revoked_at is null
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, hashToken(token))
                statement.executeUpdate()
            }
        }
    }

    fun verifyPassword(password: String, hash: String): Boolean =
        BCrypt.verifyer().verify(password.toCharArray(), hash).verified

    private fun ensureUser(username: String, displayName: String, role: String, password: String) {
        if (findByUsername(username) != null) return
        createUser(
            UserUpsertRequest(
                username = username,
                displayName = displayName,
                password = password,
                role = role,
                enabled = true
            )
        )
    }

    private fun hashPassword(password: String): String =
        BCrypt.withDefaults().hashToString(12, password.toCharArray())

    private fun hashToken(token: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(token.toByteArray(Charsets.UTF_8))
        return HexFormat.of().formatHex(bytes)
    }

    private fun newToken(): String {
        val bytes = ByteArray(32)
        random.nextBytes(bytes)
        return HexFormat.of().formatHex(bytes)
    }

    private fun touchSession(connection: Connection, token: String) {
        connection.prepareStatement("update sessions set last_seen_at = now() where token_hash = ?").use { statement ->
            statement.setString(1, hashToken(token))
            statement.executeUpdate()
        }
    }

    private fun normalizeUsername(value: String): String =
        value.trim().lowercase()

    private fun normalizeDisplayName(value: String?, fallback: String): String =
        value?.trim()?.takeIf { it.isNotBlank() } ?: fallback

    private fun normalizeRole(value: String): String =
        if (value == "admin") "admin" else "user"

    private fun <T> connection(block: (Connection) -> T): T =
        dataSource.connection.use { connection ->
            connection.autoCommit = true
            block(connection)
        }

    private fun ResultSet.toPublicUser(): PublicUser =
        PublicUser(
            id = getInt("id"),
            username = getString("username"),
            displayName = getString("display_name"),
            role = getString("role"),
            enabled = getBoolean("enabled")
        )

    private fun ResultSet.toUserRecord(): UserRecord =
        UserRecord(
            id = getInt("id"),
            username = getString("username"),
            passwordHash = getString("password_hash"),
            displayName = getString("display_name"),
            role = getString("role"),
            enabled = getBoolean("enabled")
        )

    companion object {
        const val DEFAULT_PASSWORD = "2026"
    }
}

data class UserRecord(
    val id: Int,
    val username: String,
    val passwordHash: String,
    val displayName: String,
    val role: String,
    val enabled: Boolean
) {
    fun toPublicUser(): PublicUser =
        PublicUser(
            id = id,
            username = username,
            displayName = displayName,
            role = role,
            enabled = enabled
        )
}
