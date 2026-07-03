import "server-only";
import { z } from "zod";

const EMBEDDING_MODEL = "voyage-3.5";
const MAX_TEXT_LEN = 8000;
const MAX_BATCH = 128;
const TIMEOUT_MS = 10_000;
/** Voyage bez karty płatniczej: 3 RPM — min. odstęp między requestami. */
const MIN_REQUEST_INTERVAL_MS = 21_000;
const MAX_429_RETRIES = 3;

let warnedMissingKey = false;
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleVoyage(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

async function voyageFetch(
  key: string,
  body: Record<string, unknown>
): Promise<Response | null> {
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt += 1) {
    await throttleVoyage();

    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status !== 429 || attempt === MAX_429_RETRIES) {
      return res;
    }

    const retryAfter = res.headers.get("retry-after");
    const waitMs = retryAfter
      ? Math.max(Number(retryAfter) * 1000, MIN_REQUEST_INTERVAL_MS)
      : MIN_REQUEST_INTERVAL_MS * (attempt + 1);
    console.warn(`Voyage 429 — retry za ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }

  return null;
}

const responseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
    })
  ),
});

function trimTexts(texts: string[]): string[] {
  return texts.map((t) => t.slice(0, MAX_TEXT_LEN));
}

export async function embedDocuments(
  texts: string[]
): Promise<number[][] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    if (!warnedMissingKey) {
      console.warn(
        "VOYAGE_API_KEY brak — embeddingi wyłączone (degradacja, aplikacja działa normalnie)"
      );
      warnedMissingKey = true;
    }
    return null;
  }

  if (texts.length === 0) return [];
  const batch = trimTexts(texts.slice(0, MAX_BATCH));

  const res = await voyageFetch(key, {
    model: EMBEDDING_MODEL,
    input: batch,
    input_type: "document",
  });

  if (!res || !res.ok) {
    if (res) {
      console.error("Voyage embed error", res.status, await res.text());
    }
    return null;
  }

  const json: unknown = await res.json();
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    console.error("Voyage embed invalid response", parsed.error.flatten());
    return null;
  }

  const vectors = parsed.data.data.map((d) => d.embedding);
  for (const v of vectors) {
    if (v.length !== 1024) {
      console.error("Voyage embed wrong dimensions", v.length);
      return null;
    }
  }

  return vectors;
}

export async function embedQuery(text: string): Promise<number[] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    if (!warnedMissingKey) {
      console.warn(
        "VOYAGE_API_KEY brak — embeddingi wyłączone (degradacja, aplikacja działa normalnie)"
      );
      warnedMissingKey = true;
    }
    return null;
  }

  const res = await voyageFetch(key, {
    model: EMBEDDING_MODEL,
    input: [text.slice(0, MAX_TEXT_LEN)],
    input_type: "query",
  });

  if (!res || !res.ok) return null;

  const json: unknown = await res.json();
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) return null;

  const vec = parsed.data.data[0]?.embedding;
  if (!vec || vec.length !== 1024) return null;
  return vec;
}

export { EMBEDDING_MODEL };
