import { hasClass } from "element-plus/es/utils/index.mjs";
import type { KittyFurniture } from "../types/kittyFurniture";

export const allKittyFurniture: Record<string, KittyFurniture> = {
  autoFeeder: {
    id: "autoFeeder",
    name: '自动投喂器',
    description: "在猫舍中配置一个自动投喂器，让你的小猫咪在饿的时候可以自己去吃东西",
    icon: "resource:autoFeeder",
    maxLevel: 5,
    durability: 100,
    durabilityLossPerHour: 1,

    effectDescription: [
        '当猫咪助手的饱食度降低至50%以下时，自动投喂器会自动为猫咪提供食物。',
    ],

    installRequirement: [
      {
        resource: [
          { id: "autoFeeder", count: 1 }
        ],
      },
    ],
    repairRequirement: [
      {
        resource: [
          { id: "autoFeeder", count: 1 }
        ],
      },
    ],

    hasConfig: true
  },
  scratchingPost: {
    id: "scratchingPost",
    name: "猫抓板",
    description: "给猫咪放松压力，以便更高效的工作",
    icon: "resource:scratchingPost",
    maxLevel: 1,
    durability: 100,
    durabilityLossPerHour: 1,

    effectDescription: [
      "猫咪助手行动耗时降低3%",
    ],

    installRequirement: [
      {
        resource: [
          { id: "scratchingPost", count: 1 },
        ],
      },
    ],
    repairRequirement: [
      {
        resource: [
          { id: "scratchingPost", count: 1 },
        ],
      },
    ],
  },
  studyDesk: {
    id: "studyDesk",
    name: "书桌",
    description: "一个让猫咪助手记录生活的地方，使猫咪助手可以记录下自己的学习内容",
    icon: "resource:studyDesk",
    maxLevel: 1,
    durability: 100,
    durabilityLossPerHour: 3,

    effectDescription: [
      "猫咪助手执行的动作可以为你提供35%对应行动的经验"
    ],

    installRequirement: [
      {
        resource: [
          { id: "studyDesk", count: 1 },
        ],
      },
    ],
    repairRequirement: [
      {
        resource: [
          { id: "pencil", count: 1 },
          { id: "paper", count: 8 },
          { id: "book", count: 1 },
        ],
      },
    ],
  },
  furnitureCashmereToy: {
    id: "furnitureCashmereToy",
    name: "毛绒玩具",
    description: "一只可爱的毛绒玩具，给小猫咪玩再好不过了",
    icon: "resource:cashmereToy",
    maxLevel: 1,
    durability: 100,
    durabilityLossPerHour: 4,

    effectDescription: [
      "猫咪助手执行的所有行动耗时减少2%，并有5%概率额外获取一次当前动作的奖励（不包含经验）"
    ],

    installRequirement: [
      {
        resource: [
          { id: "cashmereToy", count: 1 },
        ],
      },
    ],
    repairRequirement: [
      {
        resource: [
          { id: "cashmereToy", count: 1 },
        ],
      },
    ],
  },
  silkKittyNest: {
    id: "silkKittyNest",
    name: "舒适猫窝",
    description: "猫咪很喜欢在这里打盹",
    icon: "resource:silkKittyNest",
    maxLevel: 1,
    durability: 100,
    durabilityLossPerHour: 2,

    effectDescription: [
      "猫咪助手执行的所有行动耗时减少2%，并有5%概率在完成动作时，返还当前动作的消耗"
    ],

    installRequirement: [
      {
        resource: [
          { id: "silkKittyNest", count: 1 },
        ],
      },
    ],
    repairRequirement: [
      {
        resource: [
          { id: "silkKittyNest", count: 1 },
        ],
      },
    ],
  },
  silkCurtain: {
    id: "silkCurtain",
    name: "遮光窗帘",
    description: "足够遮光的窗帘，可以让猫咪更好的休息。猫咪也很喜欢抓窗帘～",
    icon: "resource:silkCurtain",
    maxLevel: 1,
    durability: 100,
    durabilityLossPerHour: 4,

    effectDescription: [
      "猫咪助手在休息时，每小时心情回复+15。猫咪助手在工作时，每小时心情消耗-0.3。猫咪助手在夜间（19:00～06:00），即使在工作状态下每小时也有7%概率回复1点心情。",
    ],

    installRequirement: [
      {
        resource: [
          { id: "silkCurtain", count: 1 },
        ],
      },
    ],
    repairRequirement: [
      {
        resource: [
          { id: "silkCurtain", count: 1 },
        ],
      },
    ],
  },
};

export type AllKittyFurnitureID = keyof typeof allKittyFurniture;

export type KittyFurnitureExistInfo = {[key in AllKittyFurnitureID]?: boolean}