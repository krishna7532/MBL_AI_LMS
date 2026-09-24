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

const session=require('express-session');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
require('dotenv').config();

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
//for passport autherization
app.use(passport.initialize());
app.use(passport.session());
app.use('/auth',authRoutes);
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
