'use strict';

/**
 * Minimal, safe Markdown → HTML for revision notes (PRD §8.3: "sanitized Markdown").
 * Supports: ## / ### headings, paragraphs, - lists, tables, > blockquotes, **bold**, *italic*.
 * ALL input is HTML-escaped first, so no raw HTML/script can pass through.
 * For production hardening, replace with a vetted parser + allow-list sanitizer (e.g. marked + sanitize-html).
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

module.exports = function renderMarkdown(source) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      // Page already owns <h1>; shift note headings down by one level (## → h2 stays h2).
      const level = Math.max(2, heading[1].length);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++; continue;
    }

    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      out.push(
        '<div class="table-responsive"><table class="table"><thead><tr>' +
        head.map((c) => `<th scope="col">${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>'
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      out.push('<ul>' + items.map((t) => `<li>${inline(t)}</li>`).join('') + '</ul>');
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*[-*]\s+|\s*>|\s*\|)/.test(lines[i])) { para.push(lines[i].trim()); i++; }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
};
