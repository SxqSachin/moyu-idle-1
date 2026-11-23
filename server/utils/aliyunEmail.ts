// 将自动生成的示例文件转换为一个可复用的工具方法。
// 导出默认函数：sendAliyunTemplateEmail(accessKeyId?, accessKeySecret?, opts)
// - 某些变量（AK/Secret、发信账号、收件人、主题、模板 id/data、htmlBody）作为方法参数传入
import Dm20151123, * as $Dm20151123 from "@alicloud/dm20151123";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $Util from "@alicloud/tea-util";
import Credential from "@alicloud/credentials";
import { EmailProviderArgs } from "./code";

function createClient(): Dm20151123 {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("Alibaba Cloud credentials are not configured");
  }
    // @ts-ignore
  let credential = new Credential.default({
    type: 'access_key',
    accessKeyId: accessKeyId,
    accessKeySecret: accessKeySecret,
  });
  let config = new $OpenApi.Config({
    credential: credential,
  });
  // Endpoint 请参考 https://api.aliyun.com/product/Dm
  config.endpoint = `dm.aliyuncs.com`;

  // @ts-ignore
  return new Dm20151123.default(config);
}

// InvalidAccessKeyId.NotFound: code: 404, Specified access key is not found. request id: 83B6D306-3644-5A84-BC95-B2B7B0BF1E8C

/**
 * 发送阿里云 DM 邮件（支持模板或自定义 HTML）
 * 当发生任何错误时直接抛出，让调用方可以看到并修复类型/运行时问题。
 * @param accessKeyId 可选 AK
 * @param accessKeySecret 可选 Secret
 * @param opts 发送参数
 */
export default async function sendAliyunTemplateEmail(opts: EmailProviderArgs) {
    const client = createClient();
  let template = new $Dm20151123.SingleSendMailRequestTemplate({
    templateData: opts.templateData,
    templateId: opts.templateId,
  });

  let singleSendMailRequest = new $Dm20151123.SingleSendMailRequest({
    subject: opts.subject,
    template: template,
    toAddress: opts.toAddress,

    accountName: "no-reply@email.moyu-idle.com",
    addressType: 1,
    replyToAddress: false,

    htmlBody: "body",
  });

  let runtime = new $Util.RuntimeOptions({});
  try {
    // 复制代码运行请自行打印 API 的返回值
    let res = await client.singleSendMailWithOptions(singleSendMailRequest, runtime);

    return { success: true, error: null, result: res }
  } catch (error) {
    console.log(error);
    // @ts-ignore
    console.log(error.data["Recommend"]);
    // throw error;
    return { success: false, error: true, result: error}
  }
}
