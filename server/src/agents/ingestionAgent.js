const path = require("path");
const { BaseAgent, AgentResult } = require("./base");
const fileProcessor = require("../services/fileProcessor");
const vectorStore = require("../services/vectorStore");

/**
 * DEVIATION FROM ORIGINAL (flagged, not silent): the Python version stores
 * all chunks from all files in ONE vector_store.add_documents call, with
 * metadata that identifies the source only by a file_path STRING (no real
 * document id). This Mongo port's Chunk schema (Phase 2) requires a real
 * documentId ObjectId — a deliberate improvement for query scoping — so
 * this agent needs actual Document _ids, not just file paths. The route
 * calling this agent (below, in ingestion.routes.js) now passes
 * `documentIds` alongside `filePaths`/`docTypes` to make that possible.
 * Chunks are stored per-document here rather than batched across the whole
 * course in one call (Python batches all chunks' embeddings in a single
 * call for efficiency) — a minor efficiency tradeoff, not a correctness one;
 * worth revisiting if embedding latency becomes a real bottleneck.
 */
class IngestionAgent extends BaseAgent {
  constructor() {
    super("ingestion_agent", "Processes uploaded documents and extracts structured text");
  }

  async execute(context) {
    const courseId = context.courseId;
    const filePaths = context.get("file_paths", []);
    const docTypes = context.get("doc_types", []);
    const documentIds = context.get("document_ids", []);

    if (!filePaths.length) {
      return new AgentResult({ success: false, error: "No files provided" });
    }

    const processedDocs = [];
    let totalChunks = 0;

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const docType = docTypes[i] || "other";
      const documentId = documentIds[i] || null;

      try {
        const text = await fileProcessor.extractText(filePath);

        if (!text || text.trim().length < 10) {
          console.warn(`[ingestion_agent] empty_extraction file=${filePath}`);
          continue;
        }

        const cleanedText = this._cleanText(text);
        const chunks = fileProcessor.chunkText(cleanedText);

        const metadataList = chunks.map((_, j) => ({
          courseId,
          docType,
          filePath,
          chunkIndex: j,
          filename: path.basename(filePath),
        }));

        if (chunks.length) {
          await vectorStore.addDocuments(courseId, documentId, chunks, metadataList);
          totalChunks += chunks.length;
        }

        processedDocs.push({
          file_path: filePath,
          doc_type: docType,
          text_length: cleanedText.length,
          num_chunks: chunks.length,
          extracted_text: cleanedText,
        });
      } catch (e) {
        console.error(`[ingestion_agent] file_processing_error file=${filePath} error=${e.message}`);
        continue; // one bad file doesn't fail the whole batch — matches Python
      }
    }

    return new AgentResult({
      success: true,
      data: {
        processed_documents: processedDocs,
        total_chunks: totalChunks,
        course_id: courseId,
      },
      nextAgent: "knowledge_extraction_agent",
    });
  }

  /**
   * Ports _clean_text exactly, including the specific regex patterns for
   * excessive whitespace, null bytes, and other control characters.
   */
  _cleanText(text) {
    let cleaned = text.replace(/\n{3,}/g, "\n\n");
    cleaned = cleaned.replace(/ {2,}/g, " ");
    cleaned = cleaned.replace(/\x00/g, "");
    // eslint-disable-next-line no-control-regex
    cleaned = cleaned.replace(/[\x01-\x08\x0b\x0c\x0e-\x1f]/g, "");
    cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return cleaned.trim();
  }
}

module.exports = IngestionAgent;
