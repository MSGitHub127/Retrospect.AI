/**
 * backend/chunker.ts
 * Splits sanitized log text into overlapping chunks for embedding.
 * Mirrors backend/ingestion/chunker.py from the blueprint.
 *
 * Strategy:
 *  - Split on natural log-line boundaries first (newlines)
 *  - Accumulate lines until we approach chunkSize tokens
 *  - Slide forward by (chunkSize - overlap) tokens to create the next chunk
 *  - "Token" approximation: 1 token ≈ 4 characters (good enough for OpenAI models)
 */

const CHARS_PER_TOKEN = 4;

export interface ChunkResult {
  chunks: string[];
  totalTokens: number;
}

export function chunkLog(
  text: string,
  chunkSizeTokens = 512,
  overlapTokens = 64,
  maxChunks = 50,
): ChunkResult {
  const chunkSizeChars = chunkSizeTokens * CHARS_PER_TOKEN;   // ~2048
  const overlapChars   = overlapTokens   * CHARS_PER_TOKEN;   // ~256
  const stepChars      = chunkSizeChars  - overlapChars;

  if (text.length === 0) return { chunks: [], totalTokens: 0 };

  // Short texts fit in a single chunk
  if (text.length <= chunkSizeChars) {
    return {
      chunks: [text],
      totalTokens: Math.ceil(text.length / CHARS_PER_TOKEN),
    };
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length && chunks.length < maxChunks) {
    const rawEnd = start + chunkSizeChars;

    // Snap to the nearest newline so we don't cut mid-line
    let end = rawEnd;
    if (rawEnd < text.length) {
      const newlineIdx = text.lastIndexOf("\n", rawEnd);
      if (newlineIdx > start + overlapChars) {
        end = newlineIdx + 1; // include the \n
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);

    start += stepChars;
  }

  const totalTokens = Math.ceil(text.length / CHARS_PER_TOKEN);
  return { chunks, totalTokens };
}
