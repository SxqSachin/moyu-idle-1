import { clone } from "~/shared/utils";

export default defineNuxtRouteMiddleware(async (to, from) => {
    const session = useUserSession()

    // 尝试等待短时间以便 session 从服务端加载/更新，避免在登录后被短时间重定向回登录页
    try {
        await Promise.race([
            // 正常拉取 session
            session.fetch(),
            // 超时保护：等待最多 300ms，防止导航被长时间阻塞
            new Promise((resolve) => setTimeout(resolve, 300)),
        ])
    } catch (e) {
        // 忽略 fetch 错误，后续逻辑会基于当前可用状态处理
    }

    const { loggedIn } = session
    const queryString = new URLSearchParams(to.query as Record<string, string>).toString()

    if (to.fullPath.startsWith('/login') && loggedIn.value) {
        // 已登录，跳回首页（保持原有行为）
        location.href = '/'
        return
    }

    // 未登录且访问受保护页，尝试更宽容地等待 session（尤其是来自登录页的导航）
    if (!to.fullPath.startsWith('/login') && !loggedIn.value) {
        // 仅在客户端可用的短期“刚登录”标记，登录成功时会写入 timestamp
        let justLoggedIn = false
        try {
            const ts = sessionStorage.getItem('moyu.justLoggedIn')
            if (ts && Date.now() - Number(ts) < 30_000) {
                justLoggedIn = true
            }
        } catch (e) {
            // ignore
        }

        // 如果是从登录页跳转过来，或检测到刚刚登录，给 session 更长的同步时间
        if (justLoggedIn || from.fullPath.startsWith('/login')) {
            const start = Date.now()
            const maxWait = 3000
            while (Date.now() - start < maxWait && !loggedIn.value) {
                try {
                    // 每次尝试拉取 session，并短暂等待
                    // eslint-disable-next-line no-await-in-loop
                    await session.fetch()
                } catch (e) {
                    // ignore
                }
                if (loggedIn.value) break
                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => setTimeout(r, 300))
            }
            // 清理标记
            try { sessionStorage.removeItem('moyu.justLoggedIn') } catch (e) {}
        }

        if (!loggedIn.value) {
            const redirectUrl = queryString ? `/login?${queryString}` : '/login'
            location.href = redirectUrl
            return
        }
    }
})