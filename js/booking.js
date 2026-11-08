/* ==========================================================================
   Couleur Cadre — réservation SANS service tiers ni abonnement
   -------------------------------------------------------------------------
   Le visiteur choisit prestation, jour et heure (créneaux calculés sur les
   horaires réels de la boutique). La demande part ensuite par :
     • SMS pré-rempli (sms:)   • e-mail pré-rempli (mailto:)
     • message à copier        • fichier agenda .ics (créneau « provisoire »)
   Rien n'est stocké ni envoyé par ce site : la boutique confirme par retour.

   >>> À MODIFIER si besoin : les constantes CFG juste en dessous. <<<
   ========================================================================== */
(function () {
  'use strict';

  var CFG = {
    smsNumber: '+33766355460',        // mobile de la boutique (annuaire tourisme) : à confirmer avec le commerçant
    smsDisplay: '07 66 35 54 60',
    phone: '+33442268896',
    phoneDisplay: '04 42 26 88 96',
    email: 'couleurcadre@orange.fr',
    shop: 'Couleur Cadre',
    address: '58 rue des Cordeliers, 13100 Aix-en-Provence',
    slotMinutes: 30,                  // durée d'un créneau
    daysAhead: 21,                    // nombre de jours proposés
    leadMinutes: 60,                  // délai minimum avant un créneau le jour même
    // 0 = dimanche … 6 = samedi ; plages [ouverture, fermeture]
    hours: {
      0: [],
      1: [['13:30', '19:00']],
      2: [['09:30', '13:00'], ['14:00', '19:00']],
      3: [['09:30', '13:00'], ['14:00', '18:30']],
      4: [['09:30', '19:00']],
      5: [['09:30', '19:00']],
      6: [['09:30', '19:00']]
    }
  };

  var SERVICES = {
    conseil: 'Conseil et devis d’encadrement',
    depot: 'Dépôt d’une œuvre à encadrer',
    retrait: 'Retrait de mon encadrement',
    deco: 'Cadres et décoration murale'
  };

  /* ---------- Outils de date (fuseau Europe/Paris) ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function toMin(s) { var p = s.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function fmtHM(min) { var h = Math.floor(min / 60), m = min % 60; return m ? h + 'h' + pad(m) : h + 'h'; }

  function parisNow() {
    var f = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    var o = {};
    f.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, m: +o.month, d: +o.day, min: (+o.hour) * 60 + (+o.minute) };
  }
  function utcDate(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function keyOf(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }

  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return utcDate(y, month, day);
  }
  var holidayCache = {};
  function holidays(y) {
    if (holidayCache[y]) return holidayCache[y];
    var E = easter(y);
    function add(n) { var d = new Date(E); d.setUTCDate(d.getUTCDate() + n); return keyOf(d); }
    var s = {};
    [y + '-01-01', add(1), y + '-05-01', y + '-05-08', add(39), add(50), y + '-07-14', y + '-08-15', y + '-11-01', y + '-11-11', y + '-12-25']
      .forEach(function (k) { s[k] = true; });
    return (holidayCache[y] = s);
  }
  function isHoliday(d) { return !!holidays(d.getUTCFullYear())[keyOf(d)]; }

  function slotsFor(d, now) {
    var ranges = CFG.hours[d.getUTCDay()] || [];
    if (isHoliday(d)) return [];
    var isToday = keyOf(d) === keyOf(utcDate(now.y, now.m, now.d));
    var out = [];
    ranges.forEach(function (r) {
      var start = toMin(r[0]), end = toMin(r[1]);
      for (var t = start; t + CFG.slotMinutes <= end; t += CFG.slotMinutes) {
        if (isToday && t < now.min + CFG.leadMinutes) continue;
        out.push({ min: t, part: start < 12 * 60 ? 'Matin' : 'Après-midi', ranges: ranges.length });
      }
    });
    return out;
  }

  var wd = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });
  var mo = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
  var longFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  /* ---------- « Ouvert / fermé » : exposé pour le reste du site ---------- */
  function openStatus() {
    var now = parisNow(), today = utcDate(now.y, now.m, now.d);
    var todayOpen = !isHoliday(today) ? (CFG.hours[today.getUTCDay()] || []) : [];
    for (var i = 0; i < todayOpen.length; i++) {
      var s = toMin(todayOpen[i][0]), e = toMin(todayOpen[i][1]);
      if (now.min >= s && now.min < e) return { open: true, text: 'Ouvert · jusqu’à ' + fmtHM(e) };
    }
    for (var n = 0; n < 9; n++) {
      var d = new Date(today); d.setUTCDate(d.getUTCDate() + n);
      if (isHoliday(d)) continue;
      var rs = CFG.hours[d.getUTCDay()] || [];
      for (var j = 0; j < rs.length; j++) {
        var st = toMin(rs[j][0]);
        if (n === 0 && st <= now.min) continue;
        var when = n === 0 ? 'ouvre à ' : n === 1 ? 'ouvre demain à ' : 'ouvre ' + wd.format(d).replace('.', '') + ' à ';
        return { open: false, text: 'Fermé · ' + when + fmtHM(st) };
      }
    }
    return { open: false, text: 'Fermé' };
  }
  window.CCShop = { cfg: CFG, parisNow: parisNow, openStatus: openStatus };

  /* ---------- Formulaire de réservation ---------- */
  var form = document.getElementById('book-form');
  if (!form) return;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var steps = $$('.bstep', form);
  var stepperItems = $$('.stepper li', form);
  var bNext = $('#b-next'), bPrev = $('#b-prev');
  var daysEl = $('#days'), slotsEl = $('#slots'), slotsDay = $('#slots-day');
  var errEl = $('#book-error');
  var state = { step: 0, service: 'conseil', date: null, time: null, frame: '' };

  function setError(msg) {
    if (!msg) { errEl.hidden = true; errEl.textContent = ''; return; }
    errEl.hidden = false; errEl.textContent = msg;
  }

  /* Jours */
  function renderDays() {
    var now = parisNow(), base = utcDate(now.y, now.m, now.d), html = '';
    for (var i = 0; i < CFG.daysAhead; i++) {
      var d = new Date(base); d.setUTCDate(base.getUTCDate() + i);
      var k = keyOf(d), off = slotsFor(d, now).length === 0;
      var reason = isHoliday(d) ? 'Jour férié' : (CFG.hours[d.getUTCDay()] || []).length === 0 ? 'Fermé' : 'Plus de créneau';
      html += '<label class="day' + (off ? ' is-off' : '') + '"' + (off ? ' title="' + reason + '"' : '') + '>' +
        '<input type="radio" name="day" value="' + k + '"' + (off ? ' disabled' : '') + ' aria-label="' + cap(longFmt.format(d)) + (off ? ' (' + reason.toLowerCase() + ')' : '') + '">' +
        '<span><small>' + wd.format(d).replace('.', '') + '</small><b>' + d.getUTCDate() + '</b><small>' + mo.format(d).replace('.', '') + '</small></span></label>';
    }
    daysEl.innerHTML = html;
    if (state.date) {
      var again = daysEl.querySelector('input[value="' + state.date + '"]');
      if (again && !again.disabled) again.checked = true; else { state.date = null; state.time = null; }
    }
  }
  function dateFromKey(k) { var p = k.split('-'); return utcDate(+p[0], +p[1], +p[2]); }

  /* Créneaux */
  function renderSlots() {
    if (!state.date) return;
    var d = dateFromKey(state.date), list = slotsFor(d, parisNow()), html = '', last = '';
    slotsDay.textContent = cap(longFmt.format(d));
    list.forEach(function (s) {
      if (s.ranges > 1 && s.part !== last) { html += '<p class="slots__sep">' + s.part + '</p>'; last = s.part; }
      var lab = fmtHM(s.min);
      html += '<label class="slot"><input type="radio" name="slot" value="' + s.min + '"' + (state.time === s.min ? ' checked' : '') + ' aria-label="' + lab + '"><span>' + lab + '</span></label>';
    });
    slotsEl.innerHTML = html || '<p class="fine">Aucun créneau disponible ce jour-là. Choisissez un autre jour ou appelez la boutique.</p>';
  }

  /* Navigation entre étapes */
  function show(n, animate) {
    state.step = n;
    steps.forEach(function (el, i) { el.classList.toggle('is-on', i === n); });
    stepperItems.forEach(function (li, i) {
      li.classList.toggle('is-on', i === Math.min(n, 3));
      li.classList.toggle('is-done', i < n);
    });
    bPrev.hidden = n === 0;
    bNext.hidden = n >= 4;
    var last = n === 3;
    bNext.firstChild.nodeValue = last ? 'Voir le récapitulatif ' : 'Continuer ';
    setError('');
    if (n === 2) renderSlots();
    if (n === 4) buildMessage();
    var el = steps[n];
    if (animate !== false && window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.gsap.fromTo(el, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .7, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
    }
    var r = form.getBoundingClientRect();
    if (animate !== false && r.top < 60 && window.CC && window.CC.scrollToEl) window.CC.scrollToEl(form, -90);
    if (window.ScrollTrigger) { clearTimeout(show._t); show._t = setTimeout(function () { window.ScrollTrigger.refresh(); }, 120); }
  }

  function validEmail(v) { return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
  function validPhone(v) { return /^(\+|00)?\d{9,15}$/.test(v.replace(/[\s.\-()]/g, '')); }

  function next() {
    var n = state.step;
    if (n === 1 && !state.date) { setError('Choisissez un jour pour continuer.'); return; }
    if (n === 2 && state.time == null) { setError('Choisissez une heure pour continuer.'); return; }
    if (n === 3) {
      var p = form.elements.prenom, t = form.elements.tel, e = form.elements.email, ok = true;
      [p, t, e].forEach(function (i) { i.removeAttribute('aria-invalid'); });
      if (!p.value.trim()) { p.setAttribute('aria-invalid', 'true'); ok = false; }
      if (!validPhone(t.value)) { t.setAttribute('aria-invalid', 'true'); ok = false; }
      if (!validEmail(e.value.trim())) { e.setAttribute('aria-invalid', 'true'); ok = false; }
      if (!ok) {
        setError(!p.value.trim() ? 'Indiquez votre prénom.' : !validPhone(t.value) ? 'Indiquez un numéro de téléphone valide pour que la boutique puisse vous répondre.' : 'Cette adresse e-mail semble incorrecte.');
        (form.querySelector('[aria-invalid="true"]') || p).focus();
        return;
      }
    }
    show(Math.min(4, n + 1));
  }
  function prev() { show(Math.max(0, state.step - 1)); }

  bNext.addEventListener('click', next);
  bPrev.addEventListener('click', prev);
  form.addEventListener('submit', function (e) { e.preventDefault(); if (state.step < 4) next(); });
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'radio' && state.step < 4) { e.preventDefault(); next(); }
  });

  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'service') state.service = t.value;
    if (t.name === 'day') { state.date = t.value; state.time = null; setError(''); }
    if (t.name === 'slot') { state.time = +t.value; setError(''); }
    if (t.matches && t.matches('[aria-invalid]')) t.removeAttribute('aria-invalid');
  });
  form.addEventListener('input', function (e) { if (e.target.removeAttribute && e.target.hasAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid'); });

  /* Message, liens SMS / e-mail, agenda */
  var msgEl = $('#msg'), smsA = $('#send-sms'), mailA = $('#send-mail'), copyB = $('#send-copy'), icsB = $('#send-ics'), recap = $('#recap');

  function slotLabel() { return fmtHM(state.time); }
  function longDate() { return dateFromKey(state.date); }

  function buildMessage() {
    var d = longDate(), svc = SERVICES[state.service] || '';
    var prenom = form.elements.prenom.value.trim(), tel = form.elements.tel.value.trim(), note = form.elements.note.value.trim();
    var lines = [
      'Bonjour, je souhaite prendre rendez-vous chez ' + CFG.shop + '.',
      'Prestation : ' + svc,
      'Créneau souhaité : ' + longFmt.format(d) + ' à ' + slotLabel()
    ];
    if (note) lines.push('Mon projet : ' + note);
    if (state.frame) lines.push('Cadre envisagé : ' + state.frame);
    lines.push('Je m’appelle ' + prenom + ', mon numéro : ' + tel + '.');
    lines.push('Merci de me confirmer ce créneau ou de me proposer un autre horaire.');
    msgEl.value = lines.join('\n');

    recap.innerHTML = '<b>' + svc + '</b><br>' + cap(longFmt.format(d)) + ' à <b>' + slotLabel() + '</b>' +
      (state.frame ? '<br>Cadre envisagé : ' + escapeHtml(state.frame) : '');
    updateLinks();
  }

  function escapeHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function updateLinks() {
    var body = msgEl.value;
    smsA.href = 'sms:' + CFG.smsNumber + '?&body=' + encodeURIComponent(body);
    var subject = 'Demande de rendez-vous : ' + (SERVICES[state.service] || '') + ' le ' + longFmt.format(longDate()) + ' à ' + slotLabel();
    var mailBody = body + (form.elements.email.value.trim() ? '\nMon e-mail : ' + form.elements.email.value.trim() : '');
    mailA.href = 'mailto:' + CFG.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(mailBody.replace(/\n/g, '\r\n'));
  }
  msgEl.addEventListener('input', updateLinks);

  copyB.addEventListener('click', function () {
    var label = copyB.querySelector('span'), old = label.textContent;
    function done(ok) { label.textContent = ok ? 'Message copié ✓' : 'Copie impossible'; setTimeout(function () { label.textContent = old; }, 2200); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msgEl.value).then(function () { done(true); }, function () { fallback(); });
    } else fallback();
    function fallback() { try { msgEl.select(); done(document.execCommand('copy')); } catch (e) { done(false); } }
  });

  /* Fichier .ics (créneau provisoire, fuseau Europe/Paris) */
  function icsEscape(s) { return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) {
    var out = [], chunk = 60;
    while (line.length > chunk) { out.push(line.slice(0, chunk)); line = ' ' + line.slice(chunk); }
    out.push(line);
    return out.join('\r\n');
  }
  function buildIcs() {
    var d = longDate(), y = d.getUTCFullYear(), m = pad(d.getUTCMonth() + 1), dd = pad(d.getUTCDate());
    var s = state.time, e = s + CFG.slotMinutes;
    function stamp(min) { return y + m + dd + 'T' + pad(Math.floor(min / 60)) + pad(min % 60) + '00'; }
    var n = new Date(), dtstamp = n.getUTCFullYear() + pad(n.getUTCMonth() + 1) + pad(n.getUTCDate()) + 'T' + pad(n.getUTCHours()) + pad(n.getUTCMinutes()) + pad(n.getUTCSeconds()) + 'Z';
    var svc = SERVICES[state.service] || 'Rendez-vous';
    var desc = svc + '\nRendez-vous À CONFIRMER par la boutique (demande envoyée par SMS ou e-mail).\nTéléphone : ' + CFG.phoneDisplay +
      (state.frame ? '\nCadre envisagé : ' + state.frame : '');
    var L = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Couleur Cadre//Reservation//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE', 'TZID:Europe/Paris',
      'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
      'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      'UID:cc-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@couleurcadre',
      'DTSTAMP:' + dtstamp,
      'DTSTART;TZID=Europe/Paris:' + stamp(s),
      'DTEND;TZID=Europe/Paris:' + stamp(e),
      'SUMMARY:' + icsEscape(CFG.shop + ' : ' + svc),
      'LOCATION:' + icsEscape(CFG.shop + ', ' + CFG.address),
      'DESCRIPTION:' + icsEscape(desc),
      'STATUS:TENTATIVE',
      'BEGIN:VALARM', 'TRIGGER:-PT120M', 'ACTION:DISPLAY', 'DESCRIPTION:Rendez-vous chez Couleur Cadre', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ];
    return L.map(fold).join('\r\n') + '\r\n';
  }
  icsB.addEventListener('click', function () {
    var blob = new Blob([buildIcs()], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'rendez-vous-couleur-cadre.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  });

  /* Pré-sélections venant du reste du site */
  var projEl = $('#proj-sel');
  function renderProj() {
    if (!state.frame) { projEl.hidden = true; projEl.textContent = ''; return; }
    projEl.hidden = false;
    projEl.innerHTML = '<b>Cadre envisagé :</b> ' + escapeHtml(state.frame) + ' <button type="button" class="ulink" id="proj-clear">retirer</button>';
    $('#proj-clear').addEventListener('click', function () { state.frame = ''; renderProj(); });
  }
  document.addEventListener('cc:service', function (e) {
    var v = e.detail, r = form.querySelector('input[name="service"][value="' + v + '"]');
    if (r) { r.checked = true; state.service = v; }
  });
  document.addEventListener('cc:frame', function (e) { state.frame = e.detail || ''; renderProj(); });

  renderDays();
  show(0, false);
  // Relance chaque heure : les créneaux « aujourd'hui » évoluent
  setInterval(function () { if (state.step < 2) renderDays(); }, 15 * 60 * 1000);
})();
