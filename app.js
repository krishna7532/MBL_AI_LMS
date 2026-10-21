'use strict';

const path = require('path');
const express = require('express');

const config = require('./config');
const constants = require('./config/constants');
const format = require('./services/format');
const icon = require('./services/icons');
const mockContext = require('./middleware/mockContext');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const multer = require('multer');

const session=require('express-session');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
require('dotenv').config();

const systemQueries = require('./query/systemQueries');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

// Values available to every EJS template
app.locals.constants = constants;
app.locals.fmt = format;
app.locals.icon = icon;

//for express session
const sessionOption={
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}
app.use(session(sessionOption));

//for database connection
app.use(express.json());

//for multer use
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).render('admin/releases', { error: `Upload error: ${err.message}`, success: null });
  }
  next(err);
});
app.get("/api/test-db", async (req, res) => {
    try {
        const result = await systemQueries.getDatabaseTime();

        res.json({
            success: true,
            message: "PostgreSQL connected successfully",
            time: result.rows[0].now
        });
    } catch (error) {
        console.error("Database error:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed",
            error: error.message
        });
    }
});
//for passport autherization
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.isAuthenticated = !!(req.user && req.user.email);
  if (req.user) {
    res.locals.user = req.user;
  }
  next();
});

// Baseline security headers. Full CSP / CSRF / rate limiting are Stage 2 work.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: config.isProduction ? '1h' : 0 }));
app.use(express.urlencoded({ extended: false }));

app.use(mockContext);

app.use('/', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/learner'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
