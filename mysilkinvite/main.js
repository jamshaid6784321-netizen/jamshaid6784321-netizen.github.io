/* My Silk Invite — shared behaviour.
   No libraries. Canvas animations start only after load and only when visible.
   Everything degrades gracefully: the site works with JS off except animations. */
(function () {
  "use strict";

  /* ---------------- helpers ---------------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $all(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function read(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  /* ---------------- gentle audio (only after a tap) ---------------- */
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, dur, type, vol, when) {
    if (!ensureAudio()) return;
    var t = audioCtx.currentTime + (when || 0);
    var o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function chirp() { tone(2600, 0.09, "sine", 0.07, 0); tone(2100, 0.08, "sine", 0.05, 0.09); tone(2900, 0.07, "sine", 0.04, 0.18); }
  function chime() { tone(659.25, 0.4, "triangle", 0.1, 0); tone(783.99, 0.4, "triangle", 0.09, 0.12); tone(1046.5, 0.6, "triangle", 0.08, 0.24); }

  /* ---------------- currency / geo pricing ---------------- */
  var PRICES = {
    standard: { USD: 19, INR: 999, PKR: 1999 },
    premium: { USD: 29, INR: 1499, PKR: 4999 }
  };
  var CUR_NOTES = {
    USD: "Prices in US dollars — one-time payment, no subscription.",
    INR: "Prices in Indian rupees — one-time payment, no subscription.",
    PKR: "Prices in Pakistani rupees — one-time payment, no subscription."
  };
  function detectCurrency() {
    try {
      var tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "");
      if (/Asia\/(Kolkata|Calcutta)/.test(tz)) return "INR";
      if (/Asia\/Karachi/.test(tz)) return "PKR";
    } catch (e) { /* ignore */ }
    var lang = (navigator.language || "en").toLowerCase();
    if (lang.indexOf("en-in") === 0 || lang === "hi" || lang.indexOf("hi-") === 0) return "INR";
    if (lang.indexOf("en-pk") === 0 || lang === "ur" || lang.indexOf("ur-") === 0) return "PKR";
    return "USD";
  }
  function fmtPrice(cur, amount) {
    if (cur === "USD") return "$" + amount;
    if (cur === "INR") return "\u20B9" + amount.toLocaleString("en-IN");
    return "Rs " + amount.toLocaleString("en-US");
  }
  function applyCurrency(cur) {
    try { localStorage.setItem("msi-currency", cur); } catch (e) { /* ignore */ }
    $all("[data-plan]").forEach(function (el) {
      var p = PRICES[el.getAttribute("data-plan")];
      if (p) el.textContent = fmtPrice(cur, p[cur]);
    });
    $all("[data-cur]").forEach(function (b) {
      var active = b.getAttribute("data-cur") === cur;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", active ? "true" : "false");
    });
    $all("[data-cur-note]").forEach(function (el) { el.textContent = CUR_NOTES[cur]; });
  }
  var savedCur = null;
  try { savedCur = localStorage.getItem("msi-currency"); } catch (e) { /* ignore */ }
  applyCurrency(savedCur || detectCurrency());
  $all("[data-cur]").forEach(function (b) {
    b.addEventListener("click", function () { applyCurrency(b.getAttribute("data-cur")); });
  });

  /* ---------------- FAQ accordion ---------------- */
  $all(".faq-item").forEach(function (item) {
    var q = $(".faq-q", item);
    if (!q) return;
    q.setAttribute("aria-expanded", "false");
    q.addEventListener("click", function () {
      var open = item.classList.toggle("open");
      q.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* ---------------- countdown ---------------- */
  function bindCountdown(scope, iso) {
    var dEl = $(".cd-d", scope), hEl = $(".cd-h", scope),
        mEl = $(".cd-m", scope), sEl = $(".cd-s", scope);
    if (!dEl || !hEl || !mEl || !sEl) return null;
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function tick() {
      if (!iso) { dEl.textContent = "--"; hEl.textContent = "--"; mEl.textContent = "--"; sEl.textContent = "--"; return; }
      var diff = Math.max(0, new Date(iso).getTime() - Date.now());
      dEl.textContent = Math.floor(diff / 86400000);
      hEl.textContent = pad(Math.floor(diff / 3600000) % 24);
      mEl.textContent = pad(Math.floor(diff / 60000) % 60);
      sEl.textContent = pad(Math.floor(diff / 1000) % 60);
    }
    tick();
    return setInterval(tick, 1000);
  }

  /* ---------------- interactive sky: birds or butterflies ---------------- */
  var REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function Sky(canvas, mode) {
    var ctx = canvas.getContext("2d");
    var parent = canvas.parentElement;
    var W = 0, H = 0, DPR = 1, raf = null, running = false, started = false;
    var creatures = [], parts = [], motes = [];

    function rand(a, b) { return a + Math.random() * (b - a); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = parent.clientWidth; H = parent.clientHeight;
      if (!W || !H) return;
      canvas.width = W * DPR; canvas.height = H * DPR;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    /* ----- birds ----- */
    function makeBird(x, y, dir) {
      return {
        x: (x !== undefined) ? x : rand(0, W), y: (y !== undefined) ? y : rand(H * 0.08, H * 0.5),
        dir: dir || (Math.random() < 0.5 ? 1 : -1), size: rand(13, 26),
        base: rand(0.45, 0.95), phase: rand(0, Math.PI * 2), flap: rand(0.10, 0.16),
        gold: Math.random() < 0.22, startled: 0, vy: 0, _bx: 0
      };
    }
    function drawBird(b) {
      var s = b.size, flap = Math.sin(b.phase) * s * 0.5;
      ctx.save();
      ctx.translate(b.x, b.y); ctx.scale(b.dir, 1);
      ctx.strokeStyle = b.gold ? "#b98a1d" : "#3a2e28";
      ctx.fillStyle = b.gold ? "#b98a1d" : "#3a2e28";
      ctx.lineWidth = Math.max(2, s * 0.11); ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.quadraticCurveTo(-s * 0.45, -s * 0.55 - flap, 0, -s * 0.08);
      ctx.quadraticCurveTo(s * 0.45, -s * 0.55 - flap, s, 0);
      ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.16, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.14, 0); ctx.lineTo(-s * 0.42, s * 0.12); ctx.lineTo(-s * 0.14, s * 0.06);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    /* ----- butterflies ----- */
    var WING_COLORS = [
      ["#ffb347", "#ff8c42"], ["#c77dff", "#9d4edd"], ["#7bdff2", "#4cc9f0"],
      ["#ff8fab", "#fb6f92"], ["#ffe66d", "#f4d35e"], ["#95d5b2", "#52b788"]
    ];
    function makeFly(x, y, dir) {
      var c = pick(WING_COLORS);
      return {
        x: (x !== undefined) ? x : rand(0, W), y: (y !== undefined) ? y : rand(H * 0.1, H * 0.55),
        dir: dir || (Math.random() < 0.5 ? 1 : -1), size: rand(13, 22),
        base: rand(0.35, 0.7), phase: rand(0, Math.PI * 2), flap: rand(0.16, 0.24),
        c1: c[0], c2: c[1], startled: 0, vy: 0, _bx: 0, wob: rand(0, 6.28)
      };
    }
    function drawFly(f) {
      var s = f.size, flap = Math.sin(f.phase);
      var spread = s * (0.55 + Math.abs(flap) * 0.6), lift = -flap * s * 0.28;
      ctx.save();
      ctx.translate(f.x, f.y); ctx.scale(f.dir, 1);
      ctx.globalAlpha = 0.95; ctx.fillStyle = f.c1;
      ctx.beginPath(); ctx.ellipse(-spread * 0.45, lift, s * 0.52, s * 0.34, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(spread * 0.45, lift, s * 0.52, s * 0.34, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = f.c2;
      ctx.beginPath(); ctx.ellipse(-spread * 0.4, s * 0.28, s * 0.36, s * 0.24, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(spread * 0.4, s * 0.28, s * 0.36, s * 0.24, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2b2118";
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.1, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#2b2118"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2, -s * 0.4); ctx.quadraticCurveTo(-5, -s * 0.62, -7, -s * 0.66);
      ctx.moveTo(2, -s * 0.4); ctx.quadraticCurveTo(5, -s * 0.62, 7, -s * 0.66);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    /* ----- particles ----- */
    function burst(x, y, kind) {
      var n = (kind === "star") ? 14 : 10;
      var colors = (mode === "birds")
        ? ["#ffffff", "#ffd9e6", "#e8c87e", "#f6b8c8"]
        : ["#ffe9a8", "#ffffff", "#ffd700", "#ffb347", "#fff8d6"];
      for (var i = 0; i < n; i++) {
        parts.push({
          x: x, y: y, vx: rand(-1.8, 1.8), vy: rand(-2.6, -0.4),
          life: 1, decay: rand(0.012, 0.025), size: rand(2.5, 7),
          rot: rand(0, 6.28), vr: rand(-0.12, 0.12), kind: kind, color: pick(colors)
        });
      }
    }
    function drawHeart(x, y, s, color, alpha) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s / 10, s / 10);
      ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.bezierCurveTo(-6, -3, -3, -8, 0, -4);
      ctx.bezierCurveTo(3, -8, 6, -3, 0, 3);
      ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
    }
    function drawStar4(x, y, s, color, alpha) {
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s);
      ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s);
      ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
    }
    function seedMotes() {
      motes = [];
      var n = (mode === "birds") ? 12 : 16;
      for (var i = 0; i < n; i++) {
        if (mode === "birds") {
          motes.push({ x: rand(0, W), y: rand(0, H), s: rand(5, 9), vy: rand(0.35, 0.8), sway: rand(0, 6.28), rot: rand(0, 6.28), vr: rand(-0.02, 0.02), color: pick(["#ffffff", "#ffd9e6", "#f6b8c8", "#ffe9a8"]) });
        } else {
          motes.push({ x: rand(0, W), y: rand(0, H), s: rand(1.2, 2.6), vy: rand(0.18, 0.5), sway: rand(0, 6.28), tw: rand(0, 6.28), color: pick(["#ffe9a8", "#ffd700", "#fff8d6"]) });
        }
      }
    }
    function seed() {
      creatures = [];
      var n = W < 600 ? 5 : 8;
      for (var i = 0; i < n; i++) creatures.push(mode === "birds" ? makeBird() : makeFly());
      seedMotes();
    }
    function startle(c, tx, ty) {
      var dx = c.x - tx, dy = c.y - ty;
      var d = Math.max(20, Math.sqrt(dx * dx + dy * dy));
      c.dir = dx >= 0 ? 1 : -1;
      c.startled = 55;
      c.vy = -rand(1.2, 2.6);
      c._bx = (dx / d) * rand(3.2, 4.8);
      if (mode === "birds") { burst(c.x, c.y, "feather"); burst(c.x, c.y, "heart"); chirp(); }
      else { burst(c.x, c.y, "spark"); chime(); }
    }
    function updateCreatures() {
      for (var i = 0; i < creatures.length; i++) {
        var c = creatures[i];
        var speed = c.base * (c.startled > 0 ? 3.5 : 1);
        c.phase += c.startled > 0 ? c.flap * 2.7 : c.flap;
        if (c.wob !== undefined) c.wob += 0.02;
        if (c.startled > 0) {
          c.startled--;
          c.x += (c.dir * speed) + (c._bx || 0);
          c.y += c.vy; c.vy *= 0.96; c._bx *= 0.94;
        } else {
          c.x += c.dir * speed;
          c.y += (c.wob !== undefined) ? Math.sin(c.wob) * 0.4 : Math.sin(c.phase * 0.5) * 0.25;
        }
        var top = (mode === "birds") ? H * 0.08 : H * 0.1, bot = (mode === "birds") ? H * 0.5 : H * 0.55;
        if (c.dir > 0 && c.x > W + 40) { c.x = -40; c.y = rand(top, bot); }
        if (c.dir < 0 && c.x < -40) { c.x = W + 40; c.y = rand(top, bot); }
        if (c.y < 12) c.y = 12;
        if (mode === "birds") drawBird(c); else drawFly(c);
      }
    }
    function updateParts() {
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.life -= p.decay;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy;
        p.vy += (p.kind === "heart") ? -0.02 : 0.03;
        p.vx *= 0.985; p.rot += p.vr;
        if (p.kind === "heart") drawHeart(p.x, p.y, p.size * 1.6, "#e88aa5", Math.max(0, p.life));
        else if (p.kind === "star") drawStar4(p.x, p.y, p.size * 1.5, p.color, Math.max(0, p.life));
        else {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.5, p.size, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore(); ctx.globalAlpha = 1;
        }
      }
      for (var j = 0; j < motes.length; j++) {
        var m = motes[j];
        m.y += m.vy; m.sway += 0.013;
        m.x += Math.sin(m.sway) * 0.45;
        if (mode === "birds") {
          m.rot += m.vr;
          if (m.y > H + 12) { m.y = -12; m.x = rand(0, W); }
          ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot);
          ctx.fillStyle = m.color; ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.ellipse(0, 0, m.s * 0.55, m.s, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore(); ctx.globalAlpha = 1;
        } else {
          m.tw += 0.05;
          if (m.y > H + 8) { m.y = -8; m.x = rand(0, W); }
          ctx.save();
          ctx.globalAlpha = 0.35 + Math.abs(Math.sin(m.tw)) * 0.55;
          ctx.fillStyle = m.color;
          ctx.beginPath(); ctx.arc(m.x, m.y, m.s, 0, Math.PI * 2); ctx.fill();
          ctx.restore(); ctx.globalAlpha = 1;
        }
      }
    }
    function drawFrame() {
      if (!W || !H) resize();
      ctx.clearRect(0, 0, W, H);
      updateCreatures();
      updateParts();
    }
    function loop() {
      if (!running) return;
      drawFrame();
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (started) return;
      started = true;
      resize(); seed();
      if (REDUCED) { drawFrame(); return; } /* one calm frame, no motion */
      running = true;
      loop();
    }
    function onTap(e) {
      if (e.target.closest("button, input, select, textarea, a")) return;
      var r = canvas.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      var best = null, bestD = 70;
      for (var i = 0; i < creatures.length; i++) {
        var c = creatures[i];
        var d = Math.sqrt((c.x - x) * (c.x - x) + (c.y - y) * (c.y - y));
        if (d < bestD + c.size) { best = c; bestD = d; }
      }
      if (best) startle(best, x, y);
      else {
        if (mode === "birds") burst(x, y, "heart"); else burst(x, y, "star");
        if (creatures.length < 10) {
          var dir = x < W / 2 ? 1 : -1;
          var nb = (mode === "birds" ? makeBird : makeFly)(dir > 0 ? -30 : W + 30, Math.max(30, y), dir);
          nb.size = 19;
          creatures.push(nb);
        }
      }
    }
    parent.addEventListener("pointerdown", onTap);
    window.addEventListener("resize", function () { resize(); if (REDUCED) drawFrame(); });
    return {
      start: start,
      resize: function () { resize(); if (REDUCED) drawFrame(); },
      setMode: function (m) { mode = m; seed(); if (REDUCED) drawFrame(); }
    };
  }

  /* Lazy-start a sky when it scrolls near the viewport (never blocks first paint). */
  function lazySky(canvas, mode) {
    if (!canvas) return null;
    var sky = Sky(canvas, mode);
    function go() { sky.start(); }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { go(); io.disconnect(); } });
      }, { rootMargin: "200px" });
      io.observe(canvas);
    } else if (document.readyState === "complete") { go(); }
    else window.addEventListener("load", go);
    return sky;
  }

  /* ---------------- RSVP (saves in this browser) ---------------- */
  function wireRsvp(scope, storageKey) {
    if (!scope) return;
    var toggle = $(".rsvp-toggle", scope), box = $(".inv-rsvp", scope);
    var nameEl = $(".rsvp-name", scope), countEl = $(".rsvp-count", scope);
    var msgEl = $(".rsvp-msg", scope);
    if (!toggle || !box) return;
    on(toggle, "click", function () {
      box.classList.toggle("hidden");
      if (!box.classList.contains("hidden") && nameEl) nameEl.focus();
    });
    function answer(attending) {
      var name = (nameEl && nameEl.value.trim()) || "Guest";
      var count = countEl ? countEl.value : "1";
      var saved = read(storageKey, []);
      saved.push({ name: name, count: count, attending: attending, at: Date.now() });
      store(storageKey, saved);
      if (msgEl) {
        msgEl.textContent = attending
          ? "Thank you, " + name + "! " + count + " guest(s) noted — we can't wait to celebrate with you."
          : "Thank you, " + name + " — your blessings mean the world to us.";
      }
      if (attending) chime();
    }
    on($(".rsvp-yes", scope), "click", function () { answer(true); });
    on($(".rsvp-no", scope), "click", function () { answer(false); });
  }

  /* ---------------- Add to Calendar (.ics download) ---------------- */
  function downloadICS(opts) {
    function p(n) { return (n < 10 ? "0" : "") + n; }
    function dt(d) { return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "T" + p(d.getHours()) + p(d.getMinutes()) + "00"; }
    var start = new Date(opts.startISO);
    if (isNaN(start.getTime())) return;
    var end = new Date(start.getTime() + 4 * 3600 * 1000);
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//My Silk Invite//EN",
      "BEGIN:VEVENT", "UID:" + opts.uid,
      "DTSTAMP:20261124T000000Z",
      "DTSTART:" + dt(start), "DTEND:" + dt(end),
      "SUMMARY:" + opts.title,
      "LOCATION:" + (opts.location || "").replace(/,/g, "\\,"),
      "DESCRIPTION:" + (opts.description || ""),
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    var blob = new Blob([ics], { type: "text/calendar" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = opts.filename || "invitation.ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------------- hero + SEO demo cards ---------------- */
  var heroCard = $("#heroCard");
  if (heroCard) {
    lazySky($("#heroSky"), "birds");
    bindCountdown(heroCard, "2027-08-14T19:00:00-05:00");
    wireRsvp(heroCard, "msi-rsvp-sample");
    on($("#heroCal"), "click", function () {
      downloadICS({
        startISO: "2027-08-14T19:00:00-05:00", uid: "sara-omar-wedding@mysilkinvite.com",
        title: "Sara & Omar — Wedding", location: "The Rosewood Hall, Chicago",
        description: "Wedding celebration of Sara & Omar.", filename: "Sara-Omar-Wedding.ics"
      });
    });
  }
  var demoCard = $("#demoCard");
  if (demoCard) {
    lazySky($("#demoSky"), "birds");
    bindCountdown(demoCard, "2027-05-22T19:00:00-05:00");
    wireRsvp(demoCard, "msi-rsvp-demo");
    on($("#demoCal"), "click", function () {
      downloadICS({
        startISO: "2027-05-22T19:00:00-05:00", uid: "huda-rayan-wedding@mysilkinvite.com",
        title: "Huda & Rayan — Wedding", location: "The Palm Court, Houston",
        description: "Wedding celebration of Huda & Rayan.", filename: "Huda-Rayan-Wedding.ics"
      });
    });
  }

  /* ---------------- builder ---------------- */
  var builder = $("#builder");
  if (!builder) return;

  var EVENT_LINES = {
    "Wedding": "request the honour of your presence at the celebration of their wedding",
    "Nikah": "request the honour of your presence at the celebration of their Nikah",
    "Walima": "request the honour of your presence at the celebration of their Walima",
    "Birthday": "invite you to celebrate a birthday",
    "Party": "invite you to a party",
    "Baby Shower": "invite you to a baby shower",
    "Bridal Shower": "invite you to a bridal shower",
    "Engagement": "invite you to celebrate an engagement",
    "Anniversary": "invite you to celebrate an anniversary",
    "Graduation": "invite you to celebrate a graduation",
    "Housewarming": "invite you to a housewarming"
  };

  var params = new URLSearchParams(window.location.search || "");
  var state = read("msi-draft", null) || {
    template: "birds", name1: "", name2: "", event: "Wedding",
    date: "", time: "19:00", venue: "", host: "Together with their families"
  };
  if (params.get("template") === "royal" || params.get("template") === "birds") state.template = params.get("template");
  if (params.get("event") && EVENT_LINES[params.get("event")]) state.event = params.get("event");

  var pvCard = $("#pvCard"), pvSky = lazySky($("#pvSky"), state.template);
  var countTimer = null;

  function field(id) { return document.getElementById(id); }
  function fmtDateLong(isoDate) {
    if (!isoDate) return "";
    var d = new Date(isoDate + "T12:00:00");
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  function fmtTime12(t) {
    if (!t) return "";
    var parts = t.split(":");
    var h = parseInt(parts[0], 10), m = parts[1] || "00";
    var ap = h >= 12 ? "PM" : "AM";
    h = h % 12; if (h === 0) h = 12;
    return h + ":" + m + " " + ap;
  }
  function slugify() {
    var s = ((state.name1 || "") + "-" + (state.name2 || "")).toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || "my-invitation";
  }
  function updatePreview() {
    if (!pvCard) return;
    var names = (state.name1 || "").trim();
    if ((state.name2 || "").trim()) names += (names ? " & " : "") + state.name2.trim();
    $("#pvNames").innerHTML = names
      ? names.replace(/ & /g, ' <span class="amp">&amp;</span> ')
      : "Your Names";
    $("#pvHost").textContent = state.host || "Together with their families";
    $("#pvLine").textContent = EVENT_LINES[state.event] || EVENT_LINES["Wedding"];
    var dateTxt = fmtDateLong(state.date);
    var timeTxt = fmtTime12(state.time);
    $("#pvDate").textContent = dateTxt ? dateTxt : "Pick a date to see it here";
    $("#pvVenue").textContent = (timeTxt ? timeTxt + " · " : "") + (state.venue || "Your venue");
    var iso = state.date && state.time ? state.date + "T" + state.time + ":00" : "";
    if (countTimer) { clearInterval(countTimer); countTimer = null; }
    countTimer = bindCountdown(pvCard, iso);
    var theme = state.template === "royal" ? "theme-royal" : "theme-birds";
    pvCard.classList.remove("theme-birds", "theme-royal");
    pvCard.classList.add(theme);
    if (pvSky) pvSky.setMode(state.template);
    updateShare();
  }
  function drawQR() {
    var cv = $("#qrCanvas");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    var N = 25, cell = cv.width / N, s = slugify();
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    function bit(x, y) {
      var v = (h ^ (x * 2654435761) ^ (y * 40503)) >>> 0;
      return ((v >> ((x + y) % 24)) & 1) === 1;
    }
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#062a1a";
    function finder(fx, fy) {
      ctx.fillRect(fx * cell, fy * cell, 7 * cell, 7 * cell);
      ctx.fillStyle = "#ffffff"; ctx.fillRect((fx + 1) * cell, (fy + 1) * cell, 5 * cell, 5 * cell);
      ctx.fillStyle = "#062a1a"; ctx.fillRect((fx + 2) * cell, (fy + 2) * cell, 3 * cell, 3 * cell);
    }
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var inFinder = (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
        if (!inFinder && bit(x, y)) ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  }
  function updateShare() {
    var link = $("#shareLink");
    if (link) link.value = "https://mysilkinvite.com/invite/" + slugify();
    drawQR();
  }
  function saveDraft() { store("msi-draft", state); }

  /* steps */
  var currentStep = 1;
  function showStep(n) {
    currentStep = n;
    [1, 2, 3].forEach(function (i) {
      var panel = $("#bstepPanel" + i);
      if (panel) panel.classList.toggle("hidden", i !== n);
      var ind = $('.bstep[data-step="' + i + '"]');
      if (ind) {
        ind.classList.toggle("active", i === n);
        ind.classList.toggle("done", i < n);
        ind.setAttribute("aria-current", i === n ? "step" : "false");
      }
    });
    if (pvSky) pvSky.resize();
    if (n === 3) updateShare();
    var top = $("#builderTop");
    if (top) top.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  on($("#toStep2"), "click", function () { showStep(2); });
  on($("#backToStep1"), "click", function () { showStep(1); });
  on($("#toStep3"), "click", function () { showStep(3); });
  on($("#backToStep2"), "click", function () { showStep(2); });

  /* template pick */
  $all(".pick-card").forEach(function (card) {
    card.addEventListener("click", function () {
      state.template = card.getAttribute("data-template");
      $all(".pick-card").forEach(function (c) {
        var sel = c === card;
        c.classList.toggle("selected", sel);
        c.setAttribute("aria-pressed", sel ? "true" : "false");
      });
      saveDraft();
      updatePreview();
    });
  });

  /* form -> live preview as you type */
  function bindField(id, key) {
    var el = field(id);
    if (!el) return;
    el.value = state[key] || "";
    el.addEventListener("input", function () { state[key] = el.value; saveDraft(); updatePreview(); });
    el.addEventListener("change", function () { state[key] = el.value; saveDraft(); updatePreview(); });
  }
  bindField("fName1", "name1");
  bindField("fName2", "name2");
  bindField("fEvent", "event");
  bindField("fDate", "date");
  bindField("fTime", "time");
  bindField("fVenue", "venue");
  bindField("fHost", "host");

  /* preview RSVP + calendar */
  wireRsvp(pvCard, "msi-rsvp-" + slugify());
  on($("#pvCal"), "click", function () {
    if (!state.date) { alert("Please add your event date first."); return; }
    var names = ((state.name1 || "Your") + (state.name2 ? " & " + state.name2 : ""));
    downloadICS({
      startISO: state.date + "T" + (state.time || "19:00") + ":00",
      uid: slugify() + "@mysilkinvite.com",
      title: names + " — " + state.event,
      location: state.venue || "",
      description: state.event + " invitation by My Silk Invite.",
      filename: slugify() + ".ics"
    });
  });

  /* copy link */
  on($("#copyLink"), "click", function () {
    var link = $("#shareLink");
    var done = function () {
      var b = $("#copyLink");
      b.textContent = "Copied ✓";
      setTimeout(function () { b.textContent = "Copy link"; }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link.value).then(done, function () { link.select(); document.execCommand("copy"); done(); });
    } else {
      link.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      done();
    }
  });

  /* init */
  $all(".pick-card").forEach(function (c) {
    var sel = c.getAttribute("data-template") === state.template;
    c.classList.toggle("selected", sel);
    c.setAttribute("aria-pressed", sel ? "true" : "false");
  });
  updatePreview();
  showStep(1);
})();
