/** Just enough Markdown for chat replies: headings, bullet lists, paragraphs and **bold**. */
import { Fragment } from "react";

export function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^\s*[-*]\s/.test(l))) {
      return (
        <ul key={i}>
          {lines.map((l, j) => (
            <li key={j}>
              <Inline text={l.replace(/^\s*[-*]\s/, "")} />
            </li>
          ))}
        </ul>
      );
    }
    if (/^#{1,4}\s/.test(block)) return <h3 key={i}><Inline text={block.replace(/^#+\s/, "")} /></h3>;
    return (
      <p key={i}>
        {lines.map((l, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            <Inline text={l} />
          </Fragment>
        ))}
      </p>
    );
  });
}

function Inline({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}
