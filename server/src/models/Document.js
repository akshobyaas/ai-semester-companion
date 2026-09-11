const mongoose = require("mongoose");

const DocumentType = ["syllabus", "notes", "pyq", "other"];

const documentSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileType: {
      type: String, // pdf, docx, pptx, txt, image, etc.
      default: null,
    },
    docType: {
      type: String,
      enum: DocumentType,
      required: true,
    },
    extractedText: {
      type: String,
      default: null,
    },
    // "metadata" is a reserved-ish word on some Mongoose internals when used
    // as a top-level key on certain plugins, but is safe as a plain schema
    // field name here — kept identical to the Python field name intentionally.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    processed: {
      type: Boolean,
      default: false,
      index: true, // the /process route queries processed:false frequently
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // Python model has no updated_at for Document
);

module.exports = {
  Document: mongoose.model("Document", documentSchema),
  DocumentType,
};
