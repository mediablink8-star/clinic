/**
 * Wraps an async route handler and forwards any unhandled errors to Express's
 * next(err) — preventing unhandled promise rejections from crashing the server.
 *
 * Usage:
 *   router.get('/route', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = fn => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
