const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join("/tmp", "chat.db");

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

let SQL = null;
let db = null;
let ready = null;

function persist() {
  if (!db) return;

  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function init() {
  if (ready) return ready;

  ready = (async () => {
    SQL = await initSqlJs({
      locateFile: (file) =>
        path.join(require.resolve("sql.js"), "..", file),
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

function run(sql, params = []) {
  if (!db) {
    throw new Error("Database has not been initialized. Call init() first.");
  }

  db.run(sql, params);
  persist();
}

function all(sql, params = []) {
  if (!db) {
    throw new Error("Database has not been initialized. Call init() first.");
  }

  const stmt = db.prepare(sql);
  stmt.bind(params);

  const rows = [];

  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }

  stmt.free();

  return rows;
}

module.exports = {
  init,
  run,
  all,
};