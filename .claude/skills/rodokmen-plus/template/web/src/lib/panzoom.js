// Zoom a posun SVG přes viewBox – sdílené pro pohledy Osa s vazbami, Vějíř v čase a Řeka času.
// Myš: kolečko = zoom kolem kurzoru, tažení = posun. Touchpad: pinch (wheel + ctrlKey) = zoom,
// dvouprstý posun = posun. Dotyk: jeden prst posun, dva prsty pinch. Stránka se při tom nehýbe (touch-action: none).
// Na <svg> nastavuje CSS proměnnou --u (uživatelských jednotek na 1 px obrazovky), aby šlo držet text
// čitelný (font-size: max(…, calc(var(--u) * 11px))), a data-zoom = poměr přiblížení vůči celku.

/** Kolečko myši vs. dvouprstý posun na touchpadu (bez ctrlKey). Myš: řádkový režim nebo velké celé kroky jen svisle. */
export function isPanGesture(e) {
  if (e.ctrlKey) return false;
  if (e.deltaMode !== 0) return false;
  if (e.deltaX !== 0) return true;
  return Math.abs(e.deltaY) < 40 || !Number.isInteger(e.deltaY);
}

export function panZoom(stage, svg, { maxZoom = 40, minZoom = 0.8, onChange = () => {} } = {}) {
  const vb0 = svg.viewBox.baseVal;
  let home = { x: vb0.x, y: vb0.y, w: vb0.width, h: vb0.height };
  let vb = { ...home };
  const apply = () => {
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const r = svg.getBoundingClientRect();
    const u = r.width ? Math.max(vb.w / r.width, vb.h / r.height) : 1;
    const z = home.w / vb.w;
    svg.style.setProperty('--u', String(u));
    svg.dataset.zoom = z.toFixed(2);
    onChange({ z, u, vb });
  };
  // bod obrazovky → souřadnice SVG (preserveAspectRatio xMidYMid meet)
  const toSvg = (cx, cy) => {
    const r = svg.getBoundingClientRect();
    const s = Math.max(vb.w / r.width, vb.h / r.height);
    const ox = (r.width * s - vb.w) / 2, oy = (r.height * s - vb.h) / 2;
    return { x: vb.x - ox + (cx - r.left) * s, y: vb.y - oy + (cy - r.top) * s, s };
  };
  const zoomAt = (f, cx, cy) => {
    const r = svg.getBoundingClientRect();
    const p = toSvg(cx ?? r.left + r.width / 2, cy ?? r.top + r.height / 2);
    const w = Math.min(home.w / minZoom, Math.max(home.w / maxZoom, vb.w / f));
    const k = w / vb.w;
    vb = { x: p.x - (p.x - vb.x) * k, y: p.y - (p.y - vb.y) * k, w, h: vb.h * k };
    apply();
  };
  const panBy = (dx, dy) => {
    const { s } = toSvg(0, 0);
    vb.x -= dx * s; vb.y -= dy * s;
    apply();
  };

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (isPanGesture(e)) return panBy(-e.deltaX, -e.deltaY);
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(Math.exp(-Math.max(-60, Math.min(60, d)) * (e.ctrlKey ? 0.01 : 0.004)), e.clientX, e.clientY);
  }, { passive: false });

  const pts = new Map();
  let moved = 0, pinch = 0;
  stage.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) moved = 0;
  });
  stage.addEventListener('pointermove', (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = d; moved += 10;
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 4) {
      if (!stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId);
      panBy(dx, dy);
    }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  // po tažení neotevírat odkaz pod prstem
  stage.addEventListener('click', (e) => { if (moved > 4) { e.preventDefault(); e.stopPropagation(); } }, true);
  window.addEventListener('resize', apply);

  const api = {
    zoomIn: () => zoomAt(1.5),
    zoomOut: () => zoomAt(1 / 1.5),
    reset: () => { vb = { ...home }; apply(); },
    /** Přiblíží na obdélník v souřadnicích SVG. */
    focus: (x, y, w, h) => {
      const r = svg.getBoundingClientRect(), a = r.height / r.width || 1;
      const fw = h / w < a ? w : h / a, fh = h / w < a ? w * a : h;
      vb = { x: x + w / 2 - fw / 2, y: y + Math.min(0, h / 2 - fh / 2), w: fw, h: fh };
      apply();
    },
    get view() { return { ...vb }; },
  };
  apply();
  return api;
}

/** Napojí tlačítka [data-pz="in|out|reset"] uvnitř root na api. */
export function bindButtons(root, api) {
  root.querySelectorAll('[data-pz]').forEach((b) =>
    b.addEventListener('click', () => ({ in: api.zoomIn, out: api.zoomOut, reset: api.reset })[b.dataset.pz]?.())
  );
}
