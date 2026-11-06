import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';

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
const WHISPER_PROMPT = process.env.WHISPER_PROMPT ||
  'Team task update for a software project. May mix Hindi and English (Hinglish).';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = openDb(path.join(DATA_DIR, 'workspace.db'));

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
const bump = () => db.prepare("UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'version'").run();
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

// ---------- auth (optional shared team passcode) ----------
const AUTH_TOKEN = PASSCODE ? crypto.createHash('sha256').update('workspace:' + PASSCODE).digest('hex') : '';
function cookies(header = '') {
  return Object.fromEntries(header.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
    const i = s.indexOf('=');
    return [s.slice(0, i), decodeURIComponent(s.slice(i + 1))];
  }));
}
function isAuthed(req) {
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
  const map = new Map(tasks.map((t) => [t.id, { ...t, links: JSON.parse(t.links || '[]'), attachments: [], updates: [] }]));
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
app.use('/uploads', express.static(UPLOAD_DIR, {
  index: false,
  maxAge: '30d',
  setHeaders: (res, file) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', 'sandbox');
    if (RISKY.test(file)) res.setHeader('Content-Disposition', 'attachment');
  },
}));

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
app.get('/api/version', (req, res) => res.json({ version: getVersion() }));

app.get('/api/tasks', (req, res) => res.json({ version: getVersion(), tasks: loadTasks() }));

app.get('/api/tasks/:id', (req, res) => {
  getTask(req.params.id);
  res.json(loadTask(req.params.id));
});

function taskFields(body, { partial }) {
  const out = {};
  const str = (k, max) => { if (body[k] !== undefined) out[k] = String(body[k] ?? '').trim().slice(0, max); };
  str('title', 200); str('description', 20000); str('area', 300);
  if (body.type !== undefined) out.type = TYPES.includes(body.type) ? body.type : 'other';
  if (body.priority !== undefined) out.priority = PRIORITIES.includes(body.priority) ? body.priority : 'normal';
  if (body.task_date !== undefined) out.task_date = /^\d{4}-\d{2}-\d{2}$/.test(body.task_date) ? body.task_date : todayLocal();
  if (body.links !== undefined) out.links = JSON.stringify(cleanLinks(body.links));
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

app.post('/api/tasks', upload.array('files', 20), (req, res) => {
  try {
    const me = actor(req);
    const f = taskFields(req.body || {}, { partial: false });
    const ts = now();
    const id = tx(() => {
      const r = db.prepare(`INSERT INTO tasks (title, description, type, priority, area, links, status, task_date, created_by, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?)`)
        .run(f.title, f.description || '', f.type || 'update', f.priority || 'normal', f.area || '', f.links || '[]',
          f.task_date || todayLocal(), me.id, ts, ts);
      const taskId = Number(r.lastInsertRowid);
      db.prepare("INSERT INTO updates (task_id, author, kind, to_status, created_at) VALUES (?, ?, 'created', 'todo', ?)").run(taskId, me.id, ts);
      saveAttachments(req.files, taskId, null, me.id);
      bump();
      return taskId;
    });
    res.json(loadTask(id));
  } catch (e) { discardFiles(req.files); throw e; }
});

app.patch('/api/tasks/:id', upload.array('files', 20), (req, res) => {
  try {
    const me = actor(req);
    const t = getTask(req.params.id);
    if (t.created_by !== me.id && me.role !== 'lead') throw new HttpError(403, 'Only the person who added it (or the lead) can edit this task');
    const f = taskFields(req.body || {}, { partial: true });
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

app.post('/api/tasks/:id/status', upload.array('files', 20), (req, res) => {
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

app.post('/api/tasks/:id/updates', upload.array('files', 20), (req, res) => {
  try {
    const me = actor(req);
    const t = getTask(req.params.id);
    const body = String(req.body?.body || '').trim().slice(0, 20000);
    if (!body && !req.files?.length) throw new HttpError(400, 'Write, speak or attach something first');
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
  console.log(`  whisper:  ${WHISPER_KEY ? `${WHISPER_MODEL} via ${WHISPER_BASE}` : 'off (browser speech recognition only)'}`);
});
