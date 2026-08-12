const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");

// Vercel/serverless: use /tmp when DB_PATH isn't provided.
// NOTE: /tmp is NOT persistent storage on Vercel.
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join("/tmp", "chat.db");

const dbDir = path.dirname(DB_PATH);

// Create database directory if necessary
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    room TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'sent',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_room_created
  ON messages (room, created_at);
`;

let SQL = null;
let db = null;
let ready = null;

/**
 * Persist the in-memory SQLite database to disk.
 */
function persist() {
  if (!db) {
    return;
  }

  const data = db.export();

  fs.writeFileSync(
    DB_PATH,
    Buffer.from(data)
  );
}

/**
 * Initialize SQLite.
 */
async function init() {
  if (ready) {
    return ready;
  }

  ready = (async () => {
    try {
      // Explicitly point sql.js to the WASM file.
      const wasmPath = path.join(
        process.cwd(),
        "node_modules",
        "sql.js",
        "dist",
        "sql-wasm.wasm"
      );

      // Helpful error if Vercel didn't bundle the WASM file.
      if (!fs.existsSync(wasmPath)) {
        throw new Error(
          `sql-wasm.wasm was not found at: ${wasmPath}. ` +
          `Make sure sql.js is in dependencies and the WASM file is included in the Vercel deployment.`
        );
      }

      SQL = await initSqlJs({
        locateFile: () => wasmPath,
      });

      // Load existing database if available.
      if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);

        db = new SQL.Database(fileBuffer);
      } else {
        db = new SQL.Database();
      }

      // Create tables/indexes.
      db.run(SCHEMA);

      // Save initial database.
      persist();

      console.log(`SQLite database initialized: ${DB_PATH}`);
    } catch (error) {
      console.error("Failed to initialize database:", error);

      // Allow another initialization attempt if this one fails.
      ready = null;

      throw error;
    }
  })();

  return ready;
}

/**
 * Run INSERT / UPDATE / DELETE / other SQL statements.
 */
function run(sql, params = []) {
  if (!db) {
    throw new Error(
      "Database has not been initialized. Call init() first."
    );
  }

  db.run(sql, params);

  persist();
}

/**
 * Run SELECT query and return rows.
 */
function all(sql, params = []) {
  if (!db) {
    throw new Error(
      "Database has not been initialized. Call init() first."
    );
  }

  const stmt = db.prepare(sql);

  try {
    stmt.bind(params);

    const rows = [];

    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }

    return rows;
  } finally {
    stmt.free();
  }
}

module.exports = {
  init,
  run,
  all,
};