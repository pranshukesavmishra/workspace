# Finlit Workspace

One shared place where the Finlit team adds tasks (updates, fixes, new features) and the lead works through them, instead of a long shared doc that needs scrolling and red/yellow/green highlighting.

- **Everyone adds tasks:** title, description, *where* to change it, links (Drive, Figma, …), screenshots, photos, files, and **voice notes that turn into text**.
- **Every task gets a number** (`#1`, `#2`, …) so it's easy to talk about in meetings or say "do task 3 and 5".
- **Status colours replace the highlighting:** 🔴 To do · 🟡 In progress · 🟢 Done · ✅ Verified · 🟠 Needs changes.
- **Team check after "done":** when the lead marks a task done, someone else on the team has to **Verify** it or **Request changes**. A change request sends the task back to the lead under **Needs changes**, and it shows up again under *today's* date.
- **Copy button** on every task, plus a multi-select **Copy all**. You get clean plain text to paste into a doc, WhatsApp or Claude.

## How it works day to day

| Who | What they do |
|---|---|
| **Team member** | Click **New task** (or press `N`). Pick the type, describe it (type, or press **Speak** and just talk), add where/links/screenshots (Ctrl+V pastes a screenshot), then **Add task**. |
| **Lead** | Open the **Board**. New tasks are on top in **To do**, urgent first, and anything sent back is in **Needs changes**. Click **Start** (turns yellow), then **Mark done** (turns green). Tick several tasks and use **Copy all** to hand them over in one go. |
| **Team member** | Tasks waiting for a check show up in a green banner. Open one, then **Verify ✓** or **Request changes**, saying or typing what's still wrong. |

There are two views:
- **Board:** columns by status, best for working through tasks.
- **By date:** the old doc layout (newest day on top) with colour bars instead of highlighting. Change requests appear under the day they were made.

Open a task to see everything about it: description, links, screenshot gallery, voice-note players, and the full history of who did what and when. You can also post follow-up updates there, with voice and attachments.

## Voice → text

Press **Speak**, talk, press **Stop**. The text goes into the description box, where you can fix it before saving. The audio recording is attached too, so nothing is lost if a word comes out wrong.

- **Free, no setup:** the browser's own speech recognition (Chrome, Edge, Android, Safari). Choose *English* or *हिन्दी* next to the mic.
- **Better (recommended for Hinglish):** set a Whisper key on the server (see `.env.example`). Recordings are then transcribed by Whisper. The *Hindi → English text* option speaks Hindi and gives English text. Works with OpenAI, Groq (cheap and fast) or a self-hosted Whisper server.

> The microphone only works over **https** (or on `localhost`). Every hosting option below gives you https.

## Run it

Needs **Node.js 22.13+** (uses the built-in SQLite, nothing to install besides two npm packages).

```bash
npm install
```

```bash
TEAM_PASSCODE=choose-something npm start
```

Open http://localhost:3000. The **first person to join becomes the lead**. Everyone else opens the same link, enters the passcode once, and adds their name. Roles can be changed later under your name → **Manage team**.

### Host it for the team

The app is a single Node server. It stores its database and uploads in `DATA_DIR`, which **must be on persistent storage**.

- **Railway / Render / Fly.io:** deploy this repo and attach a volume/disk mounted at `/data`. Set `DATA_DIR=/data`, `TEAM_PASSCODE`, and optionally `WHISPER_API_KEY`. (Free tiers without a disk lose data on restart.)
- **Any VPS / office machine with Docker:**
  ```bash
  cp .env.example .env
  ```
  Edit `.env`, then:
  ```bash
  docker compose up -d --build
  ```
  Put it behind https (e.g. Caddy, or a Cloudflare Tunnel) so the mic works on phones.

**Backups:** copy the `data/` folder (`workspace.db*` and `uploads/`).

## Configuration

See [`.env.example`](.env.example): `APP_NAME`, `PORT`, `TEAM_PASSCODE`, `DATA_DIR`, `MAX_UPLOAD_MB`, `WHISPER_API_KEY`, `WHISPER_BASE_URL`, `WHISPER_MODEL`.

## Notes

- Identity is "pick your name" on each device, protected by the shared team passcode. That's fine for a small trusted team, but it isn't per-person login.
- Rules the server enforces: only the person who added a task (or a lead) can edit or delete it, and the person who marked a task done can't verify it themselves (unless they're the only team member).
- The page refreshes itself every ~12 seconds, so everyone sees changes without reloading.
- Shortcuts: `N` new task · `/` search · `Esc` close · `Ctrl+Enter` save in the task form.

## Project layout

```
server.js        Express API: tasks, status workflow, uploads, Whisper proxy, passcode
db.js            SQLite schema (node:sqlite)
public/          Front end (plain HTML/CSS/JS, no build step)
  app.js         UI: board, by-date view, task panel, voice recorder, copy
  styles.css
```
