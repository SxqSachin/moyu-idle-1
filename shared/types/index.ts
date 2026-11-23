export type MinMax = {
    min: number
    max: number
}

export type BaseDescriptableObject = {
    name: string
    description: string
    icon: string
}

export type FuncReturnVoid = ((...args: any[]) => void) | undefined
export type FuncAction = ((...args: any[]) => void)

export * from "./codex"