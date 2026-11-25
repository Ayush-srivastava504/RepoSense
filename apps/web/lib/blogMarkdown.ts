// Module: lib/blogMarkdown.ts
// Pure (fs-free) helpers for the blog's markdown-ish article bodies: block
// parsing, heading ids for the table of contents, and reading time. The React
// rendering lives in app/blog/components/ArticleBody.tsx; keeping the parsing
// here makes it unit-testable without a renderer.
//
// Supported syntax (deliberately small — it is what the content JSON uses):
//   ## H2 / ### H3, paragraphs, "- " bullet lists, "1. " ordered lists,
//   "> " quotes, pipe tables (| a | b | with a |---| separator row), and
//   inline **bold**, `code` and [text](url).

export type Block =
  | { type: 'h2' | 'h3'; text: string; id: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[]; start: number }
  | { type: 'quote'; lines: string[] }
  | { type: 'table'; head: string[]; rows: string[][] };

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_[\]()]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/) // "\|" is a literal pipe inside a cell
    .map((c) => c.replace(/\\\|/g, '|').trim());
}

export function parseMarkdown(body: string): Block[] {
  const blocks: Block[] = [];
  const seen = new Map<string, number>();
  const uniqueId = (text: string) => {
    const base = slugifyHeading(text) || 'section';
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };

  for (const raw of body.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const block = raw.trim();
    if (!block) continue;
    const lines = block.split('\n');

    if (block.startsWith('### ')) {
      const text = block.slice(4).trim();
      blocks.push({ type: 'h3', text, id: uniqueId(text) });
    } else if (block.startsWith('## ')) {
      const text = block.slice(3).trim();
      blocks.push({ type: 'h2', text, id: uniqueId(text) });
    } else if (lines.every((l) => /^\s*[-*] /.test(l))) {
      blocks.push({ type: 'ul', items: lines.map((l) => l.replace(/^\s*[-*] /, '')) });
    } else if (lines.every((l) => /^\s*\d+[.)] /.test(l))) {
      blocks.push({ type: 'ol', start: parseInt(lines[0].trim(), 10) || 1, items: lines.map((l) => l.replace(/^\s*\d+[.)] /, '')) });
    } else if (lines.every((l) => l.startsWith('>'))) {
      blocks.push({ type: 'quote', lines: lines.map((l) => l.replace(/^>\s?/, '')).filter((l) => l.trim() !== '') });
    } else if (lines.length >= 2 && lines.every((l) => l.trim().startsWith('|')) && /^\|?[\s:-]+(\|[\s:-]+)+\|?$/.test(lines[1].trim())) {
      blocks.push({ type: 'table', head: splitRow(lines[0]), rows: lines.slice(2).map(splitRow) });
    } else {
      blocks.push({ type: 'p', text: lines.join(' ') });
    }
  }
  return blocks;
}

export function headingsFromBlocks(blocks: Block[]): Heading[] {
  return blocks.flatMap((b) =>
    b.type === 'h2' || b.type === 'h3' ? [{ id: b.id, text: stripInline(b.text), level: b.type === 'h2' ? 2 : 3 } as Heading] : []
  );
}

/** Removes inline markdown so headings/TOC/schema get plain text. */
export function stripInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string };

export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push({ type: 'text', value: text.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ type: 'bold', value: m[1] });
    else if (m[2] !== undefined) tokens.push({ type: 'code', value: m[2] });
    else tokens.push({ type: 'link', value: m[3], href: m[4] });
    last = re.lastIndex;
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
  return tokens;
}

/** ~220 wpm for technical prose; never below 1 minute. */
export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 220));
}
