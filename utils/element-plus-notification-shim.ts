import { ElMessage, ElNotification as OriginalElNotification } from 'element-plus';
import type { NotificationParams, NotificationOptions, NotificationHandle, MessageType } from 'element-plus';
import { isVNode } from 'vue';

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return true;
  // coarse pointer is a better signal for handheld devices than viewport width
  if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer:coarse)').matches) return true;
  return false;
}

function normalizeToMessage(options: NotificationParams | undefined): {
  text: string;
  type?: NotificationOptions['type'];
  duration?: number;
} {
  if (!options) return { text: '' };

  const opts = typeof options === 'string' ? { message: options } : options;
  if (isVNode(opts)) {
    // VNode payloads are not ideal for message; fall back to empty string
    return { text: '' };
  }

  const textPart = (() => {
    if (typeof opts.message === 'string') return opts.message;
    if (isVNode(opts.message) && opts.message.el?.textContent) return opts.message.el.textContent;
    return '';
  })();
  const merged = opts.title ? `${opts.title}\n${textPart}` : textPart;

  return {
    text: merged.trim(),
    type: opts.type,
    duration: opts.duration,
  };
}

const PatchedElNotification = ((options?: NotificationParams): NotificationHandle => {
  if (isMobileViewport()) {
    const { text, type, duration } = normalizeToMessage(options);
    const messageType = (type ? type : undefined) as MessageType | undefined;
    return ElMessage({
      type: messageType,
      message: text || ' ',
      duration: duration ?? 3000,
    }) as unknown as NotificationHandle;
  }

  return OriginalElNotification(options as any);
}) as typeof OriginalElNotification;

// Preserve closeAll for callers that rely on it
(PatchedElNotification as any).closeAll = (OriginalElNotification as any).closeAll;

// Map typed helpers (.success/.error/...) so legacy call-sites keep working
const helper = (kind: MessageType) => (options?: NotificationParams) => {
  if (typeof options === 'string') {
    return PatchedElNotification({ type: kind, message: options });
  }
  return PatchedElNotification({ ...(options as any), type: kind });
};

(PatchedElNotification as any).success = helper('success');
(PatchedElNotification as any).error = helper('error');
(PatchedElNotification as any).warning = helper('warning');
(PatchedElNotification as any).info = helper('info');

export { PatchedElNotification as ElNotification };
export default PatchedElNotification;
export type { NotificationParams, NotificationOptions, NotificationHandle };
