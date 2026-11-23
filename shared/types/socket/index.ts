export type GameSocketUserInfo = {
    name: string,
    uuid: string,
    firstResetPassword: boolean

    isVisitor?: boolean

    isIronCat?: boolean
}
export type GameSocketData<T> = {
    user: GameSocketUserInfo
    data: T
}
