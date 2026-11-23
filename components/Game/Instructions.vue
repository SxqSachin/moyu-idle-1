<template>
    <el-card body-class="p-3! md:p-4! flex flex-col gap-4">
        <template #header>
            <div class="flex items-center space-x-3">
                <el-icon>
                    <Icon name="material-symbols:bookmark-star-outline-rounded" class="text-gray-400 text-2xl" />
                </el-icon>
                <span class="text-2xl font-bold text-gray-800  dark:text-gray-200 tracking-wide">猫猫村民守则</span>
                <span class="ml-2 text-lg">🐾</span>
            </div>
        </template>

        <div>
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">1. 喵喵服务条款的接受</h4>
            <p>喵！欢迎来到猫猫村。无论你是新来的小猫还是资深猫村民，只要你访问、注册或使用本平台，就表示你同意遵守本守则。如果你不同意，请暂停爪爪，别继续使用服务哦。</p>
        </div>

        <div>
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">2. 账户注册与使用</h4>
            <p>• 请用真实、准确、完整的信息注册你的猫猫账户</p>
            <p>• 保护好你的账户信息，别让其他猫咪或人类冒用</p>
            <p>• 一个玩家只能拥有一个账户，不要背着你的猫咪助手在外面乱搞</p>
            <p>• 发现多号、冒用、转让等行为，喵村会采取包括但不限于封号的措施</p>
        </div>

        <div>
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">3. 村民行为规范</h4>
            <p>请自觉遵守以下猫猫行为规范：</p>
            <h5 class="font-semibold text-gray-600 dark:text-gray-400 mt-2 mb-1">1）玩家发布的信息</h5>
            <p>• 禁止发布违法、伤害、威胁、辱骂、诽谤、色情或其他不适宜内容</p>
            <p>• 禁止侵犯他猫或人类的知识产权及其他合法权益</p>
            <p>• 禁止在游戏内发布与猫猫放置游戏无关的广告、推广、商业活动</p>
            <p>• 禁止冒充官方、管理员或其他玩家进行诈骗</p>
            <p>• 禁止恶意举报、骚扰、刷屏等影响玩家体验的行为</p>
            <p>• 不要在游戏内公开任何个人信息，包括但不限于真实姓名、联系方式、地址等</p>
            <p>• 不要公开讨论任何关于游戏内漏洞、BUG、异常机制的内容，如果遇问题请反馈给猫头大大或通过“意见反馈”进行提交</p>
            <p>• 玩家在评论区发布的内容，包括但不限于文字、图片、链接等，需确保不侵犯第三方的版权或其他合法权益。</p>
            <p>• 如果评论中引用了外部图片或资源，玩家需自行确认其版权归属，并承担因版权纠纷产生的责任。</p>
            <p>• 喵村有权删除涉嫌侵权的内容。</p>
            <p>• 喵村不对玩家发布的内容承担任何法律责任，所有责任由发布者自行承担。</p>
            <p>• 不要涉政</p>
            <h5 class="font-semibold text-gray-600 dark:text-gray-400 mt-3 mb-1">2）利用漏洞与不当手段</h5>
            <!-- <p>• 禁止使用脚本、外挂、机器人等工具自动执行操作、刷资源、刷奖励</p> -->
            <p>• 禁止利用系统漏洞、BUG、异常机制牟利或影响游戏平衡</p>
            <p>• 禁止以欺诈方式牟利或影响游戏平衡</p>
            <p>• 禁止恶意刷分、刷排名、刷资源等破坏公平的行为</p>
            <p>• 禁止账号买卖、租借、共享、代练等行为</p>
            <p>• 鼓励大家公平竞争，友好互动，做文明猫猫</p>
        </div>

        <!-- <div>
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">4. 游戏规则</h4>
            <p>• 禁止使用外挂、修改器、加速器等第三方工具</p>
            <p>• 禁止恶意刷分、刷资源等</p>
            <p>• 禁止利用任何手段进行游戏外的游戏币、道具、账号等交易</p>
            <p>• 禁止利用脚本、模拟器等非官方方式挂机</p>
            <p>• 禁止利用游戏漏洞破坏游戏平衡、影响其他玩家正常游戏体验</p>
        </div> -->

        <!-- <div>
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">5. 服务的变更与终止</h4>
            <p>喵村有权随时调整、暂停或终止服务，无需提前通知。因服务变更或终止带来的损失，喵村不承担责任，请理解喵～</p>
        </div> -->

        <!-- <div>
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">6. 知识产权</h4>
            <p>猫猫村的所有内容，包括但不限于文字、图片、音频、视频、软件等，均受知识产权保护。未经允许，禁止复制、传播或用于其他用途。</p>
        </div> -->

        <div>
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">4. 免责声明</h4>
            <p>喵村不对以下情况负责：</p>
            <p>• 因用户违规导致的损失</p>
            <p>• 因第三方行为造成的损失</p>
            <p>• 因不可抗力导致的服务中断或异常</p>
            <!-- <p>• 游戏数据丢失、损坏或异常</p> -->
        </div>

        <div>
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">5. 协议的修改</h4>
            <p>本守则可能会不定期更新。如有重大变更，喵村会在平台公告。继续使用服务即视为同意新守则。</p>
        </div>

        <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p class="text-sm"><strong>本守则最后更新时间：2025年7月16日</strong></p>
            <p class="text-xs text-gray-500 mt-1">喵村希望每一位猫猫都能在这里摸鱼，公平竞争，做最棒的猫猫村民！</p>
        </div>
    </el-card>
</template>