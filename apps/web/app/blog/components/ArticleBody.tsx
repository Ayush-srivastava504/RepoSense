// Module: app/blog/components/ArticleBody.tsx
// Renders a parsed markdown body (lib/blogMarkdown.ts) with the blog's prose
// styles (.blog-prose in globals.css). Headings carry ids so the table of
// contents and "#section" links resolve.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { tokenizeInline, type Block } from '@/lib/blogMarkdown';
import { BASE_URL } from '@/lib/jobs';

function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  const internal = href.startsWith('/') || href.startsWith('#') || href.startsWith(BASE_URL);
  if (internal) {
    const local = href.startsWith(BASE_URL) ? href.slice(BASE_URL.length) || '/' : href;
    return <Link href={local}>{children}</Link>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function Inline({ text }: { text: string }) {
  return (
    <>
      {tokenizeInline(text).map((t, i) => {
        if (t.type === 'bold') return <strong key={i}>{t.value}</strong>;
        if (t.type === 'code') return <code key={i}>{t.value}</code>;
        if (t.type === 'link') return <InlineLink key={i} href={t.href}>{t.value}</InlineLink>;
        return <span key={i}>{t.value}</span>;
      })}
    </>
  );
}

export default function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="blog-prose">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h2':
            return (
              <h2 key={i} id={b.id}>
                <Inline text={b.text} />
              </h2>
            );
          case 'h3':
            return (
              <h3 key={i} id={b.id}>
                <Inline text={b.text} />
              </h3>
            );
          case 'ul':
          case 'ol': {
            const Tag = b.type;
            return (
              <Tag key={i} start={b.type === 'ol' && b.start !== 1 ? b.start : undefined}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inline text={item} />
                  </li>
                ))}
              </Tag>
            );
          }
          case 'quote':
            return (
              <blockquote key={i}>
                {b.lines.map((line, j) => (
                  <p key={j}>
                    <Inline text={line} />
                  </p>
                ))}
              </blockquote>
            );
          case 'table':
            return (
              <div key={i} className="blog-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} scope="col">
                          <Inline text={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k}>
                            <Inline text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return (
              <p key={i}>
                <Inline text={b.text} />
              </p>
            );
        }
      })}
    </div>
  );
}
