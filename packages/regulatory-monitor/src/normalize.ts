import { createHash } from 'node:crypto';

const BLOCK_TAGS = /<\/?(?:address|article|aside|blockquote|br|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…'
  };

  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#x')) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : full;
    }
    if (lower.startsWith('#')) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : full;
    }
    return named[lower] ?? full;
  });
}

export function normalizeRegulatoryContent(raw: string, contentType = ''): string {
  let value = raw.replace(/^\uFEFF/, '');
  const looksLikeHtml = contentType.toLowerCase().includes('html') || /<html[\s>]/i.test(value);

  if (looksLikeHtml) {
    value = value
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(BLOCK_TAGS, '\n')
      .replace(/<[^>]+>/g, ' ');
    value = decodeHtmlEntities(value);
  }

  return value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v\u00a0 ]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
