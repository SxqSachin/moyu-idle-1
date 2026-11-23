export interface ChatMessage {
  id: number
  sender: string         // 用户uuid
  sender_name: string    // 用户昵称
  receiver_id?: string   // 私聊时用，群聊/全局可为空
  receiver_name?: string   // 私聊时用，群聊/全局可为空
  content: string        // 消息内容
  created_At: string     // ISO 时间字符串
  is_revoked?: boolean   // 是否撤回
  is_deleted?: boolean   // 是否删除
  extra?: string         // 扩展字段(JSON)
  extra2?: {
    guildTitle?: string
    nameStyle?: string
    contentStyle?: string
    ironcat?: boolean
    bubble?: string

    bubbleDiyStyle?: {
      bgColor: string[]
      textColor: string[]
      textShadow?: {color: string, blur: number}[];
    }
  }
  
  // 扩展字段(JSON)

  extraSFX?: string      // 附加的特效

  bubbleStyle?: string // 气泡样式
}