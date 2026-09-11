/**
 * IMPORTANT PROVENANCE NOTE (found during Phase 6, changes the original plan):
 * The README claims ChromaDB; the actual code uses FAISS + a LOCAL
 * sentence-transformers model ("all-MiniLM-L6-v2", 384-dim), not any
 * hosted embedding API. There is no OpenAI/Gemini embedding call anywhere
 * in the Python backend — embeddings are free, offline, and require no API key.
 *
 * The original Phase 6 plan assumed "MongoDB Atlas Vector Search" as the
 * index (still correct — see vectorStore.js) but was silent on how
 * embeddings get generated. Defaulting to an OpenAI embeddings call here
 * would silently change the app from free/offline to paid/API-key-required,
 * which is a real behavioral change, not a refactor. Instead, this uses
 * @xenova/transformers to run the SAME MODEL (all-MiniLM-L6-v2) locally in
 * Node via ONNX/WASM — same embedding space, same zero-cost property,
 * closest possible parity to the original.
 *
 * Tradeoff to know about: model weights (~90MB) download from Hugging
 * Face's CDN on first use and are cached locally after that. This sandbox's
 * network allowlist doesn't include huggingface.co, so the actual download
 * could NOT be tested here (same limitation as Docker/Mongo in earlier
 * phases) — only the calling code's logic was verified, with a stub
 * embedder standing in for the model. This will download fine on a normal
 * dev machine or in the Docker container once built, since compose doesn't
 * restrict egress the way this tool sandbox does.
 */

const MODEL_ID = "Xenova/all-MiniLM-L6-v2"; // Xenova's ONNX port of the exact model config.py names

let extractorPromise = null;

async function getExtractor() {
  if (!extractorPromise) {
    // Lazy singleton — mirrors the Python VectorStore.__init__ loading the
    // model once and reusing it (module-level `vector_store` instance).
    const { pipeline } = await import("@xenova/transformers");
    extractorPromise = pipeline("feature-extraction", MODEL_ID);
  }
  return extractorPromise;
}

/**
 * Ports embed_text(text) -> normalized embedding vector.
 */
async function embedText(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Ports embed_texts(texts) -> normalized embedding vectors, batch_size=32.
 * transformers.js pipelines accept an array directly and batch internally,
 * but we chunk manually to mirror the explicit batch_size=32 in the
 * Python call and keep memory bounded the same way.
 */
async function embedTexts(texts, batchSize = 32) {
  const extractor = await getExtractor();
  const results = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const outputs = await extractor(batch, { pooling: "mean", normalize: true });
    // outputs.dims = [batchLen, dim]; unpack each row into its own array
    const [batchLen, dim] = outputs.dims;
    for (let row = 0; row < batchLen; row++) {
      results.push(Array.from(outputs.data.slice(row * dim, (row + 1) * dim)));
    }
  }

  return results;
}

module.exports = { embedText, embedTexts, MODEL_ID };
