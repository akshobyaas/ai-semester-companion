const multer = require("multer");

// Memory storage (not disk storage) deliberately — the Python route reads
// the full file into memory first, checks size against settings.max_upload_size,
// THEN writes to disk with a per-file error message. Multer's disk storage
// would write before we get a chance to reject with that same message shape,
// so memory storage + manual write in the route matches the original flow.
const upload = multer({ storage: multer.memoryStorage() });

module.exports = { upload };
