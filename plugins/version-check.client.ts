import { requestMenu } from '~/composables/useGlobalMenu'

export default defineNuxtPlugin(async () => {
  const session = useUserSession()
  if (!session.loggedIn.value) return
  try {
    const { data } = await useFetch('/api/app/version.check', { method: 'GET', cache: 'no-cache' })
    const payload: any = data.value
    if (payload?.data?.showUpdateLog) {
      // 直接写入全局菜单意图，不再依赖事件时序
      requestMenu('updateLog')
    }
  } catch (e) {
    // ignore
  }
})
