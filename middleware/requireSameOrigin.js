'use strict';

// Rejects state-changing requests whose browser origin does not match this server.
module.exports = function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  const host = req.get('host');
  if (!origin || !host) {
    return res.status(403).json({
      success: false,
      message: 'A same-origin browser request is required.',
    });
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return res.status(403).json({
      success: false,
      message: 'The request origin is invalid.',
    });
  }

  if (parsedOrigin.host !== host || parsedOrigin.protocol !== `${req.protocol}:`) {
    return res.status(403).json({
      success: false,
      message: 'Cross-origin exam requests are not allowed.',
    });
  }

  return next();
};
