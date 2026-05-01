function sendError(req, res, status, code, message) {
  return res.status(status).json({
    error: {
      code,
      message,
      request_id: req.requestId
    }
  });
}

module.exports = { sendError };