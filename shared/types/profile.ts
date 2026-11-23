import type { allTitles } from "../data/allTitle";
import type { GameUserCustomStyle } from "./style";

export type UserProfile = {
    uuid: string;
    name: string;
    avatar: string;
    title: keyof typeof allTitles

    style: GameUserCustomStyle

    ironcat: boolean
}