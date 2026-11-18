// 图片压缩:选图后 canvas 等比缩放(长边 1280)+JPEG 0.82,典型产物 100-400KB/张
// 纯函数 calcTargetSize 可单测;注意 GIF 会被压成静态首帧(canvas 限制)
export const IMAGE_MAX_EDGE = 1280;
export const IMAGE_QUALITY = 0.82;

// 目标尺寸:等比缩到长边 max,小图不放大
export function calcTargetSize(w, h, max = IMAGE_MAX_EDGE) {
  const W = Math.max(1, Number(w) || 0);
  const H = Math.max(1, Number(h) || 0);
  const long = Math.max(W, H);
  if (long <= max) return { w: W, h: H };
  const k = max / long;
  return { w: Math.round(W * k), h: Math.round(H * k) };
}

// 旋转后的宽高(90/270 互换)
export function rotatedSize(w, h, angle) {
  const a = ((Number(angle) || 0) % 360 + 360) % 360;
  return a % 180 === 0 ? { w, h } : { w: h, h: w };
}

// 读取图片文件为 HTMLImageElement(供编辑器使用)
function readAsImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败: ' + (file?.name || '')));
    };
    img.src = url;
  });
}

// File/Blob → { data(base64 dataURL), w, h };非图片文件抛错
export { readAsImage };

export async function compressImage(file, max = IMAGE_MAX_EDGE, quality = IMAGE_QUALITY) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('请选择图片文件');
  const img = await readAsImage(file);
  const { w, h } = calcTargetSize(img.naturalWidth, img.naturalHeight, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  const data = canvas.toDataURL('image/jpeg', quality);
  return { data, w, h };
}

// FileList → 压缩后的数组(逐张压缩,单张失败跳过并汇总报错)
export async function compressImageList(fileList, max = IMAGE_MAX_EDGE, quality = IMAGE_QUALITY) {
  const out = [];
  const errs = [];
  for (const f of Array.from(fileList || [])) {
    try {
      out.push(await compressImage(f, max, quality));
    } catch (e) {
      errs.push(e.message);
    }
  }
  if (errs.length && !out.length) throw new Error(errs.join('; '));
  return { images: out, errs };
}
