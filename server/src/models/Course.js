const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      minlength: 3,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Note: SQLAlchemy version cascades deletes to Document/Unit/Roadmap on Course delete.
// Mongo has no native cascade — this must be handled explicitly wherever course
// deletion is implemented (a pre-remove hook or an application-level transaction),
// flagged here so it isn't silently dropped when that route is ported.

module.exports = mongoose.model("Course", courseSchema);
