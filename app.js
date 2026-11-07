'use strict';
(() => {
/* =====================================================================
   helpers
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const rand = n => Math.floor(Math.random() * n);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4.5"/><g fill="currentColor" stroke="none"><circle cx="8.5" cy="8.5" r="1.3"/><circle cx="15.5" cy="8.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="8.5" cy="15.5" r="1.3"/><circle cx="15.5" cy="15.5" r="1.3"/></g>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  heart: '<path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5c0 6.1-8 11-8 11z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  expand: '<path d="M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  x: '<path d="M5 5l14 14M19 5 5 19"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  more: '<g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></g>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  import: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 20h16"/>',
  logo: '<rect x="3" y="4" width="18" height="16" rx="4"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5.5-5 4 3.5 3-2.5L21 17"/>'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

/* =====================================================================
   filename parsing  (title + #hashtags + trailing length like "8m")
   ===================================================================== */
const TAG_RE = /#[\p{L}\p{N}_]+/gu;
const RICH_RE = /#[\p{L}\p{N}_]+|@\w+|https?:\/\/\S+/gu;
const LEN_RE = /(?:^|\s)((?:\d+h)?(?:\d+m)?(?:\d+s)?)$/;

function parseName(name) {
  let base = name.replace(/\.[A-Za-z0-9]{2,5}$/, '').replace(/\s\(\d+\)$/, '').trim();
  let lenSec = null;
  const m = base.match(LEN_RE);
  if (m && m[1]) {
    const h = /(\d+)h/.exec(m[1]), mi = /(\d+)m/.exec(m[1]), s = /(\d+)s/.exec(m[1]);
    lenSec = (h ? +h[1] * 3600 : 0) + (mi ? +mi[1] * 60 : 0) + (s ? +s[1] : 0);
    base = base.slice(0, m.index).trim();
  }
  const tags = [...new Set((base.match(TAG_RE) || []).map(t => t.toLowerCase()))];
  const looksTweet = /[\s#@]/.test(base) && !/^(IMG|VID|PXL|MVIMG|Screenshot|Screen Shot|WhatsApp)[-_ ]?/i.test(base);
  const text = looksTweet
    ? base.replace(/ {3,}/g, '\n').replace(/[^\S\n]+/g, ' ').split('\n').map(l => l.trim()).filter(Boolean).join('\n')
    : '';
  return { text, tags, lenSec, hasText: looksTweet && text.length > 0 };
}

function richText(t) {
  return esc(t).replace(RICH_RE, m => m[0] === '#'
    ? `<a class="tag" data-tag="${m.toLowerCase()}">${m}</a>`
    : `<span class="lnk">${m}</span>`);
}

function ago(sec) {
  const d = Date.now() / 1000 - sec;
  if (d < 60) return 'now';
  if (d < 3600) return Math.floor(d / 60) + 'm';
  if (d < 86400) return Math.floor(d / 3600) + 'h';
  const dt = new Date(sec * 1000);
  const same = dt.getFullYear() === new Date().getFullYear();
  return dt.toLocaleDateString('en', same ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDur(it) {
  const s = it.dur || it.lenSec;
  if (!s) return it.lenSec === 0 ? '<1m' : '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
function fmtSize(b) {
  if (!b) return '';
  if (b < 1048576) return Math.max(1, Math.round(b / 1024)) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
const hueOf = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) % 360; return h; };
const gradOf = s => { const h = hueOf(s); return `linear-gradient(135deg,hsl(${h},65%,48%),hsl(${(h + 50) % 360},65%,34%))`; };

/* =====================================================================
   state + persistence
   ===================================================================== */
const Cap = window.Capacitor;
const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const Native = isNative ? (Cap.registerPlugin ? Cap.registerPlugin('MediaLibrary') : (Cap.Plugins || {}).MediaLibrary) : null;

const S = {
  items: [], byKey: new Map(), tagCounts: new Map(), folders: [],
  likes: new Set(), albums: [],
  settings: { blur: false, autoplay: true, onlyTitled: false, sort: 'new', syncFavs: false },
  favSeen: new Set(),
  tab: 'home', kind: 'all', query: '', loaded: false, error: null,
  scroll: {}, pages: []
};
const R = { scope: 'all', type: 'all', seen: new Set(), history: [], current: null, spinning: false };

function loadState() {
  try {
    const st = JSON.parse(localStorage.getItem('tg1') || '{}');
    S.likes = new Set(st.likes || []);
    S.favSeen = new Set(st.favSeen || []);
    S.albums = (st.albums || []).map(a => ({ ...a, items: new Set(a.items || []), ex: new Set(a.ex || []) }));
    Object.assign(S.settings, st.settings || {});
    R.scope = st.scope || 'all'; R.type = st.type || 'all';
  } catch (e) { /* storage unavailable */ }
}
const saveState = debounce(() => {
  try {
    localStorage.setItem('tg1', JSON.stringify({
      likes: [...S.likes], favSeen: [...S.favSeen],
      albums: S.albums.map(a => ({ ...a, items: [...a.items], ex: [...a.ex] })),
      settings: S.settings, scope: R.scope, type: R.type
    }));
  } catch (e) { /* ignore */ }
}, 250);

/* =====================================================================
   library
   ===================================================================== */
function buildItem(r) {
  const p = parseName(r.n);
  const rel = r.r || '';
  const folder = r.f || rel.split('/').filter(Boolean).pop() || 'Gallery';
  const kind = r.m === 'image/gif' ? 'gif' : (r.k === 'v' ? 'video' : 'image');
  return {
    key: rel + r.n, id: r.id, k: r.k, fav: !!r.v, name: r.n, rel, folder, kind,
    url: r.url || `/_media/o/${r.k}/${r.id}`,
    thumb: r.thumb || `/_media/t/${r.k}/${r.id}`,
    dur: Math.round((r.d || 0) / 1000), added: r.a || 0, size: r.s || 0, w: r.w || 0, h: r.h || 0,
    text: p.text, tags: p.tags, hasText: p.hasText, lenSec: p.lenSec
  };
}

async function scan() {
  S.error = null;
  try {
    let raws;
    if (Native) raws = (await Native.getMedia()).items || [];
    else if (window.DEMO) raws = window.DEMO.items;
    else raws = [];
    S.items = raws.map(buildItem).sort((a, b) => b.added - a.added);
    S.byKey = new Map(S.items.map(it => [it.key, it]));
    const tc = new Map(), fc = new Map();
    for (const it of S.items) {
      for (const t of it.tags) tc.set(t, (tc.get(t) || 0) + 1);
      const f = fc.get(it.rel) || { rel: it.rel, name: it.folder, count: 0 };
      f.count++; fc.set(it.rel, f);
    }
    S.tagCounts = tc;
    S.folders = [...fc.values()].filter(f => !f.name.startsWith('.')).sort((a, b) => b.count - a.count);
    for (const a of S.albums) syncAlbum(a);
    if (S.settings.syncFavs) importFavs(false);
    S.loaded = true;
    saveState();
    prewarm();
  } catch (e) {
    S.error = String((e && e.message) || e);
    S.loaded = true;
  }
}

/* Samsung/Google Gallery "favorites" -> Liked. force=false only takes favorites not imported before. */
function importFavs(force) {
  let added = 0;
  for (const it of S.items) {
    if (!it.fav) continue;
    if (!force && S.favSeen.has(it.key)) continue;
    S.favSeen.add(it.key);
    if (!S.likes.has(it.key)) { S.likes.add(it.key); added++; }
  }
  return added;
}
/* ask the phone to build thumbnails in the background so scrolling never waits for them */
function prewarm() {
  if (!Native || !Native.prewarm) return;
  try { Native.prewarm({ items: S.items.slice(0, 1200).map(it => it.k + ':' + it.id) }).catch(() => {}); } catch (e) { /* ignore */ }
}

function syncAlbum(a) {
  if (!a.src) return 0;
  let added = 0;
  for (const it of S.items) {
    if (it.rel === a.src.rel && !a.items.has(it.key) && !a.ex.has(it.key)) { a.items.add(it.key); added++; }
  }
  return added;
}

const albumsOf = key => S.albums.filter(a => a.items.has(key));
const uid = () => Math.random().toString(36).slice(2, 9);

function itemsFor(o = {}) {
  let arr = S.items;
  if (o.album) arr = arr.filter(it => o.album.items.has(it.key));
  if (o.likes) arr = arr.filter(it => S.likes.has(it.key));
  if (o.folder != null) arr = arr.filter(it => it.rel === o.folder);
  if (o.kind && o.kind !== 'all') arr = arr.filter(it => it.kind === o.kind);
  if (o.tag) arr = arr.filter(it => it.tags.includes(o.tag));
  if (o.query) {
    const q = o.query.toLowerCase();
    arr = arr.filter(it => it.name.toLowerCase().includes(q) || it.folder.toLowerCase().includes(q));
  }
  if (o.titledOnly) arr = arr.filter(it => it.hasText);
  return S.settings.sort === 'old' ? arr.slice().reverse() : arr;
}
const mainOpts = o => ({ titledOnly: S.settings.onlyTitled, ...o });

/* =====================================================================
   overlays (back button support), sheets, toast
   ===================================================================== */
const ovStack = [];
history.replaceState({ ov: 0 }, '');
function pushOv(closeFn) { ovStack.push(closeFn); history.pushState({ ov: ovStack.length }, ''); }
const back = () => history.back();
window.addEventListener('popstate', e => {
  const target = (e.state && e.state.ov) || 0;
  while (ovStack.length > target) { const f = ovStack.pop(); try { f(); } catch (err) { /* ignore */ } }
});
function closeAllOverlays() { if (ovStack.length) history.go(-ovStack.length); }

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

function openSheet(html, onMount) {
  const bd = document.createElement('div');
  bd.className = 'backdrop';
  bd.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`;
  $('#sheets').appendChild(bd);
  const close = () => bd.remove();
  bd.addEventListener('click', e => { if (e.target === bd) back(); });
  pushOv(close);
  if (onMount) onMount($('.sheet', bd), bd);
  return bd;
}
function askText(title, def = '', ok = 'Save') {
  return new Promise(res => {
    let done = false;
    const bd = openSheet(`<h3>${esc(title)}</h3><input class="field" maxlength="60" value="${esc(def)}"><button class="btn blue" data-ok>${esc(ok)}</button>`, (sh) => {
      const inp = $('input', sh);
      setTimeout(() => { inp.focus(); inp.select(); }, 120);
      const go = () => { const v = inp.value.trim(); if (!v) return; done = true; back(); res(v); };
      $('[data-ok]', sh).onclick = go;
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
    const obs = new MutationObserver(() => { if (!bd.isConnected) { obs.disconnect(); if (!done) res(null); } });
    obs.observe($('#sheets'), { childList: true });
  });
}

/* =====================================================================
   media loading (lazy), autoplay, posts
   ===================================================================== */
let activeVid = null;
const loadIO = new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? attach(e.target) : detach(e.target))), { rootMargin: '2500px 0px' });
/* a video only starts once it has stayed on screen for a moment, so flicking past never spins up decoders */
const playIO = new IntersectionObserver(es => es.forEach(e => {
  const m = e.target;
  clearTimeout(m._pt);
  if (e.intersectionRatio >= 0.6 && S.settings.autoplay) m._pt = setTimeout(() => play(m), 160);
  else stopMedia(m);
}), { threshold: [0, 0.6] });

function attach(m) {
  if (m._img) return;
  const it = S.byKey.get(m.dataset.key); if (!it) return;
  const img = new Image();
  img.decoding = 'async'; img.alt = '';
  img.onerror = () => { if (!img._fb) { img._fb = true; img.src = it.url; } };
  img.src = it.thumb;
  m.insertBefore(img, m.firstChild);
  m._img = img;
}
function detach(m) {
  stopMedia(m);
  if (m._img) { m._img.remove(); m._img = null; }
}
function play(m) {
  const it = S.byKey.get(m.dataset.key);
  if (!it || it.kind === 'image' || !m._img) return;
  if (it.kind === 'gif') { if (!m._gif) { m._gif = true; m._img.src = it.url; } return; }
  if (m._vid) return;
  if (activeVid && activeVid !== m) stopMedia(activeVid);
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
  v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  v.src = it.url;
  v.addEventListener('playing', () => m.classList.add('playing'));
  m.appendChild(v); m._vid = v; activeVid = m;
  const p = v.play(); if (p && p.catch) p.catch(() => {});
}
function stopMedia(m) {
  clearTimeout(m._pt);
  if (m._vid) {
    const v = m._vid; v.pause(); v.removeAttribute('src'); v.load(); v.remove();
    m._vid = null; m.classList.remove('playing');
    if (activeVid === m) activeVid = null;
  }
  if (m._gif) { m._gif = false; const it = S.byKey.get(m.dataset.key); if (it && m._img) m._img.src = it.thumb; }
}
function observeMedia(m) { loadIO.observe(m); playIO.observe(m); }
function unobserveAll(host) {
  $$('.media', host).forEach(m => { loadIO.unobserve(m); playIO.unobserve(m); stopMedia(m); });
}

function postEl(it) {
  const el = document.createElement('article');
  el.className = 'post'; el.dataset.key = it.key;
  const ratio = clamp(it.w && it.h ? it.w / it.h : 1, 0.72, 1.9).toFixed(3);
  const dur = it.kind === 'video' ? fmtDur(it) : '';
  const badge = it.kind === 'video' ? `<div class="badge">${ic('play')}${esc(dur)}</div>` : (it.kind === 'gif' ? '<div class="badge">GIF</div>' : '');
  const hint = it.kind === 'video' ? `<div class="playhint"><span>${ic('play')}</span></div>` : '';
  el.innerHTML = `
    <div class="avatar" style="background:${gradOf(it.folder)}">${esc(Array.from(it.folder)[0] || 'G')}</div>
    <div class="body">
      <div class="head"><span class="name">${esc(it.folder)}</span><span class="handle">@${esc(it.folder.toLowerCase().replace(/\s+/g, ''))}</span><span>·</span><span>${ago(it.added)}</span>
        <button class="more" data-act="more" aria-label="More">${ic('more')}</button></div>
      ${it.hasText ? `<div class="text" dir="auto">${richText(it.text)}</div>` : ''}
      <div class="media" data-act="open" data-key="${esc(it.key)}" style="aspect-ratio:${ratio}">${badge}${hint}</div>
      <div class="pills"></div>
      <div class="actions">
        <button class="act" data-act="open" aria-label="Open">${ic('expand')}<span>${esc(fmtSize(it.size))}</span></button>
        <button class="act" data-act="like" aria-label="Like">${ic('heart')}</button>
        <button class="act" data-act="album" aria-label="Albums">${ic('bookmark')}<span class="cnt"></span></button>
      </div>
    </div>`;
  paintPost(el, it);
  observeMedia($('.media', el));
  return el;
}
function paintPost(el, it) {
  const liked = S.likes.has(it.key), al = albumsOf(it.key);
  $('[data-act=like]', el).classList.toggle('liked', liked);
  const b = $('[data-act=album]', el);
  b.classList.toggle('saved', al.length > 0);
  $('.cnt', b).textContent = al.length || '';
  $('.pills', el).innerHTML = al.map(a => `<button class="pill" data-album="${a.id}">${ic('folder')}${esc(a.name)}</button>`).join('');
}
function refreshPost(key) {
  const it = S.byKey.get(key); if (!it) return;
  $$('.post').filter(p => p.dataset.key === key).forEach(p => paintPost(p, it));
  paintViewerButtons();
}

function clearFeed(host) { unobserveAll(host); if (host._io) { host._io.disconnect(); host._io = null; } }
function mountFeed(host, list, emptyHTML) {
  clearFeed(host);
  host.innerHTML = '';
  host._list = list;
  if (!list.length) { host.innerHTML = emptyHTML || '<div class="empty"><h2>Nothing here</h2>No posts to show.</div>'; return; }
  let i = 0;
  const sentinel = document.createElement('div'); sentinel.className = 'sentinel';
  host.appendChild(sentinel);
  const more = () => {
    const frag = document.createDocumentFragment();
    for (let n = 0; n < 12 && i < list.length; n++, i++) frag.appendChild(postEl(list[i]));
    host.insertBefore(frag, sentinel);
    if (i >= list.length) { io.disconnect(); sentinel.remove(); } else { io.unobserve(sentinel); io.observe(sentinel); }
  };
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) more(); }, { rootMargin: '2500px 0px' });
  host._io = io;
  more();
  if (i < list.length) io.observe(sentinel);
}

/* one delegated click handler for every feed */
document.addEventListener('click', e => {
  const tagEl = e.target.closest('[data-tag]');
  if (tagEl && tagEl.closest('.post')) { openTagPage(tagEl.dataset.tag); return; }
  const pill = e.target.closest('[data-album]');
  if (pill) { openAlbumPage(pill.dataset.album); return; }
  const a = e.target.closest('.post [data-act]');
  if (!a) return;
  const post = a.closest('.post'), key = post.dataset.key, it = S.byKey.get(key);
  const host = post.parentElement;
  if (!it) return;
  switch (a.dataset.act) {
    case 'open': openViewer((host && host._list) || [it], key); break;
    case 'like': toggleLike(key); break;
    case 'album': openPicker(key); break;
    case 'more': openPostMenu(key); break;
  }
});

function toggleLike(key) {
  if (S.likes.has(key)) S.likes.delete(key); else S.likes.add(key);
  saveState(); refreshPost(key); syncPages(); if (S.tab === 'albums') buildAlbums();
}

/* =====================================================================
   viewer
   ===================================================================== */
const V = { list: [], i: 0 };
function openViewer(list, key) {
  V.list = list; V.i = Math.max(0, list.findIndex(x => x.key === key));
  $('#viewer').hidden = false;
  showViewer();
  pushOv(() => { clearStage(); $('#viewer').hidden = true; });
}
function clearStage() {
  const st = $('#vstage');
  $$('video', st).forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
  st.innerHTML = '';
}
let vTok = 0;
function showViewer() {
  const it = V.list[V.i]; if (!it) return;
  clearStage();
  const st = $('#vstage'), tok = ++vTok;
  if (it.kind === 'video') {
    const el = document.createElement('video');
    el.controls = true; el.autoplay = true; el.loop = true; el.playsInline = true; el.preload = 'auto';
    el.setAttribute('playsinline', ''); el.poster = it.thumb; el.src = it.url;
    st.appendChild(el);
  } else {
    /* the cached thumbnail shows on the same frame; the full-size file swaps in once it is decoded */
    const lo = new Image(); lo.alt = ''; lo.src = it.thumb;
    st.appendChild(lo);
    const hi = new Image(); hi.alt = ''; hi.decoding = 'async'; hi.src = it.url;
    const swap = () => { if (tok !== vTok) return; st.appendChild(hi); lo.remove(); };
    if (hi.decode) hi.decode().then(swap, () => { if (tok === vTok) lo.src = it.thumb; }); else hi.onload = swap;
  }
  $('#viewer').classList.toggle('vid', it.kind === 'video');
  $('#vtext').innerHTML = it.hasText ? richText(it.text) : esc(it.name);
  $('#vcount').textContent = V.list.length > 1 ? `${V.i + 1} / ${V.list.length}` : '';
  paintViewerButtons();
  for (const d of [1, -1]) { const nb = V.list[V.i + d]; if (nb) new Image().src = nb.thumb; }
}
function paintViewerButtons() {
  const it = V.list[V.i]; if (!it || $('#viewer').hidden) return;
  $('[data-v=like]').classList.toggle('liked', S.likes.has(it.key));
  $('[data-v=album]').classList.toggle('saved', albumsOf(it.key).length > 0);
}
function stepViewer(d) {
  const n = V.i + d; if (n < 0 || n >= V.list.length) return;
  V.i = n; showViewer();
}
(function initViewer() {
  const v = $('#viewer');
  $('[data-v=close]').innerHTML = ic('x');
  $('[data-v=prev]').innerHTML = ic('back');
  $('[data-v=next]').innerHTML = ic('next');
  $('[data-v=like]').innerHTML = ic('heart');
  $('[data-v=album]').innerHTML = ic('bookmark');
  v.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (b) {
      const it = V.list[V.i];
      ({ close: back, prev: () => stepViewer(-1), next: () => stepViewer(1), like: () => it && toggleLike(it.key), album: () => it && openPicker(it.key) })[b.dataset.v]();
      return;
    }
    const t = e.target.closest('[data-tag]');
    if (t) { openTagPage(t.dataset.tag); }
  });
  let sx = 0, sy = 0, st = 0;
  const stage = $('#vstage');
  stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = e.timeStamp; }, { passive: true });
  stage.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    const nearControls = e.target.tagName === 'VIDEO' && sy > stage.getBoundingClientRect().bottom - 100;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 60 && e.timeStamp - st < 700 && !nearControls) stepViewer(dx < 0 ? 1 : -1);
  }, { passive: true });
  document.addEventListener('keydown', e => {
    if (v.hidden) return;
    if (e.key === 'ArrowRight') stepViewer(1);
    else if (e.key === 'ArrowLeft') stepViewer(-1);
    else if (e.key === 'Escape') back();
  });
})();

/* =====================================================================
   album picker / import / settings / post menu
   ===================================================================== */
function openPicker(key) {
  const it = S.byKey.get(key); if (!it) return;
  const render = sh => {
    sh.innerHTML = `<div class="grab"></div><h3>Add to albums</h3><p class="note">A post can live in as many albums as you like.</p>
      <button class="item" data-new>${ic('plus')}<span class="grow">New album</span></button>
      ${S.albums.map(a => `<button class="item ${a.items.has(key) ? 'on' : ''}" data-id="${a.id}"><span class="box">${ic('check')}</span><span class="grow">${esc(a.name)}<small>${pl(a.items.size,'post')}${a.src ? ' · synced with folder' : ''}</small></span></button>`).join('')}
      <button class="btn blue" data-done>Done</button>`;
  };
  openSheet('', sh => {
    render(sh);
    sh.addEventListener('click', async e => {
      if (e.target.closest('[data-done]')) { back(); return; }
      if (e.target.closest('[data-new]')) {
        const name = await askText('New album');
        if (name) { const a = newAlbum(name); a.items.add(key); saveState(); refreshPost(key); syncPages(); }
        if (sh.isConnected) render(sh);
        if (S.tab === 'albums') buildAlbums();
        return;
      }
      const row = e.target.closest('[data-id]'); if (!row) return;
      const a = S.albums.find(x => x.id === row.dataset.id);
      toggleMember(a, key);
      render(sh); refreshPost(key); syncPages();
      if (S.tab === 'albums') buildAlbums();
    });
  });
}
function newAlbum(name, src) {
  const a = { id: uid(), name, src: src || null, items: new Set(), ex: new Set(), created: Date.now() };
  S.albums.push(a); saveState(); return a;
}
function toggleMember(a, key) {
  if (a.items.has(key)) { a.items.delete(key); if (a.src) a.ex.add(key); }
  else { a.items.add(key); a.ex.delete(key); }
  saveState();
}

function openImport() {
  const sel = new Set();
  let mode = 'albums';
  const favCount = S.items.filter(it => it.fav).length;
  const render = (sh, q = '') => {
    const rows = S.folders.filter(f => !q || f.name.toLowerCase().includes(q) || f.rel.toLowerCase().includes(q));
    $('.list', sh).innerHTML = rows.map(f => {
      const linked = S.albums.find(a => a.src && a.src.rel === f.rel);
      return `<button class="item ${sel.has(f.rel) ? 'on' : ''}" data-rel="${esc(f.rel)}"><span class="box">${ic('check')}</span><span class="grow">${esc(f.name)}<small>${esc(f.rel || '/')} · ${f.count} items${linked ? ' · already imported' : ''}</small></span></button>`;
    }).join('') || '<p class="note">No folders found.</p>';
    $$('[data-mode]', sh).forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    const go = $('[data-go]', sh), n = sel.size;
    go.disabled = !n;
    go.textContent = !n ? 'Select folders to import' : mode === 'likes' ? `Like everything in ${n} folder${n > 1 ? 's' : ''}` : `Import ${n} album${n > 1 ? 's' : ''}`;
  };
  openSheet(`<h3>Import from Gallery</h3>
    <button class="item" data-favs>${ic('heart')}<span class="grow">Gallery favorites → Liked<small>${favCount ? `${pl(favCount, 'item')} hearted in Gallery` : 'The phone reported no favorites. Use folders below instead.'}</small></span></button>
    <p class="note">Or pick folders and add them as:</p>
    <div class="row" style="margin:0 16px 8px"><button class="chip on" data-mode="albums">Albums</button><button class="chip" data-mode="likes">Likes</button></div>
    <input class="filter" placeholder="Filter folders" />
    <div class="list"></div><button class="btn blue" data-go>Import</button>`, sh => {
    render(sh);
    $('.filter', sh).addEventListener('input', e => render(sh, e.target.value.trim().toLowerCase()));
    sh.addEventListener('click', e => {
      if (e.target.closest('[data-favs]')) {
        if (!favCount) { toast('No favorites found on the phone'); return; }
        const n = importFavs(true); saveState(); back(); afterLikesChanged();
        toast(n ? `Liked ${pl(n, 'favorite')} from Gallery` : 'Favorites already in Liked');
        return;
      }
      const m = e.target.closest('[data-mode]');
      if (m) { mode = m.dataset.mode; render(sh, $('.filter', sh).value.trim().toLowerCase()); return; }
      const row = e.target.closest('[data-rel]');
      if (row) { const r = row.dataset.rel; sel.has(r) ? sel.delete(r) : sel.add(r); render(sh, $('.filter', sh).value.trim().toLowerCase()); return; }
      if (e.target.closest('[data-go]')) {
        if (mode === 'likes') {
          let n = 0;
          for (const it of S.items) if (sel.has(it.rel) && !S.likes.has(it.key)) { S.likes.add(it.key); n++; }
          saveState(); back(); afterLikesChanged(); toast(n ? `Liked ${pl(n, 'post')}` : 'Already liked');
          return;
        }
        let made = 0, synced = 0;
        for (const rel of sel) {
          const f = S.folders.find(x => x.rel === rel); if (!f) continue;
          let a = S.albums.find(x => x.src && x.src.rel === rel);
          if (!a) {
            const dup = S.albums.some(x => x.name.toLowerCase() === f.name.toLowerCase());
            a = newAlbum(dup ? `${f.name} (${rel.replace(/\/$/, '')})` : f.name, { rel }); made++;
          }
          synced += syncAlbum(a);
        }
        saveState(); back(); buildAlbums(); toast(made ? `Imported ${made} album${made > 1 ? 's' : ''}` : `Synced ${synced} new posts`);
      }
    });
  });
}
function afterLikesChanged() {
  $$('.post').forEach(p => refreshPost(p.dataset.key));
  syncPages(); if (S.tab === 'albums') buildAlbums();
}

function openSettings() {
  const sw = (k, label, sub) => `<button class="item ${S.settings[k] ? 'on' : ''}" data-set="${k}"><span class="grow">${label}<small>${sub}</small></span><span class="switch"></span></button>`;
  const render = sh => {
    sh.innerHTML = `<div class="grab"></div><h3>Settings</h3>
      ${sw('blur', 'Blur media until opened', 'Hides previews in the feed. Tap a post to see it.')}
      ${sw('autoplay', 'Autoplay videos', 'Muted, only the post on screen.')}
      ${sw('syncFavs', 'Sync Gallery favorites', 'New favorites you heart in Gallery are added to Liked when the library rescans.')}
      ${sw('onlyTitled', 'Only posts with titles', 'Hide files that are not from the downloader (camera, screenshots).')}
      <div class="item"><span class="grow">Order<small>Newest or oldest first</small></span>
        <span class="row" style="margin:0"><button class="chip ${S.settings.sort === 'new' ? 'on' : ''}" data-sort="new">Newest</button><button class="chip ${S.settings.sort === 'old' ? 'on' : ''}" data-sort="old">Oldest</button></span></div>
      <button class="btn ghost" data-rescan>Rescan library</button>
      <p class="note" style="margin-top:14px">${S.items.length} items in ${S.folders.length} folders · ${S.albums.length} albums · ${S.likes.size} liked</p>`;
  };
  openSheet('', sh => {
    render(sh);
    sh.addEventListener('click', async e => {
      const s = e.target.closest('[data-set]');
      if (s) {
        const k = s.dataset.set; S.settings[k] = !S.settings[k];
        if (k === 'syncFavs' && S.settings[k]) { const n = importFavs(false); if (n) { afterLikesChanged(); toast(`Liked ${pl(n, 'favorite')} from Gallery`); } }
        applySettings(); saveState(); render(sh); return;
      }
      const o = e.target.closest('[data-sort]');
      if (o) { S.settings.sort = o.dataset.sort; saveState(); render(sh); rebuildHome(); return; }
      if (e.target.closest('[data-rescan]')) { back(); await boot(true); toast('Library updated'); }
    });
  });
}
function applySettings() {
  document.body.classList.toggle('blur', !!S.settings.blur);
  if (!S.settings.autoplay && activeVid) stopMedia(activeVid);
  rebuildHome();
  if (S.tab === 'search') buildSearch();
}

function openPostMenu(key) {
  const it = S.byKey.get(key); if (!it) return;
  const info = [it.name, it.rel || '', [fmtSize(it.size), it.w && it.h ? `${it.w}×${it.h}` : '', it.kind === 'video' ? fmtDur(it) : ''].filter(Boolean).join(' · ')].filter(Boolean);
  openSheet(`<button class="item" data-m="album">${ic('bookmark')}<span class="grow">Add to albums</span></button>
    <button class="item" data-m="like">${ic('heart')}<span class="grow">${S.likes.has(key) ? 'Remove like' : 'Like'}</span></button>
    ${it.hasText ? `<button class="item" data-m="copy">${ic('expand')}<span class="grow">Copy text</span></button>` : ''}
    <button class="item" data-m="folder">${ic('folder')}<span class="grow">More from ${esc(it.folder)}</span></button>
    <p class="note" style="margin-top:8px;word-break:break-all">${info.map(esc).join('<br>')}</p>`, sh => {
    sh.addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      const m = b.dataset.m;
      if (m === 'copy') { try { navigator.clipboard.writeText(it.text); toast('Copied'); } catch (err) { toast('Copy not available'); } back(); }
      else if (m === 'like') { toggleLike(key); back(); }
      else if (m === 'album') { back(); setTimeout(() => openPicker(key), 30); }
      else if (m === 'folder') { back(); setTimeout(() => openFolderPage(it.rel, it.folder), 30); }
    });
  });
}

/* =====================================================================
   detail pages (album, hashtag, folder)
   ===================================================================== */
function openPage(cfg) {
  const el = document.createElement('div');
  el.className = 'page';
  el.innerHTML = `<div class="hdr"><div class="hdr-row"><button class="ib" data-p="back" aria-label="Back">${ic('back')}</button>
    <div class="titlebox"><b></b><span class="sub"></span></div><button class="ib" data-p="menu" aria-label="Menu">${ic('more')}</button></div></div><div class="feed"></div>`;
  $('#pages').appendChild(el);
  const feed = $('.feed', el);
  const page = { el, feed, cfg };
  page.head = () => { $('b', el).textContent = cfg.title(); $('.sub', el).textContent = cfg.sub(); };
  page.rebuild = () => { page.head(); mountFeed(feed, cfg.list(), cfg.empty); };
  page.rebuild();
  S.pages.push(page);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    if (b.dataset.p === 'back') back(); else cfg.menu && cfg.menu(page);
  });
  pushOv(() => { clearFeed(feed); el.remove(); S.pages = S.pages.filter(p => p !== page); });
  return page;
}
/* after likes/albums change, drop posts that no longer belong on an open page */
function syncPages() {
  for (const p of S.pages) {
    const keep = new Set(p.cfg.list().map(i => i.key));
    $$('.post', p.feed).forEach(el => { if (!keep.has(el.dataset.key)) el.remove(); });
    p.feed._list = p.cfg.list();
    p.head();
    if (!$('.post', p.feed)) p.rebuild();
  }
}

function openTagPage(tag) {
  const list = () => itemsFor(mainOpts({ tag }));
  openPage({
    title: () => tag, sub: () => `${pl(list().length,'post')}`, list,
    empty: '<div class="empty"><h2>No posts</h2>Nothing carries this hashtag.</div>',
    menu: () => openSheet(`<button class="item" data-m="album">${ic('folder')}<span class="grow">Save as album<small>Create an album with these posts</small></span></button>
      <button class="item" data-m="spin">${ic('dice')}<span class="grow">Roulette from ${esc(tag)}</span></button>`, sh => {
      sh.addEventListener('click', async e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        if (b.dataset.m === 'spin') { R.scope = 'tag:' + tag; saveState(); closeAllOverlays(); setTimeout(() => go('roulette'), 60); return; }
        back();
        const name = await askText('Album name', tag.replace(/^#/, ''));
        if (!name) return;
        const a = newAlbum(name); list().forEach(i => a.items.add(i.key)); saveState();
        $$('.post').forEach(p => refreshPost(p.dataset.key)); toast(`Saved ${pl(a.items.size,'post')} to “${name}”`);
      });
    })
  });
}
function openFolderPage(rel, name) {
  const list = () => itemsFor(mainOpts({ folder: rel }));
  openPage({ title: () => name, sub: () => `${pl(list().length,'post')} · ${rel || '/'}`, list });
}
function openAlbumPage(id) {
  const a = id === 'likes' ? null : S.albums.find(x => x.id === id);
  if (id !== 'likes' && !a) return;
  const isLikes = id === 'likes';
  const list = () => itemsFor(isLikes ? { likes: true } : { album: a });
  openPage({
    title: () => (isLikes ? 'Liked' : a.name),
    sub: () => `${pl(list().length,'post')}${a && a.src ? ' · synced with folder' : ''}`,
    list,
    empty: `<div class="empty"><h2>${isLikes ? 'No likes yet' : 'Empty album'}</h2>${isLikes ? 'Tap the heart on any post, or import your Gallery favorites from the ⋯ menu.' : 'Use the bookmark button on a post to add it here.'}</div>`,
    menu: page => openSheet(`<button class="item" data-m="spin">${ic('dice')}<span class="grow">Roulette from this ${isLikes ? 'list' : 'album'}</span></button>
      ${isLikes ? `<button class="item" data-m="favs">${ic('import')}<span class="grow">Import favorites from Gallery<small>Adds everything you hearted in Gallery</small></span></button>` : ''}
      ${a ? `<button class="item" data-m="rename">${ic('bookmark')}<span class="grow">Rename</span></button>` : ''}
      ${a && a.src ? `<button class="item" data-m="sync">${ic('import')}<span class="grow">Sync with folder<small>${esc(a.src.rel)}</small></span></button>` : ''}
      ${a ? `<button class="item danger" data-m="del">${ic('x')}<span class="grow">Delete album<small>Your files are not touched</small></span></button>` : ''}`, sh => {
      sh.addEventListener('click', async e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const m = b.dataset.m;
        if (m === 'spin') { R.scope = isLikes ? 'likes' : 'album:' + a.id; saveState(); closeAllOverlays(); setTimeout(() => go('roulette'), 60); return; }
        back();
        if (m === 'favs') { const n = importFavs(true); saveState(); afterLikesChanged(); page.rebuild(); toast(n ? `Liked ${pl(n, 'favorite')} from Gallery` : 'No new favorites found'); }
        else if (m === 'rename') { const n = await askText('Rename album', a.name); if (n) { a.name = n; saveState(); page.head(); buildAlbums(); } }
        else if (m === 'sync') { const n = syncAlbum(a); saveState(); page.rebuild(); buildAlbums(); toast(n ? `Added ${n} new posts` : 'Already up to date'); }
        else if (m === 'del') { S.albums = S.albums.filter(x => x !== a); saveState(); back(); buildAlbums(); $$('.post').forEach(p => refreshPost(p.dataset.key)); toast('Album deleted'); }
      });
    })
  });
}

/* =====================================================================
   views
   ===================================================================== */
const TABS = [['home', 'home'], ['search', 'search'], ['roulette', 'dice'], ['albums', 'folder']];
function buildNav() {
  $('#nav').innerHTML = TABS.map(([t, i]) => `<button data-tab="${t}" aria-label="${t}">${ic(i)}</button>`).join('');
  $('#nav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });
}
function go(tab) {
  S.scroll[S.tab] = window.scrollY;
  S.tab = tab;
  for (const [t] of TABS) $('#v-' + t).hidden = t !== tab;
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (tab === 'roulette') buildRoulette();
  if (tab === 'albums') buildAlbums();
  if (tab === 'search' && !$('#v-search').firstChild) buildSearch();
  window.scrollTo(0, S.scroll[tab] || 0);
}

/* ---- home ---- */
function buildHome() {
  const v = $('#v-home');
  v.innerHTML = `<div class="hdr"><div class="hdr-row"><button class="me" data-h="settings" aria-label="Settings">G</button>
    <div class="brand">${ic('logo')}</div><button class="ib" data-h="spin" aria-label="Roulette">${ic('dice')}</button></div>
    <div class="tabs">${[['all', 'All'], ['image', 'Photos'], ['video', 'Videos'], ['gif', 'GIFs']].map(([k, l]) => `<button data-k="${k}" class="${S.kind === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="feed"></div>`;
  v.addEventListener('click', e => {
    const h = e.target.closest('[data-h]');
    if (h) { h.dataset.h === 'settings' ? openSettings() : go('roulette'); return; }
    const k = e.target.closest('[data-k]');
    if (k) { S.kind = k.dataset.k; $$('.tabs button', v).forEach(b => b.classList.toggle('on', b === k)); rebuildHome(); window.scrollTo(0, 0); }
  });
  rebuildHome();
}
function rebuildHome() {
  const feed = $('#v-home .feed'); if (!feed) return;
  if (!S.loaded) { feed.innerHTML = '<div class="loading"><div class="spin"></div>Loading your gallery…</div>'; return; }
  if (S.error) {
    feed.innerHTML = `<div class="empty"><h2>${/PERMISSION/.test(S.error) ? 'Allow access' : 'Could not load'}</h2>${/PERMISSION/.test(S.error)
      ? 'Gallery needs permission to see your photos and videos. Choose “Allow all” when asked.' : esc(S.error)}<button class="btn blue" data-retry>Try again</button></div>`;
    $('[data-retry]', feed).onclick = () => boot(true);
    return;
  }
  mountFeed(feed, itemsFor(mainOpts({ kind: S.kind })),
    '<div class="empty"><h2>Nothing here</h2>No media found. Check the filters in Settings.</div>');
}

/* ---- search ---- */
function buildSearch() {
  const v = $('#v-search');
  v.innerHTML = `<div class="hdr"><div class="hdr-row"><div class="searchbox">${ic('search')}<input type="search" placeholder="Search titles and #hashtags" value="${esc(S.query)}" autocomplete="off"></div></div></div><div class="sbody"></div>`;
  const body = $('.sbody', v), inp = $('input', v);
  const draw = () => {
    clearFeed(body);
    const q = inp.value.trim().toLowerCase();
    S.query = inp.value;
    if (!q) {
      const tags = [...S.tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
      body.innerHTML = `<div class="sect">Trending in your gallery</div>` + (tags.map(([t, n], i) =>
        `<button class="trend" data-t="${esc(t)}"><span><span class="rank">${i + 1} · Hashtag</span><b>${esc(t)}</b><small>${n} post${n > 1 ? 's' : ''}</small></span></button>`).join('')
        || '<div class="empty">No hashtags found yet.</div>');
      return;
    }
    const list = q.startsWith('#')
      ? itemsFor(mainOpts({})).filter(it => it.tags.some(t => t.includes(q)))
      : itemsFor(mainOpts({})).filter(it => it.name.toLowerCase().includes(q) || it.folder.toLowerCase().includes(q));
    mountFeed(body, list, '<div class="empty"><h2>No results</h2>Try a different word or a #hashtag.</div>');
  };
  inp.addEventListener('input', debounce(draw, 220));
  body.addEventListener('click', e => { const t = e.target.closest('[data-t]'); if (t) openTagPage(t.dataset.t); });
  draw();
}

/* ---- roulette ---- */
function poolFor() {
  const s = R.scope, base = { kind: R.type, titledOnly: false };
  if (s === 'likes') return itemsFor({ ...base, likes: true });
  if (s.startsWith('album:')) { const a = S.albums.find(x => x.id === s.slice(6)); return a ? itemsFor({ ...base, album: a }) : []; }
  if (s.startsWith('folder:')) return itemsFor({ ...base, folder: s.slice(7) });
  if (s.startsWith('tag:')) return itemsFor({ ...base, tag: s.slice(4) });
  return itemsFor(base);
}
function scopeOptions() {
  const sel = v => (R.scope === v ? ' selected' : '');
  let h = `<optgroup label="Gallery"><option value="all"${sel('all')}>Entire gallery (${S.items.length})</option><option value="likes"${sel('likes')}>Liked (${S.likes.size})</option></optgroup>`;
  if (R.scope.startsWith('tag:')) h += `<optgroup label="Hashtag"><option value="${esc(R.scope)}" selected>${esc(R.scope.slice(4))}</option></optgroup>`;
  if (S.albums.length) h += `<optgroup label="Albums">${S.albums.map(a => `<option value="album:${a.id}"${sel('album:' + a.id)}>${esc(a.name)} (${a.items.size})</option>`).join('')}</optgroup>`;
  h += `<optgroup label="Phone folders">${S.folders.slice(0, 200).map(f => `<option value="folder:${esc(f.rel)}"${sel('folder:' + f.rel)}>${esc(f.name)} (${f.count})</option>`).join('')}</optgroup>`;
  return h;
}
function buildRoulette() {
  const v = $('#v-roulette');
  v.innerHTML = `<div class="hdr"><div class="hdr-row"><h1>Roulette</h1></div></div>
    <div class="rou">
      <select class="sel" aria-label="Where to pick from">${scopeOptions()}</select>
      <div class="row">${[['all', 'Anything'], ['image', 'Photos'], ['video', 'Videos'], ['gif', 'GIFs']].map(([k, l]) => `<button class="chip ${R.type === k ? 'on' : ''}" data-type="${k}">${l}</button>`).join('')}</div>
      <div class="poolinfo"></div>
      <div class="wheel"><button class="spinbtn" data-spin>${ic('dice')}<span>SPIN</span></button><div class="ticker"><span></span></div></div>
    </div>
    <div class="result"></div><div class="hist"></div>`;
  const info = () => { const n = poolFor().length; $('.poolinfo', v).textContent = n ? `${n} possible • ${R.seen.size} already seen` : 'Nothing matches this selection'; };
  $('.sel', v).onchange = e => { R.scope = e.target.value; R.seen.clear(); saveState(); info(); };
  v.onclick = e => {
    const t = e.target.closest('[data-type]');
    if (t) { R.type = t.dataset.type; R.seen.clear(); saveState(); $$('[data-type]', v).forEach(b => b.classList.toggle('on', b === t)); info(); return; }
    if (e.target.closest('[data-spin]') || e.target.closest('[data-again]')) { spin(); return; }
    const h = e.target.closest('[data-hist]');
    if (h) { const it = S.byKey.get(h.dataset.hist); if (it) showResult(it, false); }
  };
  info(); paintHistory(); if (R.current) showResult(R.current, false);
}
function paintHistory() {
  const h = $('#v-roulette .hist'); if (!h) return;
  h.hidden = !R.history.length;
  h.innerHTML = R.history.slice(0, 24).map(k => { const it = S.byKey.get(k); return it ? `<button data-hist="${esc(k)}"><img src="${esc(it.thumb)}" alt="" loading="lazy"></button>` : ''; }).join('');
}
function showResult(it, scroll = true) {
  R.current = it;
  const box = $('#v-roulette .result'); if (!box) return;
  clearFeed(box); box.innerHTML = '';
  const p = postEl(it); box.appendChild(p); box._list = [it];
  const again = document.createElement('button');
  again.className = 'btn blue'; again.dataset.again = '1'; again.textContent = 'Spin again'; again.style.margin = '14px 16px';
  again.style.width = 'calc(100% - 32px)';
  box.appendChild(again);
  if (scroll) requestAnimationFrame(() => box.scrollIntoView({ block: 'start' }));
  paintHistory();
}
async function spin() {
  if (R.spinning) return;
  const pool = poolFor();
  const v = $('#v-roulette');
  if (!pool.length) { toast('Nothing to spin here'); return; }
  let cand = pool.filter(it => !R.seen.has(it.key));
  if (!cand.length) { R.seen.clear(); cand = pool; if (pool.length > 1) toast('You have seen everything. Reshuffled.'); }
  const pick = cand[rand(cand.length)];
  R.spinning = true;
  const btn = $('.spinbtn', v), tick = $('.ticker span', v);
  btn.classList.add('spinning');
  const label = it => it.tags[0] || (it.hasText ? Array.from(it.text.replace(/\n/g, ' ')).slice(0, 38).join('') : it.folder);
  for (let i = 0; i < 6; i++) { // ~0.27s total (was ~1.5s)
    tick.textContent = label(pool[rand(pool.length)]);
    await new Promise(r => setTimeout(r, 28 + i * 7));
  }
  btn.classList.remove('spinning');
  tick.textContent = label(pick);
  R.seen.add(pick.key);
  R.history.unshift(pick.key); R.history = R.history.filter((k, i, a) => a.indexOf(k) === i).slice(0, 40);
  R.spinning = false;
  if (S.tab === 'roulette') {
    showResult(pick);
    $('.poolinfo', v).textContent = `${pool.length} possible • ${R.seen.size} already seen`;
  }
}

/* ---- albums ---- */
function buildAlbums() {
  const v = $('#v-albums');
  v.innerHTML = `<div class="hdr"><div class="hdr-row"><h1>Albums</h1>
    <button class="ib" data-a="import" aria-label="Import from Gallery">${ic('import')}</button><button class="ib" data-a="new" aria-label="New album">${ic('plus')}</button></div></div>
    <button class="arow" data-open="likes"><span class="cover" style="background:linear-gradient(135deg,#f91880,#a3115a)">${ic('heart')}</span><span class="grow"><b>Liked</b><small>${pl(S.likes.size,'post')}</small></span></button>
    ${S.albums.map(a => `<button class="arow" data-open="${a.id}"><span class="cover" style="background:${gradOf(a.name)}">${ic('folder')}</span><span class="grow"><b>${esc(a.name)}</b><small>${pl(a.items.size,'post')}${a.src ? ' · <span class="linked">synced with folder</span>' : ''}</small></span></button>`).join('')}
    ${S.albums.length ? '' : `<div class="empty"><h2>No albums yet</h2>Import your Samsung Gallery albums, or make your own. One post can be in many albums, like tags.<button class="btn blue" data-a="import">Import from Gallery</button></div>`}`;
  v.onclick = async e => {
    const o = e.target.closest('[data-open]');
    if (o) { openAlbumPage(o.dataset.open); return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'import') openImport();
    else { const n = await askText('New album', '', 'Create'); if (n) { newAlbum(n); buildAlbums(); } }
  };
}

/* =====================================================================
   boot
   ===================================================================== */
async function boot(rescan) {
  if (rescan) { S.loaded = false; rebuildHome(); }
  await scan();
  rebuildHome();
  if (S.tab === 'roulette') buildRoulette();
  if (S.tab === 'albums') buildAlbums();
  if (S.tab === 'search') buildSearch();
}
loadState();
buildNav();
applySettings();
buildHome();
go('home');
boot();
})();
