import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createStorage } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- configuration (all optional, see .env.example) ----------
const PORT = Number(process.env.PORT || 3000);
const APP_NAME = (process.env.APP_NAME || 'Finlit Workspace').slice(0, 60);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PASSCODE = process.env.TEAM_PASSCODE || '';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 25);
const WHISPER_KEY = process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY || '';
const WHISPER_BASE = (process.env.WHISPER_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'whisper-1';
// Optional key for scripts / Claude: "Authorization: Bearer <API_TOKEN>" works like the team passcode (min. 16 characters).
const API_TOKEN = (process.env.API_TOKEN || '').length >= 16 ? process.env.API_TOKEN : '';
const WHISPER_PROMPT = process.env.WHISPER_PROMPT ||
  'Team task update for a software project. May mix Hindi and English (Hinglish).';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const remote = createStorage(process.env);
const DB_FILE = path.join(DATA_DIR, 'workspace.db');
if (remote && !fs.existsSync(DB_FILE)) {
  // Fresh container (free hosts wipe the disk on restart): bring the database back from the bucket.
  // If the bucket can't be reached we stop here instead of starting empty and overwriting the real copy.
  const saved = await remote.get('db/workspace.db');
  if (saved) { fs.writeFileSync(DB_FILE, saved); console.log(`Restored database from ${remote.describe} (${saved.length} bytes)`); }
  else console.log(`No saved database in ${remote.describe} yet: starting fresh`);
}
const db = openDb(DB_FILE);

const TYPES = ['bug', 'update', 'feature', 'other'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const TRANSITIONS = {
  todo:        ['in_progress', 'done'],
  in_progress: ['done', 'todo'],
  done:        ['verified', 'reopened', 'in_progress'],
  reopened:    ['in_progress', 'done'],
  verified:    ['reopened'],
};
const COLORS = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4d7c0f', '#c026d3', '#0f766e'];

const now = () => new Date().toISOString();
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
const bump = () => { db.prepare("UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'version'").run(); scheduleBackup(); scheduleBroadcast(); };

// ---------- live updates (Server-Sent Events) ----------
// Every open page keeps one connection; after any change it gets the new version number and reloads the data.
const sseClients = new Set();
let broadcastQueued = false;
function scheduleBroadcast() {
  if (broadcastQueued) return;
  broadcastQueued = true;
  setImmediate(() => {           // after the current transaction has committed
    broadcastQueued = false;
    const msg = `data: ${getVersion()}\n\n`;
    for (const res of sseClients) res.write(msg);
  });
}
setInterval(() => { for (const res of sseClients) res.write(': ping\n\n'); }, 25000).unref();

// ---------- database backups ----------
// A few seconds after every change: a consistent snapshot of the database. One copy per day is kept in
// DATA_DIR/backups (last 30 days). With a bucket configured, the latest copy and the daily copies also go there.
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP_DAILY = 30;
let backupTimer = null;
let backupChain = Promise.resolve();
let lastDaily = '';
function scheduleBackup() {
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => { backupTimer = null; runBackup(); }, 3000);
}
function runBackup() {
  backupChain = backupChain.then(async () => {
    const tmp = path.join(DATA_DIR, `snapshot-${process.pid}.db`);
    fs.rmSync(tmp, { force: true });
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`); // consistent copy, safe while the app runs
    try {
      const day = todayLocal();
      if (day !== lastDaily) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        fs.copyFileSync(tmp, path.join(BACKUP_DIR, `${day}.db`));
        const old = fs.readdirSync(BACKUP_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -KEEP_DAILY);
        old.forEach((f) => fs.rmSync(path.join(BACKUP_DIR, f), { force: true }));
      }
      if (remote) {
        const buf = fs.readFileSync(tmp);
        await remote.put('db/workspace.db', buf, 'application/vnd.sqlite3');
        if (day !== lastDaily) await remote.put(`db/daily/${day}.db`, buf, 'application/vnd.sqlite3');
      }
      lastDaily = day;
    } finally { fs.rmSync(tmp, { force: true }); }
  }).catch((e) => console.error('Database backup failed (will retry on the next change):', e.message));
  return backupChain;
}
async function shutdown(signal) {
  if (backupTimer) { clearTimeout(backupTimer); console.log(`${signal}: saving database before exit…`); await runBackup(); }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
const getVersion = () => Number(db.prepare("SELECT value FROM meta WHERE key = 'version'").get().value);

// ---------- uploads ----------
const MIME_EXT = {
  'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a', 'audio/mpeg': '.mp3', 'audio/wav': '.wav',
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'application/pdf': '.pdf',
};
const fixName = (name) => {
  // multer hands us latin1-decoded names; re-decode so Hindi / emoji file names survive
  try { return Buffer.from(name, 'latin1').toString('utf8'); } catch { return name; }
};
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext) ext = MIME_EXT[(file.mimetype || '').split(';')[0]] || '';
    ext = ext.replace(/[^.a-z0-9]/g, '').slice(0, 10);
    cb(null, crypto.randomBytes(12).toString('hex') + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 20 } });
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const kindOf = (mime = '') =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : 'file';

function saveAttachments(files = [], taskId, updateId, memberId) {
  const ins = db.prepare(`INSERT INTO attachments (task_id, update_id, stored_name, original_name, mime, size, kind, uploaded_by, created_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const f of files) {
    const mime = (f.mimetype || 'application/octet-stream').split(';')[0];
    ins.run(taskId, updateId ?? null, f.filename, fixName(f.originalname || f.filename), mime, f.size, kindOf(mime), memberId, now());
  }
}
const discardFiles = (files = []) => files.forEach((f) => f.path && fs.unlink(f.path, () => {}));
// With cloud storage, copy each upload to the bucket before it is recorded (the local copy stays as a cache).
async function persistUploads(files = []) {
  if (!remote || !files.length) return;
  await Promise.all(files.map(async (f) => remote.put('uploads/' + f.filename, await fs.promises.readFile(f.path), (f.mimetype || '').split(';')[0] || 'application/octet-stream')));
}

// ---------- auth (optional shared team passcode) ----------
const AUTH_TOKEN = PASSCODE ? crypto.createHash('sha256').update('workspace:' + PASSCODE).digest('hex') : '';
function cookies(header = '') {
  return Object.fromEntries(header.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
    const i = s.indexOf('=');
    return [s.slice(0, i), decodeURIComponent(s.slice(i + 1))];
  }));
}
const safeEqual = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
function isAuthed(req) {
  if (API_TOKEN) {
    const h = req.get('authorization') || '';
    if (h.startsWith('Bearer ') && safeEqual(h.slice(7).trim(), API_TOKEN)) return true;
  }
  if (!PASSCODE) return true;
  const c = cookies(req.headers.cookie).ws_auth || '';
  return c.length === AUTH_TOKEN.length && crypto.timingSafeEqual(Buffer.from(c), Buffer.from(AUTH_TOKEN));
}

function actor(req) {
  const id = Number(req.get('x-member-id'));
  const m = id ? db.prepare('SELECT * FROM members WHERE id = ? AND active = 1').get(id) : null;
  if (!m) throw new HttpError(400, 'Please pick who you are first.');
  return m;
}

function getTask(id) {
  const t = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted = 0').get(Number(id));
  if (!t) throw new HttpError(404, `Task #${id} not found`);
  return t;
}

function parseLinks(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  try { const j = JSON.parse(v); if (Array.isArray(j)) return j; } catch { /* plain text */ }
  return String(v).split(/[\n\s,]+/);
}
const cleanLinks = (v) => [...new Set(parseLinks(v).map((s) => String(s).trim()).filter(Boolean))].slice(0, 30);

function shapeAttachment(a) {
  return {
    id: a.id, update_id: a.update_id, name: a.original_name, mime: a.mime, size: a.size,
    kind: a.kind, url: '/uploads/' + a.stored_name, uploaded_by: a.uploaded_by, created_at: a.created_at,
  };
}

function loadTasks() {
  const tasks = db.prepare('SELECT * FROM tasks WHERE deleted = 0 ORDER BY id DESC').all();
  const map = new Map(tasks.map((t) => [t.id, {
    ...t, links: JSON.parse(t.links || '[]'), checklist: JSON.parse(t.checklist || '[]'), attachments: [], updates: [],
  }]));
  for (const a of db.prepare('SELECT * FROM attachments ORDER BY id').all()) map.get(a.task_id)?.attachments.push(shapeAttachment(a));
  for (const u of db.prepare('SELECT * FROM updates ORDER BY id').all()) map.get(u.task_id)?.updates.push({ ...u });
  return [...map.values()];
}
const loadTask = (id) => loadTasks().find((t) => t.id === Number(id));

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

app.get('/api/ping', (req, res) => res.json({ ok: true })); // health check / keep-awake ping (no passcode, no data)

app.get('/api/config', (req, res) => {
  res.json({ appName: APP_NAME, needsPasscode: !!PASSCODE, authed: isAuthed(req), whisper: !!WHISPER_KEY, maxUploadMb: MAX_UPLOAD_MB });
});

app.post('/api/login', (req, res) => {
  if (!PASSCODE) return res.json({ ok: true });
  if (String(req.body?.passcode || '') !== PASSCODE) return res.status(401).json({ error: 'Wrong passcode' });
  res.setHeader('Set-Cookie',
    `ws_auth=${AUTH_TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}${req.secure ? '; Secure' : ''}`);
  res.json({ ok: true });
});

app.use(['/api', '/uploads'], (req, res, next) => (isAuthed(req) ? next() : res.status(401).json({ error: 'Passcode required' })));

const RISKY = /\.(html?|xhtml|svg|xml|js|mjs)$/i;
app.get('/uploads/:name', async (req, res) => {
  const name = req.params.name;
  if (!/^[a-f0-9]{24}(\.[a-z0-9]{1,9})?$/.test(name)) throw new HttpError(404, 'Not found');
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) {
    const buf = remote ? await remote.get('uploads/' + name) : null; // fresh container: fetch from the bucket once
    if (!buf) throw new HttpError(404, 'Not found');
    await fs.promises.writeFile(file, buf);
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', 'sandbox');
  if (RISKY.test(name)) res.setHeader('Content-Disposition', 'attachment');
  res.sendFile(file, { maxAge: '30d' });
});

// --- members ---
app.get('/api/members', (req, res) => {
  res.json(db.prepare('SELECT * FROM members ORDER BY active DESC, role = \'lead\' DESC, name').all());
});

app.post('/api/members', (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 40);
  if (!name) throw new HttpError(400, 'Name is required');
  const count = db.prepare('SELECT COUNT(*) AS n FROM members').get().n;
  const existing = db.prepare('SELECT * FROM members WHERE name = ?').get(name);
  if (existing) {
    if (!existing.active) db.prepare('UPDATE members SET active = 1 WHERE id = ?').run(existing.id);
    bump();
    return res.json({ ...existing, active: 1 });
  }
  const hasLead = db.prepare("SELECT 1 FROM members WHERE role = 'lead' AND active = 1").get();
  const role = hasLead ? 'member' : 'lead'; // first person becomes the lead
  const r = db.prepare('INSERT INTO members (name, role, color, created_at) VALUES (?, ?, ?, ?)')
    .run(name, role, COLORS[count % COLORS.length], now());
  bump();
  res.json(db.prepare('SELECT * FROM members WHERE id = ?').get(r.lastInsertRowid));
});

app.patch('/api/members/:id', (req, res) => {
  const me = actor(req);
  const target = db.prepare('SELECT * FROM members WHERE id = ?').get(Number(req.params.id));
  if (!target) throw new HttpError(404, 'Member not found');
  const { name, role, active } = req.body || {};
  if ((role !== undefined || active !== undefined) && me.role !== 'lead') throw new HttpError(403, 'Only the lead can change roles');
  tx(() => {
    if (name !== undefined) {
      const n = String(name).trim().slice(0, 40);
      if (!n) throw new HttpError(400, 'Name is required');
      db.prepare('UPDATE members SET name = ? WHERE id = ?').run(n, target.id);
    }
    if (role === 'lead' || role === 'member') {
      if (role === 'member' && target.role === 'lead') {
        const others = db.prepare("SELECT COUNT(*) AS n FROM members WHERE role = 'lead' AND active = 1 AND id != ?").get(target.id).n;
        if (!others) throw new HttpError(400, 'The team needs at least one lead');
      }
      db.prepare('UPDATE members SET role = ? WHERE id = ?').run(role, target.id);
    }
    if (active !== undefined) {
      if (!active && target.id === me.id) throw new HttpError(400, "You can't remove yourself");
      db.prepare('UPDATE members SET active = ? WHERE id = ?').run(active ? 1 : 0, target.id);
    }
    bump();
  });
  res.json(db.prepare('SELECT * FROM members WHERE id = ?').get(target.id));
});

// --- tasks ---
app.get('/api/stats', (req, res) => {
  const k = Object.fromEntries(db.prepare('SELECT kind, COUNT(*) AS n FROM attachments GROUP BY kind').all().map((r) => [r.kind, r.n]));
  res.json({
    bytes: db.prepare('SELECT COALESCE(SUM(size), 0) AS b FROM attachments').get().b,
    images: k.image || 0, audio: k.audio || 0, files: (k.file || 0) + (k.video || 0),
    tasks: db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE deleted = 0').get().n,
  });
});

app.get('/api/version',(req, res) => res.json({ version: getVersion() }));

app.get('/api/tasks', (req, res) => {
  // With x-member-id we also send what this person has already seen (for the "New" / "Updated" markers).
  const me = Number(req.get('x-member-id')) ? db.prepare('SELECT * FROM members WHERE id = ?').get(Number(req.get('x-member-id'))) : null;
  const seen = me ? Object.fromEntries(db.prepare('SELECT task_id, at FROM seen WHERE member_id = ?').all(me.id).map((r) => [r.task_id, r.at])) : {};
  res.json({ version: getVersion(), tasks: loadTasks(), seen, feed_seen_at: me?.feed_seen_at || null });
});

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',   // no-transform: proxies must not compress/buffer the stream
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  });
  res.write(`retry: 5000\ndata: ${getVersion()}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.post('/api/seen', (req, res) => {
  const me = actor(req);
  const ts = now();
  const up = db.prepare('INSERT INTO seen (member_id, task_id, at) VALUES (?, ?, ?) ON CONFLICT(member_id, task_id) DO UPDATE SET at = excluded.at');
  tx(() => {
    const ids = req.body?.all ? db.prepare('SELECT id FROM tasks WHERE deleted = 0').all().map((r) => r.id)
      : (Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean).slice(0, 2000) : []);
    for (const id of ids) up.run(me.id, id, ts);
    if (req.body?.all) db.prepare('UPDATE members SET feed_seen_at = ? WHERE id = ?').run(ts, me.id);
  });
  res.json({ ok: true, at: ts });
});

app.post('/api/feed-seen', (req, res) => {
  const me = actor(req);
  const ts = now();
  db.prepare('UPDATE members SET feed_seen_at = ? WHERE id = ?').run(ts, me.id);
  res.json({ ok: true, at: ts });
});

app.get('/api/tasks/:id', (req, res) => {
  getTask(req.params.id);
  res.json(loadTask(req.params.id));
});

const itemId = () => crypto.randomBytes(5).toString('hex');
const newChecklist = (texts = []) => texts.map((t) => String(t).trim().slice(0, 300)).filter(Boolean).slice(0, 50)
  .map((text) => ({ id: itemId(), text, done: false, done_by: null, done_at: null }));

function taskFields(body, { partial }) {
  const out = {};
  const str = (k, max) => { if (body[k] !== undefined) out[k] = String(body[k] ?? '').trim().slice(0, max); };
  str('title', 200); str('description', 20000); str('area', 300);
  if (body.type !== undefined) out.type = TYPES.includes(body.type) ? body.type : 'other';
  if (body.priority !== undefined) out.priority = PRIORITIES.includes(body.priority) ? body.priority : 'normal';
  if (body.task_date !== undefined) out.task_date = /^\d{4}-\d{2}-\d{2}$/.test(body.task_date) ? body.task_date : todayLocal();
  if (body.links !== undefined) out.links = JSON.stringify(cleanLinks(body.links));
  if (body.due_date !== undefined) out.due_date = /^\d{4}-\d{2}-\d{2}$/.test(body.due_date) ? body.due_date : null;
  if (body.checklist !== undefined) {
    let items = body.checklist;
    if (!Array.isArray(items)) { try { items = JSON.parse(items); } catch { items = String(items || '').split('\n'); } }
    out.checklist = JSON.stringify(newChecklist(Array.isArray(items) ? items : []));
  }
  if (!partial || out.title !== undefined) {
    if (!out.title && out.description) {
      // No title? Use the first line of the (possibly voice-typed) description.
      const first = out.description.split('\n').find((l) => l.trim()) || '';
      out.title = first.length > 90 ? first.slice(0, 87).replace(/\s+\S*$/, '') + '…' : first;
    }
    if (!out.title && !partial) throw new HttpError(400, 'Add a title or a description');
    if (out.title === '') delete out.title;
  }
  return out;
}

function insertTask(f, memberId, ts) {
  const r = db.prepare(`INSERT INTO tasks (title, description, type, priority, area, links, status, task_date, due_date, checklist, created_by, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?)`)
    .run(f.title, f.description || '', f.type || 'update', f.priority || 'normal', f.area || '', f.links || '[]',
      f.task_date || todayLocal(), f.due_date || null, f.checklist || '[]', memberId, ts, ts);
  const taskId = Number(r.lastInsertRowid);
  db.prepare("INSERT INTO updates (task_id, author, kind, to_status, created_at) VALUES (?, ?, 'created', 'todo', ?)").run(taskId, memberId, ts);
  db.prepare('INSERT OR REPLACE INTO seen (member_id, task_id, at) VALUES (?, ?, ?)').run(memberId, taskId, ts); // your own task isn't "new" for you
  return taskId;
}

// Meeting mode: many tasks at once (shared type / priority / dates), each with optional checklist items.
app.post('/api/tasks/bulk', (req, res) => {
  const me = actor(req);
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : [];
  if (!items.length) throw new HttpError(400, 'Nothing to add');
  const shared = taskFields({ ...req.body, title: 'x' }, { partial: true });
  delete shared.title;
  const ts = now();
  const ids = tx(() => {
    const out = items.map((it) => {
      const f = { ...shared, ...taskFields({ title: it.title, description: it.description || '', checklist: it.checklist || [] }, { partial: false }) };
      return insertTask(f, me.id, ts);
    });
    bump();
    return out;
  });
  res.json({ ids });
});

app.post('/api/tasks/:id/checklist', (req, res) => {
  const me = actor(req);
  const t = getTask(req.params.id);
  const list = JSON.parse(t.checklist || '[]');
  const { op, item, text } = req.body || {};
  const i = list.findIndex((x) => x.id === item);
  if (op === 'add') {
    const added = newChecklist(String(text || '').split('\n'));
    if (!added.length) throw new HttpError(400, 'Write the point first');
    if (list.length + added.length > 50) throw new HttpError(400, 'A task can have at most 50 points');
    list.push(...added);
  } else {
    if (i < 0) throw new HttpError(404, 'That point no longer exists');
    if (op === 'toggle') Object.assign(list[i], list[i].done ? { done: false, done_by: null, done_at: null } : { done: true, done_by: me.id, done_at: now() });
    else if (op === 'edit') { const v = String(text || '').trim().slice(0, 300); if (!v) throw new HttpError(400, 'Empty point'); list[i].text = v; }
    else if (op === 'remove') list.splice(i, 1);
    else throw new HttpError(400, 'Unknown action');
  }
  db.prepare('UPDATE tasks SET checklist = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(list), now(), t.id);
  bump();
  res.json(loadTask(t.id));
});

// Plain-text (Markdown) export, e.g. for Claude:  GET /api/export.md?ids=3,5   or   ?status=todo,reopened
app.get('/api/export.md', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean);
  const statuses = String(req.query.status || (ids.length ? '' : 'reopened,todo,in_progress')).split(',').filter(Boolean);
  const members = Object.fromEntries(db.prepare('SELECT id, name FROM members').all().map((m) => [m.id, m.name]));
  const tasks = loadTasks().filter((t) => (ids.length ? ids.includes(t.id) : true) && (statuses.length ? statuses.includes(t.status) : true))
    .sort((a, b) => a.id - b.id);
  const out = [];
  for (const t of tasks) {
    out.push(`## Task #${t.id}: ${t.title}`, '');
    out.push(`- Type: ${t.type} · Priority: ${t.priority} · Status: ${t.status}`);
    out.push(`- Added by ${members[t.created_by] || '?'} on ${t.task_date}${t.due_date ? ` · Due ${t.due_date}` : ''}`);
    if (t.area) out.push(`- Where: ${t.area}`);
    if (t.description) out.push('', t.description);
    if (t.checklist.length) out.push('', 'Checklist:', ...t.checklist.map((c) => `- [${c.done ? 'x' : ' '}] ${c.text}`));
    if (t.links.length) out.push('', 'Links:', ...t.links.map((l) => `- ${l}`));
    const files = t.attachments.filter((a) => !a.update_id);
    if (files.length) out.push('', 'Attachments:', ...files.map((a) => `- ${a.kind}: ${a.name} ${base}${a.url}`));
    const notes = t.updates.filter((u) => (u.kind === 'comment' || u.kind === 'rework') && (u.body || t.attachments.some((a) => a.update_id === u.id)));
    if (notes.length) {
      out.push('', 'Updates:');
      for (const u of notes) {
        out.push(`- ${u.created_at.slice(0, 10)} ${members[u.author] || '?'}${u.kind === 'rework' ? ' (CHANGES REQUESTED)' : ''}: ${u.body || ''}`);
        for (const a of t.attachments.filter((x) => x.update_id === u.id)) out.push(`  - ${a.kind}: ${a.name} ${base}${a.url}`);
      }
    }
    out.push('', '---', '');
  }
  res.type('text/markdown; charset=utf-8').send(out.join('\n') || 'No matching tasks.\n');
});

app.post('/api/tasks', upload.array('files', 20), async (req, res) => {
  try {
    const me = actor(req);
    const f = taskFields(req.body || {}, { partial: false });
    await persistUploads(req.files);
    const ts = now();
    const id = tx(() => {
      const taskId = insertTask(f, me.id, ts);
      saveAttachments(req.files, taskId, null, me.id);
      bump();
      return taskId;
    });
    res.json(loadTask(id));
  } catch (e) { discardFiles(req.files); throw e; }
});

app.patch('/api/tasks/:id', upload.array('files', 20), async (req, res) => {
  try {
    const me = actor(req);
    const t = getTask(req.params.id);
    if (t.created_by !== me.id && me.role !== 'lead') throw new HttpError(403, 'Only the person who added it (or the lead) can edit this task');
    const f = taskFields(req.body || {}, { partial: true });
    await persistUploads(req.files);
    tx(() => {
      const keys = Object.keys(f);
      if (keys.length) {
        db.prepare(`UPDATE tasks SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
          .run(...keys.map((k) => f[k]), now(), t.id);
      }
      saveAttachments(req.files, t.id, null, me.id);
      bump();
    });
    res.json(loadTask(t.id));
  } catch (e) { discardFiles(req.files); throw e; }
});

app.delete('/api/tasks/:id', (req, res) => {
  const me = actor(req);
  const t = getTask(req.params.id);
  if (t.created_by !== me.id && me.role !== 'lead') throw new HttpError(403, 'Only the person who added it (or the lead) can delete this task');
  db.prepare('UPDATE tasks SET deleted = 1, updated_at = ? WHERE id = ?').run(now(), t.id);
  bump();
  res.json({ ok: true });
});

app.post('/api/tasks/:id/status', upload.array('files', 20), async (req, res) => {
  try {
    const me = actor(req);
    const t = getTask(req.params.id);
    const to = String(req.body?.status || '');
    const note = String(req.body?.note || '').trim().slice(0, 20000);
    if (!(TRANSITIONS[t.status] || []).includes(to)) throw new HttpError(400, `Can't move a "${t.status}" task to "${to}"`);
    if (to === 'reopened' && !note && !req.files?.length) throw new HttpError(400, 'Tell the lead what needs to change (type or speak it)');
    if (to === 'verified' && t.done_by === me.id) {
      const others = db.prepare('SELECT COUNT(*) AS n FROM members WHERE active = 1 AND id != ?').get(me.id).n;
      if (others) throw new HttpError(403, 'Someone else from the team has to verify work you marked as done');
    }
    await persistUploads(req.files);
    const ts = now();
    tx(() => {
      const sets = { status: to, updated_at: ts };
      if (to === 'done') Object.assign(sets, { done_by: me.id, done_at: ts, verified_by: null, verified_at: null });
      if (to === 'verified') Object.assign(sets, { verified_by: me.id, verified_at: ts });
      if (to === 'reopened' || to === 'in_progress' || to === 'todo') Object.assign(sets, { verified_by: null, verified_at: null });
      const keys = Object.keys(sets);
      db.prepare(`UPDATE tasks SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => sets[k]), t.id);
      const r = db.prepare('INSERT INTO updates (task_id, author, kind, body, from_status, to_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(t.id, me.id, to === 'reopened' ? 'rework' : 'status', note, t.status, to, ts);
      saveAttachments(req.files, t.id, Number(r.lastInsertRowid), me.id);
      bump();
    });
    res.json(loadTask(t.id));
  } catch (e) { discardFiles(req.files); throw e; }
});

app.post('/api/tasks/:id/updates', upload.array('files', 20), async (req, res) => {
  try {
    const me = actor(req);
    const t = getTask(req.params.id);
    const body = String(req.body?.body || '').trim().slice(0, 20000);
    if (!body && !req.files?.length) throw new HttpError(400, 'Write, speak or attach something first');
    await persistUploads(req.files);
    const ts = now();
    tx(() => {
      const r = db.prepare("INSERT INTO updates (task_id, author, kind, body, created_at) VALUES (?, ?, 'comment', ?, ?)").run(t.id, me.id, body, ts);
      saveAttachments(req.files, t.id, Number(r.lastInsertRowid), me.id);
      db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(ts, t.id);
      bump();
    });
    res.json(loadTask(t.id));
  } catch (e) { discardFiles(req.files); throw e; }
});

app.delete('/api/attachments/:id', (req, res) => {
  const me = actor(req);
  const a = db.prepare('SELECT * FROM attachments WHERE id = ?').get(Number(req.params.id));
  if (!a) throw new HttpError(404, 'Attachment not found');
  if (a.uploaded_by !== me.id && me.role !== 'lead') throw new HttpError(403, 'Only the uploader (or the lead) can remove this');
  db.prepare('DELETE FROM attachments WHERE id = ?').run(a.id);
  fs.unlink(path.join(UPLOAD_DIR, a.stored_name), () => {});
  remote?.del('uploads/' + a.stored_name).catch((e) => console.error(e.message));
  bump();
  res.json({ ok: true });
});

// --- voice → text (Whisper or any OpenAI-compatible speech-to-text API) ---
app.post('/api/transcribe', audioUpload.single('audio'), async (req, res) => {
  if (!WHISPER_KEY) throw new HttpError(501, 'Server-side Whisper is not configured');
  if (!req.file) throw new HttpError(400, 'No audio received');
  const lang = String(req.body?.lang || '');
  const translate = lang === 'hi-en';
  const mime = (req.file.mimetype || 'audio/webm').split(';')[0];
  const form = new FormData();
  form.append('file', new Blob([req.file.buffer], { type: mime }), 'voice' + (MIME_EXT[mime] || '.webm'));
  form.append('model', WHISPER_MODEL);
  form.append('response_format', 'json');
  if (WHISPER_PROMPT) form.append('prompt', WHISPER_PROMPT);
  if (!translate && lang && lang !== 'auto') form.append('language', lang.slice(0, 2));
  const r = await fetch(`${WHISPER_BASE}/audio/${translate ? 'translations' : 'transcriptions'}`, {
    method: 'POST', headers: { Authorization: `Bearer ${WHISPER_KEY}` }, body: form,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, 'Transcription failed: ' + (data?.error?.message || r.statusText));
  res.json({ text: String(data.text || '').trim() });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `File too large (max ${MAX_UPLOAD_MB} MB)` : err.message;
    return res.status(400).json({ error: msg });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`${APP_NAME} running on http://localhost:${PORT}`);
  console.log(`  data:     ${DATA_DIR}`);
  console.log(`  passcode: ${PASSCODE ? 'on' : 'off (set TEAM_PASSCODE to protect it)'}`);
  console.log(`  storage:  ${remote ? remote.describe + ' (files + database backups)' : 'local disk only'}`);
  console.log(`  api key:  ${API_TOKEN ? 'on (Authorization: Bearer …)' : 'off'}`);
  console.log(`  whisper:  ${WHISPER_KEY ? `${WHISPER_MODEL} via ${WHISPER_BASE}` : 'off (browser speech recognition only)'}`);
});
