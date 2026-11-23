import GeetestLib from '~/server/utils/geetest';
import { redisClient } from '~/server/utils';

const GeetestConfig = Object.freeze({
    GEETEST_ID: process.env.GEETEST_ID || "",
    GEETEST_KEY: process.env.GEETEST_KEY || "",
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6379',
    BYPASS_URL: 'http://bypass.geetest.com/v1/bypass_status.php',
    CYCLE_TIME: 10,
    GEETEST_BYPASS_STATUS_KEY: 'gt_server_bypass_status',
});

export default defineEventHandler(async (event) => {
    if (!GeetestConfig.GEETEST_ID || !GeetestConfig.GEETEST_KEY) {
        throw createError({ statusCode: 503, statusMessage: "GeeTest is not configured" });
    }
    const gtLib = new GeetestLib(GeetestConfig.GEETEST_ID, GeetestConfig.GEETEST_KEY);
    const digestmod = 'md5';
    const userId = 'test';
    const params = { digestmod, user_id: userId, client_type: 'web', ip_address: getRequestIP(event) || '' };

    const bypasscache = await redisClient.get(GeetestConfig.GEETEST_BYPASS_STATUS_KEY);
    let result;
    if (bypasscache === 'success') {
        result = await gtLib.register(digestmod, params);
    } else {
        result = await gtLib.localRegister();
    }

    // 返回原先 result.data（字符串形式的 JSON），保持不改变返回结构和值类型
    setHeader(event, 'Content-Type', 'application/json;charset=UTF-8');
    // result.data 里原本是 JSON 字符串；为了兼容旧行为直接返回字符串
    return result.data;
});
