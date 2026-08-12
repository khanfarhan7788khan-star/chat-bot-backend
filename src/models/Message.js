const { v4: uuidv4 } = require("uuid");
const db = require("../config/db");

/**
 * Persist a new chat message.
 * @param {{ username: string, text: string, room?: string }} data
 * @returns {object} the stored message record
 */
function createMessage({ username, text, room = "general" }) {
  const message = {
    id: uuidv4(),
    username,
    text,
    room,
    status: "sent",
    created_at: new Date().toISOString(),
  };

  db.run(
    `INSERT INTO messages (id, username, text, room, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [message.id, message.username, message.text, message.room, message.status, message.created_at]
  );

  return message;
}

/**
 * Fetch chat history for a room, oldest first.
 * @param {string} room
 * @param {number} limit
 */
function getHistory(room = "general", limit = 200) {
  return db.all(
    `SELECT id, username, text, room, status, created_at
     FROM messages
     WHERE room = ?
     ORDER BY created_at ASC
     LIMIT ?`,
    [room, limit]
  );
}

/**
 * Update the delivered/read status of a message.
 */
function updateStatus(id, status) {
  db.run(`UPDATE messages SET status = ? WHERE id = ?`, [status, id]);
}

module.exports = { createMessage, getHistory, updateStatus };
