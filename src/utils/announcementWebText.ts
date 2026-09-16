import { fetch as expoFetch } from 'expo/fetch';

export function isAnnouncementUrl(text: string): boolean {
  if (!/^https?:\/\/\S+$/i.test(text)) return false;
  try {
    return Boolean(new URL(text).hostname);
  } catch {
    return false;
  }
}

/** Best-effort text extraction only: no scripts, login or browser rendering. */
export function extractAnnouncementWebText(html: string): string {
  const entities: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ndash: '–', mdash: '—', hellip: '…', middot: '·',
  };
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|nav|header|footer|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '\n')
    .replace(/<\/?(?:div|p|br|h[1-6]|li|ul|ol|tr|td|th|dt|dd|section|article|main|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/a\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (!name.startsWith('#')) return entities[name.toLowerCase()] ?? entity;
      const point = name[1].toLowerCase() === 'x'
        ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    })
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t \u00a0]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export async function fetchAnnouncementText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await expoFetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      headers: { Accept: 'text/html,application/xhtml+xml,text/plain' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!/^(?:text\/(?:html|plain)|application\/xhtml\+xml)\b/i.test(contentType)) {
      throw new Error('链接未返回网页或纯文本。');
    }
    if (!response.body) throw new Error('网页响应为空。');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let body = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 3_000_000) {
          await reader.cancel();
          throw new Error('网页过大，请直接粘贴活动正文。');
        }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    const text = /^text\/plain\b/i.test(contentType) ? body.trim() : extractAnnouncementWebText(body);
    if (!text) throw new Error('网页没有可读取的正文，可能需要登录或浏览器加载。');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
