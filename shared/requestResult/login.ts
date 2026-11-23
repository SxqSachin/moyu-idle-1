export const NAME_EXIST_CODE = 40001;
export const NAME_EXIST_MSG = "name existed";

export const EMAIL_EXIST_CODE = 40002;
export const EMAIL_EXIST_MSG = "email existed";

export const NAME_EMAIL_EXIST_CODE = 40003;
export const NAME_EMAIL_EXIST_MSG = "name or email existed";

export const EMAIL_PASSWORD_ERROR_CODE = 40010;
export const EMAIL_PASSWORD_ERROR_MSG = "name, email or password error";

export const CAPTCHA_CHECK_FAILED_CODE = 80010;
export const CAPTCHA_CHECK_FAILED_MSG = "captcha check failed";

export const CREATE_USER_FAILED_CODE = 80110;
export const CREATE_USER_FAILED_MSG = "注册环境异常";

export const isEmailExisted = (obj: {code: number}): boolean => {
    return obj.code == EMAIL_EXIST_CODE
}
export const isNameExisted = (obj: {code: number}): boolean => {
    return obj.code == NAME_EXIST_CODE
}

export const isLoginFailed = (obj: {code: number}): boolean => {
    return obj.code == EMAIL_PASSWORD_ERROR_CODE
}

export const isCaptchaCheckFailed = (obj: {code: number}) : boolean => {
    return obj.code == CAPTCHA_CHECK_FAILED_CODE
}

export const isMultiAccount = (obj: {code: number}) : boolean => {
    return obj.code == CREATE_USER_FAILED_CODE
}