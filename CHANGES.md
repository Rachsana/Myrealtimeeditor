# Changes made to CollabDoc

## 🔴 Critical fixes

1. **Leaked credentials removed from git tracking**
   `server/.env` (real MongoDB URI + JWT secret) was committed to the
   public repo. It's now untracked and gitignored. **You must still
   rotate both the MongoDB password and JWT_SECRET** — they were public
   and removing the file from *this* copy doesn't erase them from the
   original repo's git history. See "Rotate your secrets" below.

2. **Production API calls were broken** (`client/src/api.js`)
   `axios.create({ baseURL: "/api" })` only works locally, where Vite's
   dev proxy forwards `/api` → `localhost:5000`. In production there's
   no proxy, so every API call 404'd. Fixed to use `VITE_SERVER_URL` in
   production, same root cause as the CP Tracker signup bug.

3. **Duplicate/buggy Socket.IO cursor handler** (`server/index.js`)
   There were two `socket.on("cursor-move", ...)` handlers. The first
   referenced an undefined `getColorFor` function and would throw on
   every cursor move. Removed the dead one, kept a single correct
   handler with a properly implemented `getColorFor`.

## 🔒 Security

4. **Socket-level JWT authentication** — sockets now must present a
   valid JWT on connection (`socket.handshake.auth.token`), verified in
   `io.use(...)` middleware. Previously, anyone who knew a `docId` could
   connect over the socket layer without any auth at all.

5. **Per-document authorization on `join-doc`** — before joining a
   document's room, the server now checks the user is the owner or an
   invited collaborator, instead of trusting the client-supplied `docId`
   blindly.

6. **Rate limiting** on `send-changes` and `cursor-move` (in-memory,
   per-socket) to prevent a single client from flooding the room.

## ✨ Features added

7a. **Docker support** — added `server/Dockerfile` (multi-stage-friendly,
    Node 20 Alpine, healthcheck included) and a root `docker-compose.yml`
    that spins up the backend + Redis together for local dev, matching
    the same Redis-adapter path used in production. MongoDB is not
    containerized — point `MONGO_URI` at Atlas (or your own instance) as
    usual.

7b. **AI-assisted "Summarize changes"** — a new `GET /api/docs/:id/summarize`
    route compares the two most recent saved versions and returns a
    plain-English summary of what changed, surfaced via a button in the
    version history panel. Uses OpenAI's API if `OPENAI_API_KEY` is set;
    **falls back to a zero-cost heuristic word-diff summary if it isn't**,
    so the feature works end-to-end with no API key required. This is the
    one AI-touching feature layered onto an existing app rather than a
    separate ML project — shows current-stack fluency without derailing
    into unrelated scope.

7. **Version history** — `server/models/Document.js` already had a
   `versions` sub-schema; it just wasn't wired up. Added:
   - Automatic version snapshots on save (throttled to once per 2 min,
     not every 2-second autosave, to avoid bloating the document)
   - `GET /api/docs/:id/versions` — list history
   - `POST /api/docs/:id/restore/:versionId` — restore a version
     (the current content is itself snapshotted first, so restoring
     is undoable)
   - A "History" button + modal in the editor UI to browse and restore

8. **Live cursors** — cleaned up and completed the existing partial
   implementation. Each connected user gets a stable color; cursor
   position broadcasts on click/keyup/select; `user-left` is emitted on
   disconnect so stale cursors don't linger for other users.

9. **Redis adapter for Socket.IO scaling** — optional, activates
   automatically if `REDIS_URL` is set (see `server/index.js`,
   `setupRedisAdapter()`). Falls back cleanly to the default in-memory
   adapter if unset, so local dev needs no Redis.

## Known limitation (be upfront about this if asked)

Real-time sync is still **last-write-wins** at the character level
(`send-changes` broadcasts the full textarea content). This is fine for
2-3 concurrent editors but isn't a true CRDT/OT merge — two people
typing in different parts of the document at the same instant can
clobber each other. The documented next step is migrating to **Yjs**
(`y-socket.io`), which also gives you cursor "awareness" for free and
would replace the hand-rolled cursor broadcast. Being able to explain
this tradeoff is itself a good interview answer — see the conflict
resolution notes below.

---

## Rotate your secrets (do this regardless of this zip)

Since `server/.env` was previously public on GitHub:

1. **MongoDB Atlas** → Database Access → change the password for the
   user in your connection string (or delete/recreate the user).
2. **JWT_SECRET** → generate a new random value, e.g.:
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
3. Update these in your deployment platform's environment variables
   (Render dashboard), not just your local `.env`.
4. Optionally, scrub the old value from git history on the real GitHub
   repo using `git filter-repo` or BFG Repo-Cleaner, then force-push —
   though rotating the credentials makes the old exposed values useless
   either way, which is the more important step.
