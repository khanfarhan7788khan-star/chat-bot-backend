const Message = require("../models/Message");

const DEFAULT_ROOM = "general";

// In-memory presence map: socket.id -> { username, room }
// (Fine for a single-instance demo app; a production deployment with
// multiple server instances would back this with Redis instead.)
const onlineUsers = new Map();

function getOnlineUsernames(room) {
  const names = new Set();
  for (const { username, room: userRoom } of onlineUsers.values()) {
    if (userRoom === room) names.add(username);
  }
  return Array.from(names);
}

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    /**
     * Client identifies itself right after connecting (dummy auth).
     * Joins a room and announces presence to everyone else in it.
     */
    socket.on("user_join", ({ username, room = DEFAULT_ROOM } = {}) => {
      try {
        if (!username || !username.trim()) return;

        socket.data.username = username.trim();
        socket.data.room = room;
        onlineUsers.set(socket.id, { username: socket.data.username, room });

        socket.join(room);

        // Tell everyone in the room who's online now
        io.to(room).emit("presence_update", {
          onlineUsers: getOnlineUsernames(room),
        });

        // Let the rest of the room know someone joined
        socket.to(room).emit("system_message", {
          text: `${socket.data.username} joined the chat`,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[socket:user_join] error:", err.message);
        socket.emit("error_event", { message: "Failed to join chat." });
      }
    });

    /**
     * Real-time message send (primary path). Persists to SQLite then
     * broadcasts to everyone in the room, including the sender (so all
     * clients render from a single source of truth).
     */
    socket.on("send_message", ({ text, room = DEFAULT_ROOM } = {}) => {
      try {
        const username = socket.data.username;
        if (!username) {
          return socket.emit("error_event", {
            message: "You must join before sending messages.",
          });
        }
        if (!text || !text.trim()) {
          return socket.emit("error_event", {
            message: "Message text cannot be empty.",
          });
        }

        const message = Message.createMessage({
          username,
          text: text.trim(),
          room,
        });

        io.to(room).emit("new_message", message);

        // Mark delivered once broadcast succeeds (best-effort demo status)
        Message.updateStatus(message.id, "delivered");
        io.to(room).emit("message_status", {
          id: message.id,
          status: "delivered",
        });
      } catch (err) {
        console.error("[socket:send_message] error:", err.message);
        socket.emit("error_event", { message: "Failed to send message." });
      }
    });

    /** Typing indicator */
    socket.on("typing", ({ room = DEFAULT_ROOM } = {}) => {
      if (!socket.data.username) return;
      socket.to(room).emit("typing", { username: socket.data.username });
    });

    socket.on("stop_typing", ({ room = DEFAULT_ROOM } = {}) => {
      if (!socket.data.username) return;
      socket.to(room).emit("stop_typing", { username: socket.data.username });
    });

    /** Read receipts: client tells server which message ids it has seen */
    socket.on("message_read", ({ id, room = DEFAULT_ROOM } = {}) => {
      if (!id) return;
      try {
        Message.updateStatus(id, "read");
        io.to(room).emit("message_status", { id, status: "read" });
      } catch (err) {
        console.error("[socket:message_read] error:", err.message);
      }
    });

    /** Graceful disconnect handling */
    socket.on("disconnect", (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
      const info = onlineUsers.get(socket.id);
      onlineUsers.delete(socket.id);

      if (info) {
        const { username, room } = info;
        io.to(room).emit("presence_update", {
          onlineUsers: getOnlineUsernames(room),
        });
        socket.to(room).emit("system_message", {
          text: `${username} left the chat`,
          created_at: new Date().toISOString(),
        });
      }
    });

    socket.on("error", (err) => {
      console.error(`[socket] error on ${socket.id}:`, err.message);
    });
  });
}

module.exports = registerSocketHandlers;
