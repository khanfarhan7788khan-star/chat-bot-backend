require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const db = require("./src/config/db");
const messageRoutes = require("./src/routes/messages");
const registerSocketHandlers = require("./src/sockets");
const { errorHandler, notFound } = require("./src/middleware/errorHandler");

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  },
});

// Make io available to REST controllers (e.g. to broadcast on POST /messages)
app.set("io", io);

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/messages", messageRoutes);

app.use(notFound);
app.use(errorHandler);

registerSocketHandlers(io);

// The SQLite (sql.js/WASM) engine loads asynchronously, so we wait for it
// to be ready before accepting traffic.
db.init()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Chat server listening on port ${PORT}`);
      console.log(`   Allowed client origin(s): ${CLIENT_ORIGIN.join(", ")}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

// Fail loudly instead of silently on unhandled errors
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
