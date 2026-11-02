'use strict';

const multer = require('multer');

// Multer memory storage configuration for accepting zip or json content release packages
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const isZip = file.originalname.toLowerCase().endsWith('.zip');
    const isJson = file.originalname.toLowerCase().endsWith('.json');
    if (!isZip && !isJson) {
      const error = new Error('Only .zip or .json release packages are accepted');
      error.code = 'UNSUPPORTED_UPLOAD_TYPE';
      return cb(error);
    }
    cb(null, true);
  },
});

module.exports = upload;
