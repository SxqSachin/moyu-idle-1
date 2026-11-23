# 聊天屏蔽功能说明

## 概述
玩家可通过新的 Socket 事件将某些用户加入自己的屏蔽列表，被屏蔽用户的公屏/铁猫公屏实时消息与历史消息均不会再显示。

## 数据存储
- Redis Set: `chat:block:{userUuid}`
  - 成员：被该用户屏蔽的 target 用户 uuid 列表
  - 默认不设置过期（当前实现）。

## 新增事件
| 事件 | 方向 | 参数 | 说明 |
|------|------|------|------|
| `chat:blockUser` | C->S | `{ targetUuid }` | 屏蔽某玩家 |
| `chat:unblockUser` | C->S | `{ targetUuid }` | 取消屏蔽 |
| `chat:getBlockList` | C->S | `null` | 获取当前屏蔽列表 |
| `chat:block:success` | S->C | `{ targetUuid }` | 屏蔽成功回执 |
| `chat:unblock:success` | S->C | `{ targetUuid }` | 取消屏蔽成功 |
| `chat:blockList:success` | S->C | `{ list: string[] }` | 屏蔽列表返回 |
| `chat:block:error` 等 | S->C | `{ message }` | 错误返回 |

## 历史记录过滤
`chat:getChatList`、`chat:getIronPublicChatList` 在返回前对消息数组执行过滤：如果消息 `sender` 在当前用户屏蔽集合中则剔除。

## 实时消息过滤
公屏与铁猫公屏发送逻辑改为遍历在线用户房间，对屏蔽发送者的用户跳过发送。若无法获取全局 `io`（fallback），则回退为原广播方式（此时不会过滤实时消息，只过滤历史）。

## 兼容性
私聊暂未强制过滤；前端可在收到私聊时本地再做一次屏蔽判断（如需服务端级别屏蔽，可在 `chat:createPrivateChatMsg` 中加入校验逻辑）。

## 后续可选改进
1. 为 block Set 限制最大容量（防滥用）。
2. 增加持久化（写入数据库）用于跨 Redis 重启保留。
3. 添加服务器端私聊拦截逻辑（如果被屏蔽则拒绝发送 / 或允许但不投递）。
4. 引入批量查询（pipeline）优化大量在线用户时的过滤性能（当前逐用户 sMembers 只在存在消息发送时触发）。

---
如需扩展到工会 / 房间聊天，复用相同过滤辅助函数即可。
