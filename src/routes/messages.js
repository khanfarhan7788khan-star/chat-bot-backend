const express = require("express");
const router = express.Router();
const { getMessages, postMessage } = require("../controllers/messageController");

// GET /api/messages - fetch chat history
router.get("/", getMessages);

// POST /api/messages - send a new message
router.post("/", postMessage);

module.exports = router;
