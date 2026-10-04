// Small helpers used by many routes.

// Wraps an async route handler.
// If anything inside throws an error, we send it back as JSON instead of crashing the server.
const wrap = (handler) => (req, res) => {
  handler(req, res).catch((err) => {
    res.status(err.status || 400).json({ message: err.message || 'Something went wrong' });
  });
};

// Stops the current route and returns an error message to the user.
const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

module.exports = { wrap, fail };
