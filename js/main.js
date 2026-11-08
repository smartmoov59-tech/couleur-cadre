/* ==========================================================================
   Couleur Cadre — animations (GSAP + ScrollTrigger + Lenis)
   Règles : courbes douces (power3 / expo), transform + opacity en priorité,
   stagger partout, version allégée si prefers-reduced-motion, mobile simplifié.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  window.__ccReady = true;

  /* Dégradation : si GSAP n'a pas chargé, tout reste visible et fonctionnel */
  if (!window.gsap || !window.ScrollTrigger) { root.classList.remove('js'); return; }

  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var motion = !reduced;
  if (reduced) root.classList.add('rm');

  var navH = parseInt(getComputedStyle(root).getPropertyValue('--nav-h'), 10) || 76;

  /* ---------------------------------------------------------------------
     Smooth scroll (Lenis) branché sur ScrollTrigger
     --------------------------------------------------------------------- */
  var lenis = null;
  if (motion && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToEl(target, offset) {
    var el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: offset || 0, duration: 1.6, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
    else {
      var y = el.getBoundingClientRect().top + window.pageYOffset + (offset || 0);
      window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
    }
  }
  window.CC = {
    lenis: lenis,
    scrollToEl: scrollToEl,
    goto: function (sel) { scrollToEl(sel, sel === '#top' ? 0 : -navH + 6); }
  };

  /* Liens d'ancre */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var el = $(id);
      if (!el) return;
      e.preventDefault();
      if (a.dataset.pickService) document.dispatchEvent(new CustomEvent('cc:service', { detail: a.dataset.pickService }));
      closeMenu(true);
      scrollToEl(el, id === '#top' ? 0 : -navH + 6);
      history.replaceState(null, '', id);
    });
  });

  /* ---------------------------------------------------------------------
     Découpage de texte (lettres / mots) avec masque
     --------------------------------------------------------------------- */
  function splitText(el, mode) {
    if (el.dataset.splitDone) return $$('.sc', el);
    el.dataset.splitDone = '1';
    var label = (el.textContent || '').replace(/\s+/g, ' ').trim();
    var holder = document.createElement('span');
    (function walk(node, parent) {
      Array.prototype.forEach.call(node.childNodes, function (n) {
        if (n.nodeType === 3) {
          n.textContent.split(/([ \t\r\n]+)/).forEach(function (p) {
            if (!p) return;
            if (/^[ \t\r\n]+$/.test(p)) { parent.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = 'sw'; w.setAttribute('aria-hidden', 'true');
            if (mode === 'chars') {
              Array.from(p).forEach(function (ch) {
                var c = document.createElement('span'); c.className = 'sc'; c.textContent = ch; w.appendChild(c);
              });
            } else {
              var c = document.createElement('span'); c.className = 'sc'; c.textContent = p; w.appendChild(c);
            }
            parent.appendChild(w);
          });
        } else if (n.nodeType === 1) {
          var clone = n.cloneNode(false);
          parent.appendChild(clone);
          walk(n, clone);
        }
      });
    })(el, holder);
    el.textContent = '';
    while (holder.firstChild) el.appendChild(holder.firstChild);
    if (!el.closest('[aria-hidden="true"]') && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', label);
    el.classList.add('is-split');
    return $$('.sc', el);
  }

  var heroChars = [], titleChars = [];
  if (motion) {
    $$('.hl__in').forEach(function (el) { heroChars = heroChars.concat(splitText(el, 'chars')); });
    $$('[data-split]').forEach(function (el) {
      if (el.classList.contains('hl__in') || el.closest('.foot__word')) return;
      var chars = splitText(el, el.dataset.split === 'chars' ? 'chars' : 'words');
      titleChars.push({ el: el, chars: chars, mode: el.dataset.split });
    });
  } else {
    $$('[data-split]').forEach(function (el) { el.classList.add('is-split'); });
  }

  /* ---------------------------------------------------------------------
     Statut ouvert / fermé (hero + horaires)
     --------------------------------------------------------------------- */
  function updateStatus() {
    if (!window.CCShop) return;
    var st = window.CCShop.openStatus(), now = window.CCShop.parisNow();
    $$('[data-open-status]').forEach(function (el) {
      el.textContent = st.text;
      var host = el.closest('.pill') || el;
      host.classList.toggle('is-closed', !st.open);
    });
    var dow = new Date(Date.UTC(now.y, now.m - 1, now.d)).getUTCDay();
    $$('.hours tr').forEach(function (tr) { tr.classList.toggle('is-today', +tr.dataset.day === dow); });
  }
  updateStatus();
  setInterval(updateStatus, 60 * 1000);

  /* ---------------------------------------------------------------------
     Navigation : se cache en descendant, réapparaît en remontant + menu mobile
     --------------------------------------------------------------------- */
  var nav = $('#nav'), burger = $('.nav__burger'), menu = $('#menu'), menuOpen = false;

  $$('.menu__links a').forEach(function (a) {
    var t = a.lastChild;
    if (t && t.nodeType === 3) { var s = document.createElement('span'); s.textContent = t.textContent; a.replaceChild(s, t); }
  });

  function closeMenu(instant) {
    if (!menuOpen) return;
    menuOpen = false;
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Ouvrir le menu');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start(); else root.style.overflow = '';
    if (instant || !motion) { menu.classList.remove('is-open'); gsap.set('.menu__bg', { yPercent: -101 }); return; }
    gsap.to('.menu__bg', { yPercent: -101, duration: .8, ease: 'expo.inOut', onComplete: function () { menu.classList.remove('is-open'); } });
  }
  function openMenu() {
    menuOpen = true;
    burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Fermer le menu');
    menu.setAttribute('aria-hidden', 'false'); menu.classList.add('is-open');
    nav.classList.remove('is-hidden');
    if (lenis) lenis.stop(); else root.style.overflow = 'hidden';
    if (!motion) { gsap.set('.menu__bg', { yPercent: 0 }); return; }
    gsap.fromTo('.menu__bg', { yPercent: -101 }, { yPercent: 0, duration: .9, ease: 'expo.inOut' });
    gsap.fromTo('.menu__links a > *', { yPercent: 115 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: .05, delay: .35 });
    gsap.fromTo('.menu__foot', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .8, delay: .75, ease: 'power3.out' });
  }
  gsap.set('.menu__bg', { yPercent: -101 });
  burger.addEventListener('click', function () { menuOpen ? closeMenu() : openMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  function applyNav(y, dir) {
    nav.classList.toggle('is-solid', y > 40);
    if (menuOpen) return;
    if (y > 260 && dir === 1) nav.classList.add('is-hidden');
    else if (dir === -1 || y <= 260) nav.classList.remove('is-hidden');
  }
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: function (self) { applyNav(self.scroll(), self.direction); },
    onRefresh: function (self) { applyNav(window.pageYOffset, self.direction); }
  });

  /* Barre de progression de lecture */
  gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .15 } });

  /* Boutons flottants (mobile) : visibles après le hero, masqués sur la réservation */
  var fab = $('.fab');
  if (fab) {
    var afterHero = false, inBook = false;
    var upd = function () { fab.classList.toggle('is-on', afterHero && !inBook && !menuOpen); };
    ScrollTrigger.create({ trigger: '.hero', start: 'bottom 40%', onEnter: function () { afterHero = true; upd(); }, onLeaveBack: function () { afterHero = false; upd(); } });
    ScrollTrigger.create({ trigger: '#reserver', start: 'top 80%', end: 'bottom 20%', onToggle: function (s) { inBook = s.isActive; upd(); } });
  }

  /* ---------------------------------------------------------------------
     Vidéo du hero
     --------------------------------------------------------------------- */
  var vid = $('.hero__video');
  if (vid) {
    var saveData = navigator.connection && navigator.connection.saveData;
    if (reduced || saveData) { vid.removeAttribute('autoplay'); vid.pause(); }   // l'image de secours (poster) reste affichée
    else { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); }
  }

  /* ---------------------------------------------------------------------
     Loader + entrée du hero
     --------------------------------------------------------------------- */
  var loader = $('#loader');

  var heroStarted = false;
  function heroIntro() {
    heroStarted = true;
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo('.hero__media', { scale: 1.28 }, { scale: 1, duration: 2.6, ease: 'expo.out' }, 0)
      .fromTo('.hero__kicker', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, .25)
      .fromTo('.titleframe', { opacity: 0, scale: .9, transformOrigin: '0% 50%' }, { opacity: 1, scale: 1, duration: 1.3, ease: 'expo.out' }, .45)
      .to(heroChars, { yPercent: 0, rotate: 0, duration: 1.4, ease: 'expo.out', stagger: { each: .04, from: 'start' } }, .3)
      .fromTo('.hero__lead', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, .9)
      .fromTo('.hero__cta .btn', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: .12 }, 1.05)
      .fromTo('.hero__badges .pill', { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .1 }, 1.1)
      .fromTo('.hero__fg', { y: 180, opacity: 0, rotate: 8 }, { y: 0, opacity: 1, rotate: 0, duration: 1.8, ease: 'expo.out' }, .8)
      .fromTo('.hf', { opacity: 0, scale: .6 }, { opacity: function (i, t) { return t.classList.contains('hf--3') ? .16 : t.classList.contains('hf--4') ? .3 : .4; }, scale: 1, duration: 1.6, stagger: .12 }, 1)
      .fromTo('.scrollcue', { opacity: 0 }, { opacity: 1, duration: 1 }, 1.6);
    return tl;
  }

  function prepareHero() {
    gsap.set(heroChars, { yPercent: 118, rotate: 5, transformOrigin: '0% 100%' });
    gsap.set(['.hero__kicker', '.hero__lead', '.hero__cta .btn', '.hero__badges .pill', '.hero__fg', '.hf', '.scrollcue', '.titleframe'], { opacity: 0 });
  }

  if (loader && motion) {
    prepareHero();
    if (lenis) lenis.stop(); else root.style.overflow = 'hidden';
    window.scrollTo(0, 0);

    var num = $('.ld__num');
    var drawn = $$('.ld__line').filter(function (l) { return !l.classList.contains('ld__mitre'); });
    var obj = { v: 0 };
    var minTime = new Promise(function (r) { gsap.delayedCall(2.3, r); });
    var assets = Promise.all([
      (document.fonts && document.fonts.ready) || Promise.resolve(),
      new Promise(function (r) { var i = new Image(); i.onload = i.onerror = r; i.src = 'img/hero-poster.jpg'; })
    ]);
    var hardStop = new Promise(function (r) { setTimeout(r, 6000); });

    gsap.set('.ld__wash', { scaleY: 0, transformOrigin: '50% 100%' });
    var ltl = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
    ltl.to(drawn, { strokeDashoffset: 0, duration: 1.4, stagger: .22 }, 0)
      .to('.ld__mitre', { strokeDashoffset: 0, duration: .8, stagger: .1 }, 1.0)
      .to('.ld__wash', { scaleY: 1, duration: 1.5, ease: 'power2.inOut' }, .5)
      .fromTo('.ld__name', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .9, ease: 'power3.out' }, .7)
      .to(obj, { v: 100, duration: 2.1, ease: 'power2.inOut', onUpdate: function () { num.textContent = Math.round(obj.v); } }, 0);

    Promise.all([minTime, Promise.race([assets, hardStop])]).then(function () {
      if (!document.getElementById('loader')) return;   // déjà retiré par le filet de sécurité
      obj.v = 100; num.textContent = '100';
      var ex = gsap.timeline({ onComplete: function () { loader.remove(); if (lenis) lenis.start(); else root.style.overflow = ''; ScrollTrigger.refresh(); } });
      ex.to('.ld__center', { opacity: 0, scale: 1.12, duration: .55, ease: 'power2.in' })
        .to('.ld__half--a', { xPercent: -100, yPercent: -100, duration: 1.3, ease: 'expo.inOut' }, '>-0.05')
        .to('.ld__half--b', { xPercent: 100, yPercent: 100, duration: 1.3, ease: 'expo.inOut' }, '<')
        .add(heroIntro(), '-=1.0');
    });
  } else {
    if (loader) loader.remove();
    if (motion) { prepareHero(); heroIntro(); }
  }

  /* ---------------------------------------------------------------------
     Hero : parallax multicouche (scroll + souris)
     --------------------------------------------------------------------- */
  if (motion) {
    var heroTrig = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.hero__media', { yPercent: 14, ease: 'none', scrollTrigger: heroTrig });
    gsap.to('.hero__video', { scale: 1.26, ease: 'none', scrollTrigger: heroTrig });
    gsap.to('.hero__inner', { y: -90, opacity: .15, ease: 'none', scrollTrigger: heroTrig });
    gsap.to('.hero__fg', { yPercent: -70, ease: 'none', scrollTrigger: heroTrig });
    $$('.hf').forEach(function (el) {
      var d = parseFloat(el.getAttribute('data-depth')) || .3;
      gsap.to(el, { yPercent: -160 * d, ease: 'none', scrollTrigger: heroTrig });
    });

    if (finePointer) {
      var hero = $('.hero');
      var layers = [
        { el: $('.hero__media'), k: -10, tilt: 0 },
        { el: $('.hero__fg .fp'), k: 36, tilt: 5 }
      ];
      var setters = layers.map(function (l) {
        return { x: gsap.quickTo(l.el, 'x', { duration: 1.2, ease: 'power3' }), y: gsap.quickTo(l.el, 'y', { duration: 1.2, ease: 'power3' }), r: gsap.quickTo(l.el, 'rotationY', { duration: 1.2, ease: 'power3' }) };
      });
      var hfs = $$('.hf').map(function (el) {
        var d = parseFloat(el.getAttribute('data-depth')) || .3;
        return { d: d, x: gsap.quickTo(el, 'x', { duration: 1.4, ease: 'power3' }), y: gsap.quickTo(el, 'y', { duration: 1.4, ease: 'power3' }) };
      });
      gsap.set('.hero__fg .fp', { transformPerspective: 700 });
      hero.addEventListener('pointermove', function (e) {
        var px = e.clientX / window.innerWidth - .5, py = e.clientY / window.innerHeight - .5;
        layers.forEach(function (l, i) { setters[i].x(px * l.k); setters[i].y(py * l.k); setters[i].r(px * l.tilt * 2); });
        hfs.forEach(function (h) { h.x(px * 90 * h.d); h.y(py * 90 * h.d); });
      });
    }
  }

  /* ---------------------------------------------------------------------
     Marquee : vitesse + sens réagissent au scroll
     --------------------------------------------------------------------- */
  var mqTweens = [];
  $$('.marquee__row').forEach(function (row) {
    var track = $('.marquee__track', row), dir = parseInt(row.dataset.dir, 10) || 1;
    var base = track.innerHTML;
    track.innerHTML = base;
    var one = track.scrollWidth || 1;
    var k = Math.max(1, Math.ceil(window.innerWidth / one));
    var set = new Array(k + 1).join(base);
    track.innerHTML = set + set;
    if (!motion) return;
    var tw = gsap.fromTo(track, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: 38 + k * 6, ease: 'none', repeat: -1 });
    mqTweens.push(tw);
  });
  if (motion && mqTweens.length) {
    var vst = ScrollTrigger.create({ start: 0, end: 'max' });
    var flip = 1, cur = 1;
    gsap.ticker.add(function () {
      var v = vst.getVelocity();
      if (Math.abs(v) > 30) flip = v > 0 ? 1 : -1;
      var target = flip * (1 + Math.min(Math.abs(v) / 380, 7));
      cur += (target - cur) * .07;
      mqTweens.forEach(function (tw) { tw.timeScale(cur); });
    });
  }

  /* ---------------------------------------------------------------------
     Titres de sections : lettres / mots qui montent
     --------------------------------------------------------------------- */
  titleChars.forEach(function (t) {
    var words = t.mode !== 'chars';
    gsap.set(t.chars, { yPercent: 118, rotate: words ? 4 : 0, transformOrigin: '0% 100%' });
    ScrollTrigger.create({
      trigger: t.el, start: 'top 88%', once: true,
      onEnter: function () { gsap.to(t.chars, { yPercent: 0, rotate: 0, duration: 1.2, ease: 'expo.out', stagger: words ? .07 : .035 }); }
    });
  });

  /* Apparitions génériques (hors sections pinnées, qui ont leur propre mise en scène) */
  if (motion) {
    var fadeSel = '.wall__head .eyebrow,.gal__head .eyebrow,.rev__head .eyebrow,.cta .eyebrow,.book__intro .eyebrow,.find__info .eyebrow,.compose__panel .eyebrow,' +
      '.gal__lead,.compose__intro,.book__lead,.book__points li,.book__or,.book__photo,.find__addr a,.hours,.find__facts li,.rev__score,' +
      '.compose__form fieldset,.compose__actions,.cta__row,.wall__note,.book__form,.find__map,.foot__top > *';
    var fades = $$(fadeSel);
    gsap.set(fades, { opacity: 0, y: 34 });
    ScrollTrigger.batch(fades, {
      start: 'top 92%', once: true,
      onEnter: function (batch) { gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: .09, overwrite: true }); }
    });
  }

  /* ---------------------------------------------------------------------
     Responsive : animations lourdes seulement sur desktop
     --------------------------------------------------------------------- */
  var mm = gsap.matchMedia();

  /* --- L'atelier : section pinnée, storytelling étape par étape --- */
  mm.add('(min-width: 901px)', function () {
    if (!motion) return;
    var pin = $('.story__pin'), steps = $$('.step'), imgs = $$('.story__img'), mark = $('.ruler__mark'), markNum = $('.ruler__mark b'), ruler = $('.ruler');
    if (!pin || !steps.length) return;

    gsap.set(steps, { autoAlpha: 0 }); gsap.set(steps[0], { autoAlpha: 1, y: 0 });
    gsap.set(imgs, { clipPath: 'inset(100% 0% 0% 0%)' }); gsap.set(imgs[0], { clipPath: 'inset(0% 0% 0% 0%)' });
    imgs.forEach(function (im) { im.classList.remove('is-on'); });
    $$('.step').forEach(function (s) { s.classList.remove('is-on'); });
    gsap.set(imgs.map(function (im) { return $('img', im); }), { scale: 1.14 });

    var seg = 1.4, hold = .9, idx = 0;
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: pin, start: 'top top', end: '+=330%', pin: true, scrub: .7, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: function (self) {
          var p = self.progress * tl.duration(), n = 0;
          for (var i = 1; i < steps.length; i++) if (p >= (i - 1) * seg + hold + .3) n = i;
          if (n !== idx) { idx = n; markNum.textContent = '0' + (n + 1); }
        }
      }
    });
    for (var i = 1; i < steps.length; i++) {
      (function (i) {
        var at = (i - 1) * seg + hold;
        tl.to(steps[i - 1], { autoAlpha: 0, y: -34, duration: .35, ease: 'power2.in' }, at)
          .fromTo(steps[i], { autoAlpha: 0, y: 44 }, { autoAlpha: 1, y: 0, duration: .55, ease: 'power3.out' }, at + .25)
          .fromTo(imgs[i], { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .75, ease: 'power3.inOut' }, at)
          .fromTo($('img', imgs[i]), { scale: 1.32 }, { scale: 1.14, duration: .9, ease: 'power2.out' }, at)
          .to($('img', imgs[i - 1]), { scale: 1.26, duration: .75, ease: 'none' }, at);
      })(i);
    }
    tl.to({}, { duration: hold });
    tl.fromTo(mark, { y: 0 }, { y: function () { return ruler.clientHeight; }, ease: 'none', duration: tl.duration() }, 0);
  });

  /* --- Mobile : apparitions simples pour l'atelier --- */
  mm.add('(max-width: 900px)', function () {
    if (!motion) return;
    var els = $$('.step, .story__img');
    gsap.set(els, { opacity: 0, y: 40 });
    ScrollTrigger.batch(els, { start: 'top 90%', once: true, onEnter: function (b) { gsap.to(b, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: .1 }); } });
  });

  /* --- Prestations : défilement horizontal piloté par le scroll vertical --- */
  mm.add('(min-width: 821px)', function () {
    var pinEl = $('.hs__pin'), track = $('.hs__track');
    if (!pinEl || !track) return;
    var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };

    if (!motion) { pinEl.style.overflowX = 'auto'; return; }

    var tween = gsap.to(track, {
      x: function () { return -dist(); }, ease: 'none',
      scrollTrigger: { trigger: pinEl, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: .8, anticipatePin: 1, invalidateOnRefresh: true }
    });

    $$('.card').forEach(function (card) {
      var img = $('.card__media img', card);
      gsap.fromTo(img, { xPercent: -6.5 }, { xPercent: 6.5, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
      gsap.fromTo(card, { opacity: 0, y: 70, rotate: 2 }, { opacity: 1, y: 0, rotate: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 96%', toggleActions: 'play none none reverse' } });
    });
    gsap.from('.hs__intro > *', { y: 50, opacity: 0, duration: 1.1, stagger: .12, ease: 'power3.out', scrollTrigger: { trigger: pinEl, start: 'top 70%', once: true } });

    if (finePointer) {
      $$('.card').forEach(function (card) {
        var tilt = $('.card__tilt', card), glare = $('.glare', card);
        gsap.set(tilt, { transformPerspective: 1000 });
        var rx = gsap.quickTo(tilt, 'rotationX', { duration: .6, ease: 'power3' }), ry = gsap.quickTo(tilt, 'rotationY', { duration: .6, ease: 'power3' });
        var gx = gsap.quickTo(glare, 'x', { duration: .5, ease: 'power3' }), gy = gsap.quickTo(glare, 'y', { duration: .5, ease: 'power3' });
        card.addEventListener('pointermove', function (e) {
          var r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
          ry(px * 12); rx(-py * 12); gx(px * r.width); gy(py * r.height);
        });
        card.addEventListener('pointerleave', function () { rx(0); ry(0); gx(0); gy(0); });
      });
    }
  });

  /* --- Composer : la lampe s'allume --- */
  if (motion) {
    var stage = $('.compose__stage');
    if (stage) {
      var ctl = gsap.timeline({ scrollTrigger: { trigger: stage, start: 'top 75%', once: true } });
      ctl.fromTo('.compose__stage .fp', { y: 80, opacity: 0, rotate: -3 }, { y: 0, opacity: 1, rotate: 0, duration: 1.6, ease: 'expo.out' }, 0)
        .fromTo('.lamp', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: 'power3.out' }, 0)
        .to('.lamp__cone', { opacity: .3, duration: .08 }, 1.0).to('.lamp__cone', { opacity: 0, duration: .1 })
        .to('.lamp__cone', { opacity: .6, duration: .1 }).to('.lamp__cone', { opacity: .15, duration: .1 })
        .to('.lamp__cone', { opacity: 1, duration: 1.1, ease: 'power2.out' });
      gsap.fromTo('.compose__stage .fp', { y: 0 }, { y: -26, ease: 'none', scrollTrigger: { trigger: '.compose', start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  /* --- Chiffres : compteurs + cadres qui se balancent --- */
  $$('[data-count]').forEach(function (el) {
    var end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec, 10) || 0;
    var fmt = function (v) { return v.toFixed(dec).replace('.', ','); };
    if (!motion) { el.textContent = fmt(end); return; }
    el.textContent = fmt(0);
    var o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: function () { gsap.to(o, { v: end, duration: 2.4, ease: 'power3.out', onUpdate: function () { el.textContent = fmt(o.v); } }); }
    });
  });
  if (motion) {
    $$('.hung').forEach(function (fig, i) {
      var sw = parseFloat(fig.dataset.swing) || 4;
      gsap.set(fig, { opacity: 0, y: -90, rotation: sw * 2.4 });
      ScrollTrigger.create({
        trigger: fig, start: 'top 90%', once: true,
        onEnter: function () {
          gsap.to(fig, { opacity: 1, duration: .6, delay: i * .12 });
          gsap.to(fig, { y: 0, rotation: 0, duration: 2.6, delay: i * .12, ease: 'elastic.out(1,.32)' });
        }
      });
      if (finePointer) {
        fig.addEventListener('pointerenter', function () { gsap.to(fig, { rotation: sw * .7, duration: 1.4, ease: 'elastic.out(1,.3)', overwrite: 'auto' }); });
        fig.addEventListener('pointerleave', function () { gsap.to(fig, { rotation: 0, duration: 1.6, ease: 'elastic.out(1,.3)', overwrite: 'auto' }); });
      }
    });
  }

  /* --- Galerie : révélations par masque + parallax interne + tilt --- */
  var REVEAL = {
    curtain: { from: 'inset(0% 0% 100% 0%)', to: 'inset(0% 0% 0% 0%)' },
    circle: { from: 'circle(0% at 50% 50%)', to: 'circle(78% at 50% 50%)' },
    diag: { from: 'polygon(0% 0%, 0% 0%, 0% 0%, 0% 0%)', to: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' }
  };
  if (motion) {
    $$('.gi').forEach(function (fig) {
      var btn = $('.gi__btn', fig), img = $('img', fig), r = REVEAL[fig.dataset.reveal] || REVEAL.curtain;
      gsap.set(btn, { clipPath: r.from });
      gsap.to(btn, { clipPath: r.to, duration: 1.5, ease: 'expo.inOut', scrollTrigger: { trigger: fig, start: 'top 90%', once: true } });
      gsap.fromTo(img, { yPercent: -6, scale: 1.16 }, { yPercent: 6, scale: 1.16, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } });
      if (finePointer) {
        gsap.set(btn, { transformPerspective: 900 });
        var rx = gsap.quickTo(btn, 'rotationX', { duration: .7, ease: 'power3' }), ry = gsap.quickTo(btn, 'rotationY', { duration: .7, ease: 'power3' });
        btn.addEventListener('pointermove', function (e) {
          var b = btn.getBoundingClientRect(), px = (e.clientX - b.left) / b.width - .5, py = (e.clientY - b.top) / b.height - .5;
          ry(px * 7); rx(-py * 7);
        });
        btn.addEventListener('pointerleave', function () { rx(0); ry(0); });
      }
    });
  }

  /* --- Lightbox --- */
  (function () {
    var lb = $('#lb'); if (!lb) return;
    var items = $$('.gi__btn'), img = $('.lb__fig img', lb), cap = $('.lb__fig figcaption', lb), cur = 0, lastFocus = null;
    function fill(i) {
      cur = (i + items.length) % items.length;
      var src = $('img', items[cur]);
      img.src = src.currentSrc || src.src; img.alt = src.alt;
      cap.textContent = $('figcaption', items[cur]).textContent;
    }
    function open(i) {
      lastFocus = document.activeElement; fill(i);
      lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false');
      if (lenis) lenis.stop(); else root.style.overflow = 'hidden';
      $('.lb__close', lb).focus();
    }
    function close() {
      lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true');
      if (lenis) lenis.start(); else root.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    }
    items.forEach(function (b, i) { b.addEventListener('click', function () { open(i); }); });
    $('.lb__close', lb).addEventListener('click', close);
    $('.lb__nav--prev', lb).addEventListener('click', function () { fill(cur - 1); });
    $('.lb__nav--next', lb).addEventListener('click', function () { fill(cur + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') fill(cur - 1);
      if (e.key === 'ArrowRight') fill(cur + 1);
    });
  })();

  /* --- Avis : carrousel (glisser, flèches, points, lecture auto) --- */
  (function () {
    var vp = $('.car__viewport'), track = $('.car__track'); if (!vp || !track) return;
    var slides = $$('.rv', track), dotsEl = $('.car__dots'), i = 0, timer = null, hovering = false;
    var dots = slides.map(function (s, k) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'car__dot'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', 'Avis ' + (k + 1) + ' sur ' + slides.length); b.setAttribute('aria-selected', k === 0 ? 'true' : 'false');
      b.addEventListener('click', function () { go(k); restart(); });
      dotsEl.appendChild(b); return b;
    });
    function minX() {
      var pad = parseFloat(getComputedStyle(vp).paddingLeft) || 0;
      return -Math.max(0, track.scrollWidth - (vp.clientWidth - pad * 2));
    }
    function xFor(k) { return Math.max(minX(), -slides[k].offsetLeft); }
    function paint() {
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      dots.forEach(function (d, k) { d.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    }
    function go(k) {
      i = Math.max(0, Math.min(slides.length - 1, k));
      gsap.to(track, { x: xFor(i), duration: motion ? 1 : 0, ease: 'power3.out', overwrite: true });
      paint();
    }
    $$('[data-car]').forEach(function (b) {
      b.addEventListener('click', function () { go(i + (b.dataset.car === 'next' ? 1 : -1)); restart(); });
    });
    // glisser
    var down = false, sx = 0, tx = 0, moved = 0;
    vp.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; moved = 0; sx = e.clientX; tx = gsap.getProperty(track, 'x');
      gsap.killTweensOf(track);
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      gsap.set(track, { x: Math.max(minX() - 80, Math.min(80, tx + dx)) });
    });
    window.addEventListener('pointerup', function (e) {
      if (!down) return; down = false;
      var dx = e.clientX - sx;
      if (Math.abs(dx) > 60) go(i + (dx < 0 ? 1 : -1)); else go(i);
      restart();
    });
    vp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { go(i + 1); restart(); }
      if (e.key === 'ArrowLeft') { go(i - 1); restart(); }
    });
    function autoplay() { if (!motion || hovering || document.hidden) return; go(i >= slides.length - 1 ? 0 : i + 1); }
    function restart() { clearInterval(timer); if (motion) timer = setInterval(autoplay, 7000); }
    vp.addEventListener('pointerenter', function () { hovering = true; });
    vp.addEventListener('pointerleave', function () { hovering = false; });
    vp.addEventListener('focusin', function () { hovering = true; });
    vp.addEventListener('focusout', function () { hovering = false; });
    window.addEventListener('resize', function () { go(i); });
    paint(); restart();
    if (motion) {
      gsap.from(slides, { y: 70, opacity: 0, duration: 1.2, ease: 'power3.out', stagger: .12, scrollTrigger: { trigger: vp, start: 'top 88%', once: true }, clearProps: 'transform,opacity' });
    }
  })();

  /* --- Appel à l'action : cadres décoratifs en parallax --- */
  if (motion) {
    gsap.to('.cta__f--1', { yPercent: -50, rotate: -2, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.to('.cta__f--2', { yPercent: 60, rotate: 18, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* --- Footer : grand nom lettre par lettre --- */
  (function () {
    var w = $('.foot__word [data-split]'); if (!w) return;
    var chars = splitText(w, 'chars');
    if (!motion) return;
    gsap.set(chars, { yPercent: 105 });
    ScrollTrigger.create({
      trigger: '.foot__word', start: 'top 95%', once: true,
      onEnter: function () { gsap.to(chars, { yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: .045 }); }
    });
  })();

  /* ---------------------------------------------------------------------
     Micro-interactions : boutons magnétiques + remplissage, curseur
     --------------------------------------------------------------------- */
  $$('.btn').forEach(function (b) {
    b.addEventListener('pointerenter', function (e) {
      var r = b.getBoundingClientRect();
      b.style.setProperty('--bx', ((e.clientX - r.left) / r.width * 100) + '%');
      b.style.setProperty('--by', ((e.clientY - r.top) / r.height * 100) + '%');
    });
    b.addEventListener('pointerleave', function (e) {
      var r = b.getBoundingClientRect();
      b.style.setProperty('--bx', ((e.clientX - r.left) / r.width * 100) + '%');
      b.style.setProperty('--by', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });

  if (motion && finePointer) {
    $$('[data-magnetic]').forEach(function (el) {
      var qx = gsap.quickTo(el, 'x', { duration: .5, ease: 'power3' }), qy = gsap.quickTo(el, 'y', { duration: .5, ease: 'power3' });
      var inside = false;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        qx((e.clientX - (r.left + r.width / 2)) * .32); qy((e.clientY - (r.top + r.height / 2)) * .4); inside = true;
      });
      el.addEventListener('pointerleave', function () {
        inside = false;
        gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.4)', overwrite: 'auto' });
      });
    });

    var cursor = $('.cursor');
    if (cursor) {
      root.classList.add('has-cursor');
      var labelEl = $('.cursor__label', cursor);
      gsap.set(cursor, { xPercent: 0, x: -100, y: -100 });
      var cx = gsap.quickTo(cursor, 'x', { duration: .4, ease: 'power3' }), cy = gsap.quickTo(cursor, 'y', { duration: .4, ease: 'power3' });
      window.addEventListener('pointermove', function (e) { cx(e.clientX); cy(e.clientY); });
      var curScale = 1;
      function setCursor(label, link) {
        var s = label ? 1.9 : link ? 1.45 : 1;
        if (s !== curScale) { curScale = s; gsap.to(cursor, { scale: s, duration: .5, ease: 'power3.out', overwrite: 'auto' }); }
        cursor.classList.toggle('is-label', !!label);
        cursor.classList.toggle('is-link', !label && link);
        if (label) labelEl.textContent = label;
      }
      document.addEventListener('pointerover', function (e) {
        var t = e.target;
        if (!t.closest) return;
        if (t.closest('.gi__btn')) return setCursor('Voir', false);
        if (t.closest('.car__viewport')) return setCursor('Glisser', false);
        if (t.closest('a, button, label, input, textarea, summary')) return setCursor('', true);
        setCursor('', false);
      });
      document.documentElement.addEventListener('mouseleave', function () { gsap.to(cursor, { opacity: 0, duration: .3 }); });
      document.documentElement.addEventListener('mouseenter', function () { gsap.to(cursor, { opacity: 1, duration: .3 }); });
    }
  }

  /* ---------------------------------------------------------------------
     Recalage final (polices + images chargées)
     --------------------------------------------------------------------- */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { ScrollTrigger.refresh(); }, 250); });

  /* Filet de sécurité : si quelque chose a bloqué le loader, on le retire */
  setTimeout(function () {
    var l = document.getElementById('loader');
    if (l) {
      l.remove(); if (lenis) lenis.start(); root.style.overflow = '';
      if (motion && !heroStarted) heroIntro();   // ne jamais laisser le hero invisible
      ScrollTrigger.refresh();
    }
  }, 12000);
})();
