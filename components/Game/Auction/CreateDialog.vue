<template>
  <el-dialog v-model="visibleLocal" title="创建拍卖" :width="isAdmin ? '600px' : '360px'" :destroy-on-close="true">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="space-y-3">

      <template v-if="isAdmin">
        <el-form-item label="目标类型" prop="targetType" required>
          <el-select v-model="form.targetType" placeholder="选择类型">
            <el-option v-for="t in targetTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
      </template>

      <el-form-item prop="targetId" required>
        <template #label>
          <div class="w-48 flex items-center justify-end gap-2">
            <span>资源</span>
            <el-tooltip content="资源唯一 ID，现阶段玩家只能拍卖物品，随着小镇升级，玩家将可以自定义拍卖的服务" placement="top">
              <el-icon class="cursor-pointer text-gray-400">
                <Icon name="material-symbols:help" />
              </el-icon>
            </el-tooltip>
          </div>
        </template>
        <template v-if="form.targetType === 'ITEM'">
          <el-select v-model="form.targetId" placeholder="请选择物品" class="w-full" filterable>
            <el-option v-for="food in userInventoryItems" :key="food.id" :label="food.name" :value="food.id">
              <GameCommonSimpleResourceIconAndName :resource-id="food.id">({{food.count}})
              </GameCommonSimpleResourceIconAndName>
            </el-option>
          </el-select>
        </template>
        <template v-else-if="form.targetType === 'TEXT'">
          <el-input v-model="form.targetId" placeholder="例如物品id或头衔id" />
        </template>
      </el-form-item>

      <el-form-item prop="targetCount" required>
        <template #label>
          <div class="w-48 flex items-center justify-end gap-2">
            <span>数量</span>
            <el-tooltip content="拍卖的物品数量，最小为 1" placement="top">
              <el-icon class="cursor-pointer text-gray-400">
                <Icon name="material-symbols:help" />
              </el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-input-number v-model="form.targetCount" :min="1" :step="1" :step-strictly="true" :controls="false" />
      </el-form-item>

      <el-form-item prop="startPrice" required>
        <template #label>
          <div class="w-48 flex items-center justify-end gap-2">
            <span>起价</span>
            <el-tooltip content="起拍价格，单位为游戏货币（必填）" placement="top">
              <el-icon class="cursor-pointer text-gray-400">
                <Icon name="material-symbols:help" />
              </el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-input-number v-model="form.startPrice" :min="AUCTION_CREATE_FEE" :step="1" :step-strictly="true" :controls="false" />
      </el-form-item>

      <el-form-item prop="startPrice" required>
        <template #label>
          <div class="w-48 flex items-center justify-end gap-2">
            <span>最小加价</span>
          </div>
        </template>
        <el-input-number v-model="form.minIncrement" :min="1" :controls="false" />
      </el-form-item>

      <el-form-item prop="buyoutPrice">
        <template #label>
          <div class="w-48 flex items-center justify-end gap-2">
            <span>一口价</span>
            <el-tooltip content="当参与者直接以此价格出价时，系统将自动成交，可留空" placement="top">
              <el-icon class="cursor-pointer text-gray-400">
                <Icon name="material-symbols:help" />
              </el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-input-number v-model="form.buyoutPrice" :min="0" :controls="false" />
      </el-form-item>

      <el-form-item prop="endAt" required>
        <template #label>
          <div class="w-48 flex items-center justify-end gap-2">
            <span>结束于</span>
            <el-tooltip content="拍卖结束的时间点（必填），请选择一个将来的时间" placement="top">
              <el-icon class="cursor-pointer text-gray-400">
                <Icon name="material-symbols:help" />
              </el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-date-picker v-model="form.endAt" type="datetime" placeholder="选择结束时间" :disabled-date="disablePast"
          format="YYYY/MM/DD HH:mm" style="width: 100%;" />
      </el-form-item>

      <el-form-item prop="extensionMinutes" required>
        <template #label>
          <div class="w-48 flex items-center justify-end gap-2">
            <span>延长期</span>
            <el-tooltip content="在拍卖结束前10分钟内有玩家出价时，拍卖将会延长的时间" placement="top">
              <el-icon class="cursor-pointer text-gray-400">
                <Icon name="material-symbols:help" />
              </el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-input-number v-model="form.extensionMinutes" :min="1" :max="30" :controls="false" />
      </el-form-item>

      <el-form-item v-if="isAdmin" label="备注/元数据">
        <el-input type="textarea" v-model="metaText" placeholder="JSON，可选" :rows="4" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-divider class="mt-0!"></el-divider>

      <div class="text-left text-md mb-4">
        手续费:
        <GameCommonResourceIconAndName resource-id="gold" :count="AUCTION_CREATE_FEE" :show-inventory-count="true"></GameCommonResourceIconAndName>
      </div>

      <div class="flex justify-end gap-2">
        <!-- <el-button class="w-full" @click="visibleLocal = false">取消</el-button> -->
        <el-button class="w-full" type="primary" :loading="submitting" @click="submit">创建</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ElMessage } from "element-plus";
import type { FormRules } from "element-plus";
import { emitCreateAuction, onCreateAuctionSuccess, onCreateAuctionFail } from "~/api/game/socket/auction";
import type { AuctionCreateInput, AuctionTargetType } from "~/shared/types/auction";
import { useInventory } from "~/composables/game/useInventory";
import { ObjectKeysTyped } from "~/shared/utils";
import { allGameResource } from "~/shared/data/allGameResources";
import { AUCTION_CREATE_FEE } from "~/shared/data/constant";
import { waitUtilConnected } from "~/api/game/socket/socket";

const props = defineProps<{ 
  visible?: boolean
 }>();
const emit = defineEmits<{ (e: "update:visible", v: boolean): void; (e: "created", uuid: string): void }>();

const { user } = useUserSession()

const isGm = computed(() => {
  return user.value?.isGm;
})

const isAdmin = computed(() => {
  return user.value?.isGm;
})

// 使用 computed getter/setter 直接与父 v-model 同步（兼容 element-plus 的 v-model 用法）
const visibleLocal = computed({
  get: () => !!props.visible,
  set: (v: boolean) => {
    emit("update:visible", v);
  },
});

const targetTypes = ["ITEM", "TITLE", "SHOP", "BUILDING", "TEXT"] as AuctionTargetType[];

// 表单数据
const form = ref<AuctionCreateInput>({
  creator: "",
  targetType: "ITEM",
  targetId: "",
  minIncrement: 100,
  targetCount: 1,
  startPrice: AUCTION_CREATE_FEE,
  endAt: new Date(Date.now() + 60 * 60 * 1000),
  extensionMinutes: 10,
});

// 表单引用与校验规则（使用 FormRules 类型，避免 type 字段的 TS 类型冲突）
const formRef = ref<any>(null);
const rules: FormRules = {
  targetType: [{ required: true, message: "请选择目标类型", trigger: "change" }],
  targetId: [{ required: true, message: "请输入目标 ID", trigger: "blur" }],
  targetCount: [
    { required: true, message: "数量必须填写且大于等于 1", trigger: "change" },
    {
      // 使用自定义 validator 避免直接设置 type: 'number' 导致的类型冲突
      validator: (_rule, value, callback) => {
        const v = Number(value);
        if (!Number.isFinite(v) || v < 1) callback(new Error("数量必须为大于等于 1 的数字"));
        else callback();
      },
      trigger: "change",
    },
  ],
  startPrice: [{ required: true, message: "请输入起价", trigger: "change" }],
  endAt: [{ required: true, type: "date", message: "请选择结束时间", trigger: "change" }],
  extensionMinutes: [{ required: true, type: "number", message: "请填写延长期 (1~30)", trigger: "change" }],
  depositRequired: [
    {
      validator: (_rule, value, callback) => {
        if (value == null || value === "") return callback();
        const v = Number(value);
        if (!Number.isFinite(v) || v < 0) callback(new Error("保证金不能为负数"));
        else callback();
      },
      trigger: "change",
    },
  ],
};

const metaText = ref<string>("");
const submitting = ref(false);

let offSuccess: () => void;
let offFail: () => void;

const inventory = useInventory();

// 只展示玩家拥有的食物
const userInventoryItems = computed(() => {
  if (isGm.value) {
    return ObjectKeysTyped(inventory.value)
      .filter(r => !!allGameResource[r])
      .filter(r => !!inventory.value[r]?.count)
      .map(r => {
        let resource = allGameResource[r];
        return {
          id: r,
          name: resource.name,
          icon: resource.icon,
          count: inventory.value[r]?.count || 0
        }
      })
  }

  return ObjectKeysTyped(inventory.value)
    .filter(r => !!allGameResource[r] && !allGameResource[r].hideInMarket)
    .filter(r => !!inventory.value[r]?.count)
    .map(r => {
      let resource = allGameResource[r];
      return {
        id: r,
        name: resource.name,
        icon: resource.icon,
        count: inventory.value[r]?.count || 0
      }
    })
})

onMounted(async () => {
  await waitUtilConnected()

  offSuccess = onCreateAuctionSuccess((d) => {
    submitting.value = false;
    ElMessage.success("拍卖创建成功");
    emit("created", d.auction.uuid);
    // 关闭对话框（setter 会向父 emit update:visible）
    visibleLocal.value = false;
  }) as any;
  offFail = onCreateAuctionFail((msg) => {
    submitting.value = false;
    ElMessage.error(msg?.message || "拍卖创建失败");
  }) as any;
});

onUnmounted(() => {
  offSuccess?.();
  offFail?.();
});

function disablePast(date: Date) {
  if (date.getTime() < Date.now()) {
    return true;
  }

  if (isAdmin.value) {
    return false;
  }

  return  date.getTime() >= Date.now() + (86400 * 1000) * 5;
}

function submit() {
  if (!formRef.value) {
    submitting.value = false;
    return;
  }
  submitting.value = true;
  formRef.value.validate(async (valid: boolean) => {
    if (!valid) {
      submitting.value = false;
      ElMessage.warning("请正确填写拍卖信息后再提交");
      return;
    }

    // parse metadata
    let meta: any = undefined;
    if (metaText.value && metaText.value.trim()) {
      try {
        meta = JSON.parse(metaText.value);
      } catch (err) {
        submitting.value = false;
        ElMessage.error("备注/元数据 JSON 解析失败");
        return;
      }
    }

    // 合并并发送（creator 由后端覆盖为当前用户）
    try {
      // emitCreateAuction 是同步触发 socket 发包的函数，内部回调处理创建结果
      emitCreateAuction({
        ...form.value,
        metadata: meta,
        creator: "",
      } as AuctionCreateInput);
      // 结果由 onCreateAuctionSuccess 处理
    } catch (err: any) {
      submitting.value = false;
      ElMessage.error(err?.message || "创建请求发送失败");
    }
  });
}
</script>