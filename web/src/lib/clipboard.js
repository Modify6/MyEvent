// 剪贴板工具:一键复制任意文本 —— 云端走 http://IP 非安全上下文时 navigator.clipboard 不可用,
// 必须有 textarea + execCommand 兜底
import { showToast } from 'vant';

export async function copyText(text, { silent = false } = {}) {
  const s = String(text ?? '');
  if (!s) return false;
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(s);
      ok = true;
    }
  } catch {}
  if (!ok) {
    // 兜底:临时 textarea 选中后 execCommand(老 WebView / http 环境可行)
    try {
      const ta = document.createElement('textarea');
      ta.value = s;
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      ok = false;
    }
  }
  if (!silent) showToast(ok ? '已复制' : '复制失败,请长按手动复制');
  return ok;
}
