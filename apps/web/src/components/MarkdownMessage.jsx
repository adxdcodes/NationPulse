function renderInline(text) {
  const pattern = /(\*\*[^*]+?\*\*|__[^_]+?__|~~[^~]+?~~|`[^`\n]+`|(?<!\*)\*(?!\s)[^*\n]+?\*(?!\*)|(?<!_)_(?!\s)[^_\n]+?_(?!_)|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  const parts = [];
  let cursor = 0;
  let key = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(text.slice(cursor, index));
    const token = match[0];
    let node = token;
    if (token.startsWith("**") || token.startsWith("__")) node = <strong key={key++}>{token.slice(2, -2)}</strong>;
    else if (token.startsWith("~~")) node = <del key={key++}>{token.slice(2, -2)}</del>;
    else if (token.startsWith("`")) node = <code key={key++}>{token.slice(1, -1)}</code>;
    else if (token.startsWith("*") || token.startsWith("_")) node = <em key={key++}>{token.slice(1, -1)}</em>;
    else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (link) node = <a key={key++} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    }
    parts.push(node);
    cursor = index + token.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function isBlockStart(line) {
  return /^\s*(?:#{1,6}\s|```|>\s?|[-*+]\s+|\d+[.)]\s+|(?:\*\s*){3,}$)/.test(line);
}

function tableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
}

export default function MarkdownMessage({ text }) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    if (/^\s*```/.test(line)) {
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i += 1;
      blocks.push(<pre key={`code-${i}`}><code>{code.join("\n")}</code></pre>);
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      const Heading = `h${Math.min(heading[1].length + 1, 6)}`;
      blocks.push(<Heading key={`heading-${i}`}>{renderInline(heading[2])}</Heading>);
      i += 1;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1])) {
      const headers = tableCells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) rows.push(tableCells(lines[i++]));
      blocks.push(
        <div className="np-chat-table-wrap" key={`table-${i}`}>
          <table><thead><tr>{headers.map((cell, index) => <th key={index}>{renderInline(cell)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, index) => <td key={index}>{renderInline(row[index] || "")}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^\s*(?:---+|\*\s*){3,}$/.test(line)) {
      blocks.push(<hr key={`rule-${i}`} />);
      i += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(<blockquote key={`quote-${i}`}>{quote.map((part, index) => <p key={index}>{renderInline(part)}</p>)}</blockquote>);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items = [];
      while (i < lines.length) {
        const item = lines[i].match(isOrdered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/);
        if (!item) break;
        items.push(item[1]);
        i += 1;
      }
      const List = isOrdered ? "ol" : "ul";
      blocks.push(<List key={`list-${i}`}>{items.map((item, index) => <li key={index}>{renderInline(item)}</li>)}</List>);
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && (paragraph.length === 0 || !isBlockStart(lines[i]))) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    if (paragraph.length) blocks.push(<p key={`paragraph-${i}`}>{renderInline(paragraph.join(" "))}</p>);
  }

  return <div className="np-chat-markdown">{blocks}</div>;
}
