/**
 * Minimal replacement for `string-random` when the package is not installed.
 * Produces a lowercase hex string of the requested length.
 */
function stringRandom(len: number = 32): string {
    if (len <= 0) return '';
    // crypto.randomBytes generates secure random bytes; hex representation is lowercase
    // each byte -> 2 hex chars, so ceil(len/2) bytes needed
    return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}
import * as crypto from 'crypto';
import axios, { AxiosResponse } from 'axios';
import qs from 'qs';


class GeetestLibResult {
    status: number;
    data: string;
    msg: string;

    constructor(status = 0, data = '', msg = '') {
        // 成功失败的标识码，1表示成功，0表示失败
        this.status = status;
        // 返回数据，json格式
        this.data = data;
        // 备注信息，如异常信息等
        this.msg = msg;
    }

    setAll(status: number, data: string, msg: string): void {
        this.status = status;
        this.data = data;
        this.msg = msg;
    }

    toString(): string {
        return `GeetestLibResult{status=${this.status}, data=${this.data}, msg=${this.msg}}`;
    }
}

type GeetestParams = Record<string, any>;

class GeetestLib {
    static IS_DEBUG: boolean = false; // 调试开关，是否输出调试日志
    static API_URL: string = "http://api.geetest.com";
    static REGISTER_URL: string = "/register.php";
    static VALIDATE_URL: string = "/validate.php";
    static JSON_FORMAT: string = "1";
    static NEW_CAPTCHA: boolean = true;
    static HTTP_TIMEOUT_DEFAULT: number = 5000; // 单位：毫秒
    static VERSION: string = "node-express:3.1.1";
    static GEETEST_CHALLENGE: string = "geetest_challenge"; // 极验二次验证表单传参字段 chllenge
    static GEETEST_VALIDATE: string = "geetest_validate"; // 极验二次验证表单传参字段 validate
    static GEETEST_SECCODE: string = "geetest_seccode"; // 极验二次验证表单传参字段 seccode
    static GEETEST_SERVER_STATUS_SESSION_KEY: string = "gt_server_status"; // 极验验证API服务状态Session Key

    private geetest_id: string;
    private geetest_key: string;
    public libResult: GeetestLibResult;

    constructor(geetest_id: string, geetest_key: string) {
        this.geetest_id = geetest_id;
        this.geetest_key = geetest_key;
        this.libResult = new GeetestLibResult();
    }

    private gtlog(message: string): void {
        if (GeetestLib.IS_DEBUG) {
            // eslint-disable-next-line no-console
            console.log('gtlog: ' + message);
        }
    }

    /**
     * 验证初始化
     */
    async register(digestmod: string, params: GeetestParams = {}): Promise<any> {
        this.gtlog(`register(): 开始验证初始化, digestmod=${digestmod}.`);
        const origin_challenge = await this.requestRegister(params);
        this.buildRegisterResult(origin_challenge, digestmod);
        this.gtlog(`register(): 验证初始化, lib包返回信息=${JSON.stringify(this.libResult)}.`);
        return this.libResult;
    }

    /**
     * 向极验发送验证初始化的请求，GET方式
     */
    async requestRegister(params: GeetestParams = {}): Promise<string> {
        params = Object.assign({}, params, {
            gt: this.geetest_id,
            json_format: GeetestLib.JSON_FORMAT,
            sdk: GeetestLib.VERSION,
        });
        const register_url = GeetestLib.API_URL + GeetestLib.REGISTER_URL;
        this.gtlog(`requestRegister(): 验证初始化, 向极验发送请求, url=${register_url}, params=${JSON.stringify(params)}.`);
        let origin_challenge = '';
        try {
            const res: AxiosResponse<any> = await axios({
                url: register_url,
                method: 'GET',
                timeout: GeetestLib.HTTP_TIMEOUT_DEFAULT,
                params: params,
            });
            const resBody = res.status === 200 ? res.data : '';
            this.gtlog(`requestRegister(): 验证初始化, 与极验网络交互正常, 返回码=${res.status}, 返回body=${JSON.stringify(resBody)}.`);
            origin_challenge = resBody && resBody.challenge ? String(resBody.challenge) : '';
        } catch (e: any) {
            this.gtlog('requestRegister(): 验证初始化, 请求异常，后续流程走宕机模式, ' + (e && e.message ? e.message : String(e)));
            origin_challenge = '';
        }
        return origin_challenge;
    }

    async localRegister(): Promise<any> {
        this.gtlog('获取当前缓存中bypass状态为fail，后续流程走宕机模式 ');
        this.buildRegisterResult('', '');
        this.gtlog(`register(): 验证初始化, lib包返回信息=${JSON.stringify(this.libResult)}.`);
        return this.libResult;
    }

    /**
     * 构建验证初始化返回数据
     */
    buildRegisterResult(origin_challenge: string, digestmod?: string): void {
        // origin_challenge为空或者值为0代表失败
        if (!origin_challenge || origin_challenge === '0') {
            // 本地随机生成32位字符串
            const challenge = stringRandom(32).toLowerCase();
            const data = {
                success: 0,
                gt: this.geetest_id,
                challenge: challenge,
                new_captcha: GeetestLib.NEW_CAPTCHA,
            };
            this.libResult.setAll(0, JSON.stringify(data), '获取当前缓存中bypass状态为fail，本地生成challenge，后续流程走宕机模式');
        } else {
            let challenge: string;
            if (digestmod === 'md5') {
                challenge = this.md5_encode(origin_challenge + this.geetest_key);
            } else if (digestmod === 'sha256') {
                challenge = this.sha256_encode(origin_challenge + this.geetest_key);
            } else if (digestmod === 'hmac-sha256') {
                challenge = this.hmac_sha256_encode(origin_challenge, this.geetest_key);
            } else {
                challenge = this.md5_encode(origin_challenge + this.geetest_key);
            }
            const data = {
                success: 1,
                gt: this.geetest_id,
                challenge: challenge,
                new_captcha: GeetestLib.NEW_CAPTCHA,
            };
            this.libResult.setAll(1, JSON.stringify(data), '');
        }
    }

    /**
     * 正常流程下（即验证初始化成功），二次验证
     */
    async successValidate(challenge: string, validate: string, seccode: string, params: GeetestParams = {}): Promise<any> {
        this.gtlog(`successValidate(): 开始二次验证 正常模式, challenge=${challenge}, validate=${validate}, seccode=${seccode}.`);
        if (!this.checkParam(challenge, validate, seccode)) {
            this.libResult.setAll(0, '', '正常模式，本地校验，参数challenge、validate、seccode不可为空');
        } else {
            const response_seccode = await this.requestValidate(challenge, validate, seccode, params);
            if (!response_seccode) {
                this.libResult.setAll(0, '', '请求极验validate接口失败');
            } else if (response_seccode === 'false') {
                this.libResult.setAll(0, '', '极验二次验证不通过');
            } else {
                this.libResult.setAll(1, '', '');
            }
        }
        this.gtlog(`successValidate(): 二次验证 正常模式, lib包返回信息=${JSON.stringify(this.libResult)}.`);
        return this.libResult;
    }

    /**
     * 异常流程下（即验证初始化失败，宕机模式），二次验证
     * 注意：由于是宕机模式，初衷是保证验证业务不会中断正常业务，所以此处只作简单的参数校验，可自行设计逻辑。
     */
    failValidate(challenge: string, validate: string, seccode: string): any {
        this.gtlog(`failValidate(): 开始二次验证 宕机模式, challenge=${challenge}, validate=${validate}, seccode=${seccode}.`);
        if (!this.checkParam(challenge, validate, seccode)) {
            this.libResult.setAll(0, '', '宕机模式，本地校验，参数challenge、validate、seccode不可为空.');
        } else {
            this.libResult.setAll(1, '', '');
        }
        this.gtlog(`failValidate(): 二次验证 宕机模式, lib包返回信息=${JSON.stringify(this.libResult)}.`);
        return this.libResult;
    }

    /**
     * 向极验发送二次验证的请求，POST方式
     */
    async requestValidate(challenge: string, validate: string, seccode: string, params: GeetestParams = {}): Promise<string> {
        params = Object.assign({}, params, {
            seccode: seccode,
            json_format: GeetestLib.JSON_FORMAT,
            challenge: challenge,
            sdk: GeetestLib.VERSION,
            captchaid: this.geetest_id,
        });
        const validate_url = GeetestLib.API_URL + GeetestLib.VALIDATE_URL;
        this.gtlog(`requestValidate(): 二次验证 正常模式, 向极验发送请求, url=${validate_url}, params=${JSON.stringify(params)}.`);
        let response_seccode = '';
        try {
            const res: AxiosResponse<any> = await axios({
                url: validate_url,
                method: 'POST',
                timeout: GeetestLib.HTTP_TIMEOUT_DEFAULT,
                data: qs.stringify(params),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            const resBody = res.status === 200 ? res.data : '';
            this.gtlog(`requestValidate(): 二次验证 正常模式, 与极验网络交互正常, 返回码=${res.status}, 返回body=${JSON.stringify(resBody)}.`);
            response_seccode = resBody && resBody.seccode ? String(resBody.seccode) : '';
        } catch (e: any) {
            this.gtlog('requestValidate(): 二次验证 正常模式, 请求异常, ' + (e && e.message ? e.message : String(e)));
            response_seccode = '';
        }
        return response_seccode;
    }

    /**
     * 校验二次验证的三个参数，校验通过返回true，校验失败返回false
     */
    checkParam(challenge?: string, validate?: string, seccode?: string): boolean {
        const isNonEmptyString = (v?: string) => typeof v === 'string' && v.trim() !== '';
        return isNonEmptyString(challenge) && isNonEmptyString(validate) && isNonEmptyString(seccode);
    }

    /**
     * md5 加密
     */
    md5_encode(value: string): string {
        return crypto.createHash('md5').update(value).digest('hex');
    }

    /**
     * sha256加密
     */
    sha256_encode(value: string): string {
        return crypto.createHash('sha256').update(value).digest('hex');
    }

    /**
     * hmac-sha256 加密
     */
    hmac_sha256_encode(value: string, key: string): string {
        return crypto.createHmac('sha256', key).update(value).digest('hex');
    }
}

export default GeetestLib;