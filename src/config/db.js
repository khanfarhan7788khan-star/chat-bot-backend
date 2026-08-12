const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");

const DB_PATH = process.env.DB_PATH || "./data/chat.db";

// Ensure the directory for the database file exists
const dbDir = path.dirname(DB_PATH);
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

// sql.js is a synchronous, pure-WASM build of SQLite. It has no native
// compilation step (unlike better-sqlite3 / node-sqlite3), which makes
// setup painless across OSes and CI environments. The whole DB lives in
// memory and is flushed to disk after every write.
let SQL = null;
let db = null;
let ready = null;

function persist() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function init() {
  if (ready) return ready;
  ready = (async () => {
    SQL = await initSqlJs({
      // Resolve the wasm binary that ships inside the sql.js package
      locateFile: (file) => path.join(require.resolve("sql.js"), "..", file),
    });

    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    db.run(SCHEMA);
    persist();
  })();
  return ready;
}

/** Run an INSERT/UPDATE/DELETE statement and persist to disk. */
function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

/** Run a SELECT statement and return an array of row objects. */
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

module.exports = { init, run, all };
