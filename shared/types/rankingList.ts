
export type RankingListItem = {
    uuid: string
    name: string
    avatar: string
    rank: string | number
    exp?: number // 经验值，仅在角色等级榜中使用
}
export type RankingList = {
    name: string
    list: RankingListItem[]
}