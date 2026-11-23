import type { GameActionReward } from "../types/gameAction";
import type { KittyEssayType } from "../types/kittyEssayInfo";
import type { allGameActionMainType } from "./allGameActions";

export const allKittyEssayContent: {
  [mainType in keyof typeof allGameActionMainType]: KittyEssayType[];
} = {
  collecting: [
    {
      content: "今天在草丛里发现了好多新鲜的叶子，真开心！",
      reward: [
        {
          id: "windBellHerb",
          percent: 0.6,
          range: {
            min: 1,
            max: 2,
          },
        },
        {
          id: "dawnBlossom",
          percent: 0.6,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "小爪子沾满了泥土，但收获满满。", reward: [] },
    { content: "采集的时候遇到了一只蝴蝶，和它玩了好久。", reward: [] },
    { content: "阳光下采集，感觉一切都很美好。", reward: [] },
    { content: "今天的收获比昨天多了一点点。", reward: [] },
    {
      content: "偶然发现了一颗特别大的蘑菇。",
      reward: [
        {
          id: "hugeMushroom",
          percent: 1,
          count: 1,
        },
      ],
    },
    { content: "和伙伴一起采集，效率翻倍！", reward: [] },
    { content: "风吹过，带来了好多落叶。", reward: [] },
    { content: "采集途中遇到了一只小松鼠。", reward: [] },
    { content: "今天的采集让我觉得自己很厉害。", reward: [] },
    {
      content: "发现了一种没见过的小果子。",
      reward: [
        {
          id: "mysteriousBerry_1",
          percent: 1,
          count: 2,
        },
      ],
    },
    { content: "采集结束后，躺在草地上休息。", reward: [] },
    { content: "采集的时候被蚂蚁咬了一口，好痒。", reward: [] },
    { content: "今天的采集任务完成得很顺利。", reward: [] },
    { content: "遇到了一场小雨，采集变得有趣了。", reward: [] },
    {
      content: "采集到了一些稀有的材料。",
      reward: [
        {
          id: "luminousMoss",
          percent: 0.8,
          range: {
            min: 1,
            max: 2,
          },
        },
        {
          id: "mysteriousBerry_1",
          percent: 0.8,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "和朋友一起比赛谁采集得多。", reward: [] },
    {
      content: "采集途中唱了好多歌。",
      reward: [
        {
          id: "cutePoint",
          percent: 0.6,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "发现了一条小溪，水很清澈。", reward: [] },
    { content: "采集的时候不小心摔了一跤。", reward: [] },
    { content: "今天的采集让我学到了新知识。", reward: [] },
    {
      content: "捡到了一个特别的东西",
      reward: [
        {
          id: "mysteriousBerry_1",
          percent: 0.8,
          range: {
            min: 1,
            max: 2,
          },
        },
        {
          id: "cuteBracelet",
          percent: 0.1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "采集结束后，和大家分享了成果。", reward: [] },
    {
      content: "遇到了一只迷路的小鸟。",
      reward: [
        {
          id: "cutePoint",
          percent: 0.6,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    {
      content: "采集的时候看到了美丽的彩虹。",
      reward: [
        {
          id: "rainbowShard",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    {
      content: "今天的采集让我心情很好。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "采集的时候闻到了花香，忍不住打了个滚。", reward: [] },
    { content: "今天的草丛特别柔软，踩起来很舒服。", reward: [] },
    { content: "采集的时候和小虫子打了个招呼。", reward: [] },
    { content: "发现了一块超级大的树叶，可以当帽子戴。", reward: [] },
    {
      content: "采集结束后，晒晒太阳，暖洋洋的。",
      reward: [
        {
          id: "cutePoint",
          percent: 0.5,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "今天的收获装满了我的小篮子。", reward: [] },
    { content: "采集的时候和伙伴一起玩捉迷藏。", reward: [] },
    { content: "遇到了一只好奇的小兔子。", reward: [] },
    { content: "采集途中发现了一个秘密洞穴。", reward: [] },
    { content: "今天的采集让我觉得自己是探险家。", reward: [] },
    { content: "采集的时候听到了远处的鸟叫声。", reward: [] },
    {
      content: "发现了一颗闪闪发亮的小石头。",
      reward: [
        {
          id: "flashStone",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "采集结束后，和大家一起吃点心。", reward: [] },
    { content: "今天的采集让我变得更聪明了。", reward: [] },
    { content: "采集的时候和朋友一起讲笑话。", reward: [] },
    { content: "遇到了一只喜欢跳舞的小松鼠。", reward: [] },
    { content: "采集途中看到了美丽的夕阳。", reward: [] },
    { content: "今天的采集让我很满足。", reward: [] },
    { content: "采集的时候和伙伴一起拍照留念。", reward: [] },
    { content: "发现了一片特别绿的草地。", reward: [] },
    { content: "采集结束后，大家一起唱歌。", reward: [] },
    { content: "今天的采集让我觉得很幸福。", reward: [] },
    { content: "采集的时候和小鸟一起跳舞。", reward: [] },
    { content: "遇到了一只会唱歌的小虫子。", reward: [] },
    { content: "采集途中发现了一个小水塘，水很清凉。", reward: [] },
  ],
  farmingAnimal: [
    { content: "今天给小鸡喂了好多粮食，它们咯咯叫着很开心。", reward: [] },
    {
      content: "照顾小动物让我觉得很有成就感。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "帮小羊梳理毛发，毛茸茸的好舒服。", reward: [] },
    { content: "和小牛一起晒太阳，暖洋洋的。", reward: [] },
    { content: "今天的动物们都很乖巧。", reward: [] },
    { content: "给小猪洗澡，结果自己也湿了。", reward: [] },
    { content: "动物们吃饱后都围着我转。", reward: [] },
    { content: "小鸭子跟在我后面走了一圈。", reward: [] },
    { content: "今天学会了新的照料技巧。", reward: [] },
    { content: "动物们的叫声很有节奏感。", reward: [] },
    { content: "帮小兔子搭了一个新窝。", reward: [] },
    {
      content: "动物们都喜欢我带来的食物。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    {
      content: "今天的照料工作很轻松。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "小羊跳来跳去，特别活泼。", reward: [] },
    { content: "动物们一起玩耍的样子很可爱。", reward: [] },
    { content: "给动物们讲了一个故事。", reward: [] },
    {
      content: "小鸡下了好多蛋，收获满满。",
      reward: [
        {
          id: "chickenEgg",
          percent: 1,
          range: {
            min: 4,
            max: 8,
          },
        },
      ],
    },
    { content: "动物们都很健康，真开心。", reward: [] },
    { content: "今天帮小牛治好了小伤口。", reward: [] },
    { content: "动物们喜欢我的陪伴。", reward: [] },
    { content: "照料动物让我心情愉快。", reward: [] },
    { content: "动物们的毛发变得更柔顺了。", reward: [] },
    { content: "今天和动物们一起玩捉迷藏。", reward: [] },
    { content: "动物们都很信任我。", reward: [] },
    { content: "照料结束后，大家一起休息。", reward: [] },
    { content: "今天给小羊编了一个漂亮的花环。", reward: [] },
    {
      content: "动物们听我唱歌，摇头晃脑。",
      reward: [
        {
          id: "cutePoint",
          percent: 0.2,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "小兔子跳到我怀里，软软的。", reward: [] },
    { content: "今天的动物们特别有活力。", reward: [] },
    {
      content: "居然有只小羊穿着鞋子！",
      reward: [
        {
          id: "cuteShoes",
          percent: 0.04,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    {
      content: "居然有只小牛穿着鞋子！",
      reward: [
        {
          id: "cuteShoes",
          percent: 0.03,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "给小鸭子讲了一个笑话，它们嘎嘎笑。", reward: [] },
    { content: "动物们一起追逐，场面很热闹。", reward: [] },
    {
      content: "今天帮小猪找到了它丢失的玩具。",
      reward: [
        {
          id: "cashmereToy",
          percent: 0.2,
          range: {
            min: 1,
            max: 2,
          },
        },
        {
          id: "cuteDoll",
          percent: 0.06,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "动物们喜欢我新做的点心。", reward: [] },
    { content: "小牛舔了舔我的手，好温柔。", reward: [] },
    { content: "今天的动物们都很有礼貌。", reward: [] },
    { content: "给小鸡们搭了一个新家。", reward: [] },
    { content: "动物们一起晒太阳，暖洋洋的。", reward: [] },
    { content: "今天帮小羊剪了毛，变得更清爽。", reward: [] },
    { content: "动物们喜欢我的新发型。", reward: [] },
    { content: "小兔子和我一起跳舞。", reward: [] },
    { content: "今天的动物们都很开心。", reward: [] },
    { content: "给小鸭子洗了个泡泡浴。", reward: [] },
    { content: "动物们一起听故事，安静极了。", reward: [] },
    { content: "今天帮小牛画了个小花。", reward: [] },
    { content: "动物们喜欢我的陪伴。", reward: [] },
    { content: "小鸡们围着我转圈圈。", reward: [] },
    { content: "今天的动物们都很健康。", reward: [] },
    { content: "给小猪做了个新帽子。", reward: [] },
    { content: "动物们一起玩游戏，笑声不断。", reward: [] },
    { content: "今天帮小羊找到了它的朋友。", reward: [] },
    {
      content: "在鸡窝里找到了亮闪闪的东西！",
      reward: [
        {
          id: "goldenEgg",
          percent: 0.01,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
  ],
  fishing: [
    {
      content: "今天钓到了一顶帽子，吹干也许还能戴！",
      reward: [
        {
          id: "cuteHat",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    {
      content: "今天钓到了一个布娃娃，谁把这么新的娃娃给扔了呀！",
      reward: [
        {
          id: "plushFur",
          percent: 0.3,
          range: {
            min: 1,
            max: 2,
          },
        },
        {
          id: "cashmereToy",
          percent: 0.3,
          range: {
            min: 1,
            max: 2,
          },
        },
        {
          id: "cuteDoll",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    {
      content: "今天钓到了一条大鱼，超级有成就感！",
      reward: [
        {
          id: "emberEel",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "湖边的风景很美，钓鱼很放松。", reward: [] },
    {
      content: "鱼竿差点被鱼拉走，好刺激。",
      reward: [
        {
          id: "jadeTuna",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "钓鱼的时候遇到了一只青蛙。", reward: [] },
    { content: "今天的鱼口特别好。", reward: [] },
    {
      content: "钓到了一条彩色的小鱼。",
      reward: [
        {
          id: "rainbowFish",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "和朋友一起钓鱼，聊了很多天。", reward: [] },
    {
      content: "钓鱼的时候看到了水里的倒影。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "今天的鱼都很活跃。", reward: [] },
    { content: "钓鱼结束后，晒晒太阳很舒服。", reward: [] },
    {
      content: "钓到了一条稀有的鱼。",
      reward: [
        {
          id: "darkFish",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "鱼饵用完了，只好回家。", reward: [] },
    { content: "钓鱼的时候听到了鸟叫声。", reward: [] },
    {
      content: "今天的钓鱼让我很满足。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "钓鱼途中遇到了一阵小雨。", reward: [] },
    {
      content: "钓到了一条特别胖的鱼。",
      reward: [
        {
          id: "fatFish",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "钓鱼的时候学会了新技巧。", reward: [] },
    { content: "今天的鱼都很配合。", reward: [] },
    { content: "钓鱼结束后，和大家分享了成果。", reward: [] },
    { content: "钓鱼的时候看到了美丽的水草。", reward: [] },
    {
      content: "今天的钓鱼让我心情很好。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "钓到了一条跳跃力很强的鱼。", reward: [] },
    { content: "钓鱼的时候被蚊子咬了一口。", reward: [] },
    { content: "钓鱼途中遇到了一只小鸭子。", reward: [] },
    { content: "今天的钓鱼让我学到了新知识。", reward: [] },
    { content: "钓鱼的时候和小鱼聊了会天。", reward: [] },
    { content: "今天的湖面像镜子一样平静。", reward: [] },
    { content: "钓鱼的时候和朋友比赛谁钓得多。", reward: [] },
    { content: "发现了一条会跳舞的小鱼。", reward: [] },
    { content: "钓鱼结束后，大家一起吃烤鱼。", reward: [] },
    { content: "今天的鱼群特别热闹。", reward: [] },
    { content: "钓鱼的时候看到了美丽的夕阳。", reward: [] },
    { content: "钓到了一条会唱歌的鱼。", reward: [] },
    { content: "钓鱼的时候和青蛙一起唱歌。", reward: [] },
    { content: "今天的钓鱼让我觉得自己很厉害。", reward: [] },
    { content: "钓鱼途中遇到了一只小乌龟。", reward: [] },
    { content: "钓鱼的时候和朋友一起拍照。", reward: [] },
    { content: "发现了一条超级大的鱼。", reward: [] },
    {
      content: "钓鱼结束后，大家一起晒太阳。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "今天的钓鱼让我变得更聪明了。", reward: [] },
    { content: "钓鱼的时候和小鸭子一起玩水。", reward: [] },
    {
      content: "钓到了一条闪闪发亮的鱼。",
      reward: [
        {
          id: "flashFish",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "钓鱼的时候和朋友一起讲笑话。", reward: [] },
    { content: "今天的鱼群特别有活力。", reward: [] },
    { content: "钓鱼结束后，大家一起唱歌。", reward: [] },
    { content: "发现了一条喜欢跳跃的小鱼。", reward: [] },
    { content: "钓鱼的时候和小鸟一起玩耍。", reward: [] },
    { content: "今天的钓鱼让我觉得很幸福。", reward: [] },
    { content: "钓鱼途中遇到了一只小猫咪。", reward: [] },
    { content: "钓鱼的时候和朋友一起画画。", reward: [] },
    { content: "今天的鱼群像在开派对一样热闹。", reward: [] },
    { content: "钓鱼的时候和小螃蟹打了个招呼。", reward: [] },
  ],

  cooking: [
    {
      content: "今天做了一道新菜，味道棒极了！",
      reward: [
        {
          id: "sashimiPlatter",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    {
      content: "烹饪的时候厨房里香气四溢。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "学会了新的烹饪技巧。", reward: [] },
    {
      content: "做饭的时候不小心撒了点盐。",
      reward: [
        {
          id: "failedFood",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "今天的菜色很丰富。", reward: [] },
    { content: "烹饪结束后，大家一起品尝美食。", reward: [] },
    {
      content: "做了一份甜点，大家都很喜欢。",
      reward: [
        {
          id: "custardPudding",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    {
      content: "烹饪的时候听着音乐，心情很好。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "今天的烹饪让我很有成就感。", reward: [] },
    {
      content: "做饭的时候遇到了一点小麻烦。",
      reward: [
        {
          id: "failedFood",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "烹饪结束后，厨房很整洁。", reward: [] },
    {
      content: "做了一道家乡的菜。",
      reward: [
        {
          id: "mushroomStew",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "烹饪的时候和朋友一起合作。", reward: [] },
    {
      content: "今天的菜肴色香味俱全。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    {
      content: "做饭的时候不小心烫了一下。",
      reward: [
        {
          id: "failedFood",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "烹饪结束后，大家都很满意。", reward: [] },
    { content: "做了一份特别的料理。", reward: [] },
    { content: "烹饪的时候尝了好多次味道。", reward: [] },
    { content: "今天的烹饪让我学到了新知识。", reward: [] },
    { content: "做饭的时候厨房很热闹。", reward: [] },
    {
      content: "烹饪结束后，大家一起聊天。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "做了一道创意料理。", reward: [] },
    { content: "烹饪的时候看到了美丽的夕阳。", reward: [] },
    { content: "今天的烹饪让我心情很好。", reward: [] },
    {
      content: "做饭的时候被调料呛了一下。",
      reward: [
        {
          id: "failedFood",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    {
      content: "今天做了一份猫咪专属小点心。",
      reward: [
        {
          id: "luxuryCatFood",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "烹饪的时候和朋友一起跳舞。", reward: [] },
    { content: "做饭的时候厨房里充满了欢笑。", reward: [] },
    { content: "今天的菜肴特别有创意。", reward: [] },
    { content: "烹饪结束后，大家一起拍照留念。", reward: [] },
    {
      content: "做了一道超级美味的汤。",
      reward: [
        {
          id: "fishSoup",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "烹饪的时候和朋友比赛谁做得快。", reward: [] },
    { content: "今天的厨房特别整洁。", reward: [] },
    { content: "做饭的时候和朋友一起讲笑话。", reward: [] },
    { content: "烹饪结束后，大家一起吃蛋糕。", reward: [] },
    {
      content: "做了一份会发光的料理。",
      reward: [
        {
          id: "flashFood",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "烹饪的时候和朋友一起画画。", reward: [] },
    { content: "今天的菜肴特别有营养。", reward: [] },
    { content: "做饭的时候厨房里很温暖。", reward: [] },
    { content: "烹饪结束后，大家一起唱歌。", reward: [] },
    {
      content: "做了一道特别的猫咪料理。",
      reward: [
        {
          id: "sashimiPlatter",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "烹饪的时候和朋友一起玩游戏。", reward: [] },
    { content: "今天的菜肴特别有色彩。", reward: [] },
    { content: "做饭的时候厨房里很安静。", reward: [] },
    { content: "烹饪结束后，大家一起喝茶。", reward: [] },
    {
      content: "做了一份超级可爱的甜点。",
      reward: [
        {
          id: "windBellMilkShake",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "烹饪的时候和朋友一起拍视频。", reward: [] },
    { content: "今天的菜肴特别有味道。", reward: [] },
    {
      content: "做饭的时候厨房里很有爱。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "烹饪结束后，大家一起分享美食。", reward: [] },
    {
      content: "今天做了一份会跳舞的蛋糕。",
      reward: [
        {
          id: "dancingCake",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
  ],

  mining: [
    {
      content: "今天挖到了好多矿石，收获满满。",
      reward: [
        {
          id: "stone",
          percent: 1,
          range: {
            min: 3,
            max: 6,
          },
        },
        {
          id: "iron",
          percent: 0.5,
          range: {
            min: 3,
            max: 6,
          },
        },
      ],
    },
    { content: "矿洞里很凉快，适合工作。", reward: [] },
    { content: "挖矿的时候遇到了一只小蝙蝠。", reward: [] },
    {
      content: "今天的矿石特别闪亮。",
      reward: [
        {
          id: "flashStone",
          percent: 1,
          range: {
            min: 3,
            max: 6,
          },
        },
      ],
    },
    { content: "挖矿途中发现了一条小溪。", reward: [] },
    { content: "矿洞里回声很有趣。", reward: [] },
    { content: "挖矿的时候学会了新技巧。", reward: [] },
    { content: "今天的矿石种类很丰富。", reward: [] },
    {
      content: "挖矿结束后，大家一起休息。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "矿洞里偶遇了一只小老鼠。", reward: [] },
    { content: "挖矿的时候不小心摔了一跤。", reward: [] },
    {
      content: "今天的挖矿让我很有成就感。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "矿石很重，搬运很辛苦。", reward: [] },
    { content: "挖矿的时候听到了奇怪的声音。", reward: [] },
    { content: "今天的矿洞很安静。", reward: [] },
    { content: "挖矿结束后，大家一起分享成果。", reward: [] },
    { content: "矿洞里空气很清新。", reward: [] },
    { content: "挖矿的时候遇到了一点小麻烦。", reward: [] },
    { content: "今天的矿石很稀有。", reward: [] },
    { content: "挖矿途中遇到了一场小雨。", reward: [] },
    { content: "矿洞里灯光很柔和。", reward: [] },
    {
      content: "挖矿的时候看到了美丽的矿脉。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "今天的挖矿让我学到了新知识。", reward: [] },
    { content: "挖矿结束后，大家一起聊天。", reward: [] },
    { content: "矿洞里偶遇了一只小猫咪。", reward: [] },
    {
      content: "今天挖到了一块会发光的石头。",
      reward: [
        {
          id: "flashStone",
          percent: 1,
          range: {
            min: 3,
            max: 6,
          },
        },
      ],
    },
    { content: "挖矿的时候和朋友比赛谁挖得多。", reward: [] },
    { content: "矿洞里有好多神秘的角落。", reward: [] },
    { content: "挖矿的时候和小老鼠一起玩捉迷藏。", reward: [] },
    { content: "今天的矿石像糖果一样漂亮。", reward: [] },
    { content: "挖矿结束后，大家一起吃点心。", reward: [] },
    { content: "矿洞里有好多奇怪的声音。", reward: [] },
    { content: "挖矿的时候和朋友一起唱歌。", reward: [] },
    { content: "今天的矿石特别有分量。", reward: [] },
    { content: "挖矿途中遇到了一只小蝴蝶。", reward: [] },
    {
      content: "矿洞里有好多闪闪发亮的石头。",
      reward: [
        {
          id: "flashStone",
          percent: 1,
          range: {
            min: 8,
            max: 12,
          },
        },
      ],
    },
    { content: "挖矿的时候和朋友一起画画。", reward: [] },
    { content: "今天的矿石像星星一样闪烁。", reward: [] },
    { content: "挖矿结束后，大家一起拍照留念。", reward: [] },
    {
      content: "矿洞里有好多有趣的故事。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "挖矿的时候和小猫咪一起探险。", reward: [] },
    {
      content: "今天的矿石特别有魔力。",
      reward: [
        {
          id: "manacrystal",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
        {
          id: "amberEyeStone",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "挖矿途中遇到了一只小鸟。", reward: [] },
    { content: "矿洞里有好多温暖的灯光。", reward: [] },
    { content: "挖矿的时候和朋友一起讲笑话。", reward: [] },
    { content: "今天的矿石像宝石一样珍贵。", reward: [] },
    { content: "挖矿结束后，大家一起喝水。", reward: [] },
    { content: "矿洞里有好多可爱的动物。", reward: [] },
    { content: "挖矿的时候和朋友一起跳舞。", reward: [] },
    {
      content: "今天的矿石让我觉得很幸福。",
      reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "挖矿途中遇到了一只小松鼠。", reward: [] },
  ],
  sewing: [
    {
      content: "今天缝制了一件新衣服，希望铲屎官喜欢",
      reward: [
        {
          id: "cuteOutfit",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "缝制的时候线团滚来滚去，好像在玩捉迷藏。", reward: [] },
    { content: "学会了新的缝制技巧，感觉自己很厉害。", reward: [] },
    { content: "缝制结束后，衣服很合身，穿上就想跳舞。", reward: [] },
    { content: "今天的缝制让我很有成就感，尾巴都翘起来了。", reward: [] },
    { content: "缝制的时候不小心扎了一下，喵呜~不过很快就好了。", reward: [] },
    { content: "缝制结束后，大家一起品鉴作品，大家都夸我手巧。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
    ] },
    { content: "缝制的时候听着缝纫机的声音，像在唱歌。", reward: [] },
    { content: "今天的缝制让我学到了新知识，脑袋变聪明了。", reward: [] },
    { content: "缝制结束后，大家一起聊天，分享缝制小秘密。", reward: [] },
    { content: "缝制的时候看到了美丽的布料，忍不住摸了又摸。", reward: [] },
    { content: "今天的缝制很顺利，线头都乖乖听话。", reward: [] },
    { content: "缝制的时候遇到了一点小麻烦，不过很快解决了。", reward: [] },
    { content: "缝制结束后，衣服很漂亮，大家都想拍照。", reward: [] },
    {
      content: "做了一件创意缝制作品，大家都说很有趣。",
      reward: [
        {
          id: "cuteHat",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "缝制的时候看到了夕阳，感觉很温暖。", reward: [] },
    { content: "今天的缝制让我心情很好，想唱歌。", reward: [] },
    { content: "缝制结束后，大家一起休息，喝点小奶。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
    ] },
    { content: "缝制的时候被线缠住了，像在玩游戏。", reward: [] },
    { content: "缝制结束后，衣服很耐用，可以穿很久。", reward: [] },
    { content: "缝制的时候学会了新配色，颜色搭配很棒。", reward: [] },
    { content: "今天的缝制让我很满意，尾巴摇个不停。", reward: [] },
    { content: "缝制结束后，大家一起分享成果，大家都很开心。", reward: [] },
    { content: "缝制的时候偶遇了一只小猫咪，一起玩线团。", reward: [] },
    {
      content: "今天缝制了一条漂亮的围巾，戴上很暖和。",
      reward: [
        // {
        //   id: 'cuteScarf',
        //   percent: 1,
        //   range: {
        //     min: 1,
        //     max: 1
        //   }
        // },
      ],
    },
    { content: "缝制的时候和朋友一起比赛谁缝得快。", reward: [] },
    {
      content: "做了一只可爱的布娃娃，大家都喜欢。",
      reward: [
        {
          id: "cuteDoll",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "缝制的时候听到窗外小鸟叫，心情更好了。", reward: [] },
    { content: "今天的缝制让我觉得自己是小小设计师。", reward: [] },
    { content: "缝制结束后，大家一起拍照留念。", reward: [] },
    { content: "缝制的时候和伙伴一起讲笑话，大家都笑了。", reward: [] },
    {
      content: "做了一件有猫耳朵的帽子，超级可爱。",
      reward: [
        {
          id: "cuteHat",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "缝制的时候发现了一块特别软的布料。", reward: [] },
    { content: "今天的缝制让我变得更有耐心。", reward: [] },
    { content: "缝制结束后，大家一起吃点心。", reward: [] },
    { content: "缝制的时候和朋友一起唱歌，气氛很棒。", reward: [] },
    {
      content: "做了一件五彩斑斓的小裙子。",
      reward: [
        {
          id: "cuteDress",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "缝制的时候窗外下起了小雨，感觉很温馨。", reward: [] },
    { content: "今天的缝制让我觉得很幸福。", reward: [] },
    { content: "缝制的时候和小猫咪一起打滚。", reward: [] },
    { content: "做了一件带铃铛的衣服，走路叮当响。", reward: [] },
    { content: "缝制的时候学会了新缝法，大家都来学。", reward: [] },
    { content: "今天的缝制让我变得更细心。", reward: [] },
    { content: "缝制结束后，大家一起喝奶茶。", reward: [] },
    { content: "缝制的时候和伙伴一起画图纸。", reward: [] },
    { content: "做了一件带蝴蝶结的衣服，超级萌。", reward: [] },
    { content: "缝制的时候和小猫咪一起玩线球。", reward: [] },
    { content: "今天的缝制让我觉得自己很棒。", reward: [] },
  ],

  forging: [
    { content: "今天锻造了一把新武器，大家都很惊喜。", reward: [] },
    { content: "锻造的时候火花四溅，感觉很有力量。", reward: [] },
    { content: "学会了新的锻造技巧，锤子用得越来越顺手。", reward: [
    ] },
    { content: "锻造结束后，武器很锋利，大家都来试用。", reward: [] },
    { content: "今天的锻造让我很有成就感，胡须都翘起来了。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 3,
          },
        },
    ] },
    { content: "锻造的时候不小心掉了一颗钉子，不过很快找到了。", reward: [] },
    { content: "锻造结束后，大家一起品鉴作品，大家都夸我手巧。", reward: [] },
    {
      content: "做了一件特别的锻造物品，大家都抢着要。",
      reward: [
        {
          id: "cuteHammer",
          percent: 0.06,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "锻造的时候听着锤子的声音，像在打鼓。", reward: [] },
    { content: "今天的锻造让我学到了新知识，脑袋变聪明了。", reward: [] },
    { content: "锻造结束后，大家一起聊天，分享锻造小秘密。", reward: [] },
    { content: "锻造的时候看到了美丽的火焰，忍不住多看了几眼。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
    ] },
    { content: "今天的锻造很顺利，材料都很配合。", reward: [] },
    { content: "锻造的时候遇到了一点小麻烦，不过很快解决了。", reward: [] },
    { content: "锻造结束后，武器很漂亮，大家都想拍照。", reward: [] },
    {
      content: "做了一件创意锻造作品，大家都说很有趣。",
      reward: [
        {
          id: "cuteHammer",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "锻造的时候看到了夕阳，感觉很温暖。", reward: [] },
    { content: "今天的锻造让我心情很好，想唱歌。", reward: [] },
    { content: "锻造结束后，大家一起休息，喝点小奶。", reward: [] },
    { content: "锻造的时候被火星溅了一下，喵呜~不过没事。", reward: [] },
    { content: "锻造结束后，武器很耐用，可以用很久。", reward: [] },
    { content: "锻造的时候学会了新配方，大家都来学习。", reward: [] },
    { content: "今天的锻造让我很满意，尾巴摇个不停。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "锻造结束后，大家一起分享成果，大家都很开心。", reward: [] },
    { content: "锻造的时候偶遇了一只小猫咪，一起玩锤子。", reward: [] },
    {
      content: "今天锻造了一把闪闪发亮的剑，大家都来围观。",
      reward: [
        {
          id: "cuteSword",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "锻造的时候和朋友一起比赛谁锻得快。", reward: [] },
    {
      content: "做了一只可爱的铁猫，大家都喜欢。",
      reward: [
        {
          id: "cuteIronCat",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "锻造的时候听到窗外小鸟叫，心情更好了。", reward: [] },
    { content: "今天的锻造让我觉得自己是小小铁匠。", reward: [] },
    { content: "锻造结束后，大家一起拍照留念。", reward: [] },
    { content: "锻造的时候和伙伴一起讲笑话，大家都笑了。", reward: [] },
    {
      content: "做了一件有猫耳朵的铁盒子，超级可爱。",
      reward: [
        {
          id: "cuteIronBox",
          percent: 0.001,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "锻造的时候发现了一块特别亮的金属。", reward: [] },
    { content: "今天的锻造让我变得更有耐心。", reward: [] },
    { content: "锻造结束后，大家一起吃点心。", reward: [] },
    { content: "锻造的时候和朋友一起唱歌，气氛很棒。", reward: [] },
    {
      content: "做了一件五彩斑斓的小铁器。",
      reward: [
        {
          id: "shinyIronSword",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "锻造的时候窗外下起了小雨，感觉很温馨。", reward: [] },
    { content: "今天的锻造让我觉得很幸福。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "锻造的时候和小猫咪一起打滚。", reward: [] },
    {
      content: "做了一件带铃铛的铁物品，摇一摇会响。",
      reward: [
        {
          id: "cuteIronBell",
          percent: 0.04,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "锻造的时候学会了新工艺，大家都来学。", reward: [] },
    { content: "今天的锻造让我变得更细心。", reward: [] },
    { content: "锻造结束后，大家一起喝奶茶。", reward: [] },
    { content: "锻造的时候和伙伴一起画设计图。", reward: [] },
    {
      content: "做了一件带蝴蝶结的小铁器，超级萌。",
      reward: [
        {
          id: "cuteIronShield",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "锻造的时候和小猫咪一起玩锤子。", reward: [] },
    { content: "今天的锻造让我觉得自己很棒。", reward: [] },
  ],

  mysterious: [
    {
      content: "今天炼金成功，得到了神秘的物品，喵呜~好神奇！",
      reward: [
        {
          id: "purifiedEctoplasm",
          percent: 0.1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "炼金的时候烟雾缭绕，像在云里穿梭。", reward: [] },
    { content: "学会了新的炼金配方，感觉自己是小魔法师。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 3,
          },
        },
    ] },
    {
      content: "炼金结束后，物品很稀有，大家都来围观。",
      reward: [
        {
          id: "pureEssence",
          percent: 0.4,
          range: {
            min: 1,
            max: 1,
          },
        },
        {
          id: "mysticalEssence",
          percent: 0.6,
          range: {
            min: 1,
            max: 3,
          },
        },
      ],
    },
    { content: "今天的炼金让我很有成就感，胡须都翘起来了。", reward: [] },
    { content: "炼金的时候不小心弄洒了药水，地板变得亮晶晶。", reward: [] },
    { content: "炼金结束后，大家一起品鉴成果，大家都很惊喜。", reward: [] },
    {
      content: "做了一件特别的炼金物品，闪闪发光。",
      reward: [
        {
          id: "purifiedEctoplasm",
          percent: 0.4,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "炼金的时候听着神秘的音乐，感觉自己在冒险。", reward: [] },
    { content: "今天的炼金让我学到了新知识，脑袋变聪明了。", reward: [] },
    { content: "炼金结束后，大家一起聊天，分享炼金小故事。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
    ] },
    { content: "炼金的时候看到了美丽的色彩，像彩虹一样。", reward: [] },
    { content: "今天的炼金很顺利，瓶瓶罐罐都很听话。", reward: [] },
    { content: "炼金的时候遇到了一点小麻烦，不过很快解决了。", reward: [] },
    {
      content: "炼金结束后，物品很神奇，大家都想试试。",
      reward: [
        {
          id: "mysticalEssence",
          percent: 1,
          range: {
            min: 1,
            max: 3,
          },
        },
      ],
    },
    { content: "做了一件创意炼金作品，大家都说很有趣。", reward: [] },
    { content: "炼金的时候看到了星星，感觉自己在宇宙里。", reward: [] },
    { content: "今天的炼金让我心情很好，想跳舞。", reward: [
        {
          id: "cutePoint",
          percent: 0.5,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "炼金结束后，大家一起休息，喝点饮料", reward: [] },
    { content: "炼金的时候被气味呛了一下，赶紧摇摇尾巴。", reward: [] },
    { content: "炼金结束后，物品很漂亮，大家都来拍照。", reward: [] },
    { content: "炼金的时候学会了新配方，大家都来学习。", reward: [] },
    { content: "今天的炼金让我很满意，尾巴摇个不停。", reward: [] },
    { content: "炼金结束后，大家一起分享成果，大家都很开心。", reward: [] },
    { content: "炼金的时候偶遇了一只小猫咪，一起玩瓶子。", reward: [] },
    { content: "今天炼金做出了会发光的小球。", reward: [] },
    { content: "炼金的时候和朋友一起比赛谁炼得快。", reward: [] },
    {
      content: "做了一瓶香香的药水，大家都喜欢。",
      reward: [
        {
          id: "healingPotion",
          percent: 0.4,
          range: {
            min: 1,
            max: 3,
          },
        },
        {
          id: "manaPotion",
          percent: 0.4,
          range: {
            min: 1,
            max: 3,
          },
        },
      ],
    },
    { content: "炼金的时候听到窗外小鸟叫，心情更好了。", reward: [] },
    { content: "今天的炼金让我觉得自己是小小魔法师。", reward: [] },
    { content: "炼金结束后，大家一起拍照留念。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 1,
          },
        },
    ] },
    { content: "炼金的时候和伙伴一起讲笑话，大家都笑了。", reward: [] },
    {
      content: "做了一瓶会冒泡的药水，超级有趣。",
      reward: [
        {
          id: "healingPotion",
          percent: 0.8,
          range: {
            min: 1,
            max: 1,
          },
        },
        {
          id: "manaPotion",
          percent: 0.1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "炼金的时候发现了一种特别的香味。", reward: [] },
    { content: "今天的炼金让我变得更有耐心。", reward: [] },
    { content: "炼金结束后，大家一起吃点心。", reward: [] },
    { content: "炼金的时候和朋友一起唱歌，气氛很棒。", reward: [] },
    {
      content: "做了一瓶五彩斑斓的药水。",
      reward: [
        {
          id: "manaPotion",
          percent: 0.8,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "炼金的时候窗外下起了小雨，感觉很温馨。", reward: [] },
    { content: "今天的炼金让我觉得很幸福。", reward: [] },
    { content: "炼金的时候和小猫咪一起打滚。", reward: [] },
    {
      content: "做了一瓶带星星的药水，超级可爱。",
      reward: [
        {
          id: "healingPotion",
          percent: 0.1,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "炼金的时候学会了新炼法，大家都来学。", reward: [] },
    { content: "今天的炼金让我变得更细心。", reward: [] },
    { content: "炼金结束后，大家一起喝奶茶。", reward: [] },
    { content: "炼金的时候和伙伴一起画配方。", reward: [] },
    { content: "做了一瓶带蝴蝶结的药水，超级萌。", reward: [] },
    { content: "炼金的时候和小猫咪一起玩瓶子。", reward: [] },
    { content: "今天的炼金让我觉得自己很棒。", reward: [] },
  ],
  exercise: [
    { content: "今天锻炼了一下身体，感觉很有活力。", reward: [] },
    { content: "锻炼的时候流了好多汗。", reward: [] },
    { content: "学会了新的锻炼动作。", reward: [] },
    { content: "锻炼结束后，身体很轻松。", reward: [] },
    { content: "今天的锻炼让我很有成就感。", reward: [] },
    { content: "锻炼的时候不小心摔了一跤。", reward: [] },
    { content: "锻炼结束后，大家一起休息。", reward: [] },
    { content: "做了一组特别的锻炼动作。", reward: [] },
    { content: "锻炼的时候听着音乐。", reward: [] },
    { content: "今天的锻炼让我学到了新知识。", reward: [] },
    { content: "锻炼结束后，大家一起聊天。", reward: [] },
    { content: "锻炼的时候看到了美丽的风景。", reward: [] },
    { content: "今天的锻炼很顺利。", reward: [] },
    { content: "锻炼的时候遇到了一点小麻烦。", reward: [] },
    { content: "锻炼结束后，身体很健康。", reward: [] },
    { content: "做了一组创意锻炼动作。", reward: [] },
    { content: "锻炼的时候看到了夕阳。", reward: [] },
    { content: "今天的锻炼让我心情很好。", reward: [] },
    { content: "锻炼结束后，大家一起分享成果。", reward: [] },
    { content: "锻炼的时候被蚊子咬了一口。", reward: [] },
    { content: "锻炼结束后，身体很有力量。", reward: [] },
    { content: "锻炼的时候学会了新技巧。", reward: [] },
    { content: "今天的锻炼让我很满意。", reward: [] },
    { content: "锻炼结束后，大家一起喝水。", reward: [] },
    { content: "锻炼的时候偶遇了一只小猫咪。", reward: [] },
  ],

  level1Manufacture: [
    { content: "今天制造了一件新物品，大家都很喜欢。", reward: [] },
    { content: "制造的时候材料用得刚刚好，喵呜~真棒！", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 3,
          },
        },
    ] },
    { content: "学会了新的制造技巧，感觉自己很厉害。", reward: [] },
    { content: "制造结束后，物品很实用，大家都来试用。", reward: [] },
    { content: "今天的制造让我很有成就感，胡须都翘起来了。", reward: [] },
    { content: "制造的时候不小心弄丢了一个零件，不过很快找到了。", reward: [] },
    { content: "制造结束后，大家一起品鉴作品，大家都夸我手巧。", reward: [] },
    {
      content: "做了一件特别的制造物品，大家都抢着要。",
      reward: [
        {
          id: "cuteGun",
          percent: 0.05,
          range: {
            min: 1,
            max: 1,
          },
        },
      ],
    },
    { content: "制造的时候听着工具的声音，像在唱歌。", reward: [] },
    { content: "今天的制造让我学到了新知识，脑袋变聪明了。", reward: [] },
    { content: "制造结束后，大家一起聊天，分享制造小秘密。", reward: [] },
    { content: "制造的时候看到了美丽的材料，忍不住摸了又摸。", reward: [] },
    { content: "今天的制造很顺利，零件都乖乖听话。", reward: [] },
    { content: "制造的时候遇到了一点小麻烦，不过很快解决了。", reward: [] },
    { content: "制造结束后，物品很漂亮，大家都想拍照。", reward: [] },
    { content: "做了一件创意制造作品，大家都说很有趣。", reward: [] },
    { content: "制造的时候看到了夕阳，感觉很温暖。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "今天的制造让我心情很好，想唱歌。", reward: [] },
    { content: "制造结束后，大家一起休息，喝点小奶。", reward: [] },
    { content: "制造的时候被工具夹了一下，喵呜~不过没事。", reward: [] },
    { content: "制造结束后，物品很耐用，可以用很久。", reward: [] },
    { content: "制造的时候学会了新配方，大家都来学习。", reward: [] },
    { content: "今天的制造让我很满意，尾巴摇个不停。", reward: [] },
    { content: "制造结束后，大家一起分享成果，大家都很开心。", reward: [] },
    { content: "制造的时候偶遇了一只小猫咪，一起玩零件。", reward: [] },
    { content: "今天制造了一辆小车，大家都来试驾。", reward: [] },
    { content: "制造的时候和朋友一起比赛谁做得快。", reward: [] },
    { content: "做了一只可爱的机器人，大家都喜欢。", reward: [] },
    { content: "制造的时候听到窗外小鸟叫，心情更好了。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 3,
          },
        },
    ] },
    { content: "今天的制造让我觉得自己是小小工程师。", reward: [] },
    { content: "制造结束后，大家一起拍照留念。", reward: [] },
    { content: "制造的时候和伙伴一起讲笑话，大家都笑了。", reward: [] },
    { content: "做了一件有猫耳朵的小盒子，超级可爱。", reward: [] },
    { content: "制造的时候发现了一块特别亮的金属。", reward: [] },
    { content: "今天的制造让我变得更有耐心。", reward: [] },
    { content: "制造结束后，大家一起吃点心。", reward: [] },
    { content: "制造的时候和朋友一起唱歌，气氛很棒。", reward: [] },
    { content: "做了一件五彩斑斓的小玩具。", reward: [] },
    { content: "制造的时候窗外下起了小雨，感觉很温馨。", reward: [] },
    { content: "今天的制造让我觉得很幸福。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "制造的时候和小猫咪一起打滚。", reward: [] },
    { content: "做了一件带铃铛的小物品，摇一摇会响。", reward: [] },
    { content: "制造的时候学会了新工艺，大家都来学。", reward: [] },
    { content: "今天的制造让我变得更细心。", reward: [] },
    { content: "制造结束后，大家一起喝奶茶。", reward: [] },
    { content: "制造的时候和伙伴一起画设计图。", reward: [] },
    { content: "做了一件带蝴蝶结的小玩具，超级萌。", reward: [] },
    { content: "制造的时候和小猫咪一起玩零件。", reward: [] },
    { content: "今天的制造让我觉得自己很棒。", reward: [] },
  ],

  specialManufacture: [
    { content: "今天完成了一项特殊制造，大家都很惊讶。", reward: [] },
    { content: "特殊制造的时候材料很稀有，喵呜~好开心！", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "学会了新的特殊制造技巧，感觉自己很厉害。", reward: [] },
    { content: "特殊制造结束后，物品很神奇，大家都来围观。", reward: [] },
    { content: "今天的特殊制造让我很有成就感，胡须都翘起来了。", reward: [] },
    {
      content: "特殊制造的时候不小心弄丢了一个零件，不过很快找到了。",
      reward: [],
    },
    {
      content: "特殊制造结束后，大家一起品鉴作品，大家都夸我手巧。",
      reward: [],
    },
    { content: "做了一件特别的特殊制造物品，大家都抢着要。", reward: [] },
    { content: "特殊制造的时候听着工具的声音，像在唱歌。", reward: [] },
    { content: "今天的特殊制造让我学到了新知识，脑袋变聪明了。", reward: [] },
    { content: "特殊制造结束后，大家一起聊天，分享制造小秘密。", reward: [] },
    { content: "特殊制造的时候看到了美丽的材料，忍不住摸了又摸。", reward: [] },
    { content: "今天的特殊制造很顺利，零件都乖乖听话。", reward: [] },
    { content: "特殊制造的时候遇到了一点小麻烦，不过很快解决了。", reward: [] },
    { content: "特殊制造结束后，物品很漂亮，大家都想拍照。", reward: [] },
    { content: "做了一件创意特殊制造作品，大家都说很有趣。", reward: [] },
    { content: "特殊制造的时候看到了夕阳，感觉很温暖。", reward: [] },
    { content: "今天的特殊制造让我心情很好，想唱歌。", reward: [] },
    { content: "特殊制造结束后，大家一起休息，喝点小奶。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "特殊制造的时候被工具夹了一下，喵呜~不过没事。", reward: [] },
    { content: "特殊制造结束后，物品很耐用，可以用很久。", reward: [] },
    { content: "特殊制造的时候学会了新配方，大家都来学习。", reward: [] },
    { content: "今天的特殊制造让我很满意，尾巴摇个不停。", reward: [] },
    { content: "特殊制造结束后，大家一起分享成果，大家都很开心。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "特殊制造的时候偶遇了一只小猫咪，一起玩零件。", reward: [] },
    { content: "今天特殊制造了一辆小车，大家都来试驾。", reward: [] },
    { content: "特殊制造的时候和朋友一起比赛谁做得快。", reward: [] },
    { content: "做了一只可爱的机器人，大家都喜欢。", reward: [] },
    { content: "特殊制造的时候听到窗外小鸟叫，心情更好了。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "今天的特殊制造让我觉得自己是小小工程师。", reward: [] },
    { content: "特殊制造结束后，大家一起拍照留念。", reward: [] },
    { content: "特殊制造的时候和伙伴一起讲笑话，大家都笑了。", reward: [] },
    { content: "做了一件有猫耳朵的小盒子，超级可爱。", reward: [] },
    { content: "特殊制造的时候发现了一块特别亮的金属。", reward: [] },
    { content: "今天的特殊制造让我变得更有耐心。", reward: [] },
    { content: "特殊制造结束后，大家一起吃点心。", reward: [] },
    { content: "特殊制造的时候和朋友一起唱歌，气氛很棒。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "做了一件五彩斑斓的小玩具。", reward: [] },
    { content: "特殊制造的时候窗外下起了小雨，感觉很温馨。", reward: [] },
    { content: "今天的特殊制造让我觉得很幸福。", reward: [] },
    { content: "特殊制造的时候和小猫咪一起打滚。", reward: [] },
    { content: "做了一件带铃铛的小物品，摇一摇会响。", reward: [] },
    { content: "特殊制造的时候学会了新工艺，大家都来学。", reward: [] },
    { content: "今天的特殊制造让我变得更细心。", reward: [] },
    { content: "特殊制造结束后，大家一起喝奶茶。", reward: [] },
    { content: "特殊制造的时候和伙伴一起画设计图。", reward: [] },
    { content: "做了一件带蝴蝶结的小玩具，超级萌。", reward: [] },
    { content: "特殊制造的时候和小猫咪一起玩零件。", reward: [] },
    { content: "今天的特殊制造让我觉得自己很棒。", reward: [] },
  ],
  explore: [
    { content: "今天探索了一片新区域，发现了很多有趣的东西。", reward: [] },
    { content: "探索的时候遇到了一只小动物。", reward: [] },
    { content: "学会了新的探索技巧。", reward: [] },
    {
      content: "探索结束后，收获满满。",
      reward: [
        {
          id: "catScroll",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "今天的探索让我很有成就感。", reward: [] },
    { content: "探索的时候不小心迷路了。", reward: [] },
    {
      content: "探索结束后，大家一起分享发现。",
      reward: [
        {
          id: "mysteriousBell",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "探索的时候看到了美丽的风景。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "今天的探索很顺利。", reward: [] },
    { content: "探索的时候遇到了一点小麻烦。", reward: [] },
    { content: "探索结束后，大家一起休息。", reward: [] },
    { content: "探索的时候发现了一条小溪。", reward: [] },
    { content: "今天的探索让我学到了新知识。", reward: [] },
    { content: "探索结束后，大家一起聊天。", reward: [] },
    {
      content: "探索的时候看到了彩虹。",
      reward: [
        {
          id: "rainbowShard",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "探索结束后，大家一起拍照留念。", reward: [] },
    { content: "探索的时候遇到了一场小雨。", reward: [] },
    { content: "今天的探索让我心情很好。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "探索结束后，大家一起吃点心。", reward: [] },
    { content: "探索的时候被蚊子咬了一口。", reward: [] },
    { content: "探索结束后，大家一起唱歌。", reward: [] },
    { content: "探索的时候学会了新地图。", reward: [] },
    { content: "今天的探索让我很满意。", reward: [] },
    { content: "探索结束后，大家一起画画。", reward: [] },
    { content: "探索的时候偶遇了一只小猫咪。", reward: [] },
    { content: "探索的时候和伙伴一起比赛谁跑得快。", reward: [] },
    {
      content: "今天在探索中发现了一个小秘密。",
      reward: [
        {
          id: "moonlightBell",
          percent: 1,
          range: {
            min: 8,
            max: 20,
          },
        },
      ],
    },
    {
      content: "探索的时候看到了好多漂亮的花。",
      reward: [
        {
          id: "windBellHerb",
          percent: 1,
          range: {
            min: 3,
            max: 6,
          },
        },
        {
          id: "dawnBlossom",
          percent: 0.33,
          range: {
            min: 3,
            max: 6,
          },
        },
      ],
    },
    { content: "探索结束后，大家一起晒太阳。", reward: [] },
    { content: "探索的时候和小鸟一起飞翔。", reward: [] },
    { content: "今天的探索让我觉得自己是小探险家。", reward: [] },
    { content: "探索的时候遇到了一只会唱歌的小虫子。", reward: [] },
    { content: "探索结束后，大家一起喝奶茶。", reward: [] },
    { content: "探索的时候和朋友一起讲笑话。", reward: [] },
    { content: "今天的探索让我变得更聪明了。", reward: [] },
    {
      content: "探索的时候发现了一块闪闪发亮的小石头。",
      reward: [
        {
          id: "flashStone",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
      ],
    },
    { content: "探索结束后，大家一起跳舞。", reward: [] },
    { content: "探索的时候和小兔子一起玩耍。", reward: [] },
    { content: "今天的探索让我觉得很幸福。", reward: [] },
    { content: "探索的时候看到了美丽的夕阳。", reward: [] },
    { content: "探索结束后，大家一起做游戏。", reward: [] },
    { content: "探索的时候遇到了一只好奇的小松鼠。", reward: [] },
    { content: "今天的探索让我学会了新本领。", reward: [] },
    { content: "探索的时候和伙伴一起拍照留念。", reward: [] },
    { content: "探索结束后，大家一起吃蛋糕。", reward: [] },
    { content: "探索的时候发现了一片特别绿的草地。", reward: [] },
    { content: "今天的探索让我心情超级好。", reward: [
        {
          id: "cutePoint",
          percent: 1,
          range: {
            min: 1,
            max: 2,
          },
        },
    ] },
    { content: "探索的时候和小猫咪一起打滚。", reward: [] },
    { content: "探索结束后，大家一起唱歌跳舞。", reward: [] },
    { content: "探索的时候遇到了一只喜欢跳舞的小鸭子。", reward: [] },
    { content: "今天的探索让我觉得自己很棒。", reward: [] },
  ],
};

/**
 * Non-destructive templates for trait grants. Each mainType may list zero or more
 * templates. When a template is chosen the engine will attempt to grant the
 * listed trait(s) to the actor/target. Templates here are conservative: newly
 * created traits should use `initialLevel: 1` and the engine will handle
 * adding exp if the kitty already has the trait.
 */
export const allKittyTraitGrantTemplates: Record<string, {
  content?: string;
  traitGrants: {
    traitId: string;
    chance?: number; // 0..1
    target?: 'actor' | 'target' | 'both';
    addExp?: number; // optional extra exp to apply when granted
    initialLevel?: number;
  }[];
}[]> = {
  collecting: [
    { content: '在草丛里翻找时发现了一个闪亮的小东西，心里好奇极了。', traitGrants: [{ traitId: 'curious', chance: 0.04, target: 'actor', initialLevel: 1 }] },
    { content: '细心翻找草丛，意外带回了额外的收获。', traitGrants: [{ traitId: 'hoarder', chance: 0.03, target: 'actor', initialLevel: 1 }] },
    { content: '出奇制胜的采集节奏，让它变得更高效。', traitGrants: [{ traitId: 'fast_worker', chance: 0.02, target: 'actor', initialLevel: 1 }] },
  ],

  farmingAnimal: [
    { content: '耐心照料小动物，学会了稳重与细心。', traitGrants: [{ traitId: 'patient', chance: 0.04, target: 'actor', initialLevel: 1 }] },
    { content: '照顾动物时顺手把周围整理得井井有条。', traitGrants: [{ traitId: 'tidy', chance: 0.03, target: 'actor', initialLevel: 1 }] },
    { content: '温柔的互动让它学会了更乐观地看待小事。', traitGrants: [{ traitId: 'optimist', chance: 0.02, target: 'actor', initialLevel: 1 }] },
  ],

  fishing: [
    { content: '在水边安静等待，耐心带来了收获。', traitGrants: [{ traitId: 'patient', chance: 0.04, target: 'actor', initialLevel: 1 }] },
    { content: '一份难得的发现点燃了它的好奇心。', traitGrants: [{ traitId: 'curious', chance: 0.03, target: 'actor', initialLevel: 1 }] },
  ],

  cooking: [
    { content: '烹饪的灵感在锅碗瓢盆间悄悄滋生。', traitGrants: [{ traitId: 'gourmand', chance: 0.05, target: 'actor', initialLevel: 1 }] },
    { content: '尝试新配方时学会了更节奏的操作。', traitGrants: [{ traitId: 'extra_snack_reward', chance: 0.03, target: 'actor', initialLevel: 1 }] },
  ],

  mining: [
    { content: '在矿洞里发现了有价值的小碎片，眼力不错。', traitGrants: [{ traitId: 'hoarder', chance: 0.03, target: 'actor', initialLevel: 1 }] },
    { content: '默默搬运与整理，收获了耐心与稳定。', traitGrants: [{ traitId: 'patient', chance: 0.02, target: 'actor', initialLevel: 1 }] },
  ],

  sewing: [
    { content: '细致缝补中生出了巧手与创意。', traitGrants: [{ traitId: 'gadgeteer', chance: 0.03, target: 'actor', initialLevel: 1 }] },
    { content: '整理材料让它更习惯于保持整洁。', traitGrants: [{ traitId: 'tidy', chance: 0.02, target: 'actor', initialLevel: 1 }] },
  ],

  forging: [
    { content: '敲打与锻造教会了它如何更好地利用材料。', traitGrants: [{ traitId: 'gadgeteer', chance: 0.04, target: 'actor', initialLevel: 1 }] },
    { content: '专注打磨带来了更稳的节奏感。', traitGrants: [{ traitId: 'fast_worker', chance: 0.02, target: 'actor', initialLevel: 1 }] },
  ],

  mysterious: [
    { content: '一段奇怪的反应引发了强烈的好奇心。', traitGrants: [{ traitId: 'curious', chance: 0.05, target: 'actor', initialLevel: 1 }] },
    { content: '意外配方激发了小发明的冲动。', traitGrants: [{ traitId: 'gadgeteer', chance: 0.03, target: 'actor', initialLevel: 1 }] },
  ],

  explore: [
    { content: '路上的小标记让它记住了方向与路线。', traitGrants: [{ traitId: 'navigator', chance: 0.04, target: 'actor', initialLevel: 1 }] },
    { content: '陌生的风景激起了强烈的好奇心。', traitGrants: [{ traitId: 'curious', chance: 0.03, target: 'actor', initialLevel: 1 }] },
    { content: '夜间的星光让它发现了夜行的小技巧。', traitGrants: [{ traitId: 'night_vision', chance: 0.02, target: 'actor', initialLevel: 1 }] },
    { content: '被太阳晒的非常舒服～', traitGrants: [{ traitId: 'sunbather', chance: 0.02, target: 'actor', initialLevel: 1 }] },
  ],

  exercise: [
    { content: '坚持锻炼让动作更轻盈，速度更快。', traitGrants: [{ traitId: 'fast_worker', chance: 0.03, target: 'actor', initialLevel: 1 }] },
    { content: '配合训练的耐心让它更专注。', traitGrants: [{ traitId: 'patient', chance: 0.02, target: 'actor', initialLevel: 1 }] },
  ],

  level1Manufacture: [
    { content: '基础制造练就了小发明的雏形。', traitGrants: [{ traitId: 'gadgeteer', chance: 0.04, target: 'actor', initialLevel: 1 }] },
    { content: '简单制作中学会了更高效的工作节奏。', traitGrants: [{ traitId: 'fast_worker', chance: 0.02, target: 'actor', initialLevel: 1 }] },
  ],

  specialManufacture: [
    { content: '精细制作激发了创意与巧思。', traitGrants: [{ traitId: 'gadgeteer', chance: 0.05, target: 'actor', initialLevel: 1 }] },
    { content: '合作打造让它学会了与人协作和保持整洁。', traitGrants: [{ traitId: 'tidy', chance: 0.02, target: 'actor', initialLevel: 1 }] },
  ],

  encounter: [
    { content: '和新朋友互相讲了个笑话，气氛很欢乐。', traitGrants: [{ traitId: 'comedian', chance: 0.04, target: 'actor', initialLevel: 1 }] },
    { content: '一次交流让它灵感大发，写出了一句短诗。', traitGrants: [{ traitId: 'poet', chance: 0.03, target: 'actor', initialLevel: 1 }] },
    { content: '偶然的恶作剧让大家都哈哈大笑。', traitGrants: [{ traitId: 'prankster', chance: 0.03, target: 'actor', initialLevel: 1 }] },
    { content: '互动中学会了保持整洁的小习惯。', traitGrants: [{ traitId: 'tidy', chance: 0.02, target: 'actor', initialLevel: 1 }] },
  ],

  // encounter_additional: [
  //   { content: '一次小插曲让它学会更好地整理物品。', traitGrants: [{ traitId: 'tidy', chance: 0.01, target: 'actor', initialLevel: 1 }] },
  //   { content: '愉快的相处增加了它的乐观心态。', traitGrants: [{ traitId: 'optimist', chance: 0.01, target: 'actor', initialLevel: 1 }] },
  // ],
};

export const allKittyIdleEssayContent = [
  "今天在窗台上晒太阳，暖洋洋的。",
  "听着窗外的鸟叫声，感觉很放松。",
  "打了个小盹，做了一个甜甜的梦。",
  "和小伙伴一起打滚，开心极了。",
  "舔了舔自己的爪子，觉得很干净。",
  "在角落里发现了一根有趣的线团。",
  "今天的天气真好，适合发呆。",
  "和小猫咪一起玩捉迷藏。",
  "看着窗外的树叶飘落，心情很平静。",
  "在地毯上打了个滚，舒服极了。",
  "和小伙伴一起晒太阳。",
  "今天吃了好吃的小零食。",
  "在沙发上伸了个懒腰。",
  "在房间里跑来跑去，锻炼身体。",
  "和小鸟对视了一会儿。",
  "今天的午睡特别香甜。",
  "在窗边看风景，发呆了一下午。",
  "和小伙伴一起打闹。",
  "在地板上追逐自己的尾巴。",
  "今天的心情很轻松。",
  "在角落里发现了一只小虫子。",
  "和小猫咪一起玩玩具。",
  "在阳光下打了个滚。",
  "今天的空气很清新。",
  "在沙发上睡了一觉，醒来很有精神。",
  "和小伙伴一起看窗外的风景。",
  "今天的零食特别美味。",
  "在地毯上打了个滚，毛发都蓬松了。",
  "和小猫咪一起晒太阳。",
  "在房间里跳来跳去，锻炼身体。",
  "今天的午后很安静。",
  "在窗台上看云朵飘过。",
  "和小伙伴一起玩线团。",
  "在地板上打了个滚，心情很好。",
  "今天的阳光很温暖。",
  "在沙发上发呆了一会儿。",
  "和小猫咪一起追逐光点。",
  "在窗边看着小鸟飞来飞去。",
  "今天的心情特别好。",
  "在地毯上打了个滚，觉得很幸福。",
  "和小伙伴一起玩捉迷藏。",
  "在房间里跳来跳去，开心极了。",
  "今天的空气很清新。",
  "在窗台上晒太阳，感觉很舒服。",
  "和小猫咪一起打闹。",
  "在地板上追逐自己的影子。",
  "今天的午睡特别香甜。",
  "在沙发上伸了个懒腰，心情很好。",
  "和小伙伴一起看窗外的风景。",
  "今天的零食特别美味。",
  "在地毯上打了个滚，毛发都蓬松了。",
  "和小猫咪一起晒太阳。",
  "在房间里跳来跳去，锻炼身体。",
  "今天的午后很安静。",
  "在窗台上看云朵飘过。",
  "和小伙伴一起玩线团。",
  "在地板上打了个滚，心情很好。",
  "今天的阳光很温暖。",
  "在沙发上发呆了一会儿。",
  "和小猫咪一起追逐光点。",
  "在窗边看着小鸟飞来飞去。",
  "今天的心情特别好。",
  "在地毯上打了个滚，觉得很幸福。",
  "和小伙伴一起玩捉迷藏。",
  "在房间里跳来跳去，开心极了。",
  "今天的空气很清新。",
  "在窗台上晒太阳，感觉很舒服。",
  "和小猫咪一起打闹。",
  "在地板上追逐自己的影子。",
  "今天的午睡特别香甜。",
  "在沙发上伸了个懒腰，心情很好。",
  "和小伙伴一起看窗外的风景。",
  "今天的零食特别美味。",
  "在地毯上打了个滚，毛发都蓬松了。",
  "和小猫咪一起晒太阳。",
  "在房间里跳来跳去，锻炼身体。",
  "今天的午后很安静。",
  "在窗台上看云朵飘过。",
  "和小伙伴一起玩线团。",
  "在地板上打了个滚，心情很好。",
  "今天的阳光很温暖。"
];

export const allKittyEncounterActionContent = [
  "一起愉快地玩了一会儿。",
  "一起晒太阳，暖洋洋的。",
  "一起追逐光点，玩得不亦乐乎。",
  "一起打滚，毛发都蓬松了。",
  "一起在草地上奔跑。",
  "一起玩捉迷藏，笑声不断。",
  "一起分享了美味的小零食。",
  "一起看窗外的风景，心情很放松。",
  "一起打闹，气氛很欢乐。",
  "一起玩线团，线团滚来滚去。",
  "一起在地毯上打滚。",
  "一起看云朵飘过，聊了很久。",
  "一起追逐自己的尾巴。",
  "一起晒月光，夜晚很安静。",
  "一起听鸟叫声，感觉很惬意。",
  "一起在窗台上发呆。",
  "一起玩玩具，玩得很开心。",
  "一起看小鸟飞来飞去。",
  "一起比赛谁跳得高。",
  "一起在房间里跳来跳去。",
  "一起看夕阳，心情很美好。",
  "一起在角落里发现了小虫子。",
  "一起玩捉迷藏，藏得很隐蔽。",
  "一起在沙发上伸懒腰。",
  "一起看树叶飘落。",
  "一起在地板上追逐影子。",
  "一起晒太阳，聊了很多趣事。",
  "一起在窗边看风景。",
  "一起打闹，玩得很尽兴。",
  "一起在地毯上打滚，笑声回荡。",
  "一起玩线团，比赛谁卷得快。",
  "一起在房间里奔跑，锻炼身体。",
  "一起看窗外的雨滴。",
  "一起在阳光下打滚。",
  "一起在窗台上看云朵变化。",
  "一起玩捉迷藏，互相寻找。",
  "一起在沙发上发呆。",
  "一起在地板上打滚，心情很好。",
  "一起晒太阳，分享温暖。",
  "一起在窗边看小鸟跳舞。",
  "一起比赛谁跑得快。",
  "一起在角落里玩线团。",
  "一起在房间里跳来跳去，开心极了。",
  "一起看窗外的风景，聊了很多。",
  "一起在地毯上打滚，毛发蓬松。",
  "一起玩捉迷藏，藏得很巧妙。",
  "一起在沙发上伸懒腰，心情愉快。",
  "一起看树叶飘落，感受秋天。",
  "一起在地板上追逐影子，玩得很久。",
  "一起晒太阳，心情超级好。",
  "一起在窗台上看云朵飘过，聊了很久。",
];

export const allKittyFriendActionContent: {
  content: string;
  reward: GameActionReward[]
}[] = [
  {
    content: "{kittyA} 和 {kittyB} 一起研究窗外的飞虫，决定以后一起守护窗台。",
    reward: []
  },
  {
    content: "{kittyA} 和 {kittyB} 一起在阳光下比谁的胡须更长，结果都很骄傲。",
    reward: []
  },
  {
    content: "{kittyA} 和 {kittyB} 一起偷偷藏起了一颗小石头，成为了彼此的秘密守护石。",
    reward: []
  },
  {
    content: "{kittyA} 和 {kittyB} 一起在沙发下发现了一根神秘的毛线，约定以后一起玩。",
    reward: []
  },
  {
    content: "{kittyA} 和 {kittyB} 一起练习如何优雅地舔爪子，互相打分。",
    reward: []
  },
  {
    content: "{kittyA} 和 {kittyB} 一起比赛谁能盯着铲屎官更久，最后都笑翻了。",
    reward: []
  },
  {
    content: "{kittyA} 和 {kittyB} 一起在角落里开了个“喵喵小型聚会”，只邀请了最亲密的猫友。",
    reward: []
  },
  {
    content: "{kittyA} 和 {kittyB} 一起互相蹭蹭，毛发都变得更蓬松了。",
    reward: []
  },
  {
    content: "{kittyA} 和 {kittyB} 一起在月光下练习夜视，觉得自己是夜行小勇士。",
    reward: []
  },
  {
    content: "{kittyA} 和 {kittyB} 一起分享了一块阳光最暖的地板，决定以后每天都来。",
    reward: []
  }
];

export const allKittyFriendSameWorkActionContent: {
  [mainType in keyof typeof allGameActionMainType]: KittyEssayType[]
} = {
  collecting: [
    { content: "{kittyA} 和 {kittyB} 一起在草丛里翻找，谁先找到新鲜叶子就得意地喵喵叫。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 合作挖掘，发现了一颗超级大的蘑菇，决定一起守护它。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起追着蝴蝶跑，结果都忘了采集任务。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 在阳光下采集，互相晒肚皮比谁更白。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 采集完后一起在草地上打滚，毛发都沾满了小草籽。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起发现了一种没见过的小果子，决定以后一起研究。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 采集途中比赛谁能跳得更远，最后都摔进了落叶堆。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起和小松鼠打招呼，结果被邀请去松鼠家做客。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 采集结束后一起晒太阳，讨论今天谁的收获更多。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起在秘密洞穴里探险，发现了好多有趣的小石头。", reward: [] },
  ],
  farmingAnimal: [
    { content: "{kittyA} 和 {kittyB} 一起给小鸡喂食，看谁能让小鸡围得更多。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 合作帮小羊梳毛，结果把自己也弄成了毛球。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起陪小牛晒太阳，讨论谁的尾巴更长。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 给小猪洗澡，互相泼水玩得不亦乐乎。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起教小鸭子排队走路，最后自己也跟着走成一排。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起给小兔子搭窝，结果窝里多了两只猫。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能让动物们更开心，最后大家都围着它们转。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起唱歌给动物们听，动物们都安静地听完了。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起给小羊编花环，结果花环都戴在自己头上。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起和小鸭子玩水，最后变成了湿漉漉的猫团子。", reward: [] },
  ],
  fishing: [
    { content: "{kittyA} 和 {kittyB} 一起钓鱼，比赛谁能钓到最胖的鱼。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 钓鱼时互相讲笑话，结果笑得鱼都游走了。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起研究鱼饵，最后决定用自己的胡须试试。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 钓鱼时比赛谁能盯着水面更久，最后都睡着了。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起晒太阳钓鱼，结果晒成了两只懒猫。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 钓到了一条会唱歌的鱼，决定一起组乐队。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 钓鱼结束后一起吃烤鱼，讨论哪种鱼最好吃。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把鱼竿甩得更远，结果鱼竿都掉水里了。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 钓鱼时互相帮忙拉鱼，最后拉上来一只小乌龟。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起在湖边看夕阳，决定以后常来钓鱼。", reward: [] },
  ],
  cooking: [
    { content: "{kittyA} 和 {kittyB} 一起做饭，比赛谁切鱼更快。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 合作做了一份超级可爱的甜点，大家都抢着吃。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起尝味道，结果把厨房变成了试吃大会。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 做饭时互相撒面粉，最后变成了两只白猫。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起研究新菜谱，决定发明猫咪专属料理。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 做饭时比赛谁能把菜切得更整齐。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起烹饪结束后，互相评价对方的手艺。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起做了一份会跳舞的蛋糕，大家都跳起来了。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 做饭时互相讲笑话，厨房里充满了欢笑。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起做饭，最后把厨房收拾得干干净净。", reward: [] },
  ],
  mining: [
    { content: "{kittyA} 和 {kittyB} 一起挖矿，比赛谁能挖到最亮的石头。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 合作搬运矿石，结果都累趴在地上。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起在矿洞里探险，发现了神秘的矿脉。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 挖矿时比赛谁能挖得更快，最后都变成了灰猫。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起在矿洞里唱歌，回声特别有趣。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起发现了一块会发光的石头，决定一起守护它。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 挖矿时互相讲笑话，大家都笑翻了。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能找到最多的矿石。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 挖矿结束后一起休息，讨论今天的收获。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起在矿洞里画画，把墙壁装饰得很漂亮。", reward: [] },
  ],
  sewing: [
    { content: "{kittyA} 和 {kittyB} 一起缝制新衣服，比赛谁的针脚更整齐。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 合作做了一顶有猫耳朵的帽子，轮流戴着玩。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起玩线团，线团滚得到处都是。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 缝制时互相帮忙，最后做出了一条超级长的围巾。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把布料叠得更整齐。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 缝制结束后互相展示作品，大家都夸很棒。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起缝制娃娃，娃娃变成了它们的新朋友。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 缝制时互相讲笑话，气氛很欢乐。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把线团卷得更快。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 缝制结束后一起喝奶茶，庆祝新作品完成。", reward: [] },
  ],
  forging: [
    { content: "{kittyA} 和 {kittyB} 一起锻造新武器，比赛谁的更闪亮。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 合作打造了一只可爱的铁猫，大家都喜欢。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起敲打铁块，声音像在开演唱会。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 锻造时互相帮忙，最后做出了一把超级小锤子。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把铁片敲得更薄。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 锻造结束后互相展示作品，大家都很满意。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起打造了一只带蝴蝶结的小铁盾。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 锻造时互相讲笑话，气氛很热烈。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把铁块敲得更圆。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 锻造结束后一起喝奶茶，庆祝新作品完成。", reward: [] },
  ],
  mysterious: [
    { content: "{kittyA} 和 {kittyB} 一起炼金，比赛谁的药水颜色更漂亮。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 合作炼制了一瓶会冒泡的药水，大家都觉得很神奇。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起研究新配方，决定发明猫咪专属魔法。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 炼金时互相帮忙，最后做出了一瓶超级香的药水。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把药水摇得更快。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 炼金结束后互相展示成果，大家都很惊喜。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起炼制了一瓶带星星的药水。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 炼金时互相讲笑话，气氛很神秘。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把药水配得更准。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 炼金结束后一起喝奶茶，庆祝新发现。", reward: [] },
  ],
  exercise: [
    { content: "{kittyA} 和 {kittyB} 一起锻炼身体，比赛谁跳得更高。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 合作做了一组特别的锻炼动作，大家都来围观。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能坚持锻炼更久。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 锻炼时互相鼓励，最后都变得更有活力。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起做创意锻炼动作，大家都笑翻了。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 锻炼结束后一起休息，讨论谁流的汗更多。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能做更多俯卧撑。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 锻炼时互相讲笑话，气氛很轻松。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起看夕阳锻炼，觉得很有成就感。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 锻炼结束后一起喝水，补充能量。", reward: [] },
  ],
  level1Manufacture: [
    { content: "{kittyA} 和 {kittyB} 一起制造新物品，比赛谁的更实用。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 合作做了一只可爱的机器人，大家都喜欢。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把零件拼得更快。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 制造时互相帮忙，最后做出了一辆小车。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起研究新工艺，决定发明猫咪专属玩具。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 制造结束后互相展示作品，大家都很满意。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把小盒子装饰得更漂亮。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 制造时互相讲笑话，气氛很欢乐。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把玩具卷得更快。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 制造结束后一起喝奶茶，庆祝新作品完成。", reward: [] },
  ],
  specialManufacture: [
    { content: "{kittyA} 和 {kittyB} 一起完成特殊制造，比赛谁的更神奇。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 合作做了一件有猫耳朵的小盒子，大家都抢着要。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把材料用得更巧妙。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 特殊制造时互相帮忙，最后做出了一辆小车。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起研究新配方，决定发明猫咪专属神器。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 特殊制造结束后互相展示作品，大家都很惊喜。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把玩具装饰得更萌。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 特殊制造时互相讲笑话，气氛很热烈。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能把小物品拼得更快。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 特殊制造结束后一起喝奶茶，庆祝新作品完成。", reward: [] },
  ],
  explore: [
    { content: "{kittyA} 和 {kittyB} 一起探索新区域，比赛谁发现的秘密更多。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 合作发现了一条小溪，决定以后常来玩水。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能找到更多漂亮的花。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 探索时互相鼓励，最后都变成了小探险家。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起看彩虹，讨论谁的毛色更像彩虹。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 探索结束后一起分享发现，大家都很开心。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能跑得更快。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 探索时互相讲笑话，气氛很欢乐。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 一起比赛谁能画出更美的地图。", reward: [] },
    { content: "{kittyA} 和 {kittyB} 探索结束后一起喝奶茶，庆祝新发现。", reward: [] },
  ],
};