const mongoose = require("mongoose");

/**
 * Connects to MongoDB using the URI from environment config.
 * Ports the role of app/database/session.py's init_db().
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/learningagent";

  mongoose.connection.on("connected", () => {
    console.log(`[db] connected -> ${uri}`);
  });

  mongoose.connection.on("error", (err) => {
    console.error("[db] connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] disconnected");
  });

  await mongoose.connect(uri, {
    // Mongoose 8 no longer needs useNewUrlParser/useUnifiedTopology,
    // kept here as an explicit note for interview purposes.
    serverSelectionTimeoutMS: 10000,
  });
}

module.exports = { connectDB };
