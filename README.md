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

There are three views:
- **Board:** columns by status, best for working through tasks. On a computer you can **drag a card** to another column (only moves the workflow allows light up).
- **By date:** the old doc layout (newest day on top) with colour bars instead of highlighting. Change requests appear under the day they were made.
- **Report:** what happened today, yesterday, this week or on any day: verified, done, changes requested, started, new, overdue, and a per-person table. **Copy for WhatsApp** gives a ready-to-send summary for the group or the founder.

Open a task to see everything about it: description, checklist, links, screenshot gallery, voice-note players, and the full history of who did what and when. You can also post follow-up updates there, with voice and attachments.

### What else helps

- **Never miss what's new:** cards someone else added or changed since you last opened them get a blue **New** / **Updated** label. The **New for you** filter shows only those. The 🔔 lists everything the team did, and both follow you across devices.
- **Live:** changes appear instantly on everyone's screen (green dot in the top bar). Turn on **Desktop alerts** under your name to get a notification when the tab is in the background.
- **Meeting mode** (`M`): type, paste or speak the list from a meeting, one task per line, and add them all at once. Indented lines become checklist points of the task above.
- **Checklists:** split a task into points and tick them off. The card shows the progress (`2/5`).
- **Due dates:** optional. Overdue tasks turn red, and the **Overdue** filter shows them.
- **Mark up screenshots:** after attaching or pasting a screenshot, click **Mark up** to draw arrows, boxes, highlights or text showing exactly where the change goes. You can also mark up a copy of any image already on a task.
- **Duplicate check:** while typing a new task, similar open tasks are shown, so the same bug isn't added twice.
- **Image viewer:** click a screenshot to view it full-size. Use ← → to step through all images of the task.
- **Install as an app:** on Android or desktop Chrome, use **Install as an app** under your name (or the browser menu). On iPhone, use Share → **Add to Home Screen**.

### Using it with Claude

Set `API_TOKEN` (any random text of 16+ characters) in the server's `.env`. A script or a Claude session can then read tasks, including image links:

```bash
curl -H "Authorization: Bearer $API_TOKEN" "https://workspace.finlitventures.com/api/export.md?ids=3,5"
```

Without `ids` it returns all open tasks (needs changes, to do, in progress). Screenshots are downloaded the same way, with the same header.

For Claude Code sessions there is a ready helper, [`tools/ws`](tools/ws) (`ws list`, `ws show 12`, `ws files 12`, `ws start 12`, `ws tick 12 "…"`, `ws note 12 "…"`, `ws done 12 "…"`), and step-by-step instructions in [`docs/claude-tasks.md`](docs/claude-tasks.md). In a cloud session, save the key as a **network secret** for `workspace.finlitventures.com` (header `Authorization`, `Bearer`), so it never appears in the chat.

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

### Host it for the team: on the Finlit AWS server (recommended)

The workspace runs as **one extra small container on the same EC2 server as Finlit** (about 60 MB of memory). That means no new hosting account and no subscription. Files stay on the server's disk.

- Finlit's Caddy (already on ports 80/443) serves it over **https** at its own address, e.g. `https://workspace.finlitventures.com`. Without a domain it uses a free `workspace.<server-ip>.sslip.io` address.
- Finlit itself only needed a small one-time change (already applied in its repository): its Caddy loads extra site files from `/opt/finlit/caddy-extra/`. With no files there it does nothing.
- After install, the server checks this repo every 5 minutes and redeploys on its own when `main` changes (same idea as Finlit's auto-deploy).

**One-time install** (already done on the Finlit server). On the server, as `ubuntu`:

```bash
curl -fsSL https://raw.githubusercontent.com/pranshukesavmishra/workspace/main/deploy/aws/install.sh | WORKSPACE_DOMAIN=workspace.finlitventures.com bash
```

For a custom domain, first add a DNS **A record** `workspace` → the server's Elastic IP. Without `WORKSPACE_DOMAIN`, the free sslip.io address is used. The script prints the link and the team passcode, which you can change in `/opt/workspace/.env` (then rerun the script).

Useful commands on the server:

```bash
bash /opt/workspace/src/deploy/aws/update.sh logs
```

```bash
docker restart finlit-workspace
```

**Storage & backups.** Everything is in `/opt/workspace/data`: `workspace.db` (tasks) and `uploads/` (screenshots, voice notes, files). A snapshot of the database is saved every day in `data/backups/`, and the last 30 days are kept. Screenshots are shrunk in the browser before upload (max 1920 px, WebP), typically 200–400 KB each. So 5 people adding ~5 screenshots a day comes to roughly 2–3 GB a year. **Manage team** shows the storage used. For copies off the server, add an S3 bucket in `.env` (`S3_*`, see `.env.example`). Files and the database are then also stored there, which costs a few cents per GB per month on AWS.

### Other ways to run it

- **Any server with Docker:** `cp .env.example .env`, edit it, then `docker compose up -d --build`. Put it behind https so the mic works.
- **Hosts without a permanent disk** (e.g. free Render): set the `S3_*` variables. Files and the database then live in the bucket, and the database is restored on every start.

## Configuration

See [`.env.example`](.env.example): `APP_NAME`, `PORT`, `TEAM_PASSCODE`, `DATA_DIR`, `MAX_UPLOAD_MB`, `WHISPER_*` (voice-to-text) and `S3_*` (optional cloud storage).

## Notes

- Identity is "pick your name" on each device, protected by the shared team passcode. That's fine for a small trusted team, but it isn't per-person login.
- Rules the server enforces: only the person who added a task (or a lead) can edit or delete it, and the person who marked a task done can't verify it themselves (unless they're the only team member).
- The page refreshes itself every ~12 seconds, so everyone sees changes without reloading.
- Shortcuts: `N` new task · `/` search · `Esc` close · `Ctrl+Enter` save in the task form.

## Project layout

```
server.js        Express API: tasks, status workflow, uploads, Whisper proxy, passcode, backups
storage.js       Optional S3-compatible bucket (files + database copies)
deploy/aws/      Install + auto-update on the Finlit EC2 server
db.js            SQLite schema (node:sqlite)
public/          Front end (plain HTML/CSS/JS, no build step)
  app.js         UI: board, by-date view, task panel, voice recorder, copy
  styles.css
```
