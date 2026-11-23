<template>
    <div>
        <div class="login-container flex items-center justify-center p-4">
            <div class="form-card w-full max-w-md p-8">
                <!-- 标题 -->

                <div class="text-center mb-8">
                    <template v-if="tabState == 'login'">
                        <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-200  dark:text-gray-200 mb-2"> 欢迎回来 </h1>
                        <p class="text-gray-600 dark:text-gray-400 "> 登录您的账户以继续 </p>
                    </template>

                    <!-- <template v-if="tabState == 'visitor'">
                        <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-200  dark:text-gray-200 mb-2"> 以游客身份游玩 </h1>
                        <p class="text-gray-600 dark:text-gray-400 "> 快速注册一个临时账号</p>
                    </template> -->
                    <template v-if="tabState == 'register'">
                        <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-200  dark:text-gray-200 mb-2"> 注册账号 </h1>
                        <p class="text-gray-600 dark:text-gray-400 "> 注册新账户开始使用</p>
                    </template>
                </div>

                <!-- 切换按钮 -->
                <div class="flex mb-8 bg-gray-100 dark:bg-gray-700  rounded-lg p-1">
                    <!-- <button 
                    v-if="!referralCode"
                    @click="tabState = 'visitor'"
                        :class="['tab-button', 'flex-1', 'py-2', 'px-4', 'rounded-md', 'text-sm', 'font-medium', 'transition-all', { 'active': tabState == 'visitor'}]">
                        以游客身份<br />游玩
                    </button> -->
                    <button @click="tabState = 'login'"
                        :class="['tab-button', 'flex-1', 'py-2', 'px-4', 'rounded-md', 'text-sm', 'font-medium', 'transition-all', { 'active': tabState == 'login' }]">
                        登录
                    </button>
                    <button @click="tabState = 'register'"
                        :class="['tab-button', 'flex-1', 'py-2', 'px-4', 'rounded-md', 'text-sm', 'font-medium', 'transition-all', { 'active': tabState == 'register' }]">
                        注册
                    </button>
                </div>

                <!-- 游客表单 -->
                <el-form v-if="tabState == 'visitor'" :model="visitorForm" :rules="visitorRules" ref="visitorFormRef"
                    @submit.prevent="handleLogin">
                    <el-form-item prop="name" class="mb-6">
                        <el-input v-model="visitorForm.name" placeholder="请输入用户名" size="large" class="w-full">
                            <template #prefix>
                                <el-icon class="input-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                        <path stroke-linecap="round" stroke-linejoin="round"
                                            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </el-icon>
                            </template>
                        </el-input>
                    </el-form-item>

                    <div class="mb-2">
                        <el-checkbox v-model="visitorForm.agree">
                            我同意 
                            <a href="#" class="text-blue-600 hover:text-blue-500" @click.prevent="showUserAgreement">用户协议</a> 和
                            <a href="#" class="text-blue-600 hover:text-blue-500" @click.prevent="showPrivacyPolicy">隐私政策</a>
                        </el-checkbox>
                    </div>
                </el-form>

                <!-- 登录表单 -->
                <el-form v-if="tabState == 'login'" :model="loginForm" :rules="loginRules" ref="loginFormRef"
                    @submit.prevent="handleLogin">
                    <el-form-item prop="loginName" class="mb-6">
                        <el-input v-model="loginForm.loginName" placeholder="请输入用户名/邮箱" size="large" class="w-full">
                            <template #prefix>
                                <el-icon class="input-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                        <path stroke-linecap="round" stroke-linejoin="round"
                                            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </el-icon>
                            </template>
                        </el-input>
                    </el-form-item>

                    <el-form-item prop="password" class="mb-6">
                        <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" size="large"
                            show-password class="w-full">
                            <template #prefix>
                                <el-icon class="input-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                        <path stroke-linecap="round" stroke-linejoin="round"
                                            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                </el-icon>
                            </template>
                        </el-input>
                    </el-form-item>

                    <!-- <div class="flex items-center justify-between mb-2">
                        <el-checkbox v-model="loginForm.remember">记住我</el-checkbox>
                        <a href="#" class="text-sm text-blue-600 hover:text-blue-500">忘记密码？</a>
                    </div> -->
                </el-form>

                <!-- 注册表单 -->
                <el-form v-if="tabState == 'register'" :model="registerForm" :rules="(registerRules as any)"
                    ref="registerFormRef" @submit.prevent="handleRegister">
                    <el-form-item prop="username" class="mb-6">
                        <el-input v-model="registerForm.username" placeholder="请输入用户名" size="large" class="w-full">
                            <template #prefix>
                                <el-icon class="input-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                        <path stroke-linecap="round" stroke-linejoin="round"
                                            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </el-icon>
                            </template>
                        </el-input>
                    </el-form-item>

                    <el-form-item prop="email" class="mb-6">
                        <el-input v-model="registerForm.email" placeholder="请输入邮箱" size="large" class="w-full">
                            <template #prefix>
                                <el-icon class="input-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                        <path stroke-linecap="round" stroke-linejoin="round"
                                            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.32 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                    </svg>
                                </el-icon>
                            </template>
                        </el-input>
                    </el-form-item>

                    <el-form-item prop="password" class="mb-6">
                        <el-input v-model="registerForm.password" type="password" placeholder="请输入密码" size="large"
                            show-password class="w-full">
                            <template #prefix>
                                <el-icon class="input-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                        <path stroke-linecap="round" stroke-linejoin="round"
                                            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                </el-icon>
                            </template>
                        </el-input>
                    </el-form-item>

                    <el-form-item prop="confirmPassword" class="mb-6">
                        <el-input v-model="registerForm.confirmPassword" type="password" placeholder="请确认密码"
                            size="large" show-password class="w-full">
                            <template #prefix>
                                <el-icon class="input-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                        <path stroke-linecap="round" stroke-linejoin="round"
                                            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </el-icon>
                            </template>
                        </el-input>
                    </el-form-item>

                    <div class="mb-2">
                        <el-checkbox v-model="registerForm.agree">
                            我同意 
                            <a href="#" class="text-blue-600 hover:text-blue-500" @click.prevent="showUserAgreement">用户协议</a> 和
                            <a href="#" class="text-blue-600 hover:text-blue-500" @click.prevent="showPrivacyPolicy">隐私政策</a>
                        </el-checkbox>
                    </div>


                </el-form>

                <!-- <el-button v-if="tabState == 'visitor'" type="primary" size="large" class="login-button w-full mb-4"
                    @click="handleVisitorLogin" :loading="loading">
                    {{ loading ? '登录中...' : '登录' }}
                </el-button> -->
                <div v-if="tabState == 'login'" class="text-right mb-4">
                    <a href="#" class="text-sm text-blue-600 hover:text-blue-500" @click.prevent="openForgotDialog">忘记密码？</a>
                </div>
                <div id="geetest-reg" class="mb-4">
                </div>
                <el-button v-if="tabState == 'login'" type="primary" size="large" class="login-button w-full mb-4"
                    @click="handleLogin" :loading="loading">
                    {{ loading ? '登录中...' : '登录' }}
                </el-button>
                <el-button v-else-if="tabState == 'register'" type="primary" size="large"
                    class="login-button w-full mb-4" @click="handleRegister" :loading="loading">
                    {{ loading ? '注册中...' : '注册' }}
                </el-button>

                <div v-if="referralCode && tabState == 'register'" class="text-center w-full">
                    <el-popover placement="top" width="300px">
                        <template #reference>
                            <el-text size="small" class="underline!"> 此次注册来自于一次外部邀请 
                                <el-icon class="cursor-pointer text-gray-400">
                                    <Icon name="material-symbols:help" />
                                </el-icon>
                            </el-text>
                        </template>
                        <div>
                            如果您不清楚此次邀请的来源，可以点击<a href="/login" class="text-blue-400 underline">这里</a>跳转至无邀请的注册方式。
                        </div>
                    </el-popover>
                </div>

            </div>
        </div>

        <!-- 异地登录邮箱验证弹窗 -->
        <el-dialog v-model="loginVerifyVisible" title="登录环境验证" :width="isMobile ? '100%' : '400px'">
            <div>
                <p>检测到您的登录环境发生变更，我们已向绑定邮箱发送验证码。</p>
                <p class="my-2 text-gray-500">请输入邮箱验证码以完成登录。</p>

                <el-text size="small">如果您无法收到验证码，请点击<a href="https://wj.qq.com/s2/22648177/5999/" target="_blank" class="text-blue-400">此处</a>填写详细信息并留下可用的邮箱。</el-text>

                <el-input v-model="loginVerifyCode" placeholder="请输入邮箱验证码" class="mt-4" />
                <div class="flex justify-end mt-4 space-x-2">
                    <el-button :disabled="loginVerifyCooldown>0" @click="onLoginVerifyResend">
                        重新发送{{ loginVerifyCooldown>0 ? `（${loginVerifyCooldown}s）` : '' }}
                    </el-button>
                    <el-button type="primary" @click="onSubmitLoginVerify">验证并继续</el-button>
                </div>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="loginVerifyVisible=false">关闭</el-button>
                </div>
            </template>
        </el-dialog>

       <!-- 用户协议弹窗 -->
        <el-dialog
            v-model="userAgreementVisible"
            title="用户协议"
            :width="isMobile ? '100%' : '60%'"
            max-width="800px"
            top="48px"
            :modal="true"
            :close-on-click-modal="false"
            class="agreement-dialog"
        >
            <div class="agreement-content">
                <div class="text-sm text-gray-600 dark:text-gray-400 leading-6 space-y-4">
                    <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">用户服务协议</h3>
                    
                    <p class="font-medium">欢迎使用我们的服务！</p>
                    
                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">1. 服务条款的接受</h4>
                        <p>通过访问、注册或使用本平台，您表示同意受本用户协议的约束。如果您不同意本协议的任何条款，请不要使用我们的服务。</p>
                    </div>

                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">2. 账户注册与使用</h4>
                        <p>• 您必须提供真实、准确、完整的注册信息</p>
                        <p>• 您有责任维护账户信息的准确性和安全性</p>
                        <p>• 您不得将账户转让给他人或允许他人使用您的账户</p>
                        <p>• 每个用户只能注册一个账户</p>
                        <p>• 对于注册多个账号用户，我们将会采取措施进行处理，包括但不限于封禁账号。</p>
                    </div>

                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">3. 用户行为规范</h4>
                        <p>您同意不进行以下行为：</p>
                        <p>• 发布违法、有害、威胁、辱骂、诽谤、色情或其他不当内容</p>
                        <p>• 侵犯他人的知识产权或其他权利</p>
                        <p>• 使用自动化程序或机器人访问服务</p>
                        <p>• 干扰或破坏服务的正常运行</p>
                        <p>• 进行任何形式的商业活动或广告宣传</p>
                    </div>

                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">4. 游戏规则</h4>
                        <p>• 禁止使用外挂、修改器等第三方工具</p>
                        <p>• 禁止恶意刷分或利用系统漏洞</p>
                        <p>• 禁止进行任何形式的游戏币交易</p>
                        <p>• 遵守游戏内的公平竞争原则</p>
                    </div>

                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">5. 服务的变更与终止</h4>
                        <p>我们保留随时修改、暂停或终止服务的权利，无需事先通知。对于因服务变更或终止而造成的任何损失，我们不承担责任。</p>
                    </div>

                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">6. 知识产权</h4>
                        <p>本平台的所有内容，包括但不限于文本、图片、音频、视频、软件等，均受知识产权法保护。未经授权，您不得复制、传播或以其他方式使用这些内容。</p>
                    </div>

                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">7. 免责声明</h4>
                        <p>我们不对以下情况承担责任：</p>
                        <p>• 因不可抗力导致的服务中断</p>
                        <p>• 因用户违规行为造成的损失</p>
                        <p>• 因第三方行为造成的损失</p>
                        <p>• 游戏数据的丢失或损坏</p>
                    </div>

                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">8. 协议的修改</h4>
                        <p>我们可能会不时更新本协议。如有重大变更，我们会在平台上发布通知。继续使用服务即表示您接受修改后的协议。</p>
                    </div>

                    <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p class="text-sm"><strong>本协议最后更新时间：2025年7月2日</strong></p>
                    </div>
                </div>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="userAgreementVisible = false">关闭</el-button>
                    <el-button type="primary" @click="acceptUserAgreement">我已阅读并同意</el-button>
                </div>
            </template>
        </el-dialog>

                <!-- 忘记密码弹窗 -->
                <el-dialog v-model="forgotDialogVisible" title="找回密码" :width="isMobile ? '100%' : '400px'">
                    <div v-if="forgotStep === 'email'">
                        <p>请输入绑定的邮箱，我们会发送验证码到该邮箱。</p>
                        <el-input v-model="forgotEmail" placeholder="请输入邮箱" class="mt-4" />
                        <div class="flex justify-end mt-4">
                            <el-button type="primary" :disabled="forgotCooldown>0" @click="onForgotSend">
                                <span v-if="forgotCooldown>0">发送验证码 ({{ forgotCooldown }}s)</span>
                                <span v-else>发送验证码</span>
                            </el-button>
                        </div>
                    </div>

                    <div v-else-if="forgotStep === 'verify'">
                        <p>我们已发送验证码到：{{ forgotEmail }}，请输入验证码以继续。</p>
                        <el-input v-model="forgotCode" placeholder="请输入验证码" class="mt-4" />
                        <div class="flex justify-end mt-4 space-x-2">
                            <el-button @click="forgotStep = 'email'">返回</el-button>
                            <el-button type="primary" @click="onForgotVerify">验证并继续</el-button>
                        </div>
                    </div>

                    <div v-else-if="forgotStep === 'reset'">
                        <p>请输入新密码：</p>
                        <el-input v-model="forgotPassword" type="password" placeholder="新密码" class="mt-4" />
                        <el-input v-model="forgotPasswordConfirm" type="password" placeholder="确认新密码" class="mt-2" />
                        <div class="flex justify-end mt-4 space-x-2">
                            <el-button @click="forgotStep = 'email'">取消</el-button>
                            <el-button type="primary" @click="onForgotReset">重置并登录</el-button>
                        </div>
                    </div>

                    <template #footer>
                        <div class="dialog-footer">
                            <el-button @click="closeForgotDialog">关闭</el-button>
                        </div>
                    </template>
                </el-dialog>

        <!-- 隐私政策弹窗 -->
        <el-dialog
            v-model="privacyPolicyVisible"
            title="隐私政策"
            :width="isMobile ? '100%' : '60%'"
            :modal="true"
            top="48px"
            :close-on-click-modal="false"
            class="agreement-dialog"
        >
            <div class="agreement-content">
                <div class="text-sm text-gray-600 dark:text-gray-400 leading-6 space-y-4">
                    <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">隐私政策</h3>
                    
                    <p class="font-medium">我们非常重视您的隐私保护。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。</p>
                    
                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">1. 信息收集</h4>
                        <p><strong>我们收集的信息类型：</strong></p>
                        <p>• <strong>账户信息：</strong>用户名、邮箱地址、注册时间</p>
                        <p>• <strong>游戏数据：</strong>游戏进度、成就、积分等</p>
                        <p>• <strong>设备信息：</strong>IP地址、浏览器类型、操作系统</p>
                        <p>• <strong>使用数据：</strong>访问时间、页面浏览记录、功能使用情况</p>
                    </div>

                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">2. 信息使用</h4>
                        <p>我们使用收集的信息用于：</p>
                        <p>• 提供和维护我们的服务</p>
                        <p>• 改善用户体验和服务质量</p>
                        <p>• 防止欺诈和滥用行为</p>
                        <p>• 发送重要的服务通知</p>
                        <p>• 进行数据分析以优化产品功能</p>
                    </div>

                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">3. 信息共享</h4>
                        <p>我们不会出售、交易或以其他方式转让您的个人信息给第三方，除非：</p>
                        <p>• 获得您的明确同意</p>
                        <p>• 法律法规要求</p>
                        <p>• 保护我们的权利和安全</p>
                    </div>

                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">5. Cookie和类似技术</h4>
                        <p>我们使用Cookie和类似技术来：</p>
                        <p>• 记住您的偏好设置</p>
                        <p>• 提供个性化内容</p>
                        <p>• 分析网站使用情况</p>
                        <p>• 改善服务性能</p>
                    </div>

                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">9. 第三方链接</h4>
                        <p>我们的服务可能包含第三方网站的链接。我们不对这些第三方网站的隐私做法负责。我们建议您查看每个网站的隐私政策。</p>
                    </div>

                    <div>
                        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">10. 隐私政策更新</h4>
                        <p>我们可能会更新本隐私政策。如有重大变更，我们会：</p>
                        <p>• 在平台上发布显著通知</p>
                        <p>• 通过邮件通知注册用户</p>
                        <p>• 更新本页面顶部的"最后更新"日期</p>
                    </div>

                    <div class="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p class="text-sm"><strong>本隐私政策最后更新时间：2025年7月2日</strong></p>
                        <p class="text-sm mt-2"><strong>生效日期：</strong>2025年7月2日</p>
                    </div>
                </div>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="privacyPolicyVisible = false">关闭</el-button>
                    <el-button type="primary" @click="acceptPrivacyPolicy">我已阅读并同意</el-button>
                </div>
            </template>
        </el-dialog>


    </div>
</template>

<script lang="ts" setup>
// declare global {
//   var grecaptcha: {
//     render: (element: string, options: any) => void;
//     reset: () => void;
//     [key: string]: any;
//   };
  
//   interface Window {
//     onloadCallback: () => void;
//     grecaptcha: typeof grecaptcha;
//   }
// }



import { ElMessage, } from 'element-plus';
import { isCaptchaCheckFailed, isEmailExisted, isLoginFailed, isMultiAccount, isNameExisted } from '~/shared/requestResult/login';

const { user, fetch: refreshSession } = useUserSession()

import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { sanitizeInput } from '~/shared/utils';
import CryptoJS from 'crypto-js';

// const isVisitor = ref(false)
// const isLogin = ref(true);
const route = useRoute()
const referralCode = computed(() => route.query.ref as string || '')
const { isMobile } = useDevice()

const loading = ref(false);
const visitorFormRef = ref();
const loginFormRef = ref();
const registerFormRef = ref();
const fp = ref("");

const tabState = ref<"login" | "visitor" | "register">("login")

const recaptchaToken = ref("")

const userAgreementVisible = ref(false);
const privacyPolicyVisible = ref(false);

const captchaObj = ref<any>(null);

// 忘记密码弹窗状态
const forgotDialogVisible = ref(false);
const forgotEmail = ref('');
const forgotCode = ref('');
const forgotStep = ref<'email'|'verify'|'reset'>('email');
const encKey = ref<string | null>(null);
const forgotPassword = ref('');
const forgotPasswordConfirm = ref('');
const forgotCooldown = ref(0);
let forgotTimer: number | undefined;

// 登录环境验证弹窗
const loginVerifyVisible = ref(false);
const loginVerifyCode = ref('');
const loginVerifyCooldown = ref(0);
let loginVerifyTimer: number | undefined;
// 记录本次待验证的登录凭据
const pendingLogin = reactive<{ loginName: string; password: string }>({ loginName: '', password: '' });

function openForgotDialog() {
    forgotDialogVisible.value = true;
    forgotStep.value = 'email';
    forgotEmail.value = '';
    forgotCode.value = '';
    encKey.value = null;
    forgotPassword.value = '';
    forgotPasswordConfirm.value = '';
}

function closeForgotDialog() {
    forgotDialogVisible.value = false;
    if (forgotTimer) { window.clearInterval(forgotTimer); forgotTimer = undefined; }
}

async function onForgotSend() {
    forgotEmail.value = sanitizeInput(forgotEmail.value);
    if (!forgotEmail.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.value)) return ElMessage.error('请输入正确的邮箱');
    if (forgotCooldown.value > 0) return ElMessage.error(`请等待 ${forgotCooldown.value} 秒后重试`);
    try {
        const res = await $fetch('/api/game/user/request-password-reset', { method: 'POST', body: { email: forgotEmail.value } });
            if (res && (res as any).ok) {
                ElMessage.success('验证码已发送，请查看邮箱');
                forgotStep.value = 'verify';
            // start client cooldown 60s
            forgotCooldown.value = 60;
            if (forgotTimer) window.clearInterval(forgotTimer);
            forgotTimer = window.setInterval(() => {
                forgotCooldown.value -= 1;
                if (forgotCooldown.value <= 0) { forgotCooldown.value = 0; if (forgotTimer) { window.clearInterval(forgotTimer); forgotTimer = undefined; } }
            }, 1000);
        } else {
            ElMessage.error((res as any).message || '发送失败');
        }
    } catch (e: any) {
        ElMessage.error(e?.message || '发送失败');
    }
}

async function onForgotVerify() {
    forgotEmail.value = sanitizeInput(forgotEmail.value);
    forgotCode.value = sanitizeInput(forgotCode.value);
    if (!forgotEmail.value || !forgotCode.value) return ElMessage.error('请输入邮箱和验证码');
    try {
        const res = await $fetch('/api/game/user/verify-reset-code', { method: 'POST', body: { email: forgotEmail.value, code: forgotCode.value } });
        if (res && (res as any).ok) {
            ElMessage.success('验证通过，请设置新密码');
            encKey.value = (res as any).encKey;
            forgotStep.value = 'reset';
        } else {
            ElMessage.error((res as any).message || '验证失败');
        }
    } catch (e: any) {
        ElMessage.error(e?.message || '验证失败');
    }
}

async function onForgotReset() {
    if (!encKey.value) return ElMessage.error('加密密钥不存在，请重新验证验证码');
    if (!forgotPassword.value || forgotPassword.value.length < 6) return ElMessage.error('密码长度至少6位');
    if (forgotPassword.value !== forgotPasswordConfirm.value) return ElMessage.error('两次密码输入不一致');

    // encrypt with encKey using crypto-js
    try {
        const cipher = CryptoJS.AES.encrypt(forgotPassword.value, encKey.value).toString();
        const res = await $fetch('/api/game/user/reset-password', { method: 'POST', body: { email: forgotEmail.value, encPassword: cipher } });
        if (res && (res as any).ok) {
            ElMessage.success('密码已重置，请使用新密码重新登录');
            closeForgotDialog();
            // reset local login fields
            loginForm.loginName = forgotEmail.value;
            loginForm.password = '';
            // Refresh page to pick up server state
            setTimeout(async () => { await refreshSession(); await navigateTo('/login') }, 600);
        } else {
            ElMessage.error((res as any).message || '重置失败');
        }
    } catch (e: any) {
        ElMessage.error(e?.message || '重置失败');
    }
}

// 显示用户协议
const showUserAgreement = () => {
    userAgreementVisible.value = true;
}

// 显示隐私政策
const showPrivacyPolicy = () => {
    privacyPolicyVisible.value = true;
}

// 接受用户协议
const acceptUserAgreement = () => {
    registerForm.agree = true;
    userAgreementVisible.value = false;
    ElMessage.success('已同意用户协议');
}

// 接受隐私政策
const acceptPrivacyPolicy = () => {
    registerForm.agree = true;
    privacyPolicyVisible.value = false;
    ElMessage.success('已同意隐私政策');
}

const visitorForm = reactive({
    name: '',
    agree: false,
});

// 登录表单数据
const loginForm = reactive({
    loginName: '',
    password: '',
    remember: false
});

// 注册表单数据
const registerForm = reactive({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    agree: false
});

const visitorRules = {
    name: [
        { required: true, message: '用户名', trigger: 'blur' },
        { min: 2, max: 20, message: '用户名长度在2到20个字符', trigger: 'blur' }
    ],
};

// 登录表单验证规则
const loginRules = {
    loginName: [
        { required: true, message: '请输入用户名或邮箱', trigger: 'blur' },
    ],
    password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
    ]
};

// 注册表单验证规则
const registerRules = {
    username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 2, max: 20, message: '用户名长度在2到20个字符', trigger: 'blur' }
    ],
    email: [
        { required: true, message: '请输入邮箱', trigger: 'blur' },
        { 
            validator: (rule: any, value: any, callback: any) => {
                const v = (value || '').toString().trim();
                if (!v) return callback(new Error('请输入邮箱'));
                const basic = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
                if (!basic) return callback(new Error('请输入正确的邮箱格式'));
                if (!v.toLowerCase().endsWith('.com')) return callback(new Error('请使用常用邮箱格式进行注册'));
                callback();
            },
            trigger: ['blur', 'change']
        }
    ],
    password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
    ],
    confirmPassword: [
        { required: true, message: '请确认密码', trigger: 'blur' },
        {
            validator: (rule: any, value: any, callback: any) => {
                if (value !== registerForm.password) {
                    callback(new Error('两次输入密码不一致'));
                } else {
                    callback();
                }
            },
            trigger: 'blur'
        }
    ]
};

// const handleVisitorLogin = async () => {

//     visitorForm.name = sanitizeInput(visitorForm.name);

//     // 检查是否同意协议
//     if (!visitorForm.agree) {
//         ElMessage.warning('请同意用户协议和隐私政策');
//         return;
//     }

//     if (!recaptchaToken.value) {
//         ElMessage.warning("请完成验证码");
//         return
//     }

//     if (!fp.value) {
//         ElMessage.warning("设备环境异常");
//         return
//     }

//     await visitorFormRef.value.validate(async (valid: any) => {
//         if (valid) {
//             loading.value = true;
//             // 模拟登录请求

//             const res = await $fetch('/api/game/user/visitor_login', {
//                 method: 'POST',
//                 body: {
//                     name: visitorForm.name,
//                     token: recaptchaToken.value,
//                     fp: fp.value || "",
//                 },
//             })

//             loading.value = false;

//             if (isMultiAccount(res)) {
//                 grecaptcha.reset()
//                 ElMessage.error(res.msg);
//                 return
//             }

//             if (isNameExisted(res)) {
//                 grecaptcha.reset()
//                 ElMessage.error("用户名已存在");
//                 return
//             }

//             if (isCaptchaCheckFailed(res)) {
//                 grecaptcha.reset()
//                 ElMessage.error("验证失败，请重试。");
//                 return
//             }
//             await refreshSession()

//             ElMessage.success('登录成功！');

//             // await navigateTo('/')
//             location.reload()

//             // // Refresh the session on client-side and redirect to the home page
//             // await refreshSession()
//             // await navigateTo('/')

//             // ElMessage.success('登录成功！');
//         }
//     });
// }

// 处理登录
const handleLogin = async () => {
    if (!loginFormRef.value) return;

    // 过滤和trim
    loginForm.loginName = sanitizeInput(loginForm.loginName);
    loginForm.password = loginForm.password.trim();

    const validate = captchaObj.value.getValidate()
    if (!validate) {
        ElMessage.warning("请完成验证码");
        return
    }

    const data = await $fetch(`/api/geetest/validate`, {
        method: 'POST',
        body: validate
    })

    if (data.result != 'success') {
        ElMessage.warning("验证失败，请刷新页面后重试");
    }

    await loginFormRef.value.validate(async (valid: any) => {
        if (valid) {
            loading.value = true;
            // 模拟登录请求

            const res = await $fetch('/api/game/user/login', {
                method: 'POST',
                body: {
                    loginName: loginForm.loginName,
                    password: loginForm.password,
                    token: recaptchaToken.value
                },
            })

            loading.value = false;

            if ((res as any)?.needEmailLoginVerify) {
                // 异地登录，需要邮箱验证码，打开验证弹窗
                pendingLogin.loginName = loginForm.loginName;
                pendingLogin.password = loginForm.password;
                loginVerifyVisible.value = true;
                loginVerifyCode.value = '';
                // 本地60s冷却
                loginVerifyCooldown.value = 60;
                if (loginVerifyTimer) window.clearInterval(loginVerifyTimer);
                loginVerifyTimer = window.setInterval(() => {
                    loginVerifyCooldown.value -= 1;
                    if (loginVerifyCooldown.value <= 0) {
                        loginVerifyCooldown.value = 0;
                        if (loginVerifyTimer) { window.clearInterval(loginVerifyTimer); loginVerifyTimer = undefined; }
                    }
                }, 1000);
                ElMessage.info((res as any).msg || '验证码已发送至邮箱');
                return;
            }

            if (isLoginFailed(res)) {
                ElMessage.error("登录失败，邮箱或密码错误。");
                return
            }

            if (isCaptchaCheckFailed(res)) {
                ElMessage.error("验证失败，请重试。");
                return
            }

            if (res.code === 403) {
                ElMessage.error("您已被封禁。封禁原因：" + res.msg);
                return
            }

            // Refresh the session on client-side and redirect to the home page
            try { sessionStorage.setItem('moyu.justLoggedIn', String(Date.now())) } catch (e) {}
            await refreshSession()
            ElMessage.success('登录成功！');

            await navigateTo('/')

        }
    });
};

// 提交异地登录验证码
const onSubmitLoginVerify = async () => {
    if (!pendingLogin.loginName || !pendingLogin.password) {
        loginVerifyVisible.value = false;
        return;
    }
    if (!loginVerifyCode.value) {
        ElMessage.warning('请输入邮箱验证码');
        return;
    }
    try {
        loading.value = true;
        const res = await $fetch('/api/game/user/login', {
            method: 'POST',
            body: {
                loginName: pendingLogin.loginName,
                password: pendingLogin.password,
                token: recaptchaToken.value,
                loginCode: loginVerifyCode.value,
            },
        });
        loading.value = false;

        if ((res as any)?.needEmailLoginVerify) {
            ElMessage.error((res as any).msg || '验证码错误或已过期');
            return;
        }

        if (isLoginFailed(res)) {
            ElMessage.error('登录失败，邮箱或密码错误。');
            return;
        }

        if (isCaptchaCheckFailed(res)) {
            ElMessage.error('验证失败，请重试。');
            return;
        }

        if ((res as any)?.code === 403) {
            ElMessage.error('您已被封禁。封禁原因：' + (res as any).msg);
            return;
        }

        // 成功
        loginVerifyVisible.value = false;
        try { sessionStorage.setItem('moyu.justLoggedIn', String(Date.now())) } catch (e) {}
        await refreshSession();
        ElMessage.success('登录成功！');
        await navigateTo('/')
    } catch (e: any) {
        loading.value = false;
        ElMessage.error(e?.message || '登录失败');
    }
}

// 重新发送验证码（调用登录接口再次触发后端发送）
const onLoginVerifyResend = async () => {
    if (loginVerifyCooldown.value > 0) return;
    try {
        const res = await $fetch('/api/game/user/login', {
            method: 'POST',
            body: {
                loginName: pendingLogin.loginName,
                password: pendingLogin.password,
                token: recaptchaToken.value,
            },
        });
        if ((res as any)?.needEmailLoginVerify) {
            ElMessage.success((res as any).msg || '验证码已发送');
            loginVerifyCooldown.value = 60;
            if (loginVerifyTimer) window.clearInterval(loginVerifyTimer);
            loginVerifyTimer = window.setInterval(() => {
                loginVerifyCooldown.value -= 1;
                if (loginVerifyCooldown.value <= 0) { loginVerifyCooldown.value = 0; if (loginVerifyTimer) { window.clearInterval(loginVerifyTimer); loginVerifyTimer = undefined; } }
            }, 1000);
            return;
        }
        // 如果直接登录成功（例如IP未变），也处理一次
        if (!(res as any)?.code || (res as any).code === 200) {
            loginVerifyVisible.value = false;
            await refreshSession();
            ElMessage.success('登录成功！');
            location.reload();
        }
    } catch (e: any) {
        ElMessage.error(e?.message || '发送失败');
    }
}

// 处理注册
const handleRegister = async () => {
    // 过滤和trim
    registerForm.username = sanitizeInput(registerForm.username);
    registerForm.email = sanitizeInput(registerForm.email);
    registerForm.password = registerForm.password.trim();
    registerForm.confirmPassword = registerForm.confirmPassword.trim();

    if (!registerFormRef.value) return;

    if (!registerForm.agree) {
        ElMessage.warning('请同意用户协议和隐私政策');
        return;
    }

    const validate = captchaObj.value.getValidate()
    if (!validate) {
        ElMessage.warning("请完成验证码");
        return
    }

    if (!fp.value) {
        ElMessage.warning("设备环境异常");
        return
    }

    const data = await $fetch(`/api/geetest/validate`, {
        method: 'POST',
        body: validate
    })

    if (data.result != 'success') {
        ElMessage.warning("验证失败，请刷新页面后重试");
    }

    await registerFormRef.value.validate(async (valid: any) => {
        if (valid) {
            loading.value = true;
            // 强制客户端二次校验：邮箱必须以 .com 结尾
            if (!registerForm.email || !registerForm.email.toString().trim().toLowerCase().endsWith('.com')) {
                loading.value = false;
                ElMessage.warning('请使用常用邮箱格式进行注册');
                return;
            }

            const res = await $fetch('/api/game/user/create', {
                method: 'POST',
                body: {
                    name: registerForm.username,
                    password: registerForm.password,
                    email: registerForm.email,
                    token: recaptchaToken.value,
                    fp: fp.value || "",
                    referralCode: referralCode.value || undefined, // 添加推荐码参数
                },
            })

            loading.value = false;

            if (isMultiAccount(res)) {
                ElMessage.error(res.msg);
                return
            }

            if (isCaptchaCheckFailed(res)) {
                ElMessage.error("验证失败，请重试。");
                return
            }

            if (isNameExisted(res)) {
                ElMessage.error("用户名已存在");
                return
            }

            if (isEmailExisted(res)) {
                ElMessage.error("邮箱已被注册");
                return
            }

            ElMessage.success('注册成功！即将为您登录');

            try { sessionStorage.setItem('moyu.justLoggedIn', String(Date.now())) } catch (e) {}
            await refreshSession()

            await navigateTo('/')
        }
    });
};

onMounted(async () => {
    const fpPromise = FingerprintJS.load();
    fpPromise.then(fp => fp.get()).then(result => {
        let visitorId = result.visitorId;
        fp.value = visitorId;
    });

    // window.onloadCallback = async () => {
    const data = await $fetch(`/api/geetest/register?t=${(new Date()).getTime()}`, {
        method: 'GET',
    })

    // @ts-ignore
    initGeetest({
        gt: data.gt,
        challenge: data.challenge,
        new_captcha: data.new_captcha, // 用于宕机时表示是新验证码的宕机
        offline: !data.success, // 表示用户后台检测极验服务器是否宕机，一般不需要关注
        product: "float", // 产品形式，包括：float，popup
        width: "100%"
    }, (pCaptchaObj: any) => {
        captchaObj.value = pCaptchaObj;
        pCaptchaObj.appendTo("#geetest-reg");
    });
})


</script>

<style>
.login-container {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

.form-card {
    backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.1);
}

.tab-button {
    transition: all 0.3s ease;
}

.tab-button.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.input-icon {
    color: #9ca3af;
}

.login-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    transition: all 0.3s ease;
}

.login-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}
</style>