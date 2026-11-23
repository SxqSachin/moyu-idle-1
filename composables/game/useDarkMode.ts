export const useDarkMode = () => {
  const isDark = useState<boolean>('darkMode', () => {
    // 服务端渲染时返回默认值
    if (process.server) {
      return false
    }
    
    // 客户端从 localStorage 读取配置
    return localStorage.getItem('dark-mode') === '1'
  })

  const toggleDark = () => {
    isDark.value = !isDark.value
    
    // 更新 DOM 类
    if (process.client) {
      document.documentElement.classList.toggle('dark', isDark.value)
      localStorage.setItem('dark-mode', isDark.value ? '1' : '0')
    }
  }

  const initDarkMode = () => {
    if (process.client) {
      // 从 localStorage 读取配置
      const storedValue = localStorage.getItem('dark-mode') === '1'
      isDark.value = storedValue
      
      // 应用到 DOM
      document.documentElement.classList.toggle('dark', isDark.value)
    }
  }

  return {
    isDark: readonly(isDark),
    toggleDark,
    initDarkMode
  }
}