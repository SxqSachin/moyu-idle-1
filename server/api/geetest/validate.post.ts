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
    const body = await readBody(event) as Record<string, any>;

    const challenge = body[GeetestLib.GEETEST_CHALLENGE];
    const validate = body[GeetestLib.GEETEST_VALIDATE];
    const seccode = body[GeetestLib.GEETEST_SECCODE];

    const bypasscache = await redisClient.get(GeetestConfig.GEETEST_BYPASS_STATUS_KEY);
    let result;
    const params: any[] = [];
    if (bypasscache === 'success') {
        result = await gtLib.successValidate(challenge, validate, seccode, params);
    } else {
        result = gtLib.failValidate(challenge, validate, seccode);
    }

    // 注意，不要更改返回的结构和值类型
    if (result.status === 1) {
        return { result: 'success', version: GeetestLib.VERSION };
    } else {
        return { result: 'fail', version: GeetestLib.VERSION, msg: result.msg };
    }
});
