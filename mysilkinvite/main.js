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
    basic: { USD: 5, INR: 200, PKR: 500 },
    standard: { USD: 10, INR: 400, PKR: 1000 },
    premium: { USD: 15, INR: 600, PKR: 1500 }
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
  /* IP-based geo detection: the visitor's country comes from their IP
     address, so an Indian visitor sees only rupees, a US visitor sees only
     dollars and a Pakistani visitor sees only rupees (Rs). No currency
     switcher is shown — each visitor sees exactly one price, their own.
     Runs after first paint so the page never waits for it. Free HTTPS
     lookup (ipwho.is, no key). If the lookup fails or is blocked, the
     timezone/language guess above stays in place. Nothing is saved, so
     every visit detects fresh from the visitor's current IP. */
  function detectCurrencyByIP() {
    if (typeof fetch !== "function") return;
    var ctrl = null;
    try {
      ctrl = new AbortController();
      setTimeout(function () { try { ctrl.abort(); } catch (e) { /* ignore */ } }, 3000);
    } catch (e) { ctrl = null; }
    fetch("https://ipwho.is/", ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.country_code) return;
        var cc = String(d.country_code).toUpperCase();
        if (cc === "IN") applyCurrency("INR");
        else if (cc === "PK") applyCurrency("PKR");
        else if (cc === "US") applyCurrency("USD");
        /* any other country keeps the timezone/language guess (default USD) */
      })
      .catch(function () { /* offline / blocked — keep timezone guess */ });
  }
  function fmtPrice(cur, amount) {
    if (cur === "USD") return "$" + amount;
    if (cur === "INR") return "\u20B9" + amount.toLocaleString("en-IN");
    return "Rs " + amount.toLocaleString("en-US");
  }
  /* The visitor's own detected currency — the assistant reads this so
     pricing answers quote ONLY this currency, never other countries'. */
  var currentCurrency = "USD";
  function applyCurrency(cur) {
    currentCurrency = cur;
    $all("[data-plan]").forEach(function (el) {
      var p = PRICES[el.getAttribute("data-plan")];
      if (p) el.textContent = fmtPrice(cur, p[cur]);
    });
    $all("[data-cur-note]").forEach(function (el) { el.textContent = CUR_NOTES[cur]; });
    $all("[data-faq-price]").forEach(function (el) {
      el.textContent = fmtPrice(cur, PRICES.basic[cur]) + "\u2013" + fmtPrice(cur, PRICES.premium[cur]);
    });
  }
  applyCurrency(detectCurrency());
  detectCurrencyByIP();

  /* ---------------- Silk Assistant (rule-based chatbox) ----------------
     No AI API, no keys, no external requests. Answers come from the small
     built-in knowledge base below (keyword matching). Pricing answers
     quote ONLY the visitor's own detected currency (currentCurrency) —
     other countries' prices are never listed. Answers in English and in
     Roman Urdu: if the visitor writes Roman Urdu, the reply is Roman
     Urdu too. Runs only on pages that have the chat markup (homepage). */
  var chatFab = $("#chatFab"), chatPanel = $("#chatPanel"), chatLog = $("#chatLog"),
      chatForm = $("#chatForm"), chatInput = $("#chatInput"), chatClose = $("#chatClose");
  if (chatFab && chatPanel && chatLog) {
    var greeted = false;
    function chatScroll() { chatLog.scrollTop = chatLog.scrollHeight; }
    function addMsg(text, who, action) {
      var d = document.createElement("div");
      d.className = "chat-msg " + who;
      d.textContent = text; /* textContent, never innerHTML: user input stays inert */
      chatLog.appendChild(d);
      if (action) {
        var a = document.createElement("a");
        a.className = "btn gold chat-action";
        a.href = action.href;
        a.textContent = action.label;
        if (action.href.charAt(0) === "#") { on(a, "click", function () { closeChat(); }); }
        chatLog.appendChild(a);
      }
      chatScroll();
    }
    function priceAnswer() {
      var cur = currentCurrency;
      return "For you, Basic is " + fmtPrice(cur, PRICES.basic[cur]) +
        ", Standard is " + fmtPrice(cur, PRICES.standard[cur]) +
        " and Premium is " + fmtPrice(cur, PRICES.premium[cur]) +
        " — a one-time payment, no subscription. The builder is free to try right now; payments open at launch.";
    }
    function priceAnswerRU() {
      var cur = currentCurrency;
      return "Aap ke liye Basic " + fmtPrice(cur, PRICES.basic[cur]) +
        ", Standard " + fmtPrice(cur, PRICES.standard[cur]) +
        " aur Premium " + fmtPrice(cur, PRICES.premium[cur]) +
        " hai — ek dafa ki payment, koi subscription nahi. Abhi builder free try kar sakte hain; payment launch par khulegi.";
    }
    /* Event detection: birthday, anniversary, engagement, baby shower,
       graduation, housewarming, mehndi, nikah, walima, wedding, party. */
    function eventName(s) {
      if (/\bbirthday\b/.test(s)) return "Birthday";
      if (/\banniversary\b/.test(s)) return "Anniversary";
      if (/\bengagement\b/.test(s)) return "Engagement";
      if (/baby\s*shower/.test(s)) return "Baby shower";
      if (/\bgraduation\b/.test(s)) return "Graduation";
      if (/housewarming/.test(s)) return "Housewarming";
      if (/\bmehndi\b/.test(s)) return "Mehndi";
      if (/\bnikah\b/.test(s)) return "Nikah";
      if (/\bwalima\b/.test(s)) return "Walima";
      if (/\bshaadi\b|\bshadi\b|\bwedding\b/.test(s)) return "Wedding";
      if (/\bparty\b/.test(s)) return "Party";
      return null;
    }
    function assistantReply(q) {
      var s = (q || "").toLowerCase();
      /* Roman Urdu: if the visitor writes Roman Urdu, answer in Roman Urdu. */
      var ru = /\b(aoa|salam|assalam|salaam|keemat|qeemat|kitn\w+|paisa\w+|kaise|kaisay|bna\w*|kr\w*|tareeq\w+|tarika|shadi|shaadi|mehman\w+|kab|chahiye|chahye|mujhe|mer\w+|aap|apn\w+|kya|hai|ha|hain|bata\w+|btao|wala|walay|wali|nahi|nahin|aur|bhi|mein|liye|lye|lya|din|\bmil\w+)\b/.test(s);
      if (ru) {
        if (/\b(aoa|salam|assalam|salaam)\b/.test(s)) {
          return { text: "Salam! Main Silk Assistant hoon. Main invitation banane, templates, pricing aur RSVP mein madad kar sakti hoon. Aap kya banana chahte hain?" };
        }
        if (/deliver\w*|shipping|\bdin\b|\bmil\w+|pahunche|pohnche|kab (milega|aayega|aega)|der lag/.test(s)) {
          return { text: "Koi physical delivery nahi hai — ye digital invitation hai. Card banate hi link aur QR code mil jata hai, foran mehmanon ko share kar sakte hain." };
        }
        if (/payment|\bpay\b|card se|jazzcash|easypaisa|bank|transfer/.test(s)) {
          return { text: "Payment launch par khulegi — card se pay kar sakenge. Abhi builder free try kar sakte hain, invitation pehle bana lein, payment launch par hogi." };
        }
        if (/\bfree\b|muft|bina pais\w*/.test(s)) {
          return { text: "Haan — builder abhi free try kar sakte hain, aur Free Preview $0 hai. Basic, Standard aur Premium paid plans hain jo launch par khulenge." };
        }
        if (/discount|offer|promo|coupon|\bsale\b|sasta/.test(s)) {
          return { text: "Abhi koi discount nahi chal raha — price Basic " + fmtPrice(currentCurrency, PRICES.basic[currentCurrency]) + ", Standard " + fmtPrice(currentCurrency, PRICES.standard[currentCurrency]) + " aur Premium " + fmtPrice(currentCurrency, PRICES.premium[currentCurrency]) + " hai, ek dafa ki payment." };
        }
        var ev = eventName(s);
        if (ev) {
          return { text: "Bilkul! " + ev + " ke liye invitation yahan bana sakte hain — template chunein, naam, tareekh aur venue likhein, phir link aur QR code share karein. Sirf kuch minute lagte hain. Golden Birds aur Royal Night templates kisi bhi celebration ke liye hain.", action: { label: "Open the builder", href: "builder.html" } };
        }
        if (/keemat|qeemat|kitn\w+|paisa\w+|\bprice\b|\bcost\b|rate|kharcha/.test(s)) {
          return { text: priceAnswerRU() };
        }
        if (/kaise|kaisay|bna\w*|tareeq\w+|tarika|shuru/.test(s)) {
          return { text: "3 steps hain: 1) template chunein, 2) apne naam, tareekh, waqt aur venue likhein, 3) link aur QR code share karein. Sirf kuch minute lagte hain — try karne ke liye sign-up bhi nahi chahiye.", action: { label: "Open the builder", href: "builder.html" } };
        }
        if (/template|design|shadi|shaadi|nikah|walima|mehndi|bird|lantern|butterfl|\bcard\b/.test(s)) {
          return { text: "Hamare paas 2 live templates hain: Golden Birds — parinde par tap karein toh woh ur jata hai; aur Royal Night — roshan lanterns aur titliyan. 4 aur jald aa rahe hain: Blush Garden, Emerald Palace, Sunset Mehndi aur Golden Hour.", action: { label: "See templates", href: "#templates" } };
        }
        if (/rsvp|mehman\w+|countdown|calendar|qr|guest|includ|feature/.test(s)) {
          return { text: "Har invitation mein RSVP (mehmanon ki ginti ke saath), live countdown, Add to Calendar, paper card ke liye QR code aur har mehman ke liye alag link shamil hai. Ek wedding invitation mein Nikah aur Walima dono ek page par ho sakte hain." };
        }
        if (/launch|kab|tayyar|jald|available/.test(s)) {
          return { text: "Hum launch ki tayyari kar rahe hain. Abhi builder apne naamon ke saath free try kar sakte hain, aur pricing jald aa rahi hai — ek dafa ki payment, koi subscription nahi. Card payment baad mein aayegi." };
        }
        return { text: "Main invitations, pricing, templates, RSVP, delivery aur payment mein madad kar sakti hoon — aap kya banana chahte hain?", action: { label: "Start in the builder", href: "builder.html" } };
      }
      if (/\b(hi|hello|hey|salam|assalam)\b/.test(s)) {
        return { text: "Hi! I'm Silk Assistant. I can help with creating an invitation, templates, pricing and RSVP. What would you like to make?" };
      }
      if (/deliver\w*|shipping/.test(s)) {
        return { text: "There's no physical delivery — it's a digital invitation. As soon as you create it, you get a link and a QR code to share instantly with your guests." };
      }
      if (/payment|\bpay\b|jazzcash|easypaisa/.test(s)) {
        return { text: "Payments open at launch — you'll be able to pay by card. Right now the builder is free to try, so you can make your invitation first and pay when we launch." };
      }
      if (/\bfree\b|muft/.test(s)) {
        return { text: "Yes — the builder is free to try right now, and Free Preview costs $0. Basic, Standard and Premium are paid plans that open at launch." };
      }
      if (/discount|offer|promo|coupon|\bsale\b/.test(s)) {
        return { text: "No discount is running right now — Basic is " + fmtPrice(currentCurrency, PRICES.basic[currentCurrency]) + ", Standard is " + fmtPrice(currentCurrency, PRICES.standard[currentCurrency]) + " and Premium is " + fmtPrice(currentCurrency, PRICES.premium[currentCurrency]) + ", a one-time payment." };
      }
      var evEn = eventName(s);
      if (evEn) {
        return { text: "Yes — you can make a " + evEn + " invitation here! Pick a template, add your names, date and venue, then share the link and QR code. It takes just a few minutes. Golden Birds and Royal Night are live now and work for any celebration.", action: { label: "Open the builder", href: "builder.html" } };
      }
      if (/price|cost|much|charge|\bfee\b|\bplan\b|pay|buy/.test(s)) {
        return { text: priceAnswer() };
      }
      if (/\bhow\b|creat\w*|mak(e|ing)|made|start|build|begin|\bsteps?\b/.test(s)) {
        return { text: "It's 3 steps: 1) pick a template, 2) add your names, date, time and venue, 3) share your link and QR code. It takes just a few minutes — no sign-up needed to try.", action: { label: "Open the builder", href: "builder.html" } };
      }
      if (/template|design|theme|bird|lantern|butterfl|\bcard\b/.test(s)) {
        return { text: "We have two live templates: Golden Birds — tap a bird and it flies away with a chirp; and Royal Night — glowing lanterns and butterflies. Four more are coming soon: Blush Garden, Emerald Palace, Sunset Mehndi and Golden Hour.", action: { label: "See templates", href: "#templates" } };
      }
      if (/rsvp|countdown|calendar|qr|guest|nikah|walima|includ|feature/.test(s)) {
        return { text: "Every invitation includes RSVP with guest count, a live countdown, Add to Calendar, a QR code for your paper card, and per-guest links. A wedding invitation can carry Nikah and Walima on one page." };
      }
      if (/launch|when|soon|available|\bready\b/.test(s)) {
        return { text: "We're preparing for launch. Right now the builder is free to try with your own names, and pricing is coming soon — a one-time payment, no subscription. Card payments will be added later." };
      }
      return { text: "I can help with invitations, pricing, templates, RSVP, delivery and payments — what would you like to make?", action: { label: "Start in the builder", href: "builder.html" } };
    }
    function ask(q) {
      var text = (q || "").trim();
      if (!text) return;
      addMsg(text, "user");
      if (chatInput) chatInput.value = "";
      var typing = document.createElement("div");
      typing.className = "chat-msg bot typing";
      typing.textContent = "Silk Assistant is typing…";
      chatLog.appendChild(typing);
      chatScroll();
      setTimeout(function () {
        if (typing.parentNode) typing.parentNode.removeChild(typing);
        var r = assistantReply(text);
        addMsg(r.text, "bot", r.action);
      }, 650);
    }
    function openChat() {
      chatPanel.classList.remove("hidden");
      chatPanel.setAttribute("aria-hidden", "false");
      chatFab.setAttribute("aria-expanded", "true");
      if (!greeted) {
        greeted = true;
        addMsg("Hi! I'm Silk Assistant. Ask me about creating an invitation, templates, pricing or RSVP — or tap a suggestion below.", "bot");
      }
      if (chatInput) chatInput.focus();
    }
    function closeChat() {
      chatPanel.classList.add("hidden");
      chatPanel.setAttribute("aria-hidden", "true");
      chatFab.setAttribute("aria-expanded", "false");
      chatFab.focus();
    }
    on(chatFab, "click", function () {
      if (chatPanel.classList.contains("hidden")) openChat(); else closeChat();
    });
    on(chatClose, "click", closeChat);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !chatPanel.classList.contains("hidden")) closeChat();
    });
    $all(".chat-chip", chatPanel).forEach(function (c) {
      on(c, "click", function () {
        if (chatPanel.classList.contains("hidden")) openChat();
        ask(c.getAttribute("data-q"));
      });
    });
    on(chatForm, "submit", function (e) {
      e.preventDefault();
      ask(chatInput ? chatInput.value : "");
    });
  }

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
    template: "birds", name1: "", name2: "", event: "Wedding", customEvent: "",
    date: "", time: "19:00", venue: "", host: "Together with their families"
  };
  if (params.get("template") === "royal" || params.get("template") === "birds") state.template = params.get("template");
  if (params.get("event") && EVENT_LINES[params.get("event")]) state.event = params.get("event");

  var pvCard = $("#pvCard"), pvSky = lazySky($("#pvSky"), state.template);
  var countTimer = null;

  function field(id) { return document.getElementById(id); }
  /* Custom event: the visitor picks "Custom event" and types their own
     event name. eventDisplay() is the name shown and shared; eventLine()
     is the invitation sentence for it. */
  function eventDisplay() {
    if (state.event === "custom") {
      var n = (state.customEvent || "").trim();
      return n || "Custom event";
    }
    return state.event;
  }
  function eventLine() {
    if (state.event === "custom") {
      var n = (state.customEvent || "").trim();
      if (!n) return "invite you to celebrate a special occasion";
      var art = "aeiou".indexOf(n.charAt(0).toLowerCase()) >= 0 ? "an " : "a ";
      return "invite you to celebrate " + art + n;
    }
    return EVENT_LINES[state.event] || EVENT_LINES["Wedding"];
  }
  function toggleCustomEvent() {
    var sel = field("fEvent");
    var on = !!sel && sel.value === "custom";
    var w = field("fCustomEvent"), l = field("customEventLabel");
    if (w) w.classList.toggle("hidden", !on);
    if (l) l.classList.toggle("hidden", !on);
  }
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
    $("#pvLine").textContent = eventLine();
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
  bindField("fCustomEvent", "customEvent");
  on(field("fEvent"), "change", toggleCustomEvent);
  toggleCustomEvent();
  bindField("fDate", "date");
  bindField("fTime", "time");
  bindField("fVenue", "venue");
  bindField("fHost", "host");

  /* Photo upload with automatic background removal (client-side, free).
     Uses @imgly/background-removal loaded on demand from jsDelivr — no key,
     no server, the photo never leaves the visitor's device. First use
     downloads the AI model (~30MB, cached after). If removal fails
     (offline/CDN blocked), the original photo is shown in an arch frame.
     The photo is stored separately from the text draft so a big image
     can never block saving the names and details. */
  var bgRemovalLib = null;
  function setPhoto(src, framed) {
    var w = field("pvPhotoWrap"), img = field("pvPhoto"), btn = field("removePhoto");
    if (!w || !img) return;
    if (!src) {
      w.classList.add("hidden");
      img.removeAttribute("src");
      if (btn) btn.classList.add("hidden");
      return;
    }
    img.src = src;
    w.classList.toggle("framed", !!framed);
    w.classList.remove("hidden");
    if (btn) btn.classList.remove("hidden");
  }
  function loadImageFromBlob(blob) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(blob);
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("image load failed")); };
      img.src = url;
    });
  }
  function drawScaled(img, maxSide) {
    var s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    var cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(img.naturalWidth * s));
    cv.height = Math.max(1, Math.round(img.naturalHeight * s));
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    return cv;
  }
  function downscaleBlob(blob, maxSide) {
    return loadImageFromBlob(blob).then(function (img) {
      var cv = drawScaled(img, maxSide);
      return new Promise(function (resolve, reject) {
        cv.toBlob(function (b) { b ? resolve(b) : reject(new Error("encode failed")); }, "image/png");
      });
    });
  }
  function blobToDataURL(blob, maxSide) {
    return loadImageFromBlob(blob).then(function (img) {
      return drawScaled(img, maxSide).toDataURL("image/png");
    });
  }
  function loadBgRemoval() {
    if (bgRemovalLib) return Promise.resolve(bgRemovalLib);
    return import("https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm")
      .then(function (m) { bgRemovalLib = m; return m; });
  }
  function handlePhoto(file) {
    if (!file || !file.type || file.type.indexOf("image/") !== 0) return;
    var status = field("photoStatus");
    if (status) status.textContent = "Removing background… first time takes a moment while the AI model loads.";
    var usedFallback = false;
    downscaleBlob(file, 900).then(function (b) {
      return loadBgRemoval().then(function (lib) {
        return lib.removeBackground(b, { model: "medium", output: { format: "image/png" } });
      }).catch(function () { usedFallback = true; return b; });
    }).then(function (outBlob) {
      return blobToDataURL(outBlob, 600).then(function (dataUrl) {
        store("msi-photo", { src: dataUrl, framed: usedFallback });
        setPhoto(dataUrl, usedFallback);
        if (status) status.textContent = usedFallback
          ? "Background could not be removed (offline) — your photo is shown in a frame."
          : "Background removed — your photo is on the invitation.";
      });
    }).catch(function () {
      if (status) status.textContent = "That photo could not be used — please try another image.";
    });
  }
  on(field("fPhoto"), "change", function () {
    var inp = field("fPhoto");
    if (inp && inp.files && inp.files[0]) handlePhoto(inp.files[0]);
    if (inp) inp.value = "";
  });
  on(field("removePhoto"), "click", function () {
    store("msi-photo", null);
    setPhoto("", false);
    var status = field("photoStatus");
    if (status) status.textContent = "Upload a photo — its background is removed automatically and it is placed on your invitation.";
  });
  var savedPhoto = read("msi-photo", null);
  if (savedPhoto && savedPhoto.src) setPhoto(savedPhoto.src, !!savedPhoto.framed);

  /* preview RSVP + calendar */
  wireRsvp(pvCard, "msi-rsvp-" + slugify());
  on($("#pvCal"), "click", function () {
    if (!state.date) { alert("Please add your event date first."); return; }
    var names = ((state.name1 || "Your") + (state.name2 ? " & " + state.name2 : ""));
    downloadICS({
      startISO: state.date + "T" + (state.time || "19:00") + ":00",
      uid: slugify() + "@mysilkinvite.com",
      title: names + " — " + eventDisplay(),
      location: state.venue || "",
      description: eventDisplay() + " invitation by My Silk Invite.",
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
