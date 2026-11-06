// Screenshot markup: draw arrows, boxes, freehand lines, highlighter and text on an image,
// then hand back a new image file. Works with mouse, pen and touch.
//
//   const file = await openAnnotator(fileOrUrl, { name: 'screenshot.png' });   // null if cancelled

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#111827', '#ffffff'];
const TOOLS = [
  ['arrow', 'Arrow', '<path d="M5 19 19 5"/><path d="M9 5h10v10"/>'],
  ['rect', 'Box', '<rect x="4" y="5" width="16" height="14" rx="1.5"/>'],
  ['pen', 'Draw', '<path d="M3 17c3-4 5 2 8-2s4-8 7-6 1 6 3 7"/>'],
  ['mark', 'Highlight', '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'],
  ['text', 'Text', '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>'],
];
const svg = (p) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

function loadImage(source) {
  const url = source instanceof Blob ? URL.createObjectURL(source) : source;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not open the image'));
    img.src = url;
  });
}

export async function openAnnotator(source, { name = 'marked-up.png' } = {}) {
  const img = await loadImage(source);
  const scale = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * scale);
  const H = Math.round(img.naturalHeight * scale);
  const lw = Math.max(3, Math.round(Math.max(W, H) / 280));

  const wrap = document.createElement('div');
  wrap.className = 'annot-wrap';
  wrap.innerHTML = `
    <div class="annot-bar">
      <div class="annot-group">${TOOLS.map(([k, label, p]) => `<button type="button" class="annot-tool" data-tool="${k}" title="${label}">${svg(p)}<span>${label}</span></button>`).join('')}</div>
      <div class="annot-group">${COLORS.map((c) => `<button type="button" class="annot-color" data-color="${c}" style="--c:${c}" title="Colour"></button>`).join('')}</div>
      <div class="annot-group">
        <button type="button" class="annot-tool" data-act="undo" title="Undo (Ctrl+Z)">${svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>')}<span>Undo</span></button>
        <button type="button" class="annot-tool" data-act="clear" title="Remove all markings">${svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>')}<span>Clear</span></button>
      </div>
      <span class="annot-spacer"></span>
      <button type="button" class="btn" data-act="cancel">Cancel</button>
      <button type="button" class="btn primary" data-act="save">Use this image</button>
    </div>
    <div class="annot-stage"><canvas></canvas></div>
    <div class="annot-hint">Drag on the image to mark it. For text, pick <b>Text</b> and click where it should go.</div>`;
  document.body.append(wrap);

  const canvas = wrap.querySelector('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const shapes = [];
  let cur = null;
  let tool = 'arrow';
  let color = COLORS[0];

  const syncBar = () => {
    wrap.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
    wrap.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === color));
    canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
  };

  function drawShape(s) {
    ctx.save();
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
    ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const [a, b] = [s.pts[0], s.pts.at(-1)];
    if (s.type === 'rect') {
      ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    } else if (s.type === 'arrow') {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const head = lw * 5;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0] - Math.cos(ang) * head * 0.6, b[1] - Math.sin(ang) * head * 0.6); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - head * Math.cos(ang - 0.45), b[1] - head * Math.sin(ang - 0.45));
      ctx.lineTo(b[0] - head * Math.cos(ang + 0.45), b[1] - head * Math.sin(ang + 0.45));
      ctx.closePath(); ctx.fill();
    } else if (s.type === 'pen' || s.type === 'mark') {
      if (s.type === 'mark') { ctx.globalAlpha = 0.35; ctx.lineWidth = lw * 6; ctx.lineCap = 'butt'; }
      ctx.beginPath(); ctx.moveTo(a[0], a[1]);
      for (const p of s.pts.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    } else if (s.type === 'text') {
      const size = lw * 6;
      ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textBaseline = 'top';
      ctx.lineWidth = Math.max(2, size / 7);
      ctx.strokeStyle = s.color === '#ffffff' ? '#111827' : '#ffffff';   // outline so text is readable on any background
      s.text.split('\n').forEach((line, i) => {
        ctx.strokeText(line, a[0], a[1] + i * size * 1.2);
        ctx.fillText(line, a[0], a[1] + i * size * 1.2);
      });
    }
    ctx.restore();
  }
  function draw() {
    ctx.drawImage(img, 0, 0, W, H);
    for (const s of shapes) drawShape(s);
    if (cur) drawShape(cur);
  }
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)];
  };

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const p = point(e);
    if (tool === 'text') {
      const text = prompt('Text to put on the image:');
      if (text && text.trim()) { shapes.push({ type: 'text', color, pts: [p], text: text.trim() }); draw(); }
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    cur = { type: tool, color, pts: [p, p] };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const p = point(e);
    if (cur.type === 'pen' || cur.type === 'mark') cur.pts.push(p); else cur.pts[1] = p;
    draw();
  });
  const finish = () => {
    if (!cur) return;
    const [a, b] = [cur.pts[0], cur.pts.at(-1)];
    if (cur.pts.length > 2 || Math.hypot(b[0] - a[0], b[1] - a[1]) > lw * 2) shapes.push(cur);
    cur = null; draw();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  draw(); syncBar();

  return new Promise((resolve) => {
    const close = (result) => {
      window.removeEventListener('keydown', onKey, true);
      wrap.remove();
      if (source instanceof Blob) URL.revokeObjectURL(img.src);
      resolve(result);
    };
    async function save() {
      let blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.9));
      if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const ext = blob.type === 'image/webp' ? 'webp' : 'png';
      close(new File([blob], name.replace(/\.[^.]+$/, '') + '-marked.' + ext, { type: blob.type }));
    }
    function onKey(e) {   // capture phase, so Esc / Ctrl+Z don't also reach the page behind
      if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(null); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.stopImmediatePropagation(); e.preventDefault(); shapes.pop(); draw(); }
    }
    window.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.tool) { tool = b.dataset.tool; syncBar(); }
      else if (b.dataset.color) { color = b.dataset.color; syncBar(); }
      else if (b.dataset.act === 'undo') { shapes.pop(); draw(); }
      else if (b.dataset.act === 'clear') { shapes.length = 0; draw(); }
      else if (b.dataset.act === 'cancel') close(null);
      else if (b.dataset.act === 'save') save();
    });
  });
}
