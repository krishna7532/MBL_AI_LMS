// ── Google button: explains that OAuth is not connected yet ─────────────
  var googleBtn = document.getElementById('googleSignIn');
  var status = document.getElementById('oauthStatus');
  if (googleBtn && status) {
    googleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      status.hidden = false;
      status.setAttribute('tabindex', '-1');
      status.focus();
    });
  }