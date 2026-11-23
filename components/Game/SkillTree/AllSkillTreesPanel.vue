<template>
  <el-tabs v-model="active">
    <el-tab-pane label="生活" name="life">
      <GameSkillTreePanel
        v-if="active === 'life'"
        :key="active === 'life' ? 'life' : 'life-dead'"
        tree-id="life"
        title="生活"
      />
    </el-tab-pane>
    <el-tab-pane label="战斗" name="battle">
      <GameSkillTreePanel
        v-if="active === 'battle'"
        :key="active === 'battle' ? 'battle' : 'battle-dead'"
        tree-id="battle"
        title="战斗"
      />
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
const active = ref<'life' | 'battle'>('life')
</script>