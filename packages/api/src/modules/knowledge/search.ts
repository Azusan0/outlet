export type KnowledgeSearchResult = {
  document_id: string;
  chunk_id: string;
  title: string;
  snippet: string;
  score: number;
  position: number;
};

type ChunkRecord = {
  id: string;
  document_id: string;
  tenant_id: string;
  position: number;
  content: string;
};

type DocumentRecord = {
  id: string;
  title: string;
};

function tokenize(input: string): string[] {
  const normalized = input.toLocaleLowerCase();
  const tokens: string[] = [];
  const latin = normalized.match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
  tokens.push(...latin.filter((token) => token.length > 1));

  const hanSequences = normalized.match(/[\u3400-\u9fff]+/g) ?? [];
  for (const sequence of hanSequences) {
    if (sequence.length === 1) {
      tokens.push(sequence);
      continue;
    }
    for (let index = 0; index < sequence.length - 1; index += 1) {
      tokens.push(sequence.slice(index, index + 2));
    }
  }

  return tokens;
}

function termFrequency(tokens: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  return frequencies;
}

function makeSnippet(content: string, query: string): string {
  const normalizedContent = content.replace(/\s+/g, " ").trim();
  const queryTerms = [
    query.trim().toLocaleLowerCase(),
    ...tokenize(query).filter((token) => token.length > 1),
  ].filter(Boolean);

  let hit = -1;
  for (const term of queryTerms) {
    const index = normalizedContent.toLocaleLowerCase().indexOf(term);
    if (index >= 0 && (hit < 0 || index < hit)) hit = index;
  }

  if (hit < 0) return normalizedContent.slice(0, 320);
  const start = Math.max(0, hit - 110);
  const end = Math.min(normalizedContent.length, hit + 230);
  return `${start > 0 ? "..." : ""}${normalizedContent.slice(start, end)}${
    end < normalizedContent.length ? "..." : ""
  }`;
}

export function rankKnowledgeChunks(
  query: string,
  chunks: ChunkRecord[],
  documents: DocumentRecord[],
  limit = 5,
): KnowledgeSearchResult[] {
  const queryTokens = tokenize(query);
  if (!queryTokens.length || !chunks.length) return [];

  const titleById = new Map(
    documents.map((document) => [document.id, document.title]),
  );
  const tokenizedChunks = chunks.map((chunk) => ({
    chunk,
    tokens: tokenize(
      `${titleById.get(chunk.document_id) ?? ""}\n${chunk.content}`,
    ),
  }));
  const averageLength =
    tokenizedChunks.reduce((total, item) => total + item.tokens.length, 0) /
    tokenizedChunks.length;

  const documentFrequency = new Map<string, number>();
  for (const token of new Set(queryTokens)) {
    const frequency = tokenizedChunks.filter((item) =>
      item.tokens.includes(token),
    ).length;
    documentFrequency.set(token, frequency);
  }

  const k1 = 1.4;
  const b = 0.75;
  const scored = tokenizedChunks.map(({ chunk, tokens }) => {
    const frequencies = termFrequency(tokens);
    let score = 0;

    for (const token of new Set(queryTokens)) {
      const frequency = frequencies.get(token) ?? 0;
      if (!frequency) continue;
      const df = documentFrequency.get(token) ?? 0;
      const idf = Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5));
      const denominator =
        frequency +
        k1 * (1 - b + b * (tokens.length / Math.max(1, averageLength)));
      score += idf * ((frequency * (k1 + 1)) / denominator);
    }

    return { chunk, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(Math.max(limit, 1), 20))
    .map(({ chunk, score }) => ({
      document_id: chunk.document_id,
      chunk_id: chunk.id,
      title: titleById.get(chunk.document_id) ?? "Untitled document",
      snippet: makeSnippet(chunk.content, query),
      score: Number(score.toFixed(4)),
      position: chunk.position,
    }));
}
