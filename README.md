# RBAC Business Skeleton

业务系统接入 RBAC Gateway 的 Kotlin/Ktor 脚手架。

## 技术基线

- JDK 25
- Gradle 9+
- Kotlin 2.3+
- Ktor 3.4+
- PostgreSQL 42.7+
- HikariCP 7.0+
- Exposed 1.1+
- Redisson 4.2+

## 项目边界

业务系统运行在网关后面，不承担统一登录和 RBAC 鉴权。网关负责拦截 `401`、`403`、`503`，业务系统只消费网关透传的用户上下文：

- `X-User-Id`
- `X-Username`
- `X-Roles`

## 本地运行

安装 JDK 25 和 Gradle 9+ 后执行：

```bash
gradle run
```

默认启动端口为 `8080`，可用环境变量覆盖：

```bash
PORT=8081 gradle run
```

数据库默认未启用，方便先启动服务骨架。需要 PostgreSQL 时设置：

```bash
DB_ENABLED=true
DB_JDBC_URL=jdbc:postgresql://127.0.0.1:5432/rbac_business
DB_USERNAME=postgres
DB_PASSWORD=postgres
gradle run
```

Redis 默认连接 `redis://127.0.0.1:6379`。业务需要缓存时设置 `REDIS_ENABLED=true`。

## 示例接口

- `GET /health`
- `GET /api/examples/me`
- `POST /api/examples/echo`

网关策略注册清单见 `docs/gateway-routes.md`。
