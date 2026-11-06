// Team Workspace — front end (no build step, plain ES modules)

// ---------------------------------------------------------------- helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem('ws.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ws.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

const TYPE_LABEL = { bug: 'Bug fix', update: 'Update', feature: 'New feature', other: 'Other' };
const PRIORITY_LABEL = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
const PRIORITY_RANK = { urgent: 3, high: 2, normal: 1, low: 0 };
const STATUS_LABEL = {
  todo: 'To do', in_progress: 'In progress', done: 'Done · team to check', verified: 'Verified', reopened: 'Needs changes',
};
const STATUS_ORDER = ['reopened', 'todo', 'in_progress', 'done', 'verified'];

const ICONS = {
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  play: '<path d="M6 3l14 9-14 9V3z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  board: '<rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  swap: '<path d="M16 3l4 4-4 4"/><path d="M20 7H4"/><path d="M8 21l-4-4 4-4"/><path d="M4 17h16"/>',
  logo: '<path d="M5 12.5l4.5 4.5L19 7"/>',
};
const icon = (n, s = 16) => `<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const localDate = (iso) => ymd(new Date(iso));
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
function dayHeader(s) {
  const d = parseYmd(s);
  const diff = Math.round((parseYmd(todayStr()) - d) / 86400000);
  const nice = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  if (diff === 0) return ['Today', nice];
  if (diff === 1) return ['Yesterday', nice];
  return [nice, ''];
}
const shortDate = (s) => { const [a] = dayHeader(s); return a === 'Today' || a === 'Yesterday' ? a : parseYmd(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const linkify = (text) => esc(text).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const initials = (name = '?') => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// ---------------------------------------------------------------- state
const S = {
  config: { whisper: false, maxUploadMb: 25 },
  me: null,
  members: [],
  tasks: [],
  version: -1,
  view: ls.get('view', 'board'),
  filters: { q: '', member: '', type: '', status: '' },
  selected: new Set(),
  openId: null,
  showAllVerified: false,
};
const member = (id) => S.members.find((m) => m.id === id) || { id, name: 'Unknown', color: '#888', role: 'member' };
const isLead = () => S.me?.role === 'lead';
const lastActivity = (t) => t.updates.at(-1)?.created_at || t.created_at;
const latestRework = (t) => [...t.updates].reverse().find((u) => u.kind === 'rework');
const avatar = (m, cls = '') => `<span class="avatar ${cls}" style="background:${esc(m.color)}" title="${esc(m.name)}">${esc(initials(m.name))}</span>`;
const pill = (status) => `<span class="pill st-${status}"><span class="dot st-${status}"></span>${STATUS_LABEL[status]}</span>`;

// ---------------------------------------------------------------- api
async function api(url, { method = 'GET', json, form } = {}) {
  const headers = {};
  if (S.me) headers['x-member-id'] = String(S.me.id);
  let body;
  if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
  else if (form) body = form;
  const r = await fetch(url, { method, headers, body, credentials: 'same-origin' });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && data.error === 'Passcode required') { showLogin(); throw new Error('Passcode required'); }
  if (!r.ok) throw new Error(data.error || `${r.status} ${r.statusText}`);
  return data;
}

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3200);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
}

// Plain-text version of a task: paste it in a doc, WhatsApp, or straight into Claude.
function taskToText(t) {
  const by = member(t.created_by);
  const lines = [`Task #${t.id} — [${TYPE_LABEL[t.type]}] ${t.title}${t.priority !== 'normal' ? ` (${PRIORITY_LABEL[t.priority]} priority)` : ''}`];
  lines.push(`Added by ${by.name} · ${t.task_date} · Status: ${STATUS_LABEL[t.status]}`);
  if (t.area) lines.push(`Where: ${t.area}`);
  if (t.description) lines.push('', t.description);
  if (t.links.length) lines.push('', 'Links:', ...t.links.map((l) => `- ${l}`));
  const files = t.attachments.filter((a) => !a.update_id);
  if (files.length) lines.push('', 'Attachments:', ...files.map((a) => `- ${a.name}: ${location.origin}${a.url}`));
  const notes = t.updates.filter((u) => (u.kind === 'rework' || u.kind === 'comment') && u.body);
  if (notes.length) {
    lines.push('', 'Updates / change requests:');
    for (const u of notes) lines.push(`- ${localDate(u.created_at)} ${member(u.author).name}${u.kind === 'rework' ? ' (changes requested)' : ''}: ${u.body}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- data
async function loadMembers() { S.members = await api('/api/members'); }
async function loadTasks() {
  const r = await api('/api/tasks');
  S.tasks = r.tasks; S.version = r.version;
  for (const id of [...S.selected]) if (!S.tasks.some((t) => t.id === id)) S.selected.delete(id);
}
async function refresh(force = false) {
  try {
    const { version } = await api('/api/version');
    if (!force && version === S.version) return;
    await Promise.all([loadMembers(), loadTasks()]);
    S.me = S.members.find((m) => m.id === S.me?.id && m.active) || null;
    if (!S.me) return showWho();
    render();
    if (S.openId) renderDrawerMain();
  } catch (e) { if (e.message !== 'Passcode required') console.warn(e); }
}
function replaceTask(t) {
  const i = S.tasks.findIndex((x) => x.id === t.id);
  if (i >= 0) S.tasks[i] = t; else S.tasks.unshift(t);
  render();
  if (S.openId === t.id) renderDrawerMain();
}

// ---------------------------------------------------------------- status workflow
// Which buttons a person sees for a task, depending on where it is in the flow:
// To do / Needs changes → (lead) In progress → Done → team Verifies ✓ or Requests changes ↺
function actionsFor(t) {
  const a = [];
  const soloTeam = S.members.filter((m) => m.active).length < 2;
  switch (t.status) {
    case 'todo':
    case 'reopened':
      a.push({ to: 'in_progress', label: 'Start', icon: 'play', primary: true });
      a.push({ to: 'done', label: 'Mark done', icon: 'check' });
      break;
    case 'in_progress':
      a.push({ to: 'done', label: 'Mark done', icon: 'check', primary: true });
      a.push({ to: 'todo', label: 'Back to to-do', icon: 'undo', detailOnly: true });
      break;
    case 'done':
      if (t.done_by !== S.me.id || soloTeam) {
        a.push({ to: 'verified', label: 'Verify', icon: 'check', primary: true });
        a.push({ to: 'reopened', label: 'Request changes', icon: 'undo', note: true });
      } else {
        a.push({ wait: true, label: 'Waiting for the team to check' });
      }
      a.push({ to: 'in_progress', label: 'Back to in progress', icon: 'undo', detailOnly: true });
      break;
    case 'verified':
      a.push({ to: 'reopened', label: 'Reopen with changes', icon: 'undo', note: true, detailOnly: true });
      break;
  }
  return a;
}
function actionButtons(t, { inDetail = false } = {}) {
  return actionsFor(t).filter((a) => inDetail || !a.detailOnly).map((a) =>
    a.wait
      ? `<span class="note muted">${esc(a.label)}</span>`
      : `<button class="btn ${inDetail ? '' : 'sm'} st-${a.to}" data-act="status" data-to="${a.to}" data-id="${t.id}">${icon(a.icon, 14)}${esc(a.label)}</button>`,
  ).join('');
}
async function changeStatus(id, to) {
  const t = S.tasks.find((x) => x.id === id);
  const a = actionsFor(t).find((x) => x.to === to);
  if (a?.note) return openChangesModal(t);
  try {
    const form = new FormData(); form.append('status', to);
    replaceTask(await api(`/api/tasks/${id}/status`, { method: 'POST', form }));
    toast(`#${id} → ${STATUS_LABEL[to]}`);
  } catch (e) { toast(e.message, 'error'); }
}

// ---------------------------------------------------------------- filtering
function visibleTasks() {
  const { q, member: m, type, status } = S.filters;
  const needle = q.trim().toLowerCase().replace(/^#/, '');
  return S.tasks.filter((t) => {
    if (m && String(t.created_by) !== m) return false;
    if (type && t.type !== type) return false;
    if (status && t.status !== status) return false;
    if (needle) {
      const hay = `${t.id} ${t.title} ${t.description} ${t.area} ${t.links.join(' ')} ${t.updates.map((u) => u.body).join(' ')}`.toLowerCase();
      if (String(t.id) !== needle && !hay.includes(needle)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------- shell
function renderShell() {
  $('#app').innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand"><span class="brand-mark">${icon('logo', 16)}</span><span class="name">Team Workspace</span></div>
        <nav class="tabs" role="tablist">
          <button class="tab" data-view="board">${icon('board', 15)}Board</button>
          <button class="tab" data-view="timeline">${icon('calendar', 15)}<span>By date</span></button>
        </nav>
        <span class="spacer"></span>
        <button class="me-btn" data-act="me-menu"></button>
      </div>
    </header>
    <div class="toolbar">
      <label class="search">${icon('search', 15)}<input class="input" id="q" type="search" placeholder="Search tasks or #number   ( / )" autocomplete="off"></label>
      <select class="input" id="f-member"></select>
      <select class="input" id="f-type">
        <option value="">All types</option>
        ${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
      <span class="spacer"></span>
      <button class="btn primary new-btn" data-act="new">${icon('plus', 15)}New task <kbd style="color:inherit;border-color:currentColor;opacity:.7">N</kbd></button>
    </div>
    <div class="summary" id="summary"></div>
    <div id="banner"></div>
    <main id="main"></main>
    <div id="selbar"></div>
    <button class="fab" data-act="new">${icon('plus', 18)}New task</button>
    <div id="popover-root"></div>`;
  $('#q').value = S.filters.q;
  $('#q').addEventListener('input', (e) => { S.filters.q = e.target.value; render(); });
  $('#f-member').addEventListener('change', (e) => { S.filters.member = e.target.value; render(); });
  $('#f-type').addEventListener('change', (e) => { S.filters.type = e.target.value; render(); });
}

function render() {
  if (!$('#main')) return;
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === S.view));
  const meBtn = $('.me-btn');
  meBtn.innerHTML = `${avatar(S.me)}<span class="who-name">${esc(S.me.name)}</span><span class="role">${isLead() ? 'Lead' : ''}</span>`;

  const fm = $('#f-member');
  fm.innerHTML = `<option value="">Everyone</option>` + S.members.filter((m) => m.active).map((m) => `<option value="${m.id}">Added by ${esc(m.name)}</option>`).join('');
  fm.value = S.filters.member;
  $('#f-type').value = S.filters.type;

  const all = S.tasks;
  const count = (st) => all.filter((t) => t.status === st).length;
  $('#summary').innerHTML = STATUS_ORDER.map((st) => {
    const n = count(st);
    if (!n && st === 'reopened') return '';
    return `<button class="sum-pill st-${st} ${S.filters.status === st ? 'on' : ''}" data-act="filter-status" data-status="${st}"><span class="dot"></span>${STATUS_LABEL[st]} <b>${n}</b></button>`;
  }).join('') + (S.filters.status ? `<button class="link-btn" data-act="filter-status" data-status="">Clear filter</button>` : '');

  const toCheck = all.filter((t) => t.status === 'done' && t.done_by !== S.me.id);
  $('#banner').innerHTML = !isLead() && toCheck.length && S.filters.status !== 'done'
    ? `<div class="banner">${icon('check', 16)}<span><b>${toCheck.length} task${toCheck.length > 1 ? 's are' : ' is'} done</b> and waiting for the team to check.</span><button class="btn sm" data-act="filter-status" data-status="done">Show them</button></div>`
    : '';

  const tasks = visibleTasks();
  $('#main').innerHTML = S.view === 'timeline' ? renderTimeline(tasks) : renderBoard(tasks);
  renderSelbar();
}

// ---------------------------------------------------------------- board
function sorter(status) {
  if (status === 'verified') return (a, b) => (b.verified_at || '').localeCompare(a.verified_at || '');
  return (a, b) => (PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]) || lastActivity(b).localeCompare(lastActivity(a));
}
function renderBoard(tasks) {
  const cols = [
    ['reopened', 'Needs changes', 'Team asked for changes — check these first'],
    ['todo', 'To do', 'Newest on top · urgent first'],
    ['in_progress', 'In progress', ''],
    ['done', 'Done · team to check', 'Team: verify ✓ or request changes'],
    ['verified', 'Verified', 'Checked and closed'],
  ];
  if (!S.tasks.length) {
    return `<div class="card-panel" style="margin:40px auto;text-align:center">
      <h1>No tasks yet</h1>
      <p>Add the first one — type it, or press the mic and just say what needs to change.</p>
      <div><button class="btn primary" data-act="new">${icon('plus', 15)}New task</button></div></div>`;
  }
  return `<div class="board">${cols.map(([key, title, hint]) => {
    let list = tasks.filter((t) => t.status === key).sort(sorter(key));
    const total = list.length;
    let more = '';
    if (key === 'verified' && !S.showAllVerified && total > 12) {
      list = list.slice(0, 12);
      more = `<button class="link-btn" data-act="show-verified">Show all ${total}</button>`;
    }
    return `<section class="col col-${key} st-${key}">
      <header class="col-head"><span class="dot"></span><h2>${title}</h2><span class="count">${total}</span></header>
      ${hint ? `<p class="col-hint">${hint}</p>` : ''}
      <div class="col-body">${list.map(cardHTML).join('') || `<p class="empty">${key === 'reopened' ? 'Nothing sent back' : 'Nothing here'}</p>`}${more}</div>
    </section>`;
  }).join('')}</div>`;
}
function countsHTML(t) {
  const img = t.attachments.filter((a) => a.kind === 'image').length;
  const aud = t.attachments.filter((a) => a.kind === 'audio').length;
  const oth = t.attachments.length - img - aud;
  const com = t.updates.filter((u) => u.kind === 'comment' || u.kind === 'rework').length;
  const bits = [];
  if (img) bits.push(`<span title="Screenshots / photos">${icon('image', 13)}${img}</span>`);
  if (aud) bits.push(`<span title="Voice notes">${icon('mic', 13)}${aud}</span>`);
  if (oth) bits.push(`<span title="Files">${icon('clip', 13)}${oth}</span>`);
  if (t.links.length) bits.push(`<span title="Links">${icon('link', 13)}${t.links.length}</span>`);
  if (com) bits.push(`<span title="Updates">${icon('message', 13)}${com}</span>`);
  return bits.length ? `<span class="counts">${bits.join('')}</span>` : '';
}
const prioHTML = (t) => (t.priority === 'urgent' || t.priority === 'high' ? `<span class="prio ${t.priority}">${PRIORITY_LABEL[t.priority]}</span>` : '');
const selBox = (t) => `<label class="sel" title="Select to copy several tasks at once"><input type="checkbox" data-act="select" data-id="${t.id}" ${S.selected.has(t.id) ? 'checked' : ''}></label>`;

function cardHTML(t) {
  const by = member(t.created_by);
  const rw = t.status === 'reopened' ? latestRework(t) : null;
  return `<article class="card st-${t.status} ${S.selected.has(t.id) ? 'selected' : ''}" data-open="${t.id}">
    <div class="card-top">${selBox(t)}<span class="tid">#${t.id}</span><span class="chip type-${t.type}">${TYPE_LABEL[t.type]}</span>${prioHTML(t)}
      <span class="spacer"></span><button class="icon-btn" data-act="copy" data-id="${t.id}" title="Copy task text">${icon('copy', 15)}</button></div>
    <h3 class="card-title">${esc(t.title)}</h3>
    ${t.area ? `<div class="card-area">${icon('pin', 13)}${esc(t.area)}</div>` : ''}
    ${rw ? `<div class="rework-note"><b>${esc(member(rw.author).name)}:</b> ${esc(trunc(rw.body || '(see attachment)', 180))}</div>` : ''}
    <div class="card-meta">${avatar(by)}<span>${esc(by.name)}</span>·<span>${shortDate(t.task_date)}</span>${countsHTML(t)}</div>
    <div class="card-actions">${actionButtons(t)}</div>
  </article>`;
}

// ---------------------------------------------------------------- timeline (the old doc, but sorted & coloured)
function renderTimeline(tasks) {
  const entries = [];
  for (const t of tasks) {
    entries.push({ date: t.task_date, at: t.created_at, t, kind: 'new' });
    for (const u of t.updates) if (u.kind === 'rework') entries.push({ date: localDate(u.created_at), at: u.created_at, t, u, kind: 'rework' });
  }
  if (!entries.length) return `<p class="empty" style="padding:40px">No tasks match.</p>`;
  const days = new Map();
  for (const e of entries.sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))) {
    if (!days.has(e.date)) days.set(e.date, []);
    days.get(e.date).push(e);
  }
  return `<div class="timeline">${[...days].map(([date, list]) => {
    const [h, sub] = dayHeader(date);
    return `<section class="day"><h2>${esc(h)} <small>${esc(sub)} · ${list.length} item${list.length > 1 ? 's' : ''}</small></h2>
      <div class="day-list">${list.map(rowHTML).join('')}</div></section>`;
  }).join('')}</div>`;
}
function rowHTML(e) {
  const t = e.t;
  const by = member(e.kind === 'rework' ? e.u.author : t.created_by);
  return `<div class="row st-${t.status} ${e.kind === 'rework' ? 'rework' : ''} ${S.selected.has(t.id) ? 'selected' : ''}" data-open="${t.id}">
    ${selBox(t)}
    <span class="tid">#${t.id}</span>
    <div class="row-main">
      <div class="row-title">${e.kind === 'rework' ? `<span class="rework-label">${icon('undo', 13)}Changes requested</span>` : ''}${esc(t.title)}</div>
      <div class="row-sub">${avatar(by)}${esc(by.name)} · <span class="chip type-${t.type}">${TYPE_LABEL[t.type]}</span>${prioHTML(t)}${t.area ? ` · ${icon('pin', 12)}${esc(t.area)}` : ''} ${countsHTML(t)}</div>
    </div>
    <div class="row-right">${pill(t.status)}${actionButtons(t)}<button class="icon-btn" data-act="copy" data-id="${t.id}" title="Copy task text">${icon('copy', 15)}</button></div>
    ${e.kind === 'rework' && e.u.body ? `<div class="rework-note">${esc(trunc(e.u.body, 400))}</div>` : ''}
  </div>`;
}

// ---------------------------------------------------------------- selection
function renderSelbar() {
  const n = S.selected.size;
  $('#selbar').innerHTML = n ? `<div class="selbar"><span><b>${n}</b> selected</span>
    <button class="btn sm" data-act="copy-selected">${icon('copy', 14)}Copy ${n > 1 ? 'all' : ''}</button>
    <button class="btn sm" data-act="clear-selected">Clear</button></div>` : '';
}

// ---------------------------------------------------------------- composer (text + voice + files)
function composerHTML({ placeholder = '', rows = 4, value = '', hint = true } = {}) {
  return `<div class="composer">
    <textarea class="input" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
    <div class="voice-live" hidden></div>
    <div class="file-chips"></div>
    <div class="composer-tools">
      <button type="button" class="btn voice-btn">${icon('mic', 15)}<span>Speak</span></button>
      <select class="voice-lang" title="Language you will speak in">
        <option value="en-IN">English</option>
        <option value="hi-IN">हिन्दी (Hindi)</option>
        <option value="hi-en">Hindi → English text</option>
        <option value="auto">Auto-detect</option>
      </select>
      <label class="btn">${icon('clip', 15)}Attach<input type="file" multiple hidden></label>
      ${hint ? '<span class="hint">or paste a screenshot (Ctrl+V) / drop files</span>' : ''}
    </div>
  </div>`;
}

function wireComposer(root) {
  const ta = $('textarea', root);
  const chips = $('.file-chips', root);
  const files = [];
  const maxBytes = S.config.maxUploadMb * 1024 * 1024;

  function addFiles(list) {
    for (const f of list) {
      if (f.size > maxBytes) { toast(`${f.name} is larger than ${S.config.maxUploadMb} MB`, 'error'); continue; }
      files.push(f);
    }
    drawChips();
  }
  function drawChips() {
    chips.innerHTML = '';
    files.forEach((f, i) => {
      const el = document.createElement('span');
      el.className = 'fchip';
      let preview = icon(f.type.startsWith('audio/') ? 'mic' : 'file', 15);
      if (f.type.startsWith('image/')) preview = `<img src="${URL.createObjectURL(f)}" alt="">`;
      el.innerHTML = `${preview}<span title="${esc(f.name)}">${esc(f.name)}</span><small class="muted">${fmtSize(f.size)}</small><button type="button" title="Remove">${icon('x', 14)}</button>`;
      $('button', el).onclick = () => { files.splice(i, 1); drawChips(); };
      chips.append(el);
    });
  }
  $('input[type=file]', root).addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  root.addEventListener('paste', (e) => {
    const pasted = [...(e.clipboardData?.files || [])];
    if (!pasted.length) return;
    e.preventDefault();
    addFiles(pasted.map((f, i) => (f.name && f.name !== 'image.png' ? f
      : new File([f], `screenshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}${i ? '-' + i : ''}.png`, { type: f.type }))));
    toast('Screenshot added');
  });
  root.addEventListener('dragover', (e) => { e.preventDefault(); root.classList.add('drag'); });
  root.addEventListener('dragleave', () => root.classList.remove('drag'));
  root.addEventListener('drop', (e) => { e.preventDefault(); root.classList.remove('drag'); addFiles(e.dataTransfer.files); });

  const voice = wireVoice(root, ta, (f) => addFiles([f]));
  return {
    get text() { return ta.value.trim(); },
    files,
    focus: () => ta.focus(),
    get busy() { return voice.busy; },
    clear() { ta.value = ''; files.length = 0; drawChips(); },
  };
}

// Voice: record audio + live browser speech-to-text; if the server has Whisper,
// the recording is transcribed there instead (better with Hinglish / accents).
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
function wireVoice(root, ta, addFile) {
  const btn = $('.voice-btn', root);
  const lang = $('.voice-lang', root);
  const live = $('.voice-live', root);
  lang.value = ls.get('voiceLang', 'en-IN');
  lang.addEventListener('change', () => ls.set('voiceLang', lang.value));
  if (!S.config.whisper) lang.querySelector('[value="hi-en"]').textContent = 'Hindi → English (needs Whisper)';

  let rec = null, stream = null, recog = null, chunks = [], finalText = '', interim = '', active = false, t0 = 0, timer = null;
  const state = { busy: false };

  const setBtn = (html, cls = '') => { btn.innerHTML = html; btn.className = 'btn voice-btn ' + cls; };
  const tick = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    setBtn(`<span class="pulse"></span>Stop · ${Math.floor(s / 60)}:${pad(s % 60)}`, 'rec');
    live.hidden = false;
    live.textContent = (finalText + interim).trim() || (SpeechRec || S.config.whisper ? 'Listening… speak now' : 'Recording… (text will not be generated in this browser — the audio will be attached)');
  };

  btn.addEventListener('click', () => (active ? stop() : start()));

  async function start() {
    if (state.busy) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      return toast('Voice needs a secure (https) connection and a modern browser.', 'error');
    }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return toast('Microphone permission was blocked. Allow it in the browser address bar.', 'error'); }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m));
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start(1000);
    finalText = ''; interim = ''; active = true; state.busy = true; t0 = Date.now();
    if (SpeechRec) startRecognition();
    tick(); timer = setInterval(tick, 400);
  }

  function startRecognition() {
    recog = new SpeechRec();
    recog.lang = lang.value === 'auto' ? 'en-IN' : lang.value === 'hi-en' ? 'hi-IN' : lang.value;
    recog.continuous = true;
    recog.interimResults = true;
    recog.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript.trim() + ' ';
        else interim += r[0].transcript;
      }
      if (active) tick();
    };
    recog.onerror = () => {};
    recog.onend = () => { if (active) { try { recog.start(); } catch { /* already started */ } } else recog._done?.(); };
    try { recog.start(); } catch { /* ignore */ }
  }

  async function stop() {
    active = false;
    clearInterval(timer);
    setBtn(`${icon('mic', 15)}<span>Processing…</span>`);
    btn.disabled = true;
    const recogDone = recog ? new Promise((res) => { recog._done = res; setTimeout(res, 1500); try { recog.stop(); } catch { res(); } }) : null;
    const blob = await new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); rec.stop(); });
    stream.getTracks().forEach((t) => t.stop());
    if (recogDone) await recogDone;
    const seconds = (Date.now() - t0) / 1000;
    const type = (blob.type || 'audio/webm').split(';')[0];
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `voice-note-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`, { type });

    let text = (finalText + interim).trim();
    if (S.config.whisper && blob.size > 0) {
      live.textContent = 'Turning your voice into text…';
      try {
        const fd = new FormData();
        fd.append('audio', file);
        fd.append('lang', lang.value);
        const r = await api('/api/transcribe', { method: 'POST', form: fd });
        if (r.text) text = r.text;
      } catch (e) { toast('Whisper failed (' + e.message + '). Using the browser transcript.', 'error'); }
    }
    if (text) {
      const cur = ta.value.trimEnd();
      ta.value = cur ? `${cur}\n${text}` : text;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.focus();
    } else {
      toast('No words were caught — the recording is attached so nothing is lost.');
    }
    if (seconds >= 1.5 && blob.size > 0) addFile(file);
    live.hidden = true; live.textContent = '';
    btn.disabled = false;
    setBtn(`${icon('mic', 15)}<span>Speak</span>`);
    state.busy = false;
  }
  return state;
}

// ---------------------------------------------------------------- modals
function openModal(html, { size = '' } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-wrap"><div class="modal ${size}" role="dialog" aria-modal="true">${html}</div></div>`;
  const wrap = $('.modal-wrap', root);
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeModal(); });
  $$('[data-close]', root).forEach((b) => b.addEventListener('click', closeModal));
  return $('.modal', root);
}
const closeModal = () => { $('#modal-root').innerHTML = ''; };

function taskFormHTML(t) {
  const v = t || { title: '', description: '', type: 'update', priority: 'normal', area: '', links: [], task_date: todayStr() };
  const seg = (name, opts, cur) => `<div class="seg">${Object.entries(opts).map(([k, lbl]) =>
    `<label><input type="radio" name="${name}" value="${k}" ${cur === k ? 'checked' : ''}><span>${lbl}</span></label>`).join('')}</div>`;
  return `
    <div class="modal-head"><h2>${t ? `Edit task #${t.id}` : 'New task'}</h2><span class="spacer"></span><button class="icon-btn" data-close title="Close">${icon('x', 18)}</button></div>
    <form class="modal-body" id="task-form">
      <div class="field" style="display:grid;gap:5px"><b style="font-size:13px">What kind of change?</b>${seg('type', TYPE_LABEL, v.type)}</div>
      <label class="field">Title <span class="field-hint">Short — or leave empty and the first line of the description is used</span>
        <input class="input" name="title" maxlength="200" value="${esc(v.title)}" placeholder="e.g. Checkout button not working on mobile"></label>
      <div class="field" style="display:grid;gap:5px"><b style="font-size:13px">Description <span class="field-hint">— type it, or press <b>Speak</b> and explain it in your own words</span></b>
        ${composerHTML({ placeholder: 'What exactly needs to be done? What is wrong now, what should happen instead?', rows: 5, value: v.description })}</div>
      <label class="field">Where to change it <span class="opt">(page, screen, section or URL)</span>
        <input class="input" name="area" maxlength="300" value="${esc(v.area)}" placeholder="e.g. Home page → pricing section"></label>
      <label class="field">Links <span class="opt">(Drive, Figma, Docs, the page… one per line)</span>
        <textarea class="input" name="links" rows="2" style="min-height:60px" placeholder="https://drive.google.com/…">${esc(v.links.join('\n'))}</textarea></label>
      <div class="grid-2">
        <label class="field">Priority<select class="input" name="priority">${Object.entries(PRIORITY_LABEL).map(([k, l]) => `<option value="${k}" ${v.priority === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Date<input class="input" type="date" name="task_date" value="${esc(v.task_date)}"></label>
      </div>
    </form>
    <div class="modal-foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="save-task">${t ? 'Save changes' : 'Add task'}</button></div>`;
}

function openTaskModal(t = null) {
  const modal = openModal(taskFormHTML(t));
  const form = $('#task-form', modal);
  const comp = wireComposer($('.composer', modal));
  setTimeout(() => (t ? $('[name=title]', form).focus() : comp.focus()), 30);
  const save = async () => {
    if (comp.busy) return toast('Stop the recording first');
    const fd = new FormData(form);
    fd.set('description', comp.text);
    if (!String(fd.get('title')).trim() && !comp.text) return toast('Add a title or a description', 'error');
    for (const f of comp.files) fd.append('files', f, f.name);
    const btn = $('#save-task', modal);
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const saved = await api(t ? `/api/tasks/${t.id}` : '/api/tasks', { method: t ? 'PATCH' : 'POST', form: fd });
      closeModal();
      replaceTask(saved);
      toast(t ? `Task #${saved.id} updated` : `Task #${saved.id} added`);
    } catch (e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = t ? 'Save changes' : 'Add task'; }
  };
  $('#save-task', modal).addEventListener('click', save);
  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); });
}

function openChangesModal(t) {
  const modal = openModal(`
    <div class="modal-head"><h2>Request changes on #${t.id}</h2><span class="spacer"></span><button class="icon-btn" data-close>${icon('x', 18)}</button></div>
    <div class="modal-body">
      <p class="muted" style="margin:0">“${esc(t.title)}”<br>Explain what still needs to change. It goes back to the lead under <b>Needs changes</b> and shows up under today's date.</p>
      ${composerHTML({ placeholder: 'What is still wrong / what should be updated?', rows: 4 })}
    </div>
    <div class="modal-foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="send-changes">${icon('undo', 15)}Send back</button></div>`, { size: 'sm' });
  const comp = wireComposer($('.composer', modal));
  setTimeout(comp.focus, 30);
  $('#send-changes', modal).addEventListener('click', async (e) => {
    if (comp.busy) return toast('Stop the recording first');
    if (!comp.text && !comp.files.length) return toast('Say or type what needs to change', 'error');
    const fd = new FormData();
    fd.append('status', 'reopened'); fd.append('note', comp.text);
    for (const f of comp.files) fd.append('files', f, f.name);
    e.currentTarget.disabled = true;
    try {
      replaceTask(await api(`/api/tasks/${t.id}/status`, { method: 'POST', form: fd }));
      closeModal(); toast(`#${t.id} sent back with your notes`);
    } catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; }
  });
}

// ---------------------------------------------------------------- task drawer
let drawerComposer = null;
function openDrawer(id) {
  S.openId = id;
  $('#drawer-root').innerHTML = `<div class="overlay" data-act="close-drawer"></div>
    <aside class="drawer" role="dialog" aria-modal="true">
      <div class="drawer-head" id="drawer-head"></div>
      <div class="drawer-scroll" id="drawer-main"></div>
      <div class="drawer-foot">
        ${composerHTML({ placeholder: 'Add an update, question or extra detail…', rows: 2, hint: false })}
        <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn primary sm" id="post-update">Post update</button></div>
      </div>
    </aside>`;
  drawerComposer = wireComposer($('#drawer-root .drawer-foot .composer'));
  $('#post-update').addEventListener('click', postUpdate);
  renderDrawerMain();
  history.replaceState(null, '', `#task-${id}`);
}
function closeDrawer() {
  S.openId = null; drawerComposer = null;
  $('#drawer-root').innerHTML = '';
  history.replaceState(null, '', location.pathname);
}
async function postUpdate() {
  const comp = drawerComposer;
  if (comp.busy) return toast('Stop the recording first');
  if (!comp.text && !comp.files.length) return toast('Write, speak or attach something first');
  const fd = new FormData();
  fd.append('body', comp.text);
  for (const f of comp.files) fd.append('files', f, f.name);
  const btn = $('#post-update'); btn.disabled = true;
  try { const t = await api(`/api/tasks/${S.openId}/updates`, { method: 'POST', form: fd }); comp.clear(); replaceTask(t); }
  catch (e) { toast(e.message, 'error'); }
  btn.disabled = false;
}

function attachmentsHTML(list, { canRemove }) {
  const imgs = list.filter((a) => a.kind === 'image');
  const rest = list.filter((a) => a.kind !== 'image');
  const rm = (a) => (canRemove(a) ? `<button class="icon-btn rm" data-act="rm-att" data-att="${a.id}" title="Remove">${icon('x', 13)}</button>` : '');
  return (imgs.length ? `<div class="gallery">${imgs.map((a) => `<div class="thumb"><img src="${esc(a.url)}" alt="${esc(a.name)}" loading="lazy" data-act="zoom">${rm(a)}</div>`).join('')}</div>` : '')
    + rest.map((a) => (a.kind === 'audio'
      ? `<div class="file-row">${icon('mic', 15)}<audio controls preload="none" src="${esc(a.url)}"></audio><a class="fname" href="${esc(a.url)}" download="${esc(a.name)}" title="Download">${icon('file', 13)}</a>${rm(a)}</div>`
      : a.kind === 'video'
        ? `<div class="file-row" style="display:block"><video controls preload="metadata" src="${esc(a.url)}" style="width:100%;border-radius:6px"></video>${rm(a)}</div>`
        : `<div class="file-row">${icon('file', 15)}<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a><span class="fname">${fmtSize(a.size)}</span>${rm(a)}</div>`)).join('');
}

function renderDrawerMain() {
  const t = S.tasks.find((x) => x.id === S.openId);
  if (!t) { closeDrawer(); return; }
  const by = member(t.created_by);
  const canEdit = t.created_by === S.me.id || isLead();
  const canRemove = (a) => a.uploaded_by === S.me.id || isLead();
  $('#drawer-head').innerHTML = `<span class="tid">#${t.id}</span>${pill(t.status)}<span class="spacer"></span>
    <button class="btn sm" data-act="copy" data-id="${t.id}">${icon('copy', 14)}Copy</button>
    ${canEdit ? `<button class="icon-btn" data-act="edit" data-id="${t.id}" title="Edit">${icon('edit', 16)}</button>
    <button class="icon-btn" data-act="delete" data-id="${t.id}" title="Delete">${icon('trash', 16)}</button>` : ''}
    <button class="icon-btn" data-act="close-drawer" title="Close (Esc)">${icon('x', 18)}</button>`;

  const taskFiles = t.attachments.filter((a) => !a.update_id);
  const verb = (u) => {
    switch (u.kind) {
      case 'created': return 'added this task';
      case 'comment': return 'posted an update';
      case 'rework': return `<b style="color:var(--reopened)">requested changes</b>`;
      default: return `moved it to ${pill(u.to_status)}`;
    }
  };
  const done = t.done_by ? `${esc(member(t.done_by).name)} · ${timeAgo(t.done_at)}` : '—';
  const ver = t.verified_by ? `${esc(member(t.verified_by).name)} · ${timeAgo(t.verified_at)}` : '—';

  $('#drawer-main').innerHTML = `
    <h1>${esc(t.title)}</h1>
    <div class="meta-grid">
      <div><span>Added by</span><div style="display:flex;gap:6px;align-items:center">${avatar(by)}${esc(by.name)}</div></div>
      <div><span>Date</span>${dayHeader(t.task_date).filter(Boolean).join(', ')}</div>
      <div><span>Type</span><div><span class="chip type-${t.type}">${TYPE_LABEL[t.type]}</span></div></div>
      <div><span>Priority</span>${PRIORITY_LABEL[t.priority]}</div>
      ${t.area ? `<div style="grid-column:1/-1"><span>Where</span>${linkify(t.area)}</div>` : ''}
      <div><span>Marked done</span>${done}</div>
      <div><span>Verified</span>${ver}</div>
    </div>
    <div class="actionbar">${actionButtons(t, { inDetail: true }) || '<span class="note">No actions</span>'}</div>
    <div class="section"><h3>Description</h3>${t.description ? `<div class="desc">${linkify(t.description)}</div>` : '<p class="muted">No description.</p>'}</div>
    ${t.links.length ? `<div class="section"><h3>Links</h3><ul class="links">${t.links.map((l) => `<li>${icon('link', 14)}${/^https?:\/\//i.test(l) ? `<a href="${esc(l)}" target="_blank" rel="noopener">${esc(l)}</a>` : esc(l)}</li>`).join('')}</ul></div>` : ''}
    ${taskFiles.length ? `<div class="section"><h3>Screenshots, files & voice notes</h3>${attachmentsHTML(taskFiles, { canRemove })}</div>` : ''}
    <div class="section"><h3>Activity</h3><div class="activity">${t.updates.slice().reverse().map((u) => {
      const a = member(u.author);
      const files = t.attachments.filter((x) => x.update_id === u.id);
      return `<div class="act ${u.kind}">${avatar(a, 'lg')}<div>
        <div class="act-head"><b>${esc(a.name)}</b> ${verb(u)} <time title="${esc(new Date(u.created_at).toLocaleString())}">${timeAgo(u.created_at)}</time></div>
        ${u.body ? `<div class="act-body">${linkify(u.body)}</div>` : ''}
        ${files.length ? attachmentsHTML(files, { canRemove }) : ''}
      </div></div>`;
    }).join('')}</div></div>`;
}

// ---------------------------------------------------------------- team / identity
function showWho() {
  closeDrawer(); closeModal();
  const active = S.members.filter((m) => m.active);
  $('#app').innerHTML = `<div class="center-screen"><div class="card-panel">
    <div class="brand"><span class="brand-mark">${icon('logo', 16)}</span>Team Workspace</div>
    ${active.length
      ? `<h1>Who are you?</h1><p>Pick your name. This device will remember it.</p>
         <div class="who-list">${active.map((m) => `<button class="who" data-pick="${m.id}">${avatar(m, 'lg')}<b>${esc(m.name)}</b><span class="role">${m.role === 'lead' ? 'Lead' : ''}</span></button>`).join('')}</div>
         <p style="font-size:13px">Not in the list? Add yourself:</p>`
      : `<h1>Set up your team</h1><p>Start with your own name — the first person becomes the <b>lead</b> (the one who picks up and finishes tasks). Teammates add themselves when they open the link.</p>`}
    <form class="inline-form" id="add-me"><input class="input" name="name" placeholder="Your name" maxlength="40" required><button class="btn primary">Join</button></form>
  </div></div>`;
  $$('[data-pick]').forEach((b) => b.addEventListener('click', () => setMe(Number(b.dataset.pick))));
  $('#add-me').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const m = await api('/api/members', { method: 'POST', json: { name: new FormData(e.target).get('name') } });
      await loadMembers();
      setMe(m.id);
    } catch (err) { toast(err.message, 'error'); }
  });
}
async function setMe(id) {
  S.me = S.members.find((m) => m.id === id);
  ls.set('memberId', id);
  renderShell();
  await loadTasks();
  render();
  openFromHash();
}

function showLogin() {
  $('#app').innerHTML = `<div class="center-screen"><form class="card-panel" id="login">
    <div class="brand"><span class="brand-mark">${icon('logo', 16)}</span>Team Workspace</div>
    <h1>Team passcode</h1><p>Ask your lead for the passcode.</p>
    <input class="input" type="password" name="passcode" autocomplete="current-password" required autofocus>
    <button class="btn primary" style="justify-content:center">Enter</button></form></div>`;
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/login', { method: 'POST', json: { passcode: new FormData(e.target).get('passcode') } }); boot(); }
    catch (err) { toast(err.message, 'error'); }
  });
}

function openMeMenu() {
  const root = $('#popover-root');
  if (root.innerHTML) { root.innerHTML = ''; return; }
  root.innerHTML = `<div class="popover">
    <button data-act="switch-user">${icon('swap', 15)}Switch person</button>
    <button data-act="team">${icon('users', 15)}Manage team</button>
    <button data-act="theme">${icon('board', 15)}Theme: ${ls.get('theme', 'auto')}</button>
  </div>`;
}

function openTeamModal() {
  const modal = openModal(`
    <div class="modal-head"><h2>Team</h2><span class="spacer"></span><button class="icon-btn" data-close>${icon('x', 18)}</button></div>
    <div class="modal-body">
      <p class="muted" style="margin:0">The <b>lead</b> picks up tasks and marks them done; everyone else verifies. ${isLead() ? '' : 'Only a lead can change roles.'}</p>
      <div id="team-list"></div>
      <form class="inline-form" id="add-member"><input class="input" name="name" placeholder="Add a teammate's name" maxlength="40" required><button class="btn">Add</button></form>
    </div>`, { size: 'sm' });
  const draw = () => {
    $('#team-list', modal).innerHTML = S.members.filter((m) => m.active).map((m) => `<div class="team-row">${avatar(m, 'lg')}<span class="name">${esc(m.name)}${m.id === S.me.id ? ' <span class="muted">(you)</span>' : ''}</span>
      <span class="chip">${m.role === 'lead' ? 'Lead' : 'Member'}</span>
      ${isLead() ? `<button class="btn sm" data-role="${m.id}" data-to="${m.role === 'lead' ? 'member' : 'lead'}">${m.role === 'lead' ? 'Make member' : 'Make lead'}</button>
      ${m.id !== S.me.id ? `<button class="btn sm danger" data-remove="${m.id}">Remove</button>` : ''}` : ''}</div>`).join('');
  };
  draw();
  modal.addEventListener('click', async (e) => {
    const r = e.target.closest('[data-role]'); const d = e.target.closest('[data-remove]');
    try {
      if (r) await api(`/api/members/${r.dataset.role}`, { method: 'PATCH', json: { role: r.dataset.to } });
      else if (d) { if (!confirm('Remove this person from the team? Their tasks stay.')) return; await api(`/api/members/${d.dataset.remove}`, { method: 'PATCH', json: { active: false } }); }
      else return;
      await loadMembers(); S.me = S.members.find((m) => m.id === S.me.id); draw(); render();
    } catch (err) { toast(err.message, 'error'); }
  });
  $('#add-member', modal).addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/members', { method: 'POST', json: { name: new FormData(e.target).get('name') } }); e.target.reset(); await loadMembers(); draw(); render(); }
    catch (err) { toast(err.message, 'error'); }
  });
}

function applyTheme() {
  const t = ls.get('theme', 'auto');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

// ---------------------------------------------------------------- global events
document.addEventListener('click', async (e) => {
  const pop = $('#popover-root');
  if (pop?.innerHTML && !e.target.closest('.popover') && !e.target.closest('[data-act="me-menu"]')) pop.innerHTML = '';

  const tab = e.target.closest('.tab[data-view]');
  if (tab) { S.view = tab.dataset.view; ls.set('view', S.view); render(); return; }

  const el = e.target.closest('[data-act]');
  const act = el?.dataset.act;
  if (act === 'select') {
    e.stopPropagation();
    const id = Number(el.dataset.id);
    if (el.checked) S.selected.add(id); else S.selected.delete(id);
    el.closest('[data-open]')?.classList.toggle('selected', el.checked);
    renderSelbar();
    return;
  }
  if (e.target.closest('.sel')) return; // clicks on the checkbox label
  const id = Number(el?.dataset.id);
  switch (act) {
    case 'new': return openTaskModal();
    case 'status': return changeStatus(id, el.dataset.to);
    case 'copy': {
      await copyText(taskToText(S.tasks.find((t) => t.id === id)));
      return toast(`Task #${id} copied`);
    }
    case 'copy-selected': {
      const list = S.tasks.filter((t) => S.selected.has(t.id)).sort((a, b) => a.id - b.id);
      await copyText(list.map(taskToText).join('\n\n----------\n\n'));
      return toast(`${list.length} task${list.length > 1 ? 's' : ''} copied`);
    }
    case 'clear-selected': S.selected.clear(); return render();
    case 'filter-status': S.filters.status = S.filters.status === el.dataset.status ? '' : el.dataset.status; return render();
    case 'show-verified': S.showAllVerified = true; return render();
    case 'close-drawer': return closeDrawer();
    case 'edit': return openTaskModal(S.tasks.find((t) => t.id === id));
    case 'delete': {
      if (!confirm(`Delete task #${id}? This can't be undone from the app.`)) return;
      try { await api(`/api/tasks/${id}`, { method: 'DELETE' }); S.tasks = S.tasks.filter((t) => t.id !== id); S.selected.delete(id); closeDrawer(); render(); toast(`#${id} deleted`); }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    case 'rm-att': {
      if (!confirm('Remove this attachment?')) return;
      try { await api(`/api/attachments/${el.dataset.att}`, { method: 'DELETE' }); await refresh(true); }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    case 'zoom': {
      const lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.innerHTML = `<img src="${esc(el.src)}" alt="">`;
      lb.onclick = () => lb.remove();
      document.body.append(lb);
      return;
    }
    case 'me-menu': return openMeMenu();
    case 'switch-user': pop.innerHTML = ''; ls.set('memberId', null); S.me = null; return showWho();
    case 'team': pop.innerHTML = ''; return openTeamModal();
    case 'theme': {
      const order = ['auto', 'light', 'dark'];
      ls.set('theme', order[(order.indexOf(ls.get('theme', 'auto')) + 1) % 3]);
      applyTheme(); pop.innerHTML = ''; return openMeMenu();
    }
  }
  const open = e.target.closest('[data-open]');
  if (open && !e.target.closest('button, a, input, label, audio')) openDrawer(Number(open.dataset.open));
});

document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if (e.key === 'Escape') {
    if ($('.lightbox')) return $('.lightbox').remove();
    if ($('#modal-root').innerHTML) return closeModal();
    if (S.openId) return closeDrawer();
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || !S.me || $('#modal-root').innerHTML) return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openTaskModal(); }
  if (e.key === '/') { e.preventDefault(); $('#q')?.focus(); }
});

function openFromHash() {
  const m = location.hash.match(/^#task-(\d+)$/);
  if (m && S.tasks.some((t) => t.id === Number(m[1]))) openDrawer(Number(m[1]));
}

// ---------------------------------------------------------------- boot
async function boot() {
  applyTheme();
  try {
    S.config = await (await fetch('/api/config')).json();
    if (S.config.needsPasscode && !S.config.authed) return showLogin();
    await loadMembers();
    const saved = ls.get('memberId');
    S.me = S.members.find((m) => m.id === saved && m.active) || null;
    if (!S.me) return showWho();
    await setMe(S.me.id);
  } catch (e) {
    if (e.message !== 'Passcode required') $('#app').innerHTML = `<div class="boot">Could not load: ${esc(e.message)}</div>`;
  }
}
boot();
setInterval(() => { if (!document.hidden && S.me) refresh(); }, 12000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.me) refresh(); });
