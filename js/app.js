(() => {
  'use strict';

  // Datos del negocio. Si suman WhatsApp, poner el número con código de país, por ejemplo '5491123456789'.
  const CONFIG = { instagram: 'zona10.arg', whatsapp: '', pageSize: 24 };

  const DATA = window.ZONA10;
  const DEFAULT_TITLE = document.title;
  const TIPO_SUB = { f11: 'Botines de Fútbol 11', f5: 'Botines de Fútbol 5', futsal: 'Botines de Futsal', mixto: 'Botines Mixtos' };
  const SIZES_ADULT = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45];
  const SIZES_KIDS = [28, 29, 30, 31, 32, 33, 34, 35, 36, 37];
  const GRID_SIZES = '(max-width: 960px) 50vw, 30vw';
  const CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (n) => n.toLocaleString('es-AR');
  const $ = (sel) => document.querySelector(sel);

  const products = DATA.rows.map(([code, name, brand, model, tipo, cana, kids, tag, imgs, real, fam], rank) => ({
    code, name, brand, model, tipo, cana, kids: !!kids, tag, imgs, real: new Set(real), rank, fam: fam || code,
  }));
  // Familias: el mismo botín y color en otra versión (con o sin cordones, caña alta o baja). En la grilla va una tarjeta por familia.
  const families = new Map();
  for (const p of products) families.set(p.fam, [...(families.get(p.fam) || []), p]);
  const versions = (p) => families.get(p.fam);
  const onePerFamily = (list) => { const seen = new Set(); return list.filter((p) => !seen.has(p.fam) && seen.add(p.fam)); };
  const stockProducts = products.filter((p) => p.tag === 'stock');
  for (const p of products) {
    p.search = norm([p.name, DATA.brands[p.brand], DATA.models[p.model], DATA.tipos[p.tipo], p.code,
      p.cana && `caña ${p.cana}`, p.kids && 'niños kids', p.tag === 'stock' && 'stock entrega inmediata', p.tag].filter(Boolean).join(' '));
  }
  const byCode = new Map(products.map((p) => [p.code, p]));
  const brandName = (p) => DATA.brands[p.brand] || '';

  // Modelos para el filtro, de más a menos fotos.
  const modelCounts = {};
  for (const p of products) {
    if (!p.model) continue;
    modelCounts[p.model] ??= { n: 0, brand: p.brand };
    modelCounts[p.model].n++;
  }
  const modelOptions = Object.entries(modelCounts)
    .sort((a, b) => b[1].n - a[1].n)
    .map(([m, { brand }]) => [m, `${DATA.brands[brand]} ${DATA.models[m]}`]);

  const FACETS = [
    { key: 'tipo', label: 'Tipo de cancha', get: (p) => p.tipo, options: Object.entries(DATA.tipos) },
    { key: 'marca', label: 'Marca', get: (p) => p.brand, options: Object.entries(DATA.brands) },
    { key: 'modelo', label: 'Modelo', get: (p) => p.model, options: modelOptions },
    { key: 'disp', label: 'Disponibilidad', get: (p) => (p.tag === 'stock' ? 'stock' : 'encargo'), options: [['stock', 'Entrega inmediata'], ['encargo', 'Por encargo']] },
    { key: 'cana', label: 'Caña', get: (p) => p.cana, options: [['baja', 'Caña baja'], ['alta', 'Caña alta']] },
    { key: 'col', label: 'Colección', get: (p) => p.tag, options: [['2026', 'Colección 2026'], ['retro', 'Retro']] },
    { key: 'publico', label: 'Público', get: (p) => (p.kids ? 'ninos' : 'adultos'), options: [['adultos', 'Adultos'], ['ninos', 'Niños']] },
  ];
  const CHIPS = [
    ['modelo', 'predator', 'Predator'], ['modelo', 'mercurial', 'Mercurial'], ['modelo', 'f50', 'F50'],
    ['modelo', 'phantom', 'Phantom'], ['modelo', 'copa', 'Copa'], ['modelo', 'tiempo', 'Tiempo'],
    ['modelo', 'x', 'X Speedportal'], ['col', 'retro', 'Retro'], ['publico', 'ninos', 'Niños'],
  ];
  const openGroups = new Set(['tipo', 'marca', 'modelo', 'disp']);

  const state = { f: {}, q: '', sort: 'destacados', shown: CONFIG.pageSize };
  for (const f of FACETS) state.f[f.key] = new Set();

  const el = {
    grid: $('#grid'), empty: $('#empty'), more: $('#more'), moreText: $('#moreText'), moreBar: $('#moreBar'), moreBtn: $('#moreBtn'),
    title: $('#plpTitle'), count: $('#plpCount'), chips: $('#chips'), groups: $('#filterGroups'), filters: $('#filters'),
    body: document.querySelector('.plp-body'), toggle: $('#toggleFilters'), apply: $('#applyFilters'), sort: $('#sort'),
    pdp: $('#pdp'), plp: $('#catalogo'), search: $('#searchInput'), toast: $('#toast'),
    shelf: $('#stockShelf'), shelfTrack: $('#stockTrack'), stock: $('#stockPage'), stockGrid: $('#stockGrid'),
  };
  const mobile = window.matchMedia('(max-width: 960px)');

  // ---------- URL ----------
  const hashKey = () => location.hash.replace(/^#?\/?/, '');
  function readUrl() {
    const h = hashKey();
    const m = h.match(/^p\/([A-Z0-9]+)/i);
    if (m) return { pdp: m[1].toUpperCase() };
    if (/^stock\b/.test(h)) return { stock: true };
    return { qs: new URLSearchParams(h.split('?')[1] || '') };
  }
  function applyQs(qs) {
    for (const f of FACETS) state.f[f.key] = new Set((qs.get(f.key) || '').split(',').filter(Boolean));
    state.q = qs.get('q') || '';
    state.sort = qs.get('orden') || 'destacados';
  }
  function toHash() {
    const qs = new URLSearchParams();
    for (const f of FACETS) if (state.f[f.key].size) qs.set(f.key, [...state.f[f.key]].join(','));
    if (state.q) qs.set('q', state.q);
    if (state.sort !== 'destacados') qs.set('orden', state.sort);
    const s = qs.toString().replace(/%2C/g, ',');
    return '#/' + (s ? '?' + s : '');
  }

  // ---------- Filtrado ----------
  function matches(p, skipKey) {
    for (const f of FACETS) {
      if (f.key === skipKey) continue;
      const sel = state.f[f.key];
      if (sel.size && !sel.has(f.get(p))) return false;
    }
    if (state.q) {
      const terms = norm(state.q).split(/\s+/).filter(Boolean);
      if (!terms.every((t) => p.search.includes(t))) return false;
    }
    return true;
  }
  function filtered() {
    const list = products.filter((p) => matches(p));
    if (state.sort === 'az') list.sort((a, b) => a.name.localeCompare(b.name, 'es') || a.rank - b.rank);
    if (state.sort === 'za') list.sort((a, b) => b.name.localeCompare(a.name, 'es') || a.rank - b.rank);
    if (state.sort === 'marca') list.sort((a, b) => brandName(a).localeCompare(brandName(b), 'es') || a.rank - b.rank);
    return onePerFamily(list);
  }
  const activeCount = () => FACETS.reduce((n, f) => n + state.f[f.key].size, 0);

  // ---------- Piezas ----------
  // Fotos propias generadas por tools/procesar.mjs: 600 y 1200 px de ancho, fondo blanco y el botín centrado.
  const img = (code, size) => `img/p/${code}-${size}.webp`;
  // load: 'lazy' (grilla), 'high' (foto principal de la ficha) o 'auto' (resto de la galería, para que cambie al instante).
  function media(p, sizes, { load = 'lazy', code = p.imgs[0], alt = `${p.name}, ${TIPO_SUB[p.tipo].toLowerCase()}` } = {}) {
    const srcset = `${img(code, 'sm')} 600w, ${img(code, 'lg')} 1200w`;
    const attr = load === 'high' ? 'fetchpriority="high"' : load === 'lazy' ? 'loading="lazy"' : '';
    return `<div class="media${p.real.has(code) ? ' is-real' : ''}"><img src="${img(code, 'lg')}" srcset="${srcset}" sizes="${sizes}" alt="${esc(alt)}" ${attr} decoding="async"></div>`;
  }
  function badge(p) {
    if (p.tag === 'stock') return '<p class="badge badge-stock">Entrega inmediata</p>';
    if (p.tag === '2026') return '<p class="badge">Colección 2026</p>';
    if (p.tag === 'retro') return '<p class="badge">Retro</p>';
    return '';
  }
  const subtitle = (p) => [TIPO_SUB[p.tipo], p.cana && `Caña ${p.cana}`, p.kids && 'Niños'].filter(Boolean).join(' · ');
  const versionsNote = (p) => (versions(p).length > 1 ? `<p class="card-versions">${versions(p).length} versiones</p>` : '');
  const arrows = (track) => `<div class="track-arrows">
    <button type="button" aria-label="Anterior" data-track="${track}" data-dir="-1"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8"/></svg></button>
    <button type="button" aria-label="Siguiente" data-track="${track}" data-dir="1"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l8 8-8 8"/></svg></button>
  </div>`;

  // Galería de la ficha: miniaturas a la izquierda en escritorio, carrusel deslizable en mobile.
  const GALLERY_MAX = 12;
  function gallery(p) {
    const imgs = p.imgs.slice(0, GALLERY_MAX);
    const n = imgs.length;
    const slides = imgs.map((code, i) => `<div class="gslide">${media(p, '(max-width: 960px) 100vw, 55vw', { load: i === 0 ? 'high' : 'auto', code, alt: `${p.name}, foto ${i + 1} de ${n}` })}</div>`).join('');
    if (n === 1) return `<div class="pdp-gallery"><div class="gmain"><div class="gtrack">${slides}</div></div></div>`;
    return `<div class="pdp-gallery has-thumbs">
      <div class="gthumbs" aria-label="Fotos">${imgs.map((code, i) => `<button class="gthumb${i ? '' : ' is-current'}" type="button" data-gthumb="${i}" aria-label="Ver foto ${i + 1}"${i ? '' : ' aria-current="true"'}>${media(p, '72px', { load: 'auto', code, alt: '' })}</button>`).join('')}</div>
      <div class="gmain">
        <div class="gtrack" id="gTrack">${slides}</div>
        <p class="gcount" id="gCount">1 / ${n}</p>
        <div class="gnav">
          <button type="button" aria-label="Foto anterior" data-gnav="-1"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8"/></svg></button>
          <button type="button" aria-label="Foto siguiente" data-gnav="1"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l8 8-8 8"/></svg></button>
        </div>
      </div>
      ${p.real.size ? '<p class="greal">Incluye fotos reales del par</p>' : ''}
    </div>`;
  }
  function galleryGo(i, smooth = true) {
    const track = $('#gTrack');
    if (!track) return;
    const n = track.children.length;
    const k = (i + n) % n;
    track.scrollTo({ left: k * track.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
    gallerySync(k);
  }
  function gallerySync(k = galleryIndex()) {
    const track = $('#gTrack');
    if (!track) return;
    $('#gCount').textContent = `${k + 1} / ${track.children.length}`;
    document.querySelectorAll('.gthumb').forEach((b, i) => {
      b.classList.toggle('is-current', i === k);
      b.toggleAttribute('aria-current', i === k);
    });
  }
  const galleryIndex = () => { const t = $('#gTrack'); return t ? Math.round(t.scrollLeft / t.clientWidth) : 0; };
  const card = (p, sizes = GRID_SIZES) =>
    `<a class="card" href="#/p/${p.code}">${media(p, sizes)}<div class="card-info">${badge(p)}<h3 class="card-name">${esc(p.name)}</h3><p class="card-sub">${subtitle(p)}</p>${versionsNote(p)}<p class="card-code">Cód. ${p.code}</p></div></a>`;

  // ---------- Catálogo ----------
  let current = [];
  function renderTitle() {
    const one = (k) => (state.f[k].size === 1 ? [...state.f[k]][0] : null);
    const only = (...keys) => FACETS.every((f) => keys.includes(f.key) || !state.f[f.key].size);
    let t = 'Botines de fútbol: F11, F5 y Futsal';
    if (state.q) t = `Resultados para “${state.q}”`;
    else if (one('modelo') && only('modelo', 'marca')) t = modelOptions.find(([m]) => m === one('modelo'))?.[1] || t;
    else if (one('disp') === 'stock' && only('disp')) t = 'Stock con entrega inmediata';
    else if (one('col') === 'retro' && only('col')) t = 'Botines retro';
    else if (one('publico') === 'ninos' && only('publico')) t = 'Botines para niños';
    else if (one('tipo') && one('marca') && only('tipo', 'marca')) t = `${TIPO_SUB[one('tipo')]} ${DATA.brands[one('marca')]}`;
    else if (one('tipo') && only('tipo')) t = TIPO_SUB[one('tipo')];
    else if (one('marca') && only('marca')) t = `Botines ${DATA.brands[one('marca')]}`;
    el.title.textContent = t;
  }

  function renderChips() {
    el.chips.innerHTML = CHIPS.map(([k, v, label]) =>
      `<button class="chip${state.f[k].has(v) ? ' is-on' : ''}" type="button" data-chip="${k}:${v}" aria-pressed="${state.f[k].has(v)}">${label}</button>`).join('');
  }

  function renderFilters() {
    const focused = document.activeElement?.dataset?.facet ? `${document.activeElement.dataset.facet}:${document.activeElement.value}` : null;
    let html = activeCount() ? '<button class="filters-clear" type="button" data-clear-filters>Borrar filtros</button>' : '';
    for (const f of FACETS) {
      const counts = {};
      const seen = new Set(); // cada familia cuenta una vez, como en la grilla
      for (const p of products) {
        const k = `${f.get(p)}|${p.fam}`;
        if (seen.has(k) || !matches(p, f.key)) continue;
        seen.add(k);
        counts[f.get(p)] = (counts[f.get(p)] || 0) + 1;
      }
      const sel = state.f[f.key];
      const opts = f.options.filter(([v]) => counts[v] || sel.has(v));
      if (opts.length < 2 && !sel.size) continue;
      html += `<details class="fgroup" data-group="${f.key}"${openGroups.has(f.key) || sel.size ? ' open' : ''}>
        <summary><span>${f.label}${sel.size ? ` <small>(${sel.size})</small>` : ''}</span>${CHEV}</summary>
        <div class="fopts">${opts.map(([v, label]) => `<label class="fopt${counts[v] ? '' : ' is-zero'}">
          <input type="checkbox" data-facet="${f.key}" value="${v}"${sel.has(v) ? ' checked' : ''}><span>${esc(label)}</span><small>${fmt(counts[v] || 0)}</small></label>`).join('')}</div>
      </details>`;
    }
    el.groups.innerHTML = html;
    if (focused) {
      const [k, v] = focused.split(':');
      el.groups.querySelector(`input[data-facet="${k}"][value="${v}"]`)?.focus();
    }
  }

  function renderGrid(reset = true) {
    if (reset) {
      current = filtered();
      state.shown = Math.min(CONFIG.pageSize, current.length);
      el.grid.innerHTML = '';
    }
    const from = el.grid.children.length;
    const to = Math.min(state.shown, current.length);
    el.grid.insertAdjacentHTML('beforeend', current.slice(from, to).map((p) => card(p)).join(''));
    el.count.textContent = `(${fmt(current.length)})`;
    el.empty.hidden = current.length > 0;
    el.more.hidden = current.length === 0;
    el.moreText.textContent = `Viste ${fmt(to)} de ${fmt(current.length)} productos`;
    el.moreBar.style.width = `${current.length ? (to / current.length) * 100 : 0}%`;
    el.moreBtn.hidden = to >= current.length;
    el.apply.textContent = current.length ? `Ver ${fmt(current.length)} resultados` : 'Sin resultados';
  }

  function renderNavCurrent() {
    const h = currentView === 'stock' ? '#/stock' : currentView === 'catalog' ? toHash() : '';
    document.querySelectorAll('.nav-links a').forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === h));
  }

  function renderCatalog() {
    el.shelf.hidden = !stockProducts.length || activeCount() > 0 || !!state.q;
    renderTitle();
    renderChips();
    renderFilters();
    renderGrid();
    renderNavCurrent();
    el.sort.value = state.sort;
    if (document.activeElement !== el.search) el.search.value = state.q;
  }

  let lastCatalogKey = null;
  function update({ scroll = true } = {}) {
    history.replaceState(null, '', toHash());
    lastCatalogKey = listKey = hashKey();
    renderCatalog();
    if (scroll) {
      const top = el.plp.getBoundingClientRect().top + scrollY - (mobile.matches ? 0 : 36);
      if (scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  // ---------- Ficha de producto ----------
  let pdpSize = null;
  function renderPdp(p) {
    pdpSize = null;
    const vers = versions(p);
    const family = onePerFamily(products
      .filter((x) => x.fam !== p.fam && x.brand === p.brand && (p.model ? x.model === p.model : !x.model && x.tipo === p.tipo))
      .sort((a, b) => Math.abs(a.rank - p.rank) - Math.abs(b.rank - p.rank)));
    const swatches = [p, ...family.slice(0, 9)];
    const familyLabel = p.model ? `${brandName(p)} ${DATA.models[p.model]}` : `${brandName(p)} ${DATA.tipos[p.tipo]}`;
    const familyHash = p.model ? `#/?modelo=${p.model}` : `#/?marca=${p.brand}&tipo=${p.tipo}`;
    const sizes = p.kids ? SIZES_KIDS : SIZES_ADULT;
    const via = CONFIG.whatsapp ? 'WhatsApp' : 'Instagram';
    const related = onePerFamily(products.filter((x) => x.tipo === p.tipo && (x.brand !== p.brand || x.model !== p.model))).slice(0, 12);
    const swatch = (x) => `<a class="swatch${x === p ? ' is-current' : ''}" href="#/p/${x.code}" aria-label="${esc(x.name)}, código ${x.code}"${x === p ? ' aria-current="true"' : ''}>${media(x, '80px')}</a>`;

    el.pdp.innerHTML = `
      <a class="pdp-back" href="#/" data-back><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8"/></svg>Volver</a>
      <div class="pdp-main">
        ${gallery(p)}
        <div class="pdp-info">
          ${badge(p)}
          <h1 class="pdp-name">${esc(p.name)}</h1>
          <p class="pdp-sub">${subtitle(p)}</p>
          <p class="pdp-price">Precio a consultar</p>
          <p class="pdp-code">Código ${p.code} <button type="button" data-copy-code="${p.code}">Copiar</button></p>

          ${vers.length > 1 ? `<section class="swatches" aria-label="Versiones">
            <div class="swatches-head"><h2>${vers.length} versiones de este color</h2></div>
            <div class="swatch-grid">${vers.map(swatch).join('')}</div>
            <p class="swatches-note">Mismo color con otro corte: con o sin cordones, caña alta o baja. Cada versión tiene su código.</p>
          </section>` : ''}

          <section class="swatches" aria-label="Más colores">
            <div class="swatches-head">
              <h2>Más colores de ${esc(familyLabel)}</h2>
              ${family.length > 9 ? `<a href="${familyHash}">Ver los ${fmt(family.length + 1)}</a>` : ''}
            </div>
            <div class="swatch-grid">${swatches.map(swatch).join('')}</div>
          </section>

          <fieldset class="sizes">
            <legend><span>Seleccioná tu talle (AR)</span><a href="#faq-talles">Guía de talles</a></legend>
            <div class="size-grid" id="sizeGrid">
              ${sizes.map((s) => `<button class="size" type="button" aria-pressed="false" data-size="${s}">${s}</button>`).join('')}
              <button class="size size-unknown" type="button" aria-pressed="false" data-size="No sé mi talle">No sé mi talle</button>
            </div>
            <p class="size-error" id="sizeError" hidden>Seleccioná un talle.</p>
          </fieldset>

          <div class="pdp-ctas">
            <a class="btn btn-dark btn-lg" id="consult" href="${contactUrl('')}" target="_blank" rel="noopener">Consultar por ${via}</a>
            <button class="btn btn-outline btn-lg" type="button" id="copyMsg">Copiar consulta</button>
          </div>
          <p class="pdp-help">${CONFIG.whatsapp
            ? 'Te abrimos WhatsApp con el modelo, el código y tu talle ya escritos.'
            : 'Te copiamos la consulta con el modelo, el código y tu talle para que la pegues en el chat de @' + CONFIG.instagram + '. Ahí te pasamos precio y disponibilidad.'}</p>

          <div class="pdp-acc">
            <details><summary>Envíos ${CHEV}</summary><p>Enviamos a todo el país. En CABA y GBA la entrega es en el día.</p></details>
            <details><summary>${p.tag === 'stock' ? 'Entrega inmediata' : 'Pedido por encargo'} ${CHEV}</summary><p>${p.tag === 'stock'
              ? 'Este botín está en stock: coordinamos la entrega apenas confirmás el talle.'
              : 'Este modelo lo pedimos por encargo. Consultanos y te decimos cuánto demora.'}</p></details>
            <details><summary>Cómo comprar ${CHEV}</summary><p>Elegí tu talle, mandanos la consulta y te respondemos con el precio y los medios de pago. Estamos en Lomas de Zamora.</p></details>
          </div>
        </div>
      </div>
      ${related.length ? `<section class="related" aria-label="También te puede interesar">
        <div class="related-head"><h2>También te puede interesar</h2>${arrows('relatedTrack')}</div>
        <div class="related-track" id="relatedTrack">${related.map((x) => card(x, '(max-width: 960px) 62vw, 30vw')).join('')}</div>
      </section>` : ''}`;
    $('#gTrack')?.addEventListener('scroll', () => gallerySync(), { passive: true });
  }

  // ---------- Stock ----------
  function renderShelf() {
    el.shelfTrack.innerHTML = stockProducts.map((p) => card(p, '(max-width: 960px) 62vw, 24vw')).join('');
  }
  function renderStockPage() {
    $('#stockCount').textContent = `${stockProducts.length} ${stockProducts.length === 1 ? 'modelo listo' : 'modelos listos'} para entregar`;
    el.stockGrid.innerHTML = stockProducts.map((p) => card(p)).join('');
  }

  function message(p) {
    return [
      'Hola Zona 10! Quiero consultar por este botín:',
      `• ${p.name} (${subtitle(p)})`,
      `• Código: ${p.code}`,
      `• Talle: ${pdpSize}`,
      location.href.split('#')[0] + `#/p/${p.code}`,
    ].join('\n');
  }
  function contactUrl(text) {
    return CONFIG.whatsapp
      ? `https://wa.me/${CONFIG.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`
      : `https://ig.me/m/${CONFIG.instagram}`;
  }

  function copy(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    } else legacyCopy(text);
  }
  function legacyCopy(text) {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* sin portapapeles */ }
    ta.remove();
  }
  let toastTimer;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 3200);
  }

  function requireSize() {
    if (pdpSize) return true;
    $('#sizeGrid').classList.add('is-error');
    $('#sizeError').hidden = false;
    $('#sizeGrid').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  // ---------- Rutas ----------
  // Vistas: catálogo (#/?filtros), stock (#/stock) y ficha (#/p/CÓDIGO).
  let currentView = null;
  let catalogRendered = false;
  let listKey = '';         // última vista de lista (catálogo o stock) para volver a ella
  const scrollMem = {};     // scroll de cada lista, para volver desde la ficha al mismo lugar
  let pdpDepth = 0;         // cuántas fichas se abrieron seguidas, para volver a la lista de un saque
  history.scrollRestoration = 'manual';

  function setView(view) {
    currentView = view;
    document.body.classList.toggle('view-pdp', view === 'pdp');
    document.body.classList.toggle('view-stock', view === 'stock');
    el.pdp.hidden = view !== 'pdp';
    el.stock.hidden = view !== 'stock';
    if (view !== 'pdp') el.pdp.innerHTML = '';
  }

  function route() {
    const r = readUrl();
    const prev = currentView;
    if (prev && prev !== 'pdp') scrollMem[listKey] = scrollY;

    if (r.pdp) {
      const p = byCode.get(r.pdp);
      if (!p) return location.replace('#/');
      const depth = typeof history.state?.depth === 'number' ? history.state.depth : prev === 'pdp' ? pdpDepth + 1 : 1;
      pdpDepth = depth;
      history.replaceState({ depth }, '', location.href);
      setView('pdp');
      renderPdp(p);
      renderNavCurrent();
      document.title = `${p.name} | Zona 10 Store`;
      window.scrollTo(0, 0);
      return;
    }

    pdpDepth = 0;
    const key = hashKey();
    const back = prev === 'pdp' && key === listKey;
    listKey = key;

    if (r.stock) {
      setView('stock');
      renderStockPage();
      renderNavCurrent();
      document.title = 'Stock con entrega inmediata | Zona 10 Store';
      window.scrollTo(0, back ? scrollMem[key] || 0 : 0);
      return;
    }

    setView('catalog');
    document.title = DEFAULT_TITLE;
    if (key !== lastCatalogKey || !catalogRendered) {
      applyQs(r.qs);
      lastCatalogKey = key;
      renderCatalog();
      if (catalogRendered) {
        const top = el.plp.getBoundingClientRect().top + scrollY - (mobile.matches ? 0 : 36);
        window.scrollTo(0, prev === 'catalog' ? Math.min(scrollY, top) : 0);
      }
      catalogRendered = true;
    } else {
      renderNavCurrent();
      if (prev !== 'catalog') window.scrollTo(0, scrollMem[key] || 0);
    }
  }

  // Anclas internas (FAQ) sin romper la URL del catálogo.
  function goToAnchor(id) {
    if (currentView !== 'catalog') {
      location.hash = '/' + (lastCatalogKey || '');
      route();
    }
    const target = document.getElementById(id);
    if (!target) return;
    if (target.tagName === 'DETAILS') target.open = true;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Eventos ----------
  window.addEventListener('hashchange', route);

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (a && !a.getAttribute('href').startsWith('#/')) {
      e.preventDefault();
      closeMenu();
      goToAnchor(a.getAttribute('href').slice(1));
      return;
    }
    if (a && a.closest('#menu')) closeMenu();

    const chip = e.target.closest('[data-chip]');
    if (chip) {
      const [k, v] = chip.dataset.chip.split(':');
      state.f[k].has(v) ? state.f[k].delete(v) : state.f[k].add(v);
      return update();
    }
    if (e.target.closest('[data-clear-filters]')) {
      for (const f of FACETS) state.f[f.key].clear();
      state.q = '';
      return update();
    }
    if (e.target.closest('[data-close-filters]')) return closeFilters();
    if (e.target.closest('[data-back]')) {
      e.preventDefault();
      if (scrollMem[listKey] !== undefined && pdpDepth > 0) history.go(-pdpDepth);
      else location.hash = '#/';
      return;
    }

    const size = e.target.closest('[data-size]');
    if (size) {
      pdpSize = size.dataset.size;
      document.querySelectorAll('#sizeGrid .size').forEach((b) => b.setAttribute('aria-pressed', String(b === size)));
      $('#sizeGrid').classList.remove('is-error');
      $('#sizeError').hidden = true;
      return;
    }
    const p = byCode.get(readUrl().pdp);
    if (e.target.closest('#consult') && p) {
      if (!requireSize()) return e.preventDefault();
      const text = message(p);
      e.target.closest('#consult').href = contactUrl(text);
      copy(text);
      if (!CONFIG.whatsapp) toast('Copiamos tu consulta. Pegala en el chat de Instagram.');
      return;
    }
    if (e.target.closest('#copyMsg') && p) {
      if (!requireSize()) return;
      copy(message(p));
      return toast('Consulta copiada.');
    }
    const code = e.target.closest('[data-copy-code]');
    if (code) {
      copy(code.dataset.copyCode);
      return toast(`Código ${code.dataset.copyCode} copiado.`);
    }
    const nav = e.target.closest('[data-track]');
    if (nav) {
      const track = document.getElementById(nav.dataset.track);
      track.scrollBy({ left: Number(nav.dataset.dir) * track.clientWidth, behavior: 'smooth' });
      return;
    }
    const thumb = e.target.closest('[data-gthumb]');
    if (thumb) return galleryGo(Number(thumb.dataset.gthumb));
    const gnav = e.target.closest('[data-gnav]');
    if (gnav) return galleryGo(galleryIndex() + Number(gnav.dataset.gnav));
  });

  // En escritorio, pasar el mouse por una miniatura cambia la foto (como en Nike).
  document.addEventListener('mouseover', (e) => {
    const thumb = e.target.closest?.('[data-gthumb]');
    if (thumb && !mobile.matches) galleryGo(Number(thumb.dataset.gthumb), false);
  });

  el.groups.addEventListener('change', (e) => {
    const box = e.target.closest('input[data-facet]');
    if (!box) return;
    const sel = state.f[box.dataset.facet];
    box.checked ? sel.add(box.value) : sel.delete(box.value);
    update({ scroll: !mobile.matches });
  });
  el.groups.addEventListener('toggle', (e) => {
    const g = e.target.dataset?.group;
    if (g) e.target.open ? openGroups.add(g) : openGroups.delete(g);
  }, true);

  el.sort.addEventListener('change', () => { state.sort = el.sort.value; update(); });
  el.moreBtn.addEventListener('click', () => { state.shown += CONFIG.pageSize; renderGrid(false); });

  // Filtros: en escritorio se ocultan, en mobile se abren como panel.
  el.toggle.addEventListener('click', () => {
    if (mobile.matches) return openFilters();
    const off = el.body.classList.toggle('filters-off');
    el.toggle.setAttribute('aria-expanded', String(!off));
    el.toggle.querySelector('[data-label]').textContent = off ? 'Mostrar filtros' : 'Ocultar filtros';
  });
  function openFilters() { el.filters.classList.add('is-open'); document.body.classList.add('is-locked'); }
  function closeFilters() { el.filters.classList.remove('is-open'); document.body.classList.remove('is-locked'); }

  // Búsqueda
  let searchTimer;
  function runSearch(q) {
    state.q = q.trim();
    if (currentView !== 'catalog') location.hash = toHash();
    else update();
  }
  el.search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(el.search.value), 250); });
  $('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(searchTimer); runSearch(el.search.value); });
  const msearch = $('#msearch');
  $('[data-open-search]').addEventListener('click', () => { msearch.hidden = false; $('#msearchInput').value = state.q; $('#msearchInput').focus(); });
  $('[data-close-search]').addEventListener('click', () => { msearch.hidden = true; });
  $('#msearchForm').addEventListener('submit', (e) => { e.preventDefault(); msearch.hidden = true; runSearch($('#msearchInput').value); });

  // Menú mobile
  const menu = $('#menu');
  $('[data-open-menu]').addEventListener('click', () => { menu.hidden = false; document.body.classList.add('is-locked'); });
  function closeMenu() { if (!menu.hidden) { menu.hidden = true; document.body.classList.remove('is-locked'); } }
  $('[data-close-menu]').addEventListener('click', closeMenu);
  menu.addEventListener('click', (e) => { if (e.target === menu) closeMenu(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeMenu();
    closeFilters();
    msearch.hidden = true;
  });

  // Promo
  try { if (sessionStorage.getItem('z10-promo') === 'off') $('#promo').hidden = true; } catch { /* sin storage */ }
  $('[data-close-promo]').addEventListener('click', () => {
    $('#promo').hidden = true;
    try { sessionStorage.setItem('z10-promo', 'off'); } catch { /* sin storage */ }
  });

  // Avisos rotativos
  const items = [...document.querySelectorAll('.announce-item')];
  let ai = 0;
  const showAnnounce = (i) => { ai = (i + items.length) % items.length; items.forEach((it, j) => it.classList.toggle('is-active', j === ai)); };
  let announceTimer = setInterval(() => showAnnounce(ai + 1), 5000);
  document.querySelectorAll('[data-announce]').forEach((b) => b.addEventListener('click', () => {
    clearInterval(announceTimer);
    showAnnounce(ai + Number(b.dataset.announce));
    announceTimer = setInterval(() => showAnnounce(ai + 1), 5000);
  }));

  // Nav que se esconde al bajar y aparece al subir, como en Nike.
  let lastY = scrollY;
  window.addEventListener('scroll', () => {
    const y = scrollY;
    if (Math.abs(y - lastY) < 6) return;
    document.body.classList.toggle('nav-hidden', y > lastY && y > 200);
    lastY = y;
  }, { passive: true });

  // Alto real del encabezado del catálogo, para que los filtros queden pegados debajo.
  const head = $('#plpHead');
  new ResizeObserver(() => document.documentElement.style.setProperty('--head-h', `${head.offsetHeight}px`)).observe(head);

  // Fotos: aparecen al cargar; si el Drive no la entrega, se avisa.
  document.addEventListener('load', (e) => {
    if (e.target.tagName === 'IMG' && e.target.parentElement?.classList.contains('media')) e.target.classList.add('is-loaded');
  }, true);
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && e.target.parentElement?.classList.contains('media')) e.target.parentElement.classList.add('is-broken');
  }, true);

  // Botón flotante
  if (CONFIG.whatsapp) {
    const f = $('#floatCta');
    f.href = contactUrl('Hola Zona 10! Quiero hacer una consulta.');
    f.classList.add('is-wa');
    f.setAttribute('aria-label', 'Escribinos por WhatsApp');
    f.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z"/></svg>';
  }
  $('#year').textContent = new Date().getFullYear();

  renderShelf();
  route();
})();
