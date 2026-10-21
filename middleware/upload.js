'use strict';

const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const isZip = file.originalname.toLowerCase().endsWith('.zip');
    const isJson = file.originalname.toLowerCase().endsWith('.json');
    if (!isZip && !isJson) {
      return cb(new Error('Only .zip or .json release packages are accepted'));
    }
    cb(null, true);
  },
});

module.exports = upload;