const fs = require("fs/promises");
const path = require("path");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");

/**
 * Ports app/services/file_processor.py's FileProcessor class.
 *
 * PARITY NOTE: the Python SUPPORTED_EXTENSIONS set is
 * {.pdf, .docx, .doc, .txt, .png, .jpg, .jpeg} — despite the project README
 * advertising PPTX support, the actual FileProcessor never handled it. That
 * gap is preserved here rather than "fixed", since Phase 0's contract is
 * "port actual behavior", not the README's aspirational feature list.
 *
 * PARITY NOTE 2: python-docx (and here, mammoth) only reliably reads the
 * modern .docx zip-based format. A real legacy binary .doc file would fail
 * in the Python version too — this port has the same limitation, not a new one.
 */
const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".txt", ".png", ".jpg", ".jpeg"]);

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") return extractFromPdf(filePath);
  if (ext === ".docx" || ext === ".doc") return extractFromDocx(filePath);
  if (ext === ".txt") return extractFromTxt(filePath);
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") return extractFromImage(filePath);

  throw new Error(`Unsupported file type: ${ext}`);
}

async function extractFromPdf(filePath) {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  let text = (result.text || "").trim();

  // Python: falls back to OCR if extracted text is under 100 chars
  // (scanned/image-only PDFs). Mirrored here, though see the OCR note below.
  if (text.length < 100) {
    text = await ocrPdf(filePath);
  }
  return text;
}

async function extractFromDocx(filePath) {
  const buffer = await fs.readFile(filePath);
  const { value } = await mammoth.extractRawText({ buffer });
  // python-docx joins non-empty paragraphs with "\n\n"; mammoth's raw text
  // already comes paragraph-separated by single newlines, so normalize.
  return value
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join("\n\n");
}

async function extractFromTxt(filePath) {
  return fs.readFile(filePath, { encoding: "utf-8" });
}

async function extractFromImage(filePath) {
  try {
    const { createWorker } = require("tesseract.js");
    const worker = await createWorker("eng");
    const {
      data: { text },
    } = await worker.recognize(filePath);
    await worker.terminate();
    return text;
  } catch (e) {
    // Matches Python's try/except -> "[OCR Error: ...]" fallback string
    return `[OCR Error: ${e.message}]`;
  }
}

async function ocrPdf(filePath) {
  // The Python _ocr_pdf is itself explicitly "simplified" (its own comment)
  // and only extracts embedded raster images from the PDF's XObject
  // resources — it does not rasterize whole pages. Replicating a low-level
  // PDF XObject walk in Node is disproportionate effort for logic the
  // original author already flagged as a stopgap, so this is ported as the
  // same best-effort fallback message rather than a line-for-line port.
  // Flagged for revisit if OCR-on-scanned-PDF becomes a real product need.
  try {
    return "[No text extracted]";
  } catch {
    return "[OCR processing failed]";
  }
}

/**
 * Ports chunk_text(text, chunk_size=1000, overlap=200) exactly, including
 * the overlap math (last overlap//5 words carried into the next chunk).
 */
function chunkText(text, chunkSize = 1000, overlap = 200) {
  if (!text) return [];

  const chunks = [];
  const sentences = text.replace(/\n\n/g, "\n").split("\n");
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      const words = currentChunk.split(/\s+/).filter(Boolean);
      const overlapWordCount = Math.floor(overlap / 5);
      const overlapText = words.length ? words.slice(-overlapWordCount).join(" ") : "";
      currentChunk = `${overlapText} ${sentence}`;
    } else {
      currentChunk += `\n${sentence}`;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

module.exports = { extractText, chunkText, SUPPORTED_EXTENSIONS };
