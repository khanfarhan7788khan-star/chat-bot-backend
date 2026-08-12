// Centralized error handler - keeps API error responses consistent
// and prevents stack traces from leaking to clients.
function errorHandler(err, req, res, next) {
  console.error("[unhandled error]", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error.",
  });
}

// 404 handler for unknown routes
function notFound(req, res) {
  res.status(404).json({ success: false, error: "Route not found." });
}

module.exports = { errorHandler, notFound };
