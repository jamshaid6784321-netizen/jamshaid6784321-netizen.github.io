/* My Silk Invite — shared auth logic for signup.html, login.html and dashboard.html.
   Static-site preview: there is no backend yet, so accounts live in the
   browser (localStorage) and the OTP is shown on screen for testing.
   At launch this file talks to the real backend instead — see AUTH_API. */

/* Backend endpoint base (SymbolHost PHP). Leave empty for preview mode.
   At launch set this to the PHP auth folder, e.g.
   "https://mysilkinvite.com/api/auth" — it must expose:
   POST /send-otp   { email }            -> sends a 6-digit code by email
   POST /verify-otp { email, code }      -> { ok: true/false }
   POST /signup     { username, email, password } -> creates the account
   POST /login      { identifier, password }      -> returns a session
   Passwords are hashed server-side (bcrypt) — the browser never stores
   a real password. While AUTH_API is empty, PREVIEW mode runs instead. */
var AUTH_API = "";

(function () {
  "use strict";

  var PREVIEW = !AUTH_API;
  var USER_KEY = "msi-user";
  var INVITES_KEY = "msi-invites";
  var OTP_TTL_MS = 10 * 60 * 1000;      /* code valid for 10 minutes */
  var RESEND_COOLDOWN_MS = 60 * 1000;  /* 60 seconds between codes */
  var MAX_ATTEMPTS = 5;

  /* ---------- tiny helpers ---------- */
  function $(s) { return document.querySelector(s); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function read(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function setText(el, t) { if (el) el.textContent = t; }
  function show(el, yes) { if (el) { el.classList.toggle("hidden", !yes); el.hidden = !yes; } }
  function showMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = "form-msg " + (kind || "error");
    el.hidden = !text;
  }
  function fieldError(input, errEl, msg) {
    if (input) input.classList.toggle("invalid", !!msg);
    if (errEl) { errEl.textContent = msg || ""; errEl.hidden = !msg; }
    return !msg;
  }

  /* ---------- session ---------- */
  function getUser() { return read(USER_KEY, null); }
  function saveUser(u) { store(USER_KEY, u); }
  function clearUser() { try { localStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ } }
  function go(url) { window.location.href = url; }

  /* ---------- validation ---------- */
  function validUsername(v) {
    return /^[A-Za-z][A-Za-z0-9_-]{2,19}$/.test(v || "");
  }
  function validGmail(v) {
    return /^[A-Za-z0-9._%+-]+@gmail\.com$/i.test((v || "").trim());
  }
  function validPassword(v) { return (v || "").length >= 8; }

  /* Preview-only password check. This is a plain 32-bit hash — it only
     stops a casual look at localStorage, it is NOT real security.
     At launch the password is checked server-side (bcrypt) and the
     browser never stores any password or hash. */
  function hashPassword(pw) {
    var h = 0x811c9dc5;
    for (var i = 0; i < pw.length; i++) {
      h ^= pw.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return "fnv1a-" + h.toString(16);
  }

  /* ---------- OTP state machine ----------
     states: idle -> sent -> verified
     The code lives only in memory (never in localStorage). */
  var otp = { state: "idle", code: null, email: null, expiresAt: 0, resendAt: 0, attempts: 0, timer: null };
  function otpCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

  function sendOtp(email, onDone) {
    if (PREVIEW) {
      otp.code = otpCode();
      otp.state = "sent";
      otp.email = email;
      otp.expiresAt = Date.now() + OTP_TTL_MS;
      otp.resendAt = Date.now() + RESEND_COOLDOWN_MS;
      otp.attempts = 0;
      onDone(true, null);
      return;
    }
    /* Real backend (used only once AUTH_API is set at launch). */
    fetch(AUTH_API + "/send-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok) {
        otp.state = "sent"; otp.email = email;
        otp.expiresAt = Date.now() + OTP_TTL_MS;
        otp.resendAt = Date.now() + RESEND_COOLDOWN_MS;
        otp.attempts = 0;
        onDone(true, null);
      } else { onDone(false, (d && d.error) || "Could not send the code. Please try again."); }
    }).catch(function () { onDone(false, "Could not reach the server. Please try again later."); });
  }

  function verifyOtp(code) {
    if (otp.state !== "sent") return { ok: false, error: "Please request a code first." };
    if (Date.now() > otp.expiresAt) { otp.state = "idle"; return { ok: false, error: "This code has expired. Please request a new one." }; }
    if (otp.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many wrong attempts. Please request a new code." };
    if (PREVIEW) {
      if (code === otp.code) { otp.state = "verified"; return { ok: true }; }
      otp.attempts++;
      return { ok: false, error: "Wrong code. " + (MAX_ATTEMPTS - otp.attempts) + " attempt(s) left." };
    }
    return { ok: false, error: "Server verification is not connected yet." };
  }

  function startResendCooldown(btn) {
    if (!btn) return;
    if (otp.timer) clearInterval(otp.timer);
    var update = function () {
      var left = Math.ceil((otp.resendAt - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(otp.timer); otp.timer = null;
        btn.disabled = false; btn.textContent = "Resend OTP";
      } else {
        btn.disabled = true; btn.textContent = "Resend OTP (" + left + "s)";
      }
    };
    update();
    otp.timer = setInterval(update, 1000);
  }

  /* ---------- signup page ---------- */
  function initSignup() {
    if (getUser()) { go("dashboard.html"); return; }
    var form = $("#signupForm");
    if (!form) return;
    var step1 = $("#step1"), step2 = $("#step2");
    var fUser = $("#suUsername"), fEmail = $("#suEmail"),
        fPass = $("#suPassword"), fPass2 = $("#suConfirm"),
        fOtp = $("#suOtp");
    var pending = null; /* { username, email, passHash } — kept in memory until verified */

    function validateStep1() {
      var ok = true;
      var u = (fUser.value || "").trim();
      ok = fieldError(fUser, $("#errUsername"),
        !u ? "Please choose a username." :
        !validUsername(u) ? "Username must be 3–20 characters, start with a letter, and use only letters, numbers, _ or -." : "") && ok;
      var e = (fEmail.value || "").trim();
      ok = fieldError(fEmail, $("#errEmail"),
        !e ? "Please enter your Gmail address." :
        !validGmail(e) ? "Please enter a valid Gmail address (example@gmail.com)." : "") && ok;
      var p = fPass.value || "";
      ok = fieldError(fPass, $("#errPassword"),
        !p ? "Please choose a password." :
        !validPassword(p) ? "Password must be at least 8 characters." : "") && ok;
      ok = fieldError(fPass2, $("#errConfirm"),
        (fPass2.value || "") !== p ? "Passwords do not match." : "") && ok;
      return ok;
    }

    function showStep2(email) {
      setText($("#otpEmailDisplay"), email);
      show(step1, false); show(step2, true);
      showMsg($("#formMsg"), "", "");
      var box = $("#demoOtpBox");
      if (PREVIEW && otp.code) {
        setText($("#demoOtpCode"), otp.code);
        show(box, true);
        show($("#otpNotice"), true);
      } else {
        show(box, false);
        show($("#otpNotice"), false);
      }
      startResendCooldown($("#resendOtp"));
      if (fOtp) { fOtp.value = ""; fOtp.focus(); }
    }

    on(form, "submit", function (ev) {
      ev.preventDefault();
      if (!validateStep1()) return;
      var email = (fEmail.value || "").trim().toLowerCase();
      pending = {
        username: (fUser.value || "").trim(),
        email: email,
        passHash: hashPassword(fPass.value || "")
      };
      var btn = $("#sendOtpBtn");
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      sendOtp(email, function (sent, err) {
        if (btn) { btn.disabled = false; btn.textContent = "Send OTP"; }
        if (!sent) { showMsg($("#formMsg"), err || "Could not send the code. Please try again.", "error"); return; }
        showStep2(email);
      });
    });

    on($("#verifyOtpForm"), "submit", function (ev) {
      ev.preventDefault();
      var code = (fOtp.value || "").replace(/\D/g, "");
      if (code.length !== 6) { showMsg($("#otpMsg"), "Please enter the 6-digit code.", "error"); return; }
      var r = verifyOtp(code);
      if (!r.ok) { showMsg($("#otpMsg"), r.error, "error"); return; }
      if (!pending) { showMsg($("#otpMsg"), "Something went wrong — please start again.", "error"); return; }
      saveUser({ username: pending.username, email: pending.email, passHash: pending.passHash });
      go("dashboard.html");
    });

    on($("#resendOtp"), "click", function () {
      if (!pending) return;
      sendOtp(pending.email, function (sent, err) {
        if (!sent) { showMsg($("#otpMsg"), err || "Could not resend the code.", "error"); return; }
        if (PREVIEW) setText($("#demoOtpCode"), otp.code);
        showMsg($("#otpMsg"), "A new code was sent to " + pending.email + ".", "ok");
        startResendCooldown($("#resendOtp"));
      });
    });

    on($("#changeEmail"), "click", function () {
      otp.state = "idle"; otp.code = null; pending = null;
      if (otp.timer) { clearInterval(otp.timer); otp.timer = null; }
      show(step2, false); show(step1, true);
      if (fEmail) fEmail.focus();
    });
  }

  /* ---------- login page ---------- */
  function initLogin() {
    if (getUser()) { go("dashboard.html"); return; }
    var form = $("#loginForm");
    if (!form) return;
    var fId = $("#liIdentifier"), fPass = $("#liPassword");

    on(form, "submit", function (ev) {
      ev.preventDefault();
      var id = (fId.value || "").trim();
      var pw = fPass.value || "";
      if (!id || !pw) { showMsg($("#loginMsg"), "Please enter your username or Gmail and your password.", "error"); return; }
      var user = getUser();
      if (!user) {
        showMsg($("#loginMsg"), "No account found yet. Please sign up first.", "error");
        return;
      }
      var idMatch = id.toLowerCase() === String(user.username || "").toLowerCase() ||
                    id.toLowerCase() === String(user.email || "").toLowerCase();
      if (!idMatch) {
        showMsg($("#loginMsg"), "No account matches this username or Gmail.", "error");
        return;
      }
      if (user.passHash && user.passHash !== hashPassword(pw)) {
        showMsg($("#loginMsg"), "Incorrect password. Please try again.", "error");
        return;
      }
      go("dashboard.html");
    });

    on($("#forgotPassword"), "click", function (ev) {
      ev.preventDefault();
      showMsg($("#loginMsg"),
        "Password reset connects to the server at launch. For now, please use your signup details — or create a new account from the signup page.",
        "ok");
    });
  }

  /* ---------- dashboard page ---------- */
  function initDashboard() {
    var user = getUser();
    if (!user) { go("login.html"); return; }
    setText($("#dashName"), user.username || "");
    setText($("#dashGreeting"), "Welcome back, " + (user.username || "friend") + "!");
    setText($("#accUsername"), user.username || "");
    setText($("#accEmail"), user.email || "");

    var list = read(INVITES_KEY, []);
    if (!Array.isArray(list)) list = [];
    var listEl = $("#inviteList"), emptyEl = $("#inviteEmpty");
    if (list.length === 0) {
      show(listEl, false); show(emptyEl, true);
    } else {
      show(listEl, true); show(emptyEl, false);
      listEl.innerHTML = "";
      list.forEach(function (inv) {
        if (!inv || typeof inv !== "object") return;
        var li = document.createElement("li");
        li.className = "invite-item";
        var left = document.createElement("div");
        var title = document.createElement("div");
        title.className = "inv-title";
        title.textContent = inv.title || inv.template || "Untitled invitation";
        var meta = document.createElement("div");
        meta.className = "inv-meta";
        var bits = [];
        if (inv.template) bits.push(inv.template);
        if (inv.date) bits.push(inv.date);
        meta.textContent = bits.join("  •  ") || "Draft";
        left.appendChild(title); left.appendChild(meta);
        var link = document.createElement("a");
        link.className = "btn small ghost";
        if (inv.url) { link.href = inv.url; link.textContent = "Open invitation"; }
        else if (inv.template) { link.href = "builder.html?template=" + encodeURIComponent(inv.template); link.textContent = "Open in builder"; }
        else { link.href = "builder.html"; link.textContent = "Open in builder"; }
        li.appendChild(left); li.appendChild(link);
        listEl.appendChild(li);
      });
    }

    on($("#logoutBtn"), "click", function () { clearUser(); go("index.html"); });
    on($("#changePassword"), "click", function (ev) {
      ev.preventDefault();
      var n = $("#accNote");
      if (n) { n.textContent = "Changing your password connects to the server at launch."; n.hidden = false; }
    });
  }

  /* ---------- boot: run only the code for the page we are on ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    var page = (document.body && document.body.getAttribute("data-page")) || "";
    if (page === "signup") initSignup();
    else if (page === "login") initLogin();
    else if (page === "dashboard") initDashboard();
  });
})();
