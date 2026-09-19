const { Chunk } = require("../models");
const { embedText, embedTexts } = require("./embeddingService");

/**
 * INFRASTRUCTURE NOTE: MongoDB's $vectorSearch aggregation stage only works
 * on Atlas (or Atlas-equivalent local deployments with mongot), NOT on a
 * plain community `mongo:7` image — which is what docker-compose.dev.yml
 * runs. Rather than force an Atlas cloud dependency into the dev stack,
 * this implements the same brute-force cosine scan that FAISS's
 * IndexFlatIP already does (it's exact search, not ANN — so this is
 * actually equal-fidelity to the original, not a downgrade). This works
 * on any Mongo, local or Atlas, with zero extra index setup. If chunk
 * volume ever gets large enough that an in-memory scan is too slow,
 * swapping in Atlas $vectorSearch later is a contained change scoped to
 * just the `search()` function below.
 */

/**
 * Ports add_documents(course_id, texts, metadata, doc_ids).
 * The original's doc_ids-generation quirk (UUID(int=i) restarting from 0
 * on every call, silently colliding ids across calls when doc_ids isn't
 * passed) has no analog here — Mongo assigns a real unique _id per Chunk
 * document automatically, so that bug class doesn't carry over by design.
 */
async function addDocuments(courseId, documentId, texts, metadataList = null) {
  if (!texts.length) return [];

  const embeddings = await embedTexts(texts);
  const docs = texts.map((text, i) => ({
    documentId,
    courseId,
    text,
    embedding: embeddings[i],
    metadata: metadataList ? metadataList[i] : null,
    chunkIndex: i,
  }));

  return Chunk.insertMany(docs);
}

function cosineSim(a, b) {
  // Both vectors are already unit-normalized by embedText/embedTexts
  // (normalize: true), so dot product alone equals cosine similarity —
  // same shortcut the Python version relies on via FAISS IndexFlatIP.
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Ports search(course_id, query, top_k=5) -> [(text, score, metadata)].
 */
async function search(courseId, query, topK = 5) {
  const chunks = await Chunk.find({ courseId }).lean();
  if (!chunks.length) return [];

  const queryEmbedding = await embedText(query);

  const scored = chunks.map((c) => ({
    text: c.text,
    score: cosineSim(queryEmbedding, c.embedding),
    metadata: c.metadata,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.min(topK, scored.length));
}

/**
 * Ports delete_course_index(course_id).
 */
async function deleteCourseIndex(courseId) {
  await Chunk.deleteMany({ courseId });
}

/**
 * Removes the chunks of specific documents. Used before (re)processing so a
 * retry after a partly failed run doesn't leave duplicate chunks behind.
 */
async function deleteDocumentChunks(documentIds) {
  if (!documentIds.length) return;
  await Chunk.deleteMany({ documentId: { $in: documentIds } });
}

module.exports = { addDocuments, search, deleteCourseIndex, deleteDocumentChunks };
