'use strict';

const path = require('path');
const express = require('express');

const config = require('./config');
const constants = require('./config/constants');
const format = require('./services/format');
const icon = require('./services/icons');
const viewContext = require('./middleware/viewContext');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const session=require('express-session');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const paymentController = require('./controllers/paymentController');
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
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
    },
}
app.use(session(sessionOption));

// Razorpay signs the exact request bytes, so this endpoint must run before JSON parsing.
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json', limit: '256kb' }),
  paymentController.webhook
);

//for database connection
app.use(express.json({ limit: '256kb' }));

// Exposes a simple database connectivity check for operations.
app.get("/api/test-db", async (req, res) => {
    try {
        const result = await systemQueries.getDatabaseTime();

        res.json({
            success: true,
            message: "PostgreSQL connected successfully",
            time: result[0].now
        });
    } catch (error) {
        console.error("Database health check failed:", error);

        return res.status(503).json({
            success: false,
            message: "The service is temporarily unavailable. Please try again later."
        });
    }
});
//for passport autherization
app.use(passport.initialize());
app.use(passport.session());

// Makes the current authentication state available to templates.
app.use((req, res, next) => {
  res.locals.isAuthenticated = !!(req.user && req.user.email);
  if (req.user) {
    res.locals.user = req.user;
  }
  next();
});

// Baseline security headers. Full CSP / CSRF / rate limiting are Stage 2 work.
// Adds baseline browser security headers to every response.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: config.isProduction ? '1h' : 0 }));
app.use(express.urlencoded({ extended: false }));

app.use(viewContext);

app.use('/', require('./routes/auth'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api', require('./routes/examApi'));
app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/learner'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
