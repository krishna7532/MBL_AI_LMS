'use strict';

const app = require('./app');
const config = require('./config');

app.listen(config.port, () => {
  console.log(`MBL-AI LMS (Stage 1 preview) listening on http://localhost:${config.port}`);
});
