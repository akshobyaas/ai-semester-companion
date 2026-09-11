const mongoose = require("mongoose");

const UserRole = ["student", "admin"];

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
    },
    hashedPassword: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      minlength: 2,
      trim: true,
    },
    role: {
      type: String,
      enum: UserRole,
      default: "student",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true } // adds createdAt / updatedAt, mirrors created_at/updated_at
);

// Never leak the password hash if a doc is JSON-serialized directly
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.hashedPassword;
    return ret;
  },
});

module.exports = {
  User: mongoose.model("User", userSchema),
  UserRole,
};
