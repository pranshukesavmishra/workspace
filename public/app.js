// Team Workspace — front end (no build step, plain ES modules)
import { openAnnotator } from './annotate.js';

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
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  report: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  checksq: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
  chevl: '<path d="m15 18-6-6 6-6"/>',
  chevr: '<path d="m9 18 6-6-6-6"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  markup: '<path d="M5 19 19 5"/><path d="M9 5h10v10"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
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
  config: { appName: 'Finlit Workspace', whisper: false, maxUploadMb: 25 },
  me: null,
  members: [],
  tasks: [],
  version: -1,
  seen: {},                 // taskId -> when I last opened it (server-side, so it follows me across devices)
  feedSeenAt: null,         // when I last opened the activity bell
  latestEventAt: '',
  live: false,              // true while the live-update connection is delivering
  view: ls.get('view', 'board'),
  filters: { q: '', member: '', type: '', status: '', preset: '', from: '', to: '', overdue: false, unread: false },
  selected: new Set(),
  openId: null,
  showAllVerified: false,
  report: { preset: 'today', date: '' },
  lightbox: null,
};
const member = (id) => S.members.find((m) => m.id === id) || { id, name: 'Unknown', color: '#888', role: 'member' };
const isLead = () => S.me?.role === 'lead';
const lastActivity = (t) => t.updates.at(-1)?.created_at || t.created_at;
const latestRework = (t) => [...t.updates].reverse().find((u) => u.kind === 'rework');
const avatar = (m, cls = '') => `<span class="avatar ${cls}" style="background:${esc(m.color)}" title="${esc(m.name)}">${esc(initials(m.name))}</span>`;
const pill = (status) => `<span class="pill st-${status}"><span class="dot st-${status}"></span>${STATUS_LABEL[status]}</span>`;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---- due dates
const shortDue = (s) => {
  const diff = Math.round((parseYmd(s) - parseYmd(todayStr())) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return parseYmd(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};
function dueState(t) {
  if (!t.due_date || t.status === 'done' || t.status === 'verified') return '';
  const today = todayStr();
  if (t.due_date < today) return 'overdue';
  if (t.due_date === today) return 'today';
  const soon = new Date(); soon.setDate(soon.getDate() + 2);
  return t.due_date <= ymd(soon) ? 'soon' : 'later';
}
function dueHTML(t) {
  if (!t.due_date || t.status === 'verified') return '';
  const st = dueState(t) || 'later';
  const label = st === 'overdue' ? `Overdue · was due ${shortDue(t.due_date)}` : st === 'today' ? 'Due today' : `Due ${shortDue(t.due_date)}`;
  return `<span class="due due-${st}" title="Due date: ${esc(t.due_date)}">${icon('clock', 12)}${label}</span>`;
}

// ---- checklist progress
function checklistHTML(t) {
  const n = t.checklist.length;
  if (!n) return '';
  const d = t.checklist.filter((c) => c.done).length;
  return `<span class="cl-prog ${d === n ? 'full' : ''}" title="${d} of ${n} points done">${icon('checksq', 12)}${d}/${n}<i><b style="width:${Math.round((d / n) * 100)}%"></b></i></span>`;
}

// ---- "New for you" / "Updated": anything someone else did after I last opened the task
const baseline = () => S.me?.created_at || '';
function unreadKind(t) {
  if (!S.me) return '';
  const seenAt = S.seen[t.id] || '';
  const since = seenAt > baseline() ? seenAt : baseline();
  if (!t.updates.some((u) => u.author !== S.me.id && u.created_at > since)) return '';
  return !seenAt && t.created_by !== S.me.id ? 'new' : 'updated';
}
const newBadge = (t) => { const k = unreadKind(t); return k ? `<span class="new-badge ${k}">${k === 'new' ? 'New' : 'Updated'}</span>` : ''; };
function markSeen(ids) {
  const at = new Date().toISOString();
  ids.forEach((id) => { S.seen[id] = at; });
  return api('/api/seen', { method: 'POST', json: { ids } }).catch(() => {});
}

// ---- activity feed (the bell)
function feedEvents() {
  const ev = [];
  for (const t of S.tasks) for (const u of t.updates) if (u.author !== S.me.id) ev.push({ t, u });
  return ev.sort((a, b) => b.u.created_at.localeCompare(a.u.created_at));
}
const feedSince = () => (S.feedSeenAt && S.feedSeenAt > baseline() ? S.feedSeenAt : baseline());
const unreadFeedCount = () => feedEvents().filter((e) => e.u.created_at > feedSince()).length;
function eventVerb(u) {
  switch (u.kind) {
    case 'created': return 'added';
    case 'comment': return 'posted an update on';
    case 'rework': return 'requested changes on';
    default:
      return { verified: 'verified', done: 'marked done', in_progress: 'started', todo: 'moved back to to-do' }[u.to_status] || 'updated';
  }
}
function updateBadges() {
  if (!S.me) return;
  const n = unreadFeedCount();
  const b = $('#bell-count');
  if (b) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; }
  document.title = (n ? `(${n}) ` : '') + S.config.appName;
}

// ---- duplicate hint: words shared with an existing open task
const STOP = new Set('the a an and or to of in on for is it this that with be are was not page please should need needs make change update fix add remove from at by as can will new also when there their its have has hai ka ki ke ko me se par aur bhi'.split(' '));
const words = (s) => new Set(String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
function similarTasks(text) {
  const a = words(text);
  if (a.size < 2) return [];
  return S.tasks.filter((t) => t.status !== 'verified').map((t) => {
    const b = words(`${t.title} ${t.description} ${t.area}`);
    let common = 0;
    for (const w of a) if (b.has(w)) common++;
    return { t, common, score: common / Math.max(1, Math.min(a.size, b.size)) };
  }).filter((x) => x.common >= 2 && x.score >= 0.5).sort((x, y) => y.score - x.score).slice(0, 3).map((x) => x.t);
}

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
  lines.push(`Added by ${by.name} · ${t.task_date} · Status: ${STATUS_LABEL[t.status]}${t.due_date ? ` · Due ${t.due_date}` : ''}`);
  if (t.area) lines.push(`Where: ${t.area}`);
  if (t.description) lines.push('', t.description);
  if (t.checklist.length) lines.push('', 'Checklist:', ...t.checklist.map((c) => `- [${c.done ? 'x' : ' '}] ${c.text}`));
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
  // keep my own very recent "seen" marks if the server copy is older (a mark may still be on its way)
  for (const [id, at] of Object.entries(r.seen || {})) if (!S.seen[id] || at > S.seen[id]) S.seen[id] = at;
  if (r.feed_seen_at && (!S.feedSeenAt || r.feed_seen_at > S.feedSeenAt)) S.feedSeenAt = r.feed_seen_at;
  for (const id of [...S.selected]) if (!S.tasks.some((t) => t.id === id)) S.selected.delete(id);
}
const latestEvent = () => S.tasks.reduce((m, t) => t.updates.reduce((mm, u) => (u.created_at > mm ? u.created_at : mm), m), '');
async function refresh(force = false) {
  try {
    const { version } = await api('/api/version');
    if (!force && version === S.version) return;
    const before = S.latestEventAt;
    await Promise.all([loadMembers(), loadTasks()]);
    S.me = S.members.find((m) => m.id === S.me?.id && m.active) || null;
    if (!S.me) return showWho();
    S.latestEventAt = latestEvent();
    render();
    if (S.openId) renderDrawerMain();
    announce(before);
  } catch (e) { if (e.message !== 'Passcode required') console.warn(e); }
}
// Tell me about things other people just did: a small toast while I'm looking, a desktop alert when the tab is in the background.
function announce(since) {
  if (!since || !S.me) return;
  const all = feedEvents().filter((e) => e.u.created_at > since).reverse();
  if (all.length > 2 && !document.hidden) {
    const names = [...new Set(all.map((e) => member(e.u.author).name))];
    return toast(`${names.slice(0, 2).join(' & ')}${names.length > 2 ? ' and others' : ''}: ${all.length} new updates (see the 🔔)`);
  }
  const fresh = all.slice(-3);
  for (const e of fresh) {
    const line = `${member(e.u.author).name} ${eventVerb(e.u)} #${e.t.id}`;
    if (!document.hidden) toast(`${line}: ${trunc(e.t.title, 60)}`);
    else if (ls.get('notify', false) && window.Notification?.permission === 'granted') {
      try {
        const n = new Notification(line, { body: e.u.body ? trunc(e.u.body, 140) : e.t.title, tag: `ws-${e.u.id}` });
        n.onclick = () => { window.focus(); openDrawer(e.t.id); n.close(); };
      } catch { /* some mobile browsers only allow alerts from a service worker */ }
    }
  }
}
// Live updates: the server pushes a message after every change; polling stays as a fallback.
function connectLive() {
  if (!window.EventSource || S.es) return;
  S.es = new EventSource('/api/events');
  S.es.onmessage = (e) => { S.live = true; if (Number(e.data) !== S.version) refresh(); };
  S.es.onerror = () => { S.live = false; };   // the browser reconnects on its own
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
// The date range comes from the quick buttons (always worked out from "today", so it stays right after midnight) or the From / To pickers.
function dateRange() {
  const f = S.filters;
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
  if (f.preset === 'today') return [day(0), day(0)];
  if (f.preset === 'yesterday') return [day(1), day(1)];
  if (f.preset === 'week') return [day(6), day(0)];
  if (f.preset === 'custom') return [f.from || '', f.to || ''];
  return ['', ''];
}
// A task is "in" a date range if it belongs to a day in the range, or changes were requested on it on one of those days
// (the same rule the "By date" view uses to list it under that day).
function visibleTasks({ ignoreStatus = false, ignoreFlags = false } = {}) {
  const { q, member: m, type, status } = S.filters;
  const needle = q.trim().toLowerCase().replace(/^#/, '');
  const [from, to] = dateRange();
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  return S.tasks.filter((t) => {
    if (m && String(t.created_by) !== m) return false;
    if (type && t.type !== type) return false;
    if (!ignoreStatus && status && t.status !== status) return false;
    if (!ignoreFlags && S.filters.overdue && dueState(t) !== 'overdue') return false;
    if (!ignoreFlags && S.filters.unread && !unreadKind(t)) return false;
    if ((from || to) && !inRange(t.task_date) && !t.updates.some((u) => u.kind === 'rework' && inRange(localDate(u.created_at)))) return false;
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
        <div class="brand"><span class="brand-mark">${icon('logo', 16)}</span><span class="name">${esc(S.config.appName)}</span></div>
        <nav class="tabs" role="tablist">
          <button class="tab" data-view="board">${icon('board', 15)}Board</button>
          <button class="tab" data-view="timeline">${icon('calendar', 15)}<span>By date</span></button>
          <button class="tab" data-view="report">${icon('report', 15)}<span>Report</span></button>
        </nav>
        <span class="spacer"></span>
        <span class="live-dot" id="live-dot" title="Live: changes appear instantly"></span>
        <button class="icon-btn bell-btn" data-act="bell" title="Activity">${icon('bell', 19)}<span class="badge" id="bell-count" hidden></span></button>
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
      <button class="btn meet-btn" data-act="meeting" title="Add many tasks at once (M)">${icon('list', 15)}<span>Meeting mode</span></button>
      <button class="btn primary new-btn" data-act="new">${icon('plus', 15)}New task <kbd style="color:inherit;border-color:currentColor;opacity:.7">N</kbd></button>
    </div>
    <div class="datebar" id="datebar">
      <span class="datebar-label">${icon('calendar', 14)}Date</span>
      <button class="date-chip" data-act="date-preset" data-preset="">All dates</button>
      <button class="date-chip" data-act="date-preset" data-preset="today">Today</button>
      <button class="date-chip" data-act="date-preset" data-preset="yesterday">Yesterday</button>
      <button class="date-chip" data-act="date-preset" data-preset="week">Last 7 days</button>
      <label class="date-pick">From <input class="input" type="date" id="d-from"></label>
      <label class="date-pick">To <input class="input" type="date" id="d-to"></label>
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
  const pickDate = () => {
    let from = $('#d-from').value, to = $('#d-to').value;
    if (from && !to) to = from;            // only "From" picked: show just that day
    if (from && to && to < from) to = from;
    S.filters.from = from; S.filters.to = to;
    S.filters.preset = from || to ? 'custom' : '';
    render();
  };
  $('#d-from').addEventListener('change', pickDate);
  $('#d-to').addEventListener('change', pickDate);
}

function render() {
  if (!$('#main')) return;
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === S.view));
  document.body.classList.toggle('view-report', S.view === 'report');
  $('#live-dot')?.classList.toggle('on', S.live);
  const meBtn = $('.me-btn');
  meBtn.innerHTML = `${avatar(S.me)}<span class="who-name">${esc(S.me.name)}</span><span class="role">${isLead() ? 'Lead' : ''}</span>`;

  const fm = $('#f-member');
  fm.innerHTML = `<option value="">Everyone</option>` + S.members.filter((m) => m.active).map((m) => `<option value="${m.id}">Added by ${esc(m.name)}</option>`).join('');
  fm.value = S.filters.member;
  $('#f-type').value = S.filters.type;

  // date bar: highlight the active button, keep the pickers in sync (without rebuilding them while a calendar is open)
  const [dFrom, dTo] = dateRange();
  $$('#datebar .date-chip').forEach((b) => b.classList.toggle('on', b.dataset.preset === S.filters.preset));
  if ($('#d-from').value !== dFrom) $('#d-from').value = dFrom;
  if ($('#d-to').value !== dTo) $('#d-to').value = dTo;

  const all = S.tasks;
  const inScope = visibleTasks({ ignoreStatus: true });   // counts follow the date / person / type / search filters
  const count = (st) => inScope.filter((t) => t.status === st).length;
  $('#summary').innerHTML = STATUS_ORDER.map((st) => {
    const n = count(st);
    if (!n && st === 'reopened') return '';
    return `<button class="sum-pill st-${st} ${S.filters.status === st ? 'on' : ''}" data-act="filter-status" data-status="${st}"><span class="dot"></span>${STATUS_LABEL[st]} <b>${n}</b></button>`;
  }).join('');
  const flagScope = visibleTasks({ ignoreStatus: true, ignoreFlags: true });
  const nNew = flagScope.filter((t) => unreadKind(t)).length;
  const nOver = flagScope.filter((t) => dueState(t) === 'overdue').length;
  $('#summary').innerHTML += (nNew || S.filters.unread ? `<button class="sum-pill pill-new ${S.filters.unread ? 'on' : ''}" data-act="filter-unread"><span class="dot"></span>New for you <b>${nNew}</b></button>` : '')
    + (nOver || S.filters.overdue ? `<button class="sum-pill pill-over ${S.filters.overdue ? 'on' : ''}" data-act="filter-overdue">${icon('clock', 13)}Overdue <b>${nOver}</b></button>` : '')
    + (nNew ? `<button class="link-btn" data-act="mark-all-read">Mark all as read</button>` : '')
    + (S.filters.status || S.filters.unread || S.filters.overdue ? `<button class="link-btn" data-act="clear-flags">Clear filter</button>` : '');

  const toCheck = all.filter((t) => t.status === 'done' && t.done_by !== S.me.id);
  $('#banner').innerHTML = !isLead() && toCheck.length && S.filters.status !== 'done'
    ? `<div class="banner">${icon('check', 16)}<span><b>${toCheck.length} task${toCheck.length > 1 ? 's are' : ' is'} done</b> and waiting for the team to check.</span><button class="btn sm" data-act="filter-status" data-status="done">Show them</button></div>`
    : '';

  const tasks = visibleTasks();
  $('#main').innerHTML = S.view === 'report' ? renderReport() : S.view === 'timeline' ? renderTimeline(tasks) : renderBoard(tasks);
  renderSelbar();
  updateBadges();
}

// ---------------------------------------------------------------- board
function sorter(status) {
  if (status === 'verified') return (a, b) => (b.verified_at || '').localeCompare(a.verified_at || '');
  return (a, b) => (PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])
    || (a.due_date || '9999').localeCompare(b.due_date || '9999')
    || lastActivity(b).localeCompare(lastActivity(a));
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
    return `<section class="col col-${key} st-${key}" data-drop="${key}">
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
  const tags = dueHTML(t) + checklistHTML(t);
  return `<article class="card st-${t.status} ${S.selected.has(t.id) ? 'selected' : ''} ${unreadKind(t) ? 'unread' : ''}" data-open="${t.id}" draggable="true">
    <div class="card-top">${selBox(t)}<span class="tid">#${t.id}</span><span class="chip type-${t.type}">${TYPE_LABEL[t.type]}</span>${prioHTML(t)}${newBadge(t)}
      <span class="spacer"></span><button class="icon-btn" data-act="copy" data-id="${t.id}" title="Copy task text">${icon('copy', 15)}</button></div>
    <h3 class="card-title">${esc(t.title)}</h3>
    ${t.area ? `<div class="card-area">${icon('pin', 13)}${esc(t.area)}</div>` : ''}
    ${rw ? `<div class="rework-note"><b>${esc(member(rw.author).name)}:</b> ${esc(trunc(rw.body || '(see attachment)', 180))}</div>` : ''}
    ${tags ? `<div class="card-tags">${tags}</div>` : ''}
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
  return `<div class="row st-${t.status} ${e.kind === 'rework' ? 'rework' : ''} ${S.selected.has(t.id) ? 'selected' : ''} ${unreadKind(t) ? 'unread' : ''}" data-open="${t.id}">
    ${selBox(t)}
    <span class="tid">#${t.id}</span>
    <div class="row-main">
      <div class="row-title">${e.kind === 'rework' ? `<span class="rework-label">${icon('undo', 13)}Changes requested</span>` : ''}${esc(t.title)}${newBadge(t)}</div>
      <div class="row-sub">${avatar(by)}${esc(by.name)} · <span class="chip type-${t.type}">${TYPE_LABEL[t.type]}</span>${prioHTML(t)}${dueHTML(t)}${checklistHTML(t)}${t.area ? ` · ${icon('pin', 12)}${esc(t.area)}` : ''} ${countsHTML(t)}</div>
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

  async function addFiles(list) {
    for (const raw of [...list]) {
      const f = await shrinkImage(raw);
      if (f.size > maxBytes) { toast(`${f.name} is larger than ${S.config.maxUploadMb} MB`, 'error'); continue; }
      files.push(f);
      drawChips();
    }
  }
  function drawChips() {
    chips.innerHTML = '';
    files.forEach((f, i) => {
      const el = document.createElement('span');
      el.className = 'fchip';
      const isImg = f.type.startsWith('image/') && f.type !== 'image/gif';
      let preview = icon(f.type.startsWith('audio/') ? 'mic' : 'file', 15);
      if (f.type.startsWith('image/')) preview = `<img src="${URL.createObjectURL(f)}" alt="">`;
      el.innerHTML = `${preview}<span title="${esc(f.name)}">${esc(f.name)}</span><small class="muted">${fmtSize(f.size)}</small>`
        + (isImg ? `<button type="button" class="mk" title="Mark up: draw arrows, boxes, text">${icon('markup', 14)}<em>Mark up</em></button>` : '')
        + `<button type="button" class="rmv" title="Remove">${icon('x', 14)}</button>`;
      $('.rmv', el).onclick = () => { files.splice(i, 1); drawChips(); };
      if (isImg) {
        $('.mk', el).onclick = async () => {
          try { const out = await openAnnotator(f, { name: f.name }); if (out) { files[i] = out; drawChips(); } }
          catch (err) { toast(err.message, 'error'); }
        };
      }
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
    add: addFiles,
    clear() { ta.value = ''; files.length = 0; drawChips(); },
  };
}

// Screenshots are often 1–5 MB PNGs. Scale to max 1920px and re-encode (WebP, or JPEG where
// WebP encoding isn't supported): typically 5–10x smaller and text stays readable. GIFs and small files are left alone.
async function shrinkImage(file) {
  if (!/^image\/(png|jpeg|webp|bmp)$/.test(file.type) || file.size < 250 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); // JPEG has no transparency
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    let blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.85));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type });
  } catch { return file; }
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
  const v = t || { title: '', description: '', type: 'update', priority: 'normal', area: '', links: [], task_date: todayStr(), due_date: '' };
  const areas = [...new Set(S.tasks.map((x) => x.area).filter(Boolean))].slice(0, 40);
  const seg = (name, opts, cur) => `<div class="seg">${Object.entries(opts).map(([k, lbl]) =>
    `<label><input type="radio" name="${name}" value="${k}" ${cur === k ? 'checked' : ''}><span>${lbl}</span></label>`).join('')}</div>`;
  return `
    <div class="modal-head"><h2>${t ? `Edit task #${t.id}` : 'New task'}</h2><span class="spacer"></span>
      ${t ? '' : `<button type="button" class="link-btn" data-act="meeting-from-new" style="margin-right:10px">Adding several? ${icon('list', 14)} Meeting mode</button>`}
      <button class="icon-btn" data-close title="Close">${icon('x', 18)}</button></div>
    <form class="modal-body" id="task-form">
      <div class="field" style="display:grid;gap:5px"><b style="font-size:13px">What kind of change?</b>${seg('type', TYPE_LABEL, v.type)}</div>
      <label class="field">Title <span class="field-hint">Short — or leave empty and the first line of the description is used</span>
        <input class="input" name="title" maxlength="200" value="${esc(v.title)}" placeholder="e.g. Checkout button not working on mobile"></label>
      <div class="dupe" id="dupe" hidden></div>
      <div class="field" style="display:grid;gap:5px"><b style="font-size:13px">Description <span class="field-hint">— type it, or press <b>Speak</b> and explain it in your own words</span></b>
        ${composerHTML({ placeholder: 'What exactly needs to be done? What is wrong now, what should happen instead?', rows: 5, value: v.description })}</div>
      <label class="field">Where to change it <span class="opt">(page, screen, section or URL)</span>
        <input class="input" name="area" maxlength="300" value="${esc(v.area)}" placeholder="e.g. Home page → pricing section" list="area-list" autocomplete="off"></label>
      <datalist id="area-list">${areas.map((a) => `<option value="${esc(a)}">`).join('')}</datalist>
      ${t ? '' : `<label class="field">Checklist <span class="opt">(optional · one point per line, ticked off one by one)</span>
        <textarea class="input" name="checklist" rows="3" style="min-height:70px" placeholder="${esc('Make the logo bigger\nChange the menu colour\nFix the footer link')}"></textarea></label>`}
      <label class="field">Links <span class="opt">(Drive, Figma, Docs, the page… one per line)</span>
        <textarea class="input" name="links" rows="2" style="min-height:60px" placeholder="https://drive.google.com/…">${esc(v.links.join('\n'))}</textarea></label>
      <div class="grid-3">
        <label class="field">Priority<select class="input" name="priority">${Object.entries(PRIORITY_LABEL).map(([k, l]) => `<option value="${k}" ${v.priority === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Date<input class="input" type="date" name="task_date" value="${esc(v.task_date)}"></label>
        <label class="field">Due by <span class="opt">(optional)</span><input class="input" type="date" name="due_date" value="${esc(v.due_date || '')}"></label>
      </div>
    </form>
    <div class="modal-foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="save-task">${t ? 'Save changes' : 'Add task'}</button></div>`;
}

function openTaskModal(t = null) {
  const modal = openModal(taskFormHTML(t));
  const form = $('#task-form', modal);
  const comp = wireComposer($('.composer', modal));
  setTimeout(() => (t ? $('[name=title]', form).focus() : comp.focus()), 30);
  if (!t) {
    const box = $('#dupe', modal);
    form.addEventListener('input', debounce(() => {
      const list = similarTasks(`${$('[name=title]', form).value} ${comp.text}`);
      box.hidden = !list.length;
      box.innerHTML = list.length ? `<b>Looks similar to ${list.length > 1 ? 'tasks' : 'a task'} already added:</b>
        ${list.map((x) => `<div>#${x.id} ${esc(trunc(x.title, 80))} ${pill(x.status)}</div>`).join('')}
        <small>If it's the same thing, add your note to that task instead of a new one.</small>` : '';
    }, 350));
  }
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
  const seenAt = S.seen[id] || '';
  S.drawerSince = seenAt > baseline() ? seenAt : baseline();   // updates after this get a "new" highlight
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
  const t = S.tasks.find((x) => x.id === id);
  if (t && unreadKind(t)) { markSeen([id]); render(); }
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
  return (imgs.length ? `<div class="gallery">${imgs.map((a) => `<div class="thumb"><img src="${esc(a.url)}" alt="${esc(a.name)}" loading="lazy" data-act="zoom">${rm(a)}<button class="icon-btn mk" data-act="markup-att" data-url="${esc(a.url)}" data-name="${esc(a.name)}" title="Mark up a copy (arrows, boxes, text)">${icon('markup', 13)}</button></div>`).join('')}</div>` : '')
    + rest.map((a) => (a.kind === 'audio'
      ? `<div class="file-row">${icon('mic', 15)}<audio controls preload="none" src="${esc(a.url)}"></audio><a class="fname" href="${esc(a.url)}" download="${esc(a.name)}" title="Download">${icon('file', 13)}</a>${rm(a)}</div>`
      : a.kind === 'video'
        ? `<div class="file-row" style="display:block"><video controls preload="metadata" src="${esc(a.url)}" style="width:100%;border-radius:6px"></video>${rm(a)}</div>`
        : `<div class="file-row">${icon('file', 15)}<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a><span class="fname">${fmtSize(a.size)}</span>${rm(a)}</div>`)).join('');
}

function renderDrawerMain() {
  const t = S.tasks.find((x) => x.id === S.openId);
  if (!t) { closeDrawer(); return; }
  // keep what someone is typing in the checklist box, and the scroll position, when live updates re-draw the panel
  const prevAdd = $('#cl-add');
  const keep = prevAdd ? { v: prevAdd.value, focus: document.activeElement === prevAdd } : null;
  const scroller = $('#drawer-main');
  const scrollTop = scroller ? scroller.scrollTop : 0;
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
      <div><span>Due</span>${t.due_date ? (dueHTML(t) || esc(shortDue(t.due_date))) : '<span class="muted">—</span>'}</div>
      ${t.area ? `<div style="grid-column:1/-1"><span>Where</span>${linkify(t.area)}</div>` : ''}
      <div><span>Marked done</span>${done}</div>
      <div><span>Verified</span>${ver}</div>
    </div>
    <div class="actionbar">${actionButtons(t, { inDetail: true }) || '<span class="note">No actions</span>'}</div>
    <div class="section"><h3>Description</h3>${t.description ? `<div class="desc">${linkify(t.description)}</div>` : '<p class="muted">No description.</p>'}</div>
    ${checklistSection(t)}
    ${t.links.length ? `<div class="section"><h3>Links</h3><ul class="links">${t.links.map((l) => `<li>${icon('link', 14)}${/^https?:\/\//i.test(l) ? `<a href="${esc(l)}" target="_blank" rel="noopener">${esc(l)}</a>` : esc(l)}</li>`).join('')}</ul></div>` : ''}
    ${taskFiles.length ? `<div class="section"><h3>Screenshots, files & voice notes</h3>${attachmentsHTML(taskFiles, { canRemove })}</div>` : ''}
    <div class="section"><h3>Activity</h3><div class="activity">${t.updates.slice().reverse().map((u) => {
      const a = member(u.author);
      const files = t.attachments.filter((x) => x.update_id === u.id);
      const fresh = u.author !== S.me.id && u.created_at > (S.drawerSince || '');
      return `<div class="act ${u.kind} ${fresh ? 'fresh' : ''}">${avatar(a, 'lg')}<div>
        <div class="act-head"><b>${esc(a.name)}</b> ${verb(u)} ${fresh ? '<span class="new-badge updated">New</span>' : ''}<time title="${esc(new Date(u.created_at).toLocaleString())}">${timeAgo(u.created_at)}</time></div>
        ${u.body ? `<div class="act-body">${linkify(u.body)}</div>` : ''}
        ${files.length ? attachmentsHTML(files, { canRemove }) : ''}
      </div></div>`;
    }).join('')}</div></div>`;
  if (keep) { const n = $('#cl-add'); if (n) { n.value = keep.v; if (keep.focus) n.focus(); } }
  if (scroller) scroller.scrollTop = scrollTop;
}

function checklistSection(t) {
  const cl = t.checklist;
  const done = cl.filter((c) => c.done).length;
  return `<div class="section checklist"><h3>Checklist ${cl.length ? `<span class="cl-count">${done}/${cl.length} done</span>` : ''}</h3>
    ${cl.length ? `<div class="cl-bar"><b style="width:${Math.round((done / cl.length) * 100)}%"></b></div>` : ''}
    <ul class="cl-list">${cl.map((c) => `<li class="${c.done ? 'done' : ''}">
      <label><input type="checkbox" data-act="cl-toggle" data-item="${c.id}" ${c.done ? 'checked' : ''}><span>${linkify(c.text)}</span></label>
      ${c.done && c.done_by ? `<small title="${esc(new Date(c.done_at).toLocaleString())}">${esc(member(c.done_by).name)}</small>` : ''}
      <button class="icon-btn cl-rm" data-act="cl-remove" data-item="${c.id}" title="Remove this point">${icon('x', 13)}</button></li>`).join('')}</ul>
    <form class="cl-add" id="cl-add-form"><input class="input" id="cl-add" maxlength="300" autocomplete="off"
      placeholder="${cl.length ? 'Add another point… (Enter)' : 'Split it into points (optional): type one and press Enter'}"></form>
  </div>`;
}

// ---------------------------------------------------------------- team / identity
function showWho() {
  closeDrawer(); closeModal();
  const active = S.members.filter((m) => m.active);
  $('#app').innerHTML = `<div class="center-screen"><div class="card-panel">
    <div class="brand"><span class="brand-mark">${icon('logo', 16)}</span>${esc(S.config.appName)}</div>
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
  S.seen = {}; S.feedSeenAt = null;
  renderShell();
  await loadTasks();
  S.latestEventAt = latestEvent();
  render();
  openFromHash();
  connectLive();
}

function showLogin() {
  $('#app').innerHTML = `<div class="center-screen"><form class="card-panel" id="login">
    <div class="brand"><span class="brand-mark">${icon('logo', 16)}</span>${esc(S.config.appName)}</div>
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
  if (root.innerHTML && root.dataset.kind === 'me') { root.innerHTML = ''; return; }
  root.dataset.kind = 'me';
  root.innerHTML = `<div class="popover">
    <button data-act="switch-user">${icon('swap', 15)}Switch person</button>
    <button data-act="team">${icon('users', 15)}Manage team</button>
    <button data-act="theme">${icon('sun', 15)}Theme: ${ls.get('theme', 'auto')}</button>
    ${window.Notification ? `<button data-act="notify-toggle">${icon('bell', 15)}Desktop alerts: ${ls.get('notify', false) && Notification.permission === 'granted' ? 'on' : 'off'}</button>` : ''}
    ${S.installPrompt ? `<button data-act="install">${icon('phone', 15)}Install as an app</button>` : ''}
  </div>`;
}

function openTeamModal() {
  const modal = openModal(`
    <div class="modal-head"><h2>Team</h2><span class="spacer"></span><button class="icon-btn" data-close>${icon('x', 18)}</button></div>
    <div class="modal-body">
      <p class="muted" style="margin:0">The <b>lead</b> picks up tasks and marks them done; everyone else verifies. ${isLead() ? '' : 'Only a lead can change roles.'}</p>
      <div id="team-list"></div>
      <p class="muted" id="storage" style="margin:0;font-size:13px"></p>
      <form class="inline-form" id="add-member"><input class="input" name="name" placeholder="Add a teammate's name" maxlength="40" required><button class="btn">Add</button></form>
    </div>`, { size: 'sm' });
  const draw = () => {
    $('#team-list', modal).innerHTML = S.members.filter((m) => m.active).map((m) => `<div class="team-row">${avatar(m, 'lg')}<span class="name">${esc(m.name)}${m.id === S.me.id ? ' <span class="muted">(you)</span>' : ''}</span>
      <span class="chip">${m.role === 'lead' ? 'Lead' : 'Member'}</span>
      ${isLead() ? `<button class="btn sm" data-role="${m.id}" data-to="${m.role === 'lead' ? 'member' : 'lead'}">${m.role === 'lead' ? 'Make member' : 'Make lead'}</button>
      ${m.id !== S.me.id ? `<button class="btn sm danger" data-remove="${m.id}">Remove</button>` : ''}` : ''}</div>`).join('');
  };
  draw();
  api('/api/stats').then((s) => {
    $('#storage', modal).textContent = `Storage used: ${fmtSize(s.bytes)} · ${s.images} screenshots/photos, ${s.audio} voice notes, ${s.files} other files · ${s.tasks} tasks`;
  }).catch(() => {});
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


// ---------------------------------------------------------------- activity bell
function openBell() {
  const root = $('#popover-root');
  if (root.innerHTML && root.dataset.kind === 'bell') { root.innerHTML = ''; return; }
  root.dataset.kind = 'bell';
  const since = feedSince();
  const ev = feedEvents().slice(0, 50);
  root.innerHTML = `<div class="popover bell-pop">
    <div class="bell-head"><b>Activity</b><span class="spacer"></span>${ev.length ? '<button class="link-btn" data-act="mark-all-read">Mark everything as read</button>' : ''}</div>
    <div class="bell-list">${ev.length ? ev.map((e) => `<button class="bell-item ${e.u.created_at > since ? 'unread' : ''}" data-act="open-task" data-id="${e.t.id}">
        ${avatar(member(e.u.author))}
        <span class="bell-text"><span><b>${esc(member(e.u.author).name)}</b> ${eventVerb(e.u)} <b>#${e.t.id}</b> ${esc(trunc(e.t.title, 70))}</span>
        ${e.u.body ? `<small>“${esc(trunc(e.u.body, 110))}”</small>` : ''}<time>${timeAgo(e.u.created_at)}</time></span></button>`).join('')
      : '<p class="empty">Nothing from the team yet.</p>'}</div></div>`;
  S.feedSeenAt = new Date().toISOString();
  api('/api/feed-seen', { method: 'POST', json: {} }).catch(() => {});
  updateBadges();
}

// ---------------------------------------------------------------- image viewer
function openLightbox(items, index) {
  let i = index;
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  const draw = () => {
    const it = items[i];
    lb.innerHTML = `<img src="${esc(it.url)}" alt="">
      <div class="lb-bar"><span class="lb-name">${items.length > 1 ? `${i + 1} / ${items.length} · ` : ''}${esc(it.name)}</span><span class="spacer"></span>
        ${S.openId ? `<button class="btn sm" data-lb="markup">${icon('markup', 14)}Mark up</button>` : ''}
        <a class="btn sm" href="${esc(it.url)}" download="${esc(it.name)}">${icon('download', 14)}Download</a>
        <button class="btn sm" data-lb="close" title="Close (Esc)">${icon('x', 14)}</button></div>
      ${items.length > 1 ? `<button class="lb-nav prev" data-lb="prev" title="Previous (←)">${icon('chevl', 28)}</button><button class="lb-nav next" data-lb="next" title="Next (→)">${icon('chevr', 28)}</button>` : ''}`;
  };
  const api_ = {
    next() { i = (i + 1) % items.length; draw(); },
    prev() { i = (i - 1 + items.length) % items.length; draw(); },
    close() { lb.remove(); S.lightbox = null; },
  };
  lb.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const b = e.target.closest('[data-lb]');
    if (!b) { if (e.target.tagName !== 'IMG') api_.close(); return; }
    const k = b.dataset.lb;
    if (k === 'markup') { const it = items[i]; api_.close(); markupAttachment(it.url, it.name); }
    else api_[k]();
  });
  draw();
  document.body.append(lb);
  S.lightbox = api_;
}
async function markupAttachment(url, name) {
  try {
    const file = await openAnnotator(url, { name });
    if (!file || !drawerComposer) return;
    await drawerComposer.add([file]);
    drawerComposer.focus();
    toast('Marked-up copy added below. Add a note and press "Post update".');
  } catch (err) { toast(err.message, 'error'); }
}

// ---------------------------------------------------------------- meeting mode: many tasks at once
// One task per line. Indented lines (or "  - ...") under a task become its checklist points.
function parseBulk(text) {
  const items = [];
  for (const raw of String(text).split('\n')) {
    if (!raw.trim()) continue;
    const indented = /^(\s{2,}|\t)/.test(raw);
    const line = raw.trim().replace(/^([-*•·▪◦>]|\d+[.)]|\[[ xX]?\])\s*/, '').trim();
    if (!line) continue;
    if (indented && items.length) items.at(-1).checklist.push(line);
    else items.push({ title: line.slice(0, 200), checklist: [] });
  }
  return items;
}
function openMeetingModal() {
  const areas = [...new Set(S.tasks.map((x) => x.area).filter(Boolean))].slice(0, 40);
  const modal = openModal(`
    <div class="modal-head"><h2>${icon('list', 18)} Meeting mode</h2><span class="spacer"></span><button class="icon-btn" data-close title="Close">${icon('x', 18)}</button></div>
    <div class="modal-body meeting">
      <p class="muted" style="margin:0">Type, paste or <b>speak</b> the points from the meeting: <b>one task per line</b>.
        Start a line with two spaces (or a tab) to make it a checklist point of the task above. Press <b>Speak</b> once per task.</p>
      ${composerHTML({ placeholder: 'Fix the header logo size\nBlog: wrong date format\n  list page\n  detail page\nAdd UPI option on the pricing page', rows: 8, hint: false })}
      <div class="grid-3">
        <label class="field">Type<select class="input" name="type">${Object.entries(TYPE_LABEL).map(([k, l]) => `<option value="${k}" ${k === 'update' ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Priority<select class="input" name="priority">${Object.entries(PRIORITY_LABEL).map(([k, l]) => `<option value="${k}" ${k === 'normal' ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Due by <span class="opt">(optional)</span><input class="input" type="date" name="due_date"></label>
      </div>
      <div class="grid-2">
        <label class="field">Date<input class="input" type="date" name="task_date" value="${todayStr()}"></label>
        <label class="field">Where <span class="opt">(optional, for all)</span><input class="input" name="area" list="area-list2" autocomplete="off" placeholder="e.g. Website"></label>
      </div>
      <datalist id="area-list2">${areas.map((a) => `<option value="${esc(a)}">`).join('')}</datalist>
      <div class="bulk-preview" id="bulk-preview"></div>
    </div>
    <div class="modal-foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="bulk-save" disabled>Add tasks</button></div>`);
  modal.classList.add('no-files');
  const comp = wireComposer($('.composer', modal));
  const preview = $('#bulk-preview', modal);
  const btn = $('#bulk-save', modal);
  const update = () => {
    const items = parseBulk($('textarea', modal).value);
    btn.disabled = !items.length;
    btn.textContent = items.length ? `Add ${items.length} task${items.length > 1 ? 's' : ''}` : 'Add tasks';
    preview.innerHTML = items.length ? `<b>Preview</b><ol>${items.map((it) => `<li>${esc(it.title)}${it.checklist.length ? ` <span class="muted">· ${it.checklist.length} point${it.checklist.length > 1 ? 's' : ''}</span>` : ''}</li>`).join('')}</ol>` : '';
  };
  $('textarea', modal).addEventListener('input', update);
  setTimeout(comp.focus, 30);
  btn.addEventListener('click', async () => {
    if (comp.busy) return toast('Stop the recording first');
    const items = parseBulk($('textarea', modal).value);
    if (!items.length) return;
    const val = (n) => $(`[name=${n}]`, modal).value;
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      const r = await api('/api/tasks/bulk', { method: 'POST', json: { items, type: val('type'), priority: val('priority'), due_date: val('due_date'), task_date: val('task_date'), area: val('area') } });
      closeModal();
      await refresh(true);
      toast(`Added ${r.ids.length} task${r.ids.length > 1 ? 's' : ''}: #${r.ids[0]}${r.ids.length > 1 ? `–#${r.ids.at(-1)}` : ''}`);
    } catch (err) { toast(err.message, 'error'); update(); }
  });
}

// ---------------------------------------------------------------- report (daily / weekly summary)
function reportRange() {
  const r = S.report;
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
  if (r.preset === 'yesterday') return [day(1), day(1), 'Yesterday'];
  if (r.preset === 'week') return [day((new Date().getDay() + 6) % 7), day(0), 'This week'];
  if (r.preset === 'last7') return [day(6), day(0), 'Last 7 days'];
  if (r.preset === 'date' && r.date) return [r.date, r.date, dayHeader(r.date).filter(Boolean).join(', ')];
  return [day(0), day(0), 'Today'];
}
function reportData() {
  const [from, to, label] = reportRange();
  const inRange = (iso) => { const d = localDate(iso); return d >= from && d <= to; };
  const by = (pred) => {
    const out = new Map();
    for (const t of S.tasks) for (const u of t.updates) if (pred(u) && inRange(u.created_at)) out.set(t.id, { t, u });
    return [...out.values()].sort((a, b) => a.t.id - b.t.id);
  };
  const open = Object.fromEntries(['reopened', 'todo', 'in_progress', 'done'].map((st) => [st, S.tasks.filter((t) => t.status === st).length]));
  const people = S.members.filter((m) => m.active).map((m) => ({
    m,
    added: S.tasks.filter((t) => t.created_by === m.id && t.task_date >= from && t.task_date <= to).length,
    done: by((u) => u.to_status === 'done' && u.author === m.id).length,
    verified: by((u) => u.to_status === 'verified' && u.author === m.id).length,
    rework: by((u) => u.kind === 'rework' && u.author === m.id).length,
  }));
  return {
    from, to, label, open, people,
    verified: by((u) => u.to_status === 'verified').filter((x) => x.t.status === 'verified'),
    done: by((u) => u.to_status === 'done').filter((x) => x.t.status === 'done'),
    rework: by((u) => u.kind === 'rework'),
    started: by((u) => u.to_status === 'in_progress').filter((x) => x.t.status === 'in_progress'),
    added: S.tasks.filter((t) => t.task_date >= from && t.task_date <= to).sort((a, b) => a.id - b.id),
    overdue: S.tasks.filter((t) => dueState(t) === 'overdue').sort((a, b) => a.due_date.localeCompare(b.due_date)),
  };
}
function renderReport() {
  const d = reportData();
  const range = d.from === d.to ? dayHeader(d.from).filter(Boolean).join(', ') : `${shortDate(d.from)} – ${shortDate(d.to)}`;
  const tile = (cls, n, label) => `<div class="stat st-${cls}"><b>${n}</b><span>${label}</span></div>`;
  const list = (title, cls, rows, empty) => `<section class="rep-card st-${cls}"><h3><span class="dot"></span>${title}<span class="count">${rows.length}</span></h3>
    ${rows.length ? `<ul>${rows.map((x) => { const t = x.t || x; const who = member(x.u ? x.u.author : t.created_by); return `<li data-open="${t.id}"><span class="tid">#${t.id}</span><span class="rep-title">${esc(t.title)}</span>${avatar(who)}</li>`; }).join('')}</ul>` : `<p class="empty">${empty}</p>`}</section>`;
  const chip = (k, label) => `<button class="date-chip ${S.report.preset === k ? 'on' : ''}" data-act="report-preset" data-preset="${k}">${label}</button>`;
  const openTotal = d.open.reopened + d.open.todo + d.open.in_progress + d.open.done;
  return `<div class="report">
    <div class="rep-head">
      <div class="rep-presets">${chip('today', 'Today')}${chip('yesterday', 'Yesterday')}${chip('week', 'This week')}${chip('last7', 'Last 7 days')}
        <label class="date-pick">Day <input class="input" type="date" id="rep-date" value="${S.report.preset === 'date' ? esc(S.report.date) : ''}"></label></div>
      <button class="btn primary" data-act="copy-report">${icon('copy', 15)}Copy for WhatsApp</button>
    </div>
    <h2 class="rep-range">${esc(d.label)} <small>${esc(range)}</small></h2>
    <div class="stats">
      ${tile('verified', d.verified.length, 'Verified')}
      ${tile('done', d.done.length, 'Done · to check')}
      ${tile('reopened', d.rework.length, 'Changes requested')}
      ${tile('todo', d.added.length, 'New tasks')}
      ${tile('open', openTotal, 'Open right now')}
      ${tile('overdue', d.overdue.length, 'Overdue')}
    </div>
    <div class="rep-grid">
      ${list('Verified', 'verified', d.verified, 'Nothing verified in this period')}
      ${list('Done, waiting for the team to check', 'done', d.done, 'Nothing waiting')}
      ${list('Changes requested', 'reopened', d.rework, 'No changes requested')}
      ${list('Started', 'in_progress', d.started, 'Nothing started')}
      ${list('New tasks', 'todo', d.added, 'No new tasks')}
      ${list('Overdue now', 'overdue', d.overdue, 'Nothing overdue')}
    </div>
    <section class="rep-card people"><h3>By person <span class="muted" style="font-weight:500">(${esc(d.label.toLowerCase())})</span></h3>
      <table><thead><tr><th></th><th>Added</th><th>Marked done</th><th>Verified</th><th>Changes asked</th></tr></thead>
      <tbody>${d.people.map((p) => `<tr><td>${avatar(p.m)} ${esc(p.m.name)}</td><td>${p.added}</td><td>${p.done}</td><td>${p.verified}</td><td>${p.rework}</td></tr>`).join('')}</tbody></table>
    </section>
  </div>`;
}
function reportText() {
  const d = reportData();
  const when = d.from === d.to ? parseYmd(d.from).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    : `${parseYmd(d.from).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${parseYmd(d.to).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  const L = [`*${S.config.appName}: ${d.label} (${when})*`];
  const sec = (title, rows) => {
    if (!rows.length) return;
    L.push('', `${title} (${rows.length})`);
    for (const x of rows.slice(0, 40)) { const t = x.t || x; L.push(`• #${t.id} ${t.title}`); }
  };
  sec('✅ *Verified*', d.verified);
  sec('🟢 *Done, waiting for check*', d.done);
  sec('🔄 *Changes requested*', d.rework);
  sec('🟡 *Started*', d.started);
  sec('🆕 *New tasks*', d.added);
  if (d.overdue.length) {
    L.push('', `⏰ *Overdue* (${d.overdue.length})`);
    for (const t of d.overdue.slice(0, 20)) L.push(`• #${t.id} ${t.title} (due ${shortDue(t.due_date)})`);
  }
  L.push('', `📌 Open now: ${d.open.todo} to do · ${d.open.reopened} need changes · ${d.open.in_progress} in progress · ${d.open.done} to check`);
  return L.join('\n');
}

// ---------------------------------------------------------------- drag & drop between board columns (desktop)
function dropTargets(t) { return actionsFor(t).filter((a) => a.to).map((a) => a.to); }
document.addEventListener('dragstart', (e) => {
  const card = e.target.closest?.('.card[data-open]');
  if (!card) return;
  S.dragId = Number(card.dataset.open);
  e.dataTransfer.setData('text/plain', String(S.dragId));
  e.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
  const t = S.tasks.find((x) => x.id === S.dragId);
  const ok = dropTargets(t);
  $$('.col[data-drop]').forEach((c) => { if (c.dataset.drop !== t.status) c.classList.add(ok.includes(c.dataset.drop) ? 'drop-ok' : 'drop-no'); });
});
document.addEventListener('dragend', () => {
  S.dragId = null;
  $$('.dragging').forEach((x) => x.classList.remove('dragging'));
  $$('.col').forEach((c) => c.classList.remove('drop-ok', 'drop-no', 'drop-over'));
});
document.addEventListener('dragover', (e) => {
  const col = e.target.closest?.('.col.drop-ok');
  if (!col || !S.dragId) return;
  e.preventDefault();
  $$('.drop-over').forEach((x) => x !== col && x.classList.remove('drop-over'));
  col.classList.add('drop-over');
});
document.addEventListener('drop', (e) => {
  const col = e.target.closest?.('.col[data-drop]');
  if (!col || !S.dragId) return;
  e.preventDefault();
  const id = S.dragId;
  if (col.classList.contains('drop-ok')) changeStatus(id, col.dataset.drop);
  else if (col.classList.contains('drop-no')) toast(`#${id} can't go straight to "${STATUS_LABEL[col.dataset.drop]}"`, 'error');
});

// checklist "add" box and the report's day picker
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'cl-add-form') return;
  e.preventDefault();
  const input = $('#cl-add');
  const text = input.value.trim();
  if (!text || !S.openId) return;
  input.value = '';
  try { replaceTask(await api(`/api/tasks/${S.openId}/checklist`, { method: 'POST', json: { op: 'add', text } })); $('#cl-add')?.focus(); }
  catch (err) { toast(err.message, 'error'); input.value = text; }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'rep-date') { S.report = e.target.value ? { preset: 'date', date: e.target.value } : { preset: 'today', date: '' }; render(); }
});
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installPrompt = e; });

// ---------------------------------------------------------------- global events
document.addEventListener('click', async (e) => {
  const pop = $('#popover-root');
  if (pop?.innerHTML && !e.target.closest('.popover') && !e.target.closest('[data-act="me-menu"], [data-act="bell"]')) pop.innerHTML = '';

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
    case 'date-preset': S.filters.preset = el.dataset.preset; S.filters.from = ''; S.filters.to = ''; return render();
    case 'filter-status': S.filters.status = S.filters.status === el.dataset.status ? '' : el.dataset.status; return render();
    case 'filter-unread': S.filters.unread = !S.filters.unread; return render();
    case 'filter-overdue': S.filters.overdue = !S.filters.overdue; return render();
    case 'clear-flags': Object.assign(S.filters, { status: '', unread: false, overdue: false }); return render();
    case 'mark-all-read': {
      const at = new Date().toISOString();
      S.tasks.forEach((t) => { S.seen[t.id] = at; });
      S.feedSeenAt = at; pop.innerHTML = ''; S.filters.unread = false; render();
      api('/api/seen', { method: 'POST', json: { all: true } }).catch(() => {});
      return toast('All caught up');
    }
    case 'bell': return openBell();
    case 'open-task': pop.innerHTML = ''; return openDrawer(id);
    case 'meeting': return openMeetingModal();
    case 'meeting-from-new': closeModal(); return openMeetingModal();
    case 'report-preset': S.report = { preset: el.dataset.preset, date: '' }; return render();
    case 'copy-report': await copyText(reportText()); return toast('Report copied, paste it in WhatsApp');
    case 'cl-toggle':
    case 'cl-remove': {
      if (act === 'cl-remove' && !confirm('Remove this point?')) return;
      try { replaceTask(await api(`/api/tasks/${S.openId}/checklist`, { method: 'POST', json: { op: act === 'cl-toggle' ? 'toggle' : 'remove', item: el.dataset.item } })); }
      catch (err) { toast(err.message, 'error'); renderDrawerMain(); }
      return;
    }
    case 'markup-att': return markupAttachment(el.dataset.url, el.dataset.name);
    case 'notify-toggle': {
      pop.innerHTML = '';
      if (ls.get('notify', false) && Notification.permission === 'granted') { ls.set('notify', false); return toast('Desktop alerts off'); }
      const perm = await Notification.requestPermission();
      ls.set('notify', perm === 'granted');
      return toast(perm === 'granted' ? 'Desktop alerts on: you will be told when the team adds or changes something' : 'Alerts are blocked in this browser\'s settings', perm === 'granted' ? '' : 'error');
    }
    case 'install': pop.innerHTML = ''; S.installPrompt?.prompt(); S.installPrompt = null; return;
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
      const imgs = $$('#drawer-main img[data-act="zoom"]');
      const items = imgs.map((im) => ({ url: im.getAttribute('src'), name: im.alt || 'image' }));
      return openLightbox(items.length ? items : [{ url: el.getAttribute('src'), name: el.alt }], Math.max(0, imgs.indexOf(el)));
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
  if (open && !e.target.closest('button, a, input, label, audio, .rep-presets')) openDrawer(Number(open.dataset.open));
});

document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if (S.lightbox) {
    if (e.key === 'Escape') return S.lightbox.close();
    if (e.key === 'ArrowRight') return S.lightbox.next();
    if (e.key === 'ArrowLeft') return S.lightbox.prev();
  }
  if (e.key === 'Escape') {
    if ($('#popover-root')?.innerHTML) { $('#popover-root').innerHTML = ''; return; }
    if ($('#modal-root').innerHTML) return closeModal();
    if (S.openId) return closeDrawer();
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || !S.me || $('#modal-root').innerHTML) return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openTaskModal(); }
  if (e.key === 'm' || e.key === 'M') { e.preventDefault(); openMeetingModal(); }
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
    document.title = S.config.appName;
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
setInterval(() => { if (!document.hidden && S.me && !S.live) refresh(); }, 12000);   // fallback when live updates aren't getting through
setInterval(() => { if (S.me) refresh(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.me) refresh(); });
