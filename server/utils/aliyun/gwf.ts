import RPCClient from "@alicloud/pop-core";
import OSS from 'ali-oss'
// const OSS = require('ali-oss');
import { v4 as uuidv4 } from 'uuid'
import nodePath from 'node:path'

// 服务是否部署在VPC上（可通过环境变量覆盖）
const isVPC = process.env.ALIYUN_USE_VPC === '1' || process.env.IS_VPC === '1';
//文件上传token
// var tokenDic = new Array();
//文件上传客户端

const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || "";
const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || "";
// Green CIP 端点（与控制台地域一致）
const endpoint: string = process.env.ALIBABA_CLOUD_GREEN_CIP_ENDPOINT || 'https://green-cip.cn-shanghai.aliyuncs.com';
// const endpoint: string = "https://green-cip.cn-beijing.aliyuncs.com";


let rpcClient: RPCClient;
const tokenDic: Record<string, any> = {}

//创建文件上传客户端
function getRPCClient() {
    if (rpcClient) {
        return rpcClient;
    }
    if (!accessKeyId || !accessKeySecret) {
        throw new Error("Alibaba Cloud credentials are not configured");
    }

    rpcClient = new RPCClient({
        accessKeyId: accessKeyId,
        accessKeySecret: accessKeySecret,
        endpoint: endpoint,
        apiVersion: '2022-03-02',
    });

    return rpcClient;
}

//创建文件上传客户端
function getOssClient(tokenData: any) {
    // 每次用当前 token 创建新客户端，避免使用过期凭证
    const endpointKeyInternet = tokenData['OssInternetEndPoint'] || tokenData['OssInternetEndpoint']
    const endpointKeyIntranet = tokenData['OssIntranetEndPoint'] || tokenData['OssIntranetEndpoint']
    const chosenEndpoint = isVPC ? endpointKeyIntranet : endpointKeyInternet
    return new OSS({
        accessKeyId: tokenData['AccessKeyId'],
        accessKeySecret: tokenData['AccessKeySecret'],
        stsToken: tokenData['SecurityToken'],
        endpoint: chosenEndpoint,
        bucket: tokenData['BucketName'],
        secure: true,
        internal: Boolean(isVPC),
    });
}

function tokenExpired(tokenData: any): boolean {
    try {
        const exp = tokenData?.['Expiration']
        if (!exp) return true
        const now = Math.floor(Date.now() / 1000)
        let epoch: number
        if (typeof exp === 'number') {
            epoch = exp
        } else if (typeof exp === 'string') {
            const parsed = Date.parse(exp)
            if (!isNaN(parsed)) epoch = Math.floor(parsed / 1000)
            else epoch = Number(exp)
        } else {
            return true
        }
        // 预留 60 秒安全边界
        return (epoch - 60) <= now
    } catch {
        return true
    }
}

//提交检测任务
export async function invoke(filePathParam: string) {
    //注意，此处实例化的client请尽可能重复使用，避免重复建立连接，提升检测性能。
    const client = getRPCClient();
    const requestOption = {
        method: 'POST',
        formatParams: false,
    };
    //本地文件的完整路径
    const filePath = filePathParam;

    if (!tokenDic[endpoint] || tokenExpired(tokenDic[endpoint])) {
        const tokenResponse = await client.request<any>('DescribeUploadToken', {}, requestOption)
        tokenDic[endpoint] = tokenResponse.Data;
    }

    //获取上传文件客户端
    const ossClient = getOssClient(tokenDic[endpoint])
    var split = filePath.split(".");
    var objectName;
    if (split.length > 1) {
        objectName = tokenDic[endpoint].FileNamePrefix + uuidv4() + "." + split[split.length - 1];
    } else {
        objectName = tokenDic[endpoint].FileNamePrefix + uuidv4();
    }
    //上传文件
    const result = await ossClient.put(objectName, nodePath.normalize(filePath));

    //通过以下代码创建检测API请求并设置参数。
    var params = {
        //图片检测service：内容安全控制台图片增强版规则配置的serviceCode，示例：baselineCheck
        //支持service请参考：https://help.aliyun.com/document_detail/467826.html?0#p-23b-o19-gff
        "Service": "baselineCheck",
        //本地图片上传信息
        "ServiceParameters": JSON.stringify({
            "ossBucketName": tokenDic[endpoint].BucketName,
            "ossObjectName": objectName
        })
    }
    //调用接口获取检测结果
    return await client.request('ImageModeration', params, requestOption);
}
