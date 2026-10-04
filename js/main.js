/* Indah Permatasari — portfolio. GSAP + ScrollTrigger + Lenis, one easing curve throughout. */
(function () {
  'use strict';
  const D = window.INDAH, S = D.series, P = D.photos;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const root = document.documentElement, body = document.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isDesk = () => innerWidth > 860;
  const sMap = {}; S.forEach((s, i) => { s.i = i; s.count = P.filter(p => p.s === s.key).length; sMap[s.key] = s; });
  const pad2 = (n, l) => String(n).padStart(l || 2, '0');
  const code = p => sMap[p.s].code + '—' + pad2(p.n, 3);
  const thumb = p => 'img/thumb/' + p.id + '.webp', full = p => 'img/full/' + p.id + '.webp';

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });   // the address bar sliding away must not re-pin the reels
  gsap.defaults({ ease: 'expo.out', duration: 1 });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduce) {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const go = (target, opts) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, Object.assign({ duration: 1.6 }, opts)); else el.scrollIntoView();
  };

  /* ---------- text splitting ---------- */
  function splitChars(el) {
    const words = el.textContent.trim().split(/\s+/); el.textContent = '';
    words.forEach((w, i) => {
      const ws = document.createElement('span'); ws.style.cssText = 'display:inline-block;white-space:nowrap';
      Array.from(w).forEach(c => { const o = document.createElement('span'); o.className = 'ch'; const n = document.createElement('span'); n.textContent = c; o.appendChild(n); ws.appendChild(o); });
      el.appendChild(ws); if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return $$('.ch > span', el);
  }
  function splitLines(el) {
    const words = [];
    Array.from(el.childNodes).forEach(node => {
      const em = node.nodeType === 1;
      node.textContent.split(/\s+/).filter(Boolean).forEach(w => {
        const s = document.createElement(em ? 'em' : 'span'); s.style.display = 'inline-block'; s.textContent = w; words.push(s);
      });
    });
    el.textContent = ''; words.forEach(w => { el.appendChild(w); el.appendChild(document.createTextNode(' ')); });
    const rows = []; let left = Infinity;   // a new row starts where x jumps back (word heights differ, so tops are unreliable)
    words.forEach(w => { if (w.offsetLeft <= left) rows.push([]); left = w.offsetLeft; rows[rows.length - 1].push(w); });
    el.textContent = '';
    return rows.map(r => {
      const line = document.createElement('span'); line.className = 'line'; const inner = document.createElement('span');
      r.forEach((w, i) => { inner.appendChild(w); if (i < r.length - 1) inner.appendChild(document.createTextNode(' ')); });
      line.appendChild(inner); el.appendChild(line); return inner;
    });
  }

  /* ---------- depth parallax (WebGL) ---------- */
  function createGL(canvas) {
    let gl = null; try { gl = canvas.getContext('webgl', { antialias: false, alpha: false }); } catch (e) { }
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, [
      'precision mediump float;uniform sampler2D uImg,uDepth;uniform vec2 uOff,uCover,uPos;uniform float uT;varying vec2 v;',
      'void main(){',
      ' float zoom=.95-.006*sin(uT*.45);',
      ' vec2 uv=(v-.5)*uCover*zoom+uPos;',
      ' float d=texture2D(uDepth,uv).r;',
      ' vec3 c=texture2D(uImg,uv+uOff*(d-.42)).rgb;',
      ' float s=uv.x*.85+(1.-uv.y)*.3-(fract(uT*.085)*2.6-.7);',   // a soft band of light crossing the frame
      ' c+=c*exp(-s*s*30.)*.2*(.35+d);',
      ' gl_FragColor=vec4(c,1.);}'
    ].join('')));
    gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['uImg', 'uDepth', 'uOff', 'uCover', 'uPos', 'uT'].forEach(n => U[n] = gl.getUniformLocation(pr, n));
    gl.uniform1i(U.uImg, 0); gl.uniform1i(U.uDepth, 1);
    const tex = [gl.createTexture(), gl.createTexture()];
    const upload = (i, img) => {
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[i]);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    let ar = 1, ready = false;
    return {
      get ready() { return ready; },
      off() { ready = false; },
      set(img, depth) { try { upload(0, img); upload(1, depth); ar = img.naturalWidth / img.naturalHeight; ready = true; } catch (e) { ready = false; } return ready; },
      // focusY: which part of the picture stays in view when cropped, 0 = top, 1 = bottom
      draw(t, ox, oy, focusY) {
        if (!ready) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
        if (!w || !h) return;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        const ca = w / h, cx = ca > ar ? 1 : ca / ar, cy = ca > ar ? ar / ca : 1;
        gl.uniform2f(U.uCover, cx, cy);
        gl.uniform2f(U.uPos, .5, 1 - ((1 - cy) * (focusY == null ? .5 : focusY) + cy / 2));
        gl.uniform2f(U.uOff, ox, oy); gl.uniform1f(U.uT, t);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  }
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('mousemove', e => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });

  /* ---------- gallery markup ---------- */
  const seriesWrap = $('#series'), filter = $('.filter');
  $('[data-count]').textContent = P.length;
  filter.innerHTML = '<button class="is-on" data-f="all">Semua<sup>' + P.length + '</sup></button>' +
    S.map(s => '<button data-f="' + s.key + '">' + s.name + '<sup>' + s.count + '</sup></button>').join('');
  seriesWrap.innerHTML = S.map(s => {
    const cards = P.map((p, i) => p.s !== s.key ? '' :
      '<button class="card" data-i="' + i + '" style="--ar:' + (p.w / p.h).toFixed(4) + '" aria-label="' + s.name + ' ' + p.n + '">' +
      '<span class="card__frame"><img loading="lazy" decoding="async" src="' + thumb(p) + '" width="' + p.w + '" height="' + p.h + '" alt="Indah Permatasari, seri ' + s.name + ', foto ' + p.n + '"></span>' +
      '<span class="card__meta mono"><i>' + code(p) + '</i><i>' + (p.v ? 'Motion' : s.name) + '</i></span></button>').join('');
    return '<section class="series" id="s-' + s.key + '" data-key="' + s.key + '" data-bg="' + s.bg + '" data-fg="' + s.fg + '" data-glow="' + s.glow + '">' +
      '<div class="series__pin"><div class="series__in"><h3 class="series__title" aria-label="' + s.name + '">' + Array.from(s.name).map(c => '<span class="ch"><span>' + c + '</span></span>').join('') + '<sup>' + pad2(s.i + 1) + '</sup></h3>' +
      '<header class="series__head mono"><span>' + s.code + ' — ' + pad2(s.i + 1) + '/' + pad2(S.length) + '</span><span>' + s.note + '</span><span>' + s.count + ' foto</span></header>' +
      '<div class="series__view"><div class="series__track">' + cards + '</div></div>' +
      '<div class="series__bar"><i></i></div></div></div></section>';
  }).join('');
  $$('.card__frame img').forEach(img => { const on = () => img.classList.add('is-in'); if (img.complete && img.naturalWidth) on(); else img.addEventListener('load', on, { once: true }); });

  /* ---------- gallery: pinned horizontal reel with 3D tilt (all screen sizes) ---------- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1px)', () => {
    const undo = [];
    $$('.series').forEach(sec => {
      const track = $('.series__track', sec), cards = $$('.card', track).map(el => ({ el, img: $('img', el), frame: $('.card__frame', el), l: 0, w: 0 }));
      let vw = innerWidth;
      const measure = () => { vw = innerWidth; cards.forEach(c => { c.l = c.el.offsetLeft; c.w = c.el.offsetWidth; }); };
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      // tilted at the edges, flat in the middle
      const tilt = () => {
        const x = +gsap.getProperty(track, 'x') || 0;
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i], d = (c.l + c.w / 2 + x - vw / 2) / (vw / 2);
          if (d < -2.2 || d > 2.2) continue;
          const k = Math.max(-1.3, Math.min(1.3, d));
          // arriving from the right: the photo unrolls from the bottom and settles out of a push-in
          const r = d > .72 ? Math.max(0, Math.min(1, (1.32 - d) / .6)) : 1, e = 1 - (1 - r) * (1 - r);
          const y = (i % 2 ? 1 : -1) * k * 18 + (1 - e) * 70;
          c.el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,' + (-Math.abs(k) * 120).toFixed(1) + 'px) rotateY(' + (-k * 21).toFixed(2) + 'deg)';
          c.frame.style.clipPath = e < 1 ? 'inset(' + ((1 - e) * 100).toFixed(1) + '% 0 0 0)' : '';
          c.img.style.transform = 'translateX(' + (-k * 3.4).toFixed(2) + '%) scale(' + (1.12 + (1 - e) * .28).toFixed(3) + ')';
        }
      };
      measure();
      const pin = $('.series__pin', sec), s = sMap[sec.dataset.key];
      pin.style.background = 'radial-gradient(120% 90% at 82% 0%, color-mix(in srgb, ' + s.glow + ' 13%, ' + s.bg + '), ' + s.bg + ' 62%)';
      if (!reduce) gsap.to($('.series__in', sec), {
        scale: .9, yPercent: 24, opacity: .15, ease: 'none', transformOrigin: '50% 40%',
        scrollTrigger: { trigger: sec, start: 'bottom bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
      });
      gsap.timeline({
        defaults: { ease: 'none', duration: 1 },
        scrollTrigger: { trigger: sec, pin: $('.series__pin', sec), start: 'top top', end: () => '+=' + dist(), scrub: .8, invalidateOnRefresh: true, refreshPriority: 1, onRefresh: () => { measure(); tilt(); } }
      })
        .to(track, { x: () => -dist(), onUpdate: tilt }, 0)
        .fromTo($('.series__title', sec), { x: 0 }, { x: () => innerWidth * .07 }, 0)
        .to($('.series__bar i', sec), { scaleX: 1 }, 0);
      undo.push(() => { pin.style.background = ''; cards.forEach(c => { c.el.style.transform = ''; c.img.style.transform = ''; c.frame.style.clipPath = ''; }); });
    });
    return () => undo.forEach(f => f());
  });

  // entering a series: the title rises letter by letter, the details fade in, the reel opens like a curtain
  if (!reduce) $$('.series').forEach(sec => {
    const view = $('.series__view', sec);
    const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 58%', once: true } });
    tl.from($$('.series__title .ch > span', sec), { yPercent: 118, duration: 1.2, stagger: .045 }, 0)
      .from($$('.series__title sup, .series__head span', sec), { opacity: 0, y: 14, duration: 1, stagger: .08 }, .25);
    mm.add('(min-width: 1px)', () => {
      if (tl.progress() < 1) tl.fromTo(view, { clipPath: 'inset(100% 0% 0% 0%)', y: 90 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1.5, ease: 'expo.inOut', onComplete: () => gsap.set(view, { clearProps: 'clipPath,transform' }) }, .05);
      return () => gsap.set(view, { clearProps: 'clipPath,transform' });
    });
  });

  /* ---------- filter ---------- */
  function setFilter(key, scroll) {
    $$('button', filter).forEach(b => b.classList.toggle('is-on', b.dataset.f === key));
    $$('.series').forEach(s => s.classList.toggle('is-hidden', key !== 'all' && s.dataset.key !== key));
    ScrollTrigger.refresh();
    if (scroll !== false) requestAnimationFrame(() => go(key === 'all' ? '#s-' + S[0].key : '#s-' + key));
  }
  filter.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setFilter(b.dataset.f); });

  /* ---------- background follows the mood of each section ---------- */
  const theme = (bg, fg, glow) => gsap.to(root, { '--bg': bg, '--fg': fg, '--glow': glow || '#B9B2A6', duration: 1.1, ease: 'power2.out', overwrite: true });
  $$('[data-bg]').forEach(sec => ScrollTrigger.create({
    trigger: sec, start: 'top 55%', end: 'bottom 55%',
    onToggle: self => { if (self.isActive) theme(sec.dataset.bg, sec.dataset.fg, sec.dataset.glow); }
  }));

  /* ---------- 1. opener ---------- */
  const hero = $('.hero'), heroMedia = $('.hero__media'), heroZoom = $('.hero__zoom'), brand = $('.brand');
  const letters = $$('.brand__w').reduce((a, w) => a.concat(splitChars(w)), []);
  const B = { pad: 0, bigY: 0, midY: 0, navY: 0, navS: 1 };
  function fitText(el, width) { el.style.fontSize = '100px'; el.style.fontSize = (100 * width / el.offsetWidth).toFixed(2) + 'px'; }
  function layoutBrand() {
    const vw = root.clientWidth;
    B.pad = Math.min(56, Math.max(18, vw * .032));
    fitText(brand, vw - B.pad * 2);
    const f = parseFloat(brand.style.fontSize), h = brand.offsetHeight, vh = hero.offsetHeight;
    root.style.setProperty('--brand-h', h + 'px');
    B.bigY = vh - h - B.pad * .8; B.midY = (vh - h) / 2;
    B.navS = (isDesk() ? 15 : 11.5) / f; B.navY = isDesk() ? 29 : 20;
    fitText($('.bigname'), vw - B.pad * 2);
  }
  function brandScroll() {
    gsap.fromTo(brand, { x: () => B.pad, y: () => B.bigY, scale: 1 }, {
      x: () => B.pad, y: () => B.navY, scale: () => B.navS, ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: hero, start: 'top top', end: () => '+=' + hero.offsetHeight * .72, scrub: .6, invalidateOnRefresh: true, onLeave: () => brand.classList.add('is-docked'), onEnterBack: () => brand.classList.remove('is-docked') }
    });
    gsap.to(heroMedia, { scale: .9, yPercent: 7, opacity: .45, ease: 'none', transformOrigin: '50% 100%', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__meta, .hero__scroll', { opacity: 0, ease: 'none', immediateRender: false, scrollTrigger: { trigger: hero, start: 'top top', end: '+=30%', scrub: true } });
  }
  ScrollTrigger.addEventListener('refreshInit', layoutBrand);

  let heroGL = null, heroOn = true;
  ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: s => heroOn = s.isActive });
  function heroDepth() {
    if (reduce) return;
    const name = isDesk() ? 'hero' : 'hero_m', gl = createGL($('.hero__gl'));
    if (!gl) return;
    Promise.all([loadImg('img/' + name + '.webp'), loadImg('img/' + name + '-depth.jpg')]).then(r => {
      if (gl.set(r[0], r[1])) { heroGL = gl; gl.draw(0, 0, 0, .3); $('.hero__gl').classList.add('is-on'); }
    }).catch(() => { });
  }

  function intro() {
    layoutBrand();
    const show = ['.hero__meta', '.nav', '.hero__scroll'];
    const done = () => { body.classList.remove('is-loading'); if (lenis) lenis.start(); brandScroll(); ScrollTrigger.refresh(); };
    if (reduce) { $('.count').remove(); gsap.set(brand, { x: B.pad, y: B.bigY }); gsap.set(show, { opacity: 1 }); done(); return; }
    gsap.set(brand, { x: B.pad, y: B.midY }); gsap.set(letters, { yPercent: 112 });
    const cnt = $('.count'), n = { v: 0 };
    gsap.to(n, { v: 100, duration: 1.9, ease: 'power2.inOut', onUpdate: () => cnt.textContent = pad2(Math.round(n.v), 3) });
    gsap.to(cnt, { opacity: 0, y: -14, duration: .8, delay: 2.1, onComplete: () => cnt.remove() });
    gsap.timeline()
      .to(letters, { yPercent: 0, duration: 1.2, stagger: .04 }, .3)
      .fromTo(heroMedia, { clipPath: 'inset(44% 40% 44% 40%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.7, ease: 'expo.inOut' }, '>-.25')
      .fromTo(heroZoom, { scale: 1.3 }, { scale: 1.07, duration: 2.6 }, '<')
      .to(brand, { y: () => B.bigY, duration: 1.7, ease: 'expo.inOut' }, '<')
      .to(show, { opacity: 1, duration: 1.2, stagger: .08 }, '>-1.5')
      .add(done, '>-.7')
      .to(heroZoom, { scale: 1, duration: 9, ease: 'power1.out' }, '>-.2');
  }

  /* ---------- 2. about, 5. featured, 6. comp card, 7. collab ---------- */
  function sections() {
    $$('[data-lines]').forEach(el => {
      const lines = splitLines(el); if (reduce) return;
      gsap.from(lines, { yPercent: 108, duration: 1.1, stagger: .07, scrollTrigger: { trigger: el, start: 'top 88%' } });
    });
    $$('[data-chars]').forEach(el => {
      const ch = splitChars(el); if (reduce) return;
      if (el.classList.contains('bigname')) gsap.from(ch, { yPercent: 112, ease: 'power3.out', stagger: .06, scrollTrigger: { trigger: el, start: 'top 96%', end: 'max', scrub: .5 } });
      else gsap.from(ch, { yPercent: 112, duration: 1.2, stagger: .035, scrollTrigger: { trigger: el, start: 'top 85%' } });
    });
    if (reduce) return;
    gsap.fromTo('.about__clip', { clipPath: 'inset(0% 50% 0% 50%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', scrollTrigger: { trigger: '.about__photo', start: 'top 72%' } });
    gsap.fromTo('.about__clip img', { yPercent: -13 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.facts > div', { opacity: 0, y: 22, stagger: .06, scrollTrigger: { trigger: '.facts', start: 'top 88%' } });
    gsap.from('.gintro__row > *', { opacity: 0, y: 22, stagger: .1, scrollTrigger: { trigger: '.gintro__row', start: 'top 92%' } });

    const cover = { trigger: '.cover', start: 'top 74%' };
    gsap.fromTo('.cover__img', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', scrollTrigger: cover });
    gsap.to('.cover__img img', { scale: 1, duration: 2.2, scrollTrigger: cover });
    gsap.from('.cover__lines, .cover__foot', { opacity: 0, y: 18, duration: 1.2, stagger: .1, delay: .7, scrollTrigger: cover });

    // four photos dealt like cards, then the measurements
    gsap.from('.deal', { x: () => innerWidth * .7, y: 90, rotation: i => 10 + i * 5, duration: 1.3, stagger: .13, scrollTrigger: { trigger: '.comp__cards', start: 'top 78%' } });
    gsap.from('.sizes > div', { opacity: 0, y: 22, stagger: .05, delay: .5, scrollTrigger: { trigger: '.comp__cards', start: 'top 55%' } });
    gsap.from('.cta', { opacity: 0, y: 26, stagger: .09, scrollTrigger: { trigger: '.collab__links', start: 'top 88%' } });
  }

  /* ---------- 4. click a photo: it grows to the centre and comes alive ---------- */
  const lb = { el: $('.lb'), bg: $('.lb__bg'), stage: $('.lb__stage'), img: $('.lb__img'), cv: $('.lb__gl'), video: $('.lb__video'), on: false, i: -1, from: null, token: 0, gl: null };
  const lbUI = ['.lb__cap', '.lb__close', '.lb__nav'];
  function target(p) {
    const mw = innerWidth * (isDesk() ? .84 : .94), mh = innerHeight * (isDesk() ? .8 : .7), s = Math.min(mw / p.w, mh / p.h);
    return { left: (innerWidth - p.w * s) / 2, top: (innerHeight - p.h * s) / 2 - 6, width: p.w * s, height: p.h * s };
  }
  function caption(p) {
    $('.lb__code').textContent = code(p); $('.lb__name').textContent = sMap[p.s].name + (p.v ? ' · Motion' : '');
    $('.lb__num').textContent = pad2(p.n) + ' / ' + pad2(sMap[p.s].count);
  }
  function still() { lb.cv.classList.remove('is-on'); lb.video.classList.remove('is-on'); lb.img.classList.remove('is-drift'); lb.video.pause(); if (lb.gl) lb.gl.off(); }
  function load(i) {
    const p = P[i], t = ++lb.token; still(); lb.img.src = thumb(p); caption(p);
    loadImg(full(p)).then(big => {
      if (t !== lb.token) return; lb.img.src = big.src;
      if (p.v) {   // an After Effects clip exists for this photo: clips/<id>.mp4
        lb.video.src = 'clips/' + p.id + '.mp4';
        lb.video.oncanplay = () => { if (t === lb.token) { lb.video.classList.add('is-on'); lb.video.play().catch(() => { }); } };
        return;
      }
      if (reduce) return;
      if (!lb.gl) lb.gl = createGL(lb.cv);
      if (!lb.gl) { lb.img.classList.add('is-drift'); return; }
      loadImg('img/depth/' + p.id + '.jpg').then(depth => {
        if (t !== lb.token) return;
        if (lb.gl.set(big, depth)) { lb.gl.draw(performance.now() / 1000, 0, 0); lb.cv.classList.add('is-on'); } else lb.img.classList.add('is-drift');
      }).catch(() => lb.img.classList.add('is-drift'));
    }).catch(() => { });
  }
  function openLB(i, from) {
    if (lb.on || i < 0) return;
    lb.on = true; lb.i = i; lb.from = from || null; if (lenis) lenis.stop();
    lb.el.classList.add('is-open'); lb.el.setAttribute('aria-hidden', 'false');
    const t = target(P[i]), r = from ? from.getBoundingClientRect() : null;
    gsap.set(lb.stage, r ? { left: r.left, top: r.top, width: r.width, height: r.height, opacity: 1 } : Object.assign({ opacity: 0 }, t));
    if (from) from.style.visibility = 'hidden';
    load(i);
    gsap.to(lb.bg, { opacity: 1, duration: .9 });
    gsap.to(lb.stage, Object.assign({ opacity: 1, duration: reduce ? 0 : 1.1, overwrite: true }, t));
    gsap.to(lbUI, { opacity: 1, duration: .8, delay: .35 });
  }
  function closeLB() {
    if (!lb.on) return; lb.on = false; lb.token++; still();
    const card = $('.card[data-i="' + lb.i + '"] .card__frame'), back = lb.from || card;
    let r = back ? back.getBoundingClientRect() : null;
    if (r && (r.width < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth)) r = null;
    gsap.to(lbUI, { opacity: 0, duration: .3, overwrite: true });
    gsap.to(lb.bg, { opacity: 0, duration: .8 });
    gsap.to(lb.stage, Object.assign({ duration: reduce ? 0 : .9, overwrite: true, onComplete: () => {
      lb.el.classList.remove('is-open'); lb.el.setAttribute('aria-hidden', 'true');
      if (lb.from) lb.from.style.visibility = ''; lb.from = null; lb.img.removeAttribute('src'); if (lenis) lenis.start();
    } }, r ? { left: r.left, top: r.top, width: r.width, height: r.height } : { opacity: 0 }));
  }
  function step(dir) {
    if (!lb.on) return;
    if (lb.from) { lb.from.style.visibility = ''; lb.from = null; }
    lb.i = (lb.i + dir + P.length) % P.length; lb.token++; still();
    gsap.to(lb.stage, { opacity: 0, x: -dir * 40, duration: .3, ease: 'power2.in', overwrite: true, onComplete: () => {
      gsap.set(lb.stage, Object.assign({ x: dir * 40 }, target(P[lb.i]))); load(lb.i);
      gsap.to(lb.stage, { opacity: 1, x: 0, duration: .9 });
    } });
  }
  document.addEventListener('click', e => {
    let card = e.target.closest('.card');
    const track = !card && !e.target.closest('a, button') && e.target.closest('.series');
    // inside the 3D reel a press and release can resolve to the track or the section behind the cards, so fall back to the pointer position
    if (track) card = $$('.card', track).find(c => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
    if (card) return openLB(+card.dataset.i, $('.card__frame', card));
    const o = e.target.closest('[data-open]');
    if (o) return openLB(P.findIndex(p => p.id === o.dataset.open), o.classList.contains('cover') ? null : $('img', o));
    const a = e.target.closest('a[href^="#"]');
    if (a) {
      e.preventDefault(); const el = $(a.getAttribute('href'));
      if (el && el.classList.contains('is-hidden')) setFilter('all', false);
      go(a.getAttribute('href') === '#top' ? body : el);
    }
  });
  lb.bg.addEventListener('click', closeLB); $('.lb__close').addEventListener('click', closeLB);
  $('.lb__prev').addEventListener('click', () => step(-1)); $('.lb__next').addEventListener('click', () => step(1));
  addEventListener('keydown', e => { if (!lb.on) return; if (e.key === 'Escape') closeLB(); if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); });
  let tx = 0, ty = 0;
  lb.el.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  lb.el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1); else if (dy > 90) closeLB();
  }, { passive: true });
  addEventListener('resize', () => { if (lb.on) gsap.set(lb.stage, target(P[lb.i])); });

  /* ---------- one loop for both canvases ---------- */
  gsap.ticker.add(time => {
    mouse.sx += (mouse.x - mouse.sx) * .06; mouse.sy += (mouse.y - mouse.sy) * .06;
    const mx = fine ? mouse.sx : 0, my = fine ? mouse.sy : 0, a = fine ? 1 : 2.2;   // no pointer on phones: let it drift on its own
    if (lb.on) { if (lb.gl && lb.gl.ready) lb.gl.draw(time, mx * .03 + Math.sin(time * .55) * .007 * a, -my * .02 + Math.cos(time * .43) * .005 * a); }
    else if (heroGL && heroOn) heroGL.draw(time, mx * .022 + Math.sin(time * .4) * .005 * a, -my * .014 + Math.cos(time * .33) * .004 * a, .3);
  });

  /* ---------- cursor: dot + trailing ring, glass badge with turning text over photos ---------- */
  if (fine) {
    const dot = $('.cur-dot'), ring = $('.cur-ring'), aura = $('.aura');
    const dx = gsap.quickTo(dot, 'x', { duration: .12, ease: 'power3.out' }), dy = gsap.quickTo(dot, 'y', { duration: .12, ease: 'power3.out' });
    const rx = gsap.quickTo(ring, 'x', { duration: .6, ease: 'expo.out' }), ry = gsap.quickTo(ring, 'y', { duration: .6, ease: 'expo.out' });
    const ax = gsap.quickTo(aura, 'x', { duration: 2.4, ease: 'power3.out' }), ay = gsap.quickTo(aura, 'y', { duration: 2.4, ease: 'power3.out' });
    addEventListener('mousemove', e => { body.classList.add('is-cur'); dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); ax(e.clientX); ay(e.clientY); }, { passive: true });
    document.addEventListener('mouseleave', () => body.classList.remove('is-cur'));
    document.addEventListener('mouseover', e => {
      const t = e.target.closest ? e.target : null; if (!t) return;
      const big = !lb.on && t.closest('.card, .cover, .deal');
      body.classList.toggle('cur-big', !!big); body.classList.toggle('cur-link', !big && !!t.closest('a, button'));
    });
    // comp cards and the cover lean toward the pointer
    $$('.deal, .cover').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        gsap.to(el, { rotationY: px * 11, rotationX: -py * 9, transformPerspective: 1100, duration: .9, overwrite: 'auto' });
      });
      el.addEventListener('mouseleave', () => gsap.to(el, { rotationY: 0, rotationX: 0, duration: 1.2, overwrite: 'auto' }));
    });
  }

  /* ---------- marquees and reel react to scroll speed ---------- */
  if (!reduce) {
    const marqs = $$('.marq__in').map(el => ({ el, x: 0, half: 0, dir: el.parentNode.classList.contains('marq--rev') ? 1 : -1 }));
    const sizeMarq = () => marqs.forEach(m => m.half = m.el.scrollWidth / 2);
    sizeMarq(); ScrollTrigger.addEventListener('refresh', sizeMarq);
    const tracks = $$('.series__track'); let skew = 0;
    gsap.ticker.add((t, dt) => {
      const v = lenis ? lenis.velocity : 0, f = Math.min(dt, 50) / 16.7;
      marqs.forEach(m => {
        if (!m.half) return;
        m.x += m.dir * (1.1 + Math.abs(v) * .35) * f * (v < -1 ? -1 : 1);
        if (m.x <= -m.half) m.x += m.half; if (m.x > 0) m.x -= m.half;
        m.el.style.transform = 'translate3d(' + m.x.toFixed(1) + 'px,0,0)';
      });
      const target = Math.max(-7, Math.min(7, v * .09));
      if (Math.abs(target - skew) > .01) { skew += (target - skew) * .12; tracks.forEach(tr => gsap.set(tr, { skewX: -skew })); }
    });
  }

  /* ---------- start ---------- */
  const heroImg = $('.hero__img');
  const ready = Promise.all([
    document.fonts ? document.fonts.ready : 0,
    heroImg.complete ? 0 : new Promise(r => { heroImg.onload = heroImg.onerror = r; })
  ]);
  Promise.race([ready, new Promise(r => setTimeout(r, 3500))]).then(() => { sections(); intro(); heroDepth(); });
})();
