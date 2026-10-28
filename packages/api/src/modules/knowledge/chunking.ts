export type TextChunk = {
  position: number;
  content: string;
  token_estimate: number;
};

const MAX_CHUNK_CHARS = 900;
const CHUNK_OVERLAP_CHARS = 120;

export function normalizeDocumentText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function estimateTokens(input: string): number {
  const latinWords = input.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const cjkChars = input.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  return Math.max(1, latinWords + Math.ceil(cjkChars / 1.5));
}

function splitLongSegment(segment: string): string[] {
  if (segment.length <= MAX_CHUNK_CHARS) return [segment];

  const pieces: string[] = [];
  let cursor = 0;
  while (cursor < segment.length) {
    const end = Math.min(segment.length, cursor + MAX_CHUNK_CHARS);
    let cut = end;

    if (end < segment.length) {
      const window = segment.slice(Math.max(cursor + 200, end - 220), end);
      const boundary = Math.max(
        window.lastIndexOf("\n"),
        window.lastIndexOf("。"),
        window.lastIndexOf("！"),
        window.lastIndexOf("？"),
        window.lastIndexOf(". "),
        window.lastIndexOf("; "),
      );
      if (boundary > 0) {
        cut = Math.max(cursor + 200, end - window.length + boundary + 1);
      }
    }

    const piece = segment.slice(cursor, cut).trim();
    if (piece) pieces.push(piece);
    if (cut >= segment.length) break;
    cursor = Math.max(cursor + 1, cut - CHUNK_OVERLAP_CHARS);
  }
  return pieces;
}

export function chunkDocumentText(input: string): TextChunk[] {
  const text = normalizeDocumentText(input);
  if (!text) return [];

  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const units = paragraphs.flatMap((paragraph) => {
    if (paragraph.length <= MAX_CHUNK_CHARS) return [paragraph];
    return paragraph
      .split(/(?<=[。！？.!?])\s+|\n+/)
      .flatMap((sentence) => splitLongSegment(sentence.trim()))
      .filter(Boolean);
  });

  const chunks: string[] = [];
  let current = "";

  for (const unit of units) {
    if (!current) {
      current = unit;
      continue;
    }
    if (current.length + unit.length + 2 <= MAX_CHUNK_CHARS) {
      current += `\n\n${unit}`;
      continue;
    }

    chunks.push(current.trim());
    const overlap = current.slice(-CHUNK_OVERLAP_CHARS).trim();
    current = overlap ? `${overlap}\n\n${unit}` : unit;

    while (current.length > MAX_CHUNK_CHARS) {
      const [head, ...rest] = splitLongSegment(current);
      chunks.push(head);
      current = rest.join("\n\n");
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.map((content, position) => ({
    position,
    content,
    token_estimate: estimateTokens(content),
  }));
}
