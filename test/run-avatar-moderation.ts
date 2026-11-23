import path from 'node:path'
import fs from 'node:fs'
import { invoke } from '../server/utils/aliyun/gwf'

async function main() {
//   const TEST_IMAGE_PATH = path.resolve(process.cwd(), 'public/uploads/avatars/user_2509432e-caea-4abd-9220-e66ff6ef6a08_1764395786484_e1l4bao9.png')
  const TEST_IMAGE_PATH = path.resolve(process.cwd(), 'public/uploads/avatars/截屏2025-11-29 14.22.55.png')


  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    console.error('缺少测试图片: public/uploads/avatars/test-avatar.png')
    process.exit(1)
  }
  try {
    const res = await invoke(TEST_IMAGE_PATH)
    console.log(res)
    // if (res && (res.Code === 500 || res.Code === 'InvokeError')) {
    //   console.error('内容安全检测返回异常 Code:', res.Code)
    //   process.exit(2)
    // }
    console.log('测试通过')
  } catch (e) {
    console.error('调用失败', e)
    process.exit(3)
  }
}

main()
