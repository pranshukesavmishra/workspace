# Instructions for Claude: doing Finlit Workspace tasks

You were asked to do one or more tasks from the Finlit Workspace task board (https://workspace.finlitventures.com),
e.g. "do task #12" or "do #12 and #15". Follow these steps.

## 1. Get the tool

The `ws` helper is in this repository (`tools/ws`). If you are reading this from a clone at `/tmp/ws-tools`:

```bash
chmod +x /tmp/ws-tools/tools/ws && alias ws=/tmp/ws-tools/tools/ws
```

(Or call `/tmp/ws-tools/tools/ws` directly; aliases may not carry between commands.)

The API key is normally saved in this environment as a network secret for `workspace.finlitventures.com`, and the
proxy adds it to requests by itself. If `ws list` says **401** or **could not reach**, stop and tell the user:
"Save the workspace API key as a network secret for workspace.finlitventures.com in this environment's settings
(Authorization header, Bearer)". Do not ask them to paste the key into the chat.

## 2. Read the task fully

```bash
ws show 12          # description, where to change it, checklist, links, all updates and change requests
ws files 12         # downloads screenshots / voice notes / files into ./ws-files/12/
```

- **Look at every downloaded image** (open them with your file reading tool). Screenshots often have arrows/boxes
  drawn on them showing exactly where the change goes. Images posted with a "changes requested" update are the
  most recent instructions.
- If the task has **"CHANGES REQUESTED"** updates, those describe what is still wrong after an earlier attempt.
  They take priority over the original description.
- Voice notes are audio. You cannot listen to them, but their text is usually already in the description or update.
- If the user's own message gave extra instructions (from the team meeting), they take priority over the task text.

## 3. Mark it as started

```bash
ws start 12
```

## 4. Do the work

- The Finlit code is in the GitHub repository **Yusra-Khan532/Financial-Portfolio**, folder `finlit-platform/`
  (unless the user says otherwise). Use the repository attached to your session.
- Follow that repository's own instructions (CLAUDE.md / README / docs) and your session's normal git rules
  (branch, commit, push; open a pull request only if the user asked for one or the repository's rules say so).
  Pushing to `main` deploys to the live site automatically, so never push to `main` unless the user explicitly asked.
- Keep the change limited to what the task asks. If something is unclear or risky, ask the user instead of guessing.
- Tick checklist points as you finish them: `ws tick 12 "part of the point text"`.
- If you get stuck or need a decision, post it on the task too: `ws note 12 "Question: ..."`, and ask the user.

## 5. Report back on the task

When the change is pushed (or the pull request is open):

```bash
ws done 12 "What changed: ... | Where: file/page ... | Branch/PR: <link> | How to check: ..."
```

This posts your summary as an update and moves the task to **Done**, so the team checks it and clicks
**Verify** or **Request changes**. Write the summary for non-developers: what they will see, and where.
If the work is NOT finished (blocked, needs a decision), use `ws note` instead of `ws done`.

## 6. Several tasks

Do them one at a time, in the order given, with steps 2 to 5 for each. At the end, give the user a short list:
task number, what was done, and the branch/PR link.

## Other useful commands

```bash
ws list             # all open tasks (needs changes first)
ws show 12 15       # several tasks at once
```

Updates are posted under the name **Claude** (set `WS_MEMBER` to change it).
