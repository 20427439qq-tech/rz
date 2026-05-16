# 网关策略注册清单

上线顺序：先注册策略并验证，再发布业务接口。

| method | path_pattern | auth_required | permission_code | 说明 |
| --- | --- | --- | --- | --- |
| GET | `/health` | `false` |  | 健康检查 |
| GET | `/api/examples/me` | `true` | `example:read` | 读取网关透传用户上下文 |
| POST | `/api/examples/echo` | `true` | `example:create` | 示例业务写入入口 |

新增业务接口时至少补齐：

- `method`
- `path_pattern`
- `auth_required`
- `permission_code`，需要鉴权时必填
