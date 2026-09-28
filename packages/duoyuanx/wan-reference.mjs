export const MAX_WAN_INLINE_VIDEO_BYTES = 24 * 1024 * 1024;

const invalid = message => Object.assign(Error(message), {status: 400});
const inlineVideo = value => typeof value === 'string' && value.startsWith('data:video/');

export function decodeWanInlineVideo(url) {
  if (!inlineVideo(url)) return null;
  const match = /^data:video\/mp4;base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
  if (!match || match[1].length % 4 !== 0) throw invalid('万相本地参考视频仅支持 MP4，请转换格式后重试');
  const encoded = match[1];
  const size = encoded.length * 3 / 4 - (encoded.match(/=+$/)?.[0].length || 0);
  if (size < 12 || size > MAX_WAN_INLINE_VIDEO_BYTES) throw invalid('万相本地参考视频须为 24 MiB 以内的有效 MP4');
  let bytes;
  try { bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0)); }
  catch { throw invalid('万相本地参考视频 Base64 内容无效'); }
  if (String.fromCharCode(...bytes.slice(4, 8)) !== 'ftyp') throw invalid('万相本地参考视频不是有效 MP4 文件');
  return bytes;
}

export function previewWanReferences(references = []) {
  return references.map((reference, index) => {
    if (!inlineVideo(reference?.contentUrl)) return reference;
    decodeWanInlineVideo(reference.contentUrl);
    return {...reference, contentUrl:`https://reference-preview.invalid/video-${index}.mp4`};
  });
}
