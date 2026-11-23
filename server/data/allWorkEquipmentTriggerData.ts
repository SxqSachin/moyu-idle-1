import { allGameAction } from "~/shared/data/allGameActions";
import { allGameResource } from "~/shared/data/allGameResources";
import { AllResourceAlchemyTag, type AllResourceAlchemyTagId } from "~/shared/types/gameAlchemy";
import { WorkEquipmentTriggerInfo } from "~/shared/types/battle";
import { CharacterEquipmentInfo } from "~/shared/types/characterInfo";
import type { GameActionReward } from "~/shared/types/gameAction";
import { GameResource } from "~/shared/types/gameResource";
import { clone, ObjectKeysTyped } from "~/shared/utils";
import { getEquipmentActuralId, getEquipmentLevel } from "~/shared/utils/game/equipment";
import { isActionInclude } from "~/shared/utils/game/game";

export const allWorkEquipmentTriggerData: Record<string, WorkEquipmentTriggerInfo> = {
  runeCompass: {
    extraRewardOnActionFinish: ({ actionId }) => {
      if (actionId != 'exploreNewArea') {
        return null;
      }

      // Per-weekday special rewards (0=Sunday .. 6=Saturday)
      const weekday = new Date().getDay();

      const baseFrom = '符片指南针';

      const lists: Record<number, GameActionReward[]> = {
        0: [
          // Sunday - more gold
          {
            id: "gold",
            percent: 1,
            range: { min: 20, max: 25 },
            from: baseFrom,
          },
          {
            id: "darkCrystal",
            percent: 0.0015,
            range: { min: 1, max: 2 },
            from: baseFrom,
          },
          {
            id: "memoryPage",
            percent: 0.0015,
            range: { min: 1, max: 2 },
            from: baseFrom,
          },
        ],
        1: [
          // Monday - chance for rare shards
          {
            id: "gold",
            percent: 1,
            range: { min: 20, max: 25 },
            from: baseFrom,
          },
          {
            id: "soul_energy_shard",
            percent: 0.002,
            range: { min: 1, max: 2 },
            from: baseFrom,
          },
          {
            id: "faded_remnant",
            percent: 0.0015,
            range: { min: 1, max: 1 },
            from: baseFrom,
          },
          {
            id: "plushFur",
            percent: 0.0015,
            range: { min: 1, max: 1 },
            from: baseFrom,
          },
        ],
        2: [
          // Tuesday - stable small gold
          {
            id: "gold",
            percent: 1,
            range: { min: 50, max: 75 },
            from: baseFrom,
          },
          {
            id: "rusted_chain_link",
            percent: 0.0012,
            range: { min: 1, max: 1 },
            from: baseFrom,
          },
        ],
        3: [
          // Wednesday - original/default mix
          {
            id: "gold",
            percent: 1,
            range: { min: 15, max: 20 },
            from: baseFrom,
          },
          {
            id: "darkCrystal",
            percent: 0.0005,
            range: { min: 1, max: 2 },
            from: baseFrom,
          },
          {
            id: "shadowOrb",
            percent: 0.0005,
            range: { min: 1, max: 1 },
            from: baseFrom,
          },
          {
            id: "catShadowGem",
            percent: 0.003,
            range: { min: 1, max: 1 },
            from: baseFrom,
          },
          {
            id: "rusted_chain_link",
            percent: 0.001,
            range: { min: 1, max: 1 },
            from: baseFrom,
          },
          {
            id: "soul_energy_shard",
            percent: 0.001,
            range: { min: 1, max: 1 },
            from: baseFrom,
          },
          {
            id: "faded_remnant",
            percent: 0.001,
            range: { min: 1, max: 1 },
            from: baseFrom,
          },
        ],
        4: [
          // Thursday - higher chance for shadowOrb
          {
            id: "phantomWhisker",
            percent: 0.0012,
            range: { min: 1, max: 2 },
            from: baseFrom,
          },
          {
            id: "witchHat",
            percent: 0.0012,
            range: { min: 1, max: 2 },
            from: baseFrom,
          },
          {
            id: "shadowOrb",
            percent: 0.0012,
            range: { min: 1, max: 2 },
            from: baseFrom,
          },
          {
            id: "gold",
            percent: 0.8,
            range: { min: 40, max: 80 },
            from: baseFrom,
          },
        ],
        5: [
          // Friday - celebration day: extra catShadowGem
          {
            id: "catShadowGem",
            percent: 0.012,
            range: { min: 1, max: 1 },
            from: baseFrom,
          },
          {
            id: "denseFogMurkyCrystal",
            percent: 0.0001,
            range: { min: 1, max: 1 },
            from: baseFrom,
          },
          {
            id: "gold",
            percent: 1,
            range: { min: 60, max: 120 },
            from: baseFrom,
          },
        ],
        6: [
          // Saturday - more diversity
          {
            id: "darkCrystal",
            percent: 0.0008,
            range: { min: 1, max: 3 },
            from: baseFrom,
          },
          {
            id: "soul_energy_shard",
            percent: 0.0012,
            range: { min: 1, max: 2 },
            from: baseFrom,
          },
          {
            id: "faded_remnant",
            percent: 0.0012,
            range: { min: 1, max: 1 },
            from: baseFrom,
          },
        ],
      };

      return clone(lists[weekday] ?? lists[3]);
    }
  },
  genesisEssenceOwlQuillpen: {
    extraExpRewardOnActionFinish: ({ equipmentId, actionId }) => {
      if (!isActionInclude('allExerciseAction', actionId)) {
        return [];
      }

      let equipmentLevel = getEquipmentLevel(equipmentId);
      // clamp equipment level to expected range 0..10
      equipmentLevel = Math.max(0, Math.min(10, equipmentLevel));

      if (equipmentLevel < 5) {
        return []
      }

      const res: { [actionId: string]: { characterImprove: { status: any; increaseExp: number; from: string }[] } } = {};
      Object.values(allGameAction).forEach((action) => {

        const isDismentleAction = action.id.startsWith('dismantle_')
        if (isDismentleAction) {
          return;
        }

        if (!isActionInclude('allExerciseAction', action.id)) {
          return;
        }

        // clone to ensure we never mutate original objects
        const cis = action.characterImprove ? clone(action.characterImprove) : undefined;
        if (cis && cis.length > 0) {
          const bonus = cis.map((ci) => ({
            status: ci.status,
            increaseExp: 1.75 + (equipmentLevel - 5) * 0.25,
            from: "棱彩羽毛笔",
          }));
          res[action.id] = clone({
            characterImprove: bonus,
          });
        }
      });

      return res[actionId].characterImprove
    }
  },
  murkyShadowLens: {
    extraRewardOnActionFinish: ({ actionId, equipmentId }) => {
      if (actionId != 'treasureHunt') {
        return null;
      }

      let equipmentLevel = getEquipmentLevel(equipmentId);
      equipmentLevel = Math.max(0, Math.min(10, equipmentLevel));

      // Use YMD-seeded RNG to generate reproducible daily drops.
      const baseFrom = '浊光放大镜';

      // --- Whitelists: specify allowed tags/resources. If empty, all tags/resources are allowed. ---
      const TAG_WHITELIST: AllResourceAlchemyTagId[] = [
        // example: 'crystal', 'plant'
        "monster_essence_lv1",
        "monster_essence_lv2",
        "monster_essence_lv3",
        "container",
        "chaos_residue",
        "otherworld_matter",
        "living_metal",
        "parasite",
        "slime",
        "stardust",
        "fire",
        "water",
        "earth",
        "air",
        "lightning",
        "ice",
        "poison",
        "light",
        "star",
        "holy",
        "shadow",
        "ghost",
        "fungi",
        "insect",
        "blood",
        "bone",
        "organ",
        "hide",
        "scale",
        "carapace",
        "horn_tooth",
        "viscera",
        "eye",
        "spirit",
        "mana_crystal",
        "void",
        "soul_fragment",
        "crystal",
        "plant",
        "powder",
        "gas",
      ];

      // Use resource blacklist to exclude specific resource IDs. If empty, all resources allowed.
      const RESOURCE_BLACKLIST: string[] = [
        'gold'
      ];

      // seeded RNG helpers (deterministic per Y-M-D)
      const ymd = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      })();

      function strToSeed(s: string) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < s.length; i++) {
          h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
        }
        return h >>> 0;
      }

      function mulberry32(a: number) {
        return function () {
          let t = (a += 0x6d2b79f5);
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }

      function shuffle<T>(arr: T[], rnd: () => number) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          const tmp = a[i];
          a[i] = a[j];
          a[j] = tmp;
        }
        return a;
      }

      const seed = strToSeed(ymd);
      const rnd = mulberry32(seed);

      const maxTagsByLevelList = [1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5];
      const maxTagsByLevel = maxTagsByLevelList[equipmentLevel] ?? maxTagsByLevelList[0];

      const maxItemPerTagList = [2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6];
      const maxItemPerTag = maxItemPerTagList[equipmentLevel] ?? maxItemPerTagList[0];

      const maxItemCountList = [1 ,1 ,1 ,1 ,1, 2, 2, 2, 2, 2, 3];
      const maxItemCount = maxItemCountList[equipmentLevel] ?? maxItemCountList[0];

      const tagCount = maxTagsByLevel;

      // Exclude tags from blacklist and tags that have no available (non-blacklisted) resources
      // Build candidate tags from whitelist (if provided) or all tags. Exclude tags that have no available resources.
      const baseTags = (TAG_WHITELIST && TAG_WHITELIST.length > 0)
        ? TAG_WHITELIST.filter(t => Object.prototype.hasOwnProperty.call(AllResourceAlchemyTag, t))
        : ObjectKeysTyped(AllResourceAlchemyTag);

      const candidateTags = baseTags.filter((t) => {
        const tagResources = Object.values(allGameResource).filter((r) => (r.alchemyTag || []).includes(t) && !RESOURCE_BLACKLIST.includes(r.id));
        return tagResources.length > 0;
      });
      const pickedTags = shuffle(candidateTags, rnd).slice(0, tagCount) as AllResourceAlchemyTagId[];

      const rewards: GameActionReward[] = [];

      for (const tagId of pickedTags) {
        const tagResources = Object.values(allGameResource).filter((r) => (r.alchemyTag || []).includes(tagId) && !RESOURCE_BLACKLIST.includes(r.id));
        if (!tagResources.length) continue;

        // how many items to pick from this tag, biased by equipment level
        const maxItems = Math.max(1, Math.min(tagResources.length, maxItemPerTag));
        const itemCount = Math.min(tagResources.length, 1 + Math.floor(rnd() * maxItems));

        const picked = shuffle(tagResources, rnd).slice(0, itemCount);

        for (const res of picked) {
          // percent scales with equipment level. Cap rises from 0.0015 -> 0.0035 as level goes 0..10.
          const maxPercent = 0.001 + (0.0023 - 0.0015) * (equipmentLevel / 10);
          // basePercent grows modestly with level (keeps low-level chance small)
          const basePercent = 0.001 + (0.0008 - 0.0005) * (equipmentLevel / 10); // from 0.0005 -> 0.0020
          // choose uniformly between base and max using seeded RNG
          const percent = basePercent + rnd() * (maxPercent - basePercent);

          rewards.push({
            id: res.id,
            percent,
            range: { min: 1, max: Math.max(1, Math.ceil(rnd() * maxItemCount)) },
            from: baseFrom,
          });
        }
      }

      return clone(rewards);
    }
  },
};