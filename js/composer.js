/* ==========================================================================
   Couleur Cadre — « Dessinez votre cadre » : simulateur moulure + passe-partout
   Les joints d'onglet sont obtenus avec des bordures CSS de 4 teintes (haut, droite, bas, gauche).
   ========================================================================== */
(function () {
  'use strict';
  var fp = document.getElementById('fp');
  if (!fp) return;

  // couleurs de moulure : [haut, droite, bas, gauche]
  var MOULURES = [
    { id: 'chene',  label: 'Chêne naturel', c: ['#e0bd86', '#bd9760', '#9f7a47', '#cfa970'], sw: '#c9a46c' },
    { id: 'noir',   label: 'Noir laqué',    c: ['#2c2724', '#16110f', '#0c0a08', '#201c19'], sw: '#1d1a17' },
    { id: 'blanc',  label: 'Blanc',         c: ['#fbfaf7', '#e4e0d8', '#d3cec4', '#f1eee8'], sw: '#efece6' },
    { id: 'dore',   label: 'Doré vieilli',  c: ['#ecd186', '#b88f3d', '#8a6823', '#d9b45e'], sw: '#c9a24c' },
    { id: 'noyer',  label: 'Noyer',         c: ['#7d5539', '#573820', '#3d2514', '#6b462c'], sw: '#5f3f26' },
    { id: 'bleu',   label: 'Bleu nuit',     c: ['#3d5d8a', '#213f66', '#162b48', '#2d4c77'], sw: '#26446c' }
  ];
  var MATS = [
    { id: 'ivoire',    label: 'Ivoire',      c: '#F1EAD9' },
    { id: 'blanc',     label: 'Blanc',       c: '#FBFAF6' },
    { id: 'noir',      label: 'Noir',        c: '#1b1816' },
    { id: 'bleu',      label: 'Bleu encre',  c: '#22407A' },
    { id: 'mandarine', label: 'Mandarine',   c: '#D9692D' },
    { id: 'rose',      label: 'Rose poudré', c: '#CB7C8A' },
    { id: 'sauge',     label: 'Sauge',       c: '#A9B79A' },
    { id: 'none',      label: 'Aucun',       c: null }
  ];
  var WIDTHS = [
    { id: 'fin',   label: 'Fin',   v: '1.1em', phrase: 'largeur fine' },
    { id: 'moyen', label: 'Moyen', v: '2.3em', phrase: 'largeur moyenne' },
    { id: 'large', label: 'Large', v: '3.8em', phrase: 'grande largeur' }
  ];

  var state = { moulure: 'chene', mat: 'ivoire', width: 'moyen', float: false };
  var $ = function (s, c) { return (c || document).querySelector(s); };

  function mixWhite(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function m(v) { return Math.round(v + (255 - v) * k); }
    return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
  }

  function swatch(group, item, checked, colorStyle) {
    var label = document.createElement('label');
    label.className = 'sw-i';
    var input = document.createElement('input');
    input.type = 'radio'; input.name = group; input.value = item.id; input.checked = checked;
    var span = document.createElement('span');
    if (colorStyle) {
      var i = document.createElement('i');
      if (colorStyle === 'none') { i.style.background = 'repeating-linear-gradient(45deg,transparent 0 4px,rgba(243,236,224,.5) 4px 5px)'; }
      else i.style.setProperty('--sw', colorStyle);
      span.appendChild(i);
    }
    span.appendChild(document.createTextNode(item.label));
    label.appendChild(input); label.appendChild(span);
    return label;
  }

  var gM = $('[data-group="moulure"]'), gT = $('[data-group="mat"]'), gW = $('[data-group="width"]');
  MOULURES.forEach(function (m) { gM.appendChild(swatch('moulure', m, m.id === state.moulure, m.sw)); });
  MATS.forEach(function (m) { gT.appendChild(swatch('mat', m, m.id === state.mat, m.c || 'none')); });
  WIDTHS.forEach(function (w) { gW.appendChild(swatch('width', w, w.id === state.width, null)); });

  var caption = document.getElementById('fp-caption');
  var floatBox = document.getElementById('fp-float');

  function find(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }

  function describe() {
    var m = find(MOULURES, state.moulure), t = find(MATS, state.mat), w = find(WIDTHS, state.width);
    if (state.float) return m.label + ' · caisse américaine';
    if (!t.c) return m.label + ' · sans passe-partout';
    return m.label + ' · passe-partout ' + t.label.toLowerCase() + ' · ' + w.phrase;
  }

  function apply() {
    var m = find(MOULURES, state.moulure), t = find(MATS, state.mat), w = find(WIDTHS, state.width);
    var s = fp.style;
    s.setProperty('--mt', m.c[0]); s.setProperty('--mr', m.c[1]); s.setProperty('--mb', m.c[2]); s.setProperty('--ml', m.c[3]);
    var matc = t.c || '#F1EAD9';
    s.setProperty('--matc', matc);
    s.setProperty('--bevel', mixWhite(matc, .55));
    s.setProperty('--mat', t.c ? w.v : '0em');
    fp.classList.toggle('is-float', state.float);
    fp.classList.toggle('no-mat', !t.c && !state.float);
    var art = fp.querySelector('.fp__art');
    art.style.outlineWidth = (!t.c && !state.float) ? '0' : '';
    caption.textContent = describe();
    // la largeur n'a de sens qu'avec un passe-partout
    gW.style.opacity = (state.float || !t.c) ? .35 : 1;
  }

  document.getElementById('fp-form').addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'moulure' || t.name === 'mat' || t.name === 'width') state[t.name] = t.value;
    if (t.id === 'fp-float') state.float = t.checked;
    apply();
    if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.gsap.fromTo(fp, { scale: .985 }, { scale: 1, duration: .8, ease: 'elastic.out(1,.5)', overwrite: true });
    }
  });

  function check(name, value) {
    var r = document.querySelector('#fp-form input[name="' + name + '"][value="' + value + '"]');
    if (r) r.checked = true;
  }
  document.getElementById('fp-random').addEventListener('click', function () {
    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
    var prev = describe(), tries = 0;
    do {
      state.moulure = pick(MOULURES).id;
      state.mat = pick(MATS).id;
      state.width = pick(WIDTHS).id;
      state.float = Math.random() < .2;
      tries++;
    } while (describe() === prev && tries < 6);
    check('moulure', state.moulure); check('mat', state.mat); check('width', state.width);
    floatBox.checked = state.float;
    apply();
    if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.gsap.fromTo(fp, { rotation: -1.6, y: -8 }, { rotation: 0, y: 0, duration: 1.2, ease: 'elastic.out(1,.35)', overwrite: true });
    }
  });

  document.getElementById('fp-send').addEventListener('click', function () {
    document.dispatchEvent(new CustomEvent('cc:frame', { detail: describe() }));
    document.dispatchEvent(new CustomEvent('cc:service', { detail: 'conseil' }));
    if (window.CC && window.CC.goto) window.CC.goto('#reserver'); else location.hash = '#reserver';
  });

  apply();
})();
