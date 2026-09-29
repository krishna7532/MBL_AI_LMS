'use strict';

const app = require('./app');
const config = require('./config');

require("dotenv").config();
const PORT = process.env.PORT || 5000;

app.listen(config.port, () => {
  console.log(`MBL-AI LMS (Stage 1 preview) listening on http://localhost:${PORT}`);
});
