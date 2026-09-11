const mongoose = require("mongoose");

/**
 * Chunk has no equivalent in the original SQLAlchemy models — the Python
 * version kept embeddings entirely inside ChromaDB, separate from Postgres.
 * Moving to MongoDB Atlas Vector Search means embeddings live in the same
 * database as everything else, so this collection is new to the MERN port.
 *
 * courseId is denormalized (duplicated from documentId's parent) purely so
 * retrieval queries can filter by course without an extra join/populate —
 * a deliberate Mongo-style tradeoff, not an oversight.
 */
const chunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    // Dimension depends on the embedding model chosen in Phase 6
    // (e.g. 1536 for text-embedding-3-small). Left unconstrained here;
    // the Atlas Vector Search index definition enforces dimensionality.
    embedding: {
      type: [Number],
      required: true,
      // Mongoose quirk: `required: true` on an array only checks it isn't
      // `undefined` — an omitted array auto-initializes to `[]`, which
      // satisfies "required" but is useless for vector search. This
      // validator closes that gap.
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "embedding must be a non-empty array",
      },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    chunkIndex: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model("Chunk", chunkSchema);
