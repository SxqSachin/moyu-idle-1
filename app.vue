<script setup lang="ts">
import { NuxtPage } from '#components';

import 'element-plus/theme-chalk/dark/css-vars.css'
// @ts-ignore
window.WebSocket = window._WebSocket || window.WebSocket;
// @ts-ignore
globalThis.WebSocket = window._WebSocket || window.WebSocket;
</script>

<template>
  <div>
    <NuxtPage />
  </div>
</template>

<style>
  html, body {
    overflow-x: hidden
  }
</style>