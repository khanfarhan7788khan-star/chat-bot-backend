const Message = require("../models/Message");

/**
 * GET /api/messages?room=general&limit=200
 * Fetch chat history for a room.
 */
function getMessages(req, res) {
  try {
    const room = req.query.room || "general";
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const messages = Message.getHistory(room, limit);
    return res.status(200).json({ success: true, data: messages });
  } catch (err) {
    console.error("[getMessages] error:", err.message);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch chat history." });
  }
}

/**
 * POST /api/messages
 * Body: { username, text, room? }
 * Persists a message via REST and broadcasts it over Socket.io.
 * (The primary send path for connected clients is the socket "send_message"
 * event; this REST endpoint exists so message creation also works over
 * plain HTTP, per the assignment's REST API requirement.)
 */
function postMessage(req, res) {
  try {
    const { username, text, room } = req.body;

    if (!username || !username.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "username is required." });
    }
    if (!text || !text.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "text is required." });
    }

    const message = Message.createMessage({
      username: username.trim(),
      text: text.trim(),
      room: room || "general",
    });

    // Broadcast to all connected clients in the room so REST-created
    // messages also show up live.
    const io = req.app.get("io");
    if (io) {
      io.to(message.room).emit("new_message", message);
    }

    return res.status(201).json({ success: true, data: message });
  } catch (err) {
    console.error("[postMessage] error:", err.message);
    return res
      .status(500)
      .json({ success: false, error: "Failed to send message." });
  }
}

module.exports = { getMessages, postMessage };
