'use strict';

const fs = require('fs');
const path = require('path');

// IMPORTANT: outside /public — this folder must never be served directly by Express
const RELEASES_DIR = path.join(__dirname, '..', 'storage', 'releases');
fs.mkdirSync(RELEASES_DIR, { recursive: true });

function saveReleaseArchive(buffer, releaseId, version, originalFilename) {
  const ext = originalFilename.toLowerCase().endsWith('.json') ? 'json' : 'zip';
  const filename = `${releaseId}-v${version}.${ext}`;
  const filePath = path.join(RELEASES_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath; // stored in content_releases.archive_path
}

module.exports = { saveReleaseArchive };