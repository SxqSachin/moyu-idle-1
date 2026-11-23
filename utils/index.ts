export type GPTRequestOptions = {
    init?: RequestInit

    contentCallback: (str: string, rawObj: any) => void

    thinkingContentCallback?: (str: string, rawObj: any) => void
    
    startThinkingCallback?: () => void
    stopThinkingCallback?: () => void
}
export const streamRequest = (url: string, opt: GPTRequestOptions): Promise<void> => {
    return new Promise(resolve => {
        // @ts-ignore
        $fetch.native(url, opt.init)
            .then((response: Response) => response.body)
            .then(async (body: any) => {
                const reader = body.getReader();

                let isThinking = false

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        resolve();
                        return;
                    }
                    const decoder = new TextDecoder();

                    let thisTimeRes = decoder.decode(value)

                    if (thisTimeRes.includes('[DONE]')) {
                        resolve();
                        return;
                    }

                    thisTimeRes = thisTimeRes.replace(/data: /g, '')

                    const resPart = thisTimeRes.split('\n').filter(val => !!val)

                    for (const part of resPart) {
                        let resObj = JSON.parse(part)

                        if (resObj.choices[0].finish_reason) {
                            resolve();
                            return
                        }

                        if (resObj.choices[0].delta.reasoning_content) {
                            if (!isThinking) {
                                isThinking = true
                                opt.startThinkingCallback?.()
                            }

                            opt.thinkingContentCallback?.(resObj.choices[0].delta.reasoning_content, resObj)
                        } else if (resObj.choices[0].delta.content) {
                            if (isThinking) {
                                isThinking = false

                                opt.stopThinkingCallback?.()
                            }

                            opt.contentCallback(resObj.choices[0].delta.content, resObj)
                        }
                    }
                }
            });
    })
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} - 返回是否复制成功
 */
export async function copyToClipboard(text: string) {
    // 首先尝试使用现代的 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('使用 Clipboard API 复制失败:', err);
        }
    }

    // 降级方案：使用传统的 document.execCommand 方法
    try {
        // 创建一个临时的 textarea 元素
        const textArea = document.createElement('textarea');
        
        // 设置文本内容
        textArea.value = text;
        
        // 确保 textarea 在视口之外
        textArea.style.position = 'fixed';
        textArea.style.top = '-999999px';
        textArea.style.left = '-999999px';
        
        // 保持 textarea 在页面上可编辑
        textArea.contentEditable = 'true';
        textArea.readOnly = false;
        
        // 添加到文档中
        document.body.appendChild(textArea);
        
        // 选中文本
        textArea.select();
        textArea.setSelectionRange(0, textArea.value.length);
        
        // 执行复制命令
        const success = document.execCommand('copy');
        
        // 清理：移除临时元素
        document.body.removeChild(textArea);
        
        return success;
    } catch (err) {
        console.error('使用 execCommand 复制失败:', err);
        return false;
    }
}