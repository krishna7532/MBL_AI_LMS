'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const constants = require('../config/constants');
const fmt = require('../services/format');
const icon = require('../services/icons');

const navbarPath = path.join(__dirname, '..', 'views', 'partials', 'navbar.ejs');

function renderNavbar(user) {
  return ejs.renderFile(navbarPath, {
    user,
    isAdminArea: false,
    unreadCount: 0,
    constants,
    fmt,
    icon,
  });
}

test('renders a sign-in link when no user is present', async () => {
  const html = await renderNavbar(null);

  assert.match(html, /href="\/login">Sign in<\/a>/);
  assert.doesNotMatch(html, /user-dropdown-toggle/);
});

test('renders the account menu for an authenticated user', async () => {
  const html = await renderNavbar({ name: 'Taylor User' });

  assert.match(html, /Account menu for Taylor User/);
  assert.match(html, /Taylor User/);
  assert.doesNotMatch(html, /href="\/login"/);
});
