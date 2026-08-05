const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const docRoutes = require("./routes/docs");
const { verifyToken } = require("./middleware/auth");
const Document = require("./models/Document");

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/docs", verifyToken, docRoutes);

app.get("/", (req, res) => res.json({ message: "CollabDoc API running" }));

// ---------------------------------------------------------------------------
// Optional: Redis adapter for horizontal Socket.IO scaling.
// If REDIS_URL is set, rooms/broadcasts work correctly across multiple
// server instances behind a load balancer. If not set, falls back to the
// default in-memory adapter (fine for a single instance / local dev).
// ---------------------------------------------------------------------------
async function setupRedisAdapter() {
  if (!process.env.REDIS_URL) {
    console.log("REDIS_URL not set — using default in-memory Socket.IO adapter.");
    return;
  }
  try {
    const { createAdapter } = require("@socket.io/redis-adapter");
    const { createClient } = require("redis");
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.IO Redis adapter connected — ready for multi-instance scaling.");
  } catch (err) {
    console.error("Redis adapter setup failed, continuing with in-memory adapter:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Socket-level authentication.
// Every socket connection must present a valid JWT (same token used for the
// REST API). Without this, anyone who knows a docId could connect and read/
// write a document over the socket layer even without a valid session.
// ---------------------------------------------------------------------------
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized: no token provided"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // { id, ... }
    next();
  } catch (err) {
    next(new Error("Unauthorized: invalid token"));
  }
});

// In-memory active users per document
const activeUsers = {}; // { docId: [ { userId, name, socketId, color } ] }
const colors = ["#378ADD", "#D85A30", "#1D9E75", "#8B5CF6", "#EC4899", "#F59E0B", "#0EA5E9"];

function getColorFor(docId, userId) {
  if (!activeUsers[docId]) return colors[0];
  const existing = activeUsers[docId].find((u) => u.userId === userId);
  if (existing) return existing.color;
  return colors[activeUsers[docId].length % colors.length];
}

// Simple in-memory rate limiter: max N events per socket per window.
function makeRateLimiter(maxEvents, windowMs) {
  const hits = new Map(); // socketId -> [timestamps]
  return (socketId) => {
    const now = Date.now();
    const arr = (hits.get(socketId) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(socketId, arr);
    return arr.length <= maxEvents;
  };
}
const allowChangeEvent = makeRateLimiter(30, 1000); // 30 edits/sec/socket
const allowCursorEvent = makeRateLimiter(20, 1000); // 20 cursor moves/sec/socket

// How often to snapshot a version (avoid saving a version on every 2s autosave)
const VERSION_SNAPSHOT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// Socket.io
io.on("connection", (socket) => {
  console.log("User connected:", socket.id, "user:", socket.user?.id);

  // Join a document room — only if the user actually has access to it.
  socket.on("join-doc", async ({ docId }) => {
    try {
      const doc = await Document.findById(docId);
      if (!doc) return socket.emit("doc-error", { message: "Document not found" });

      const userId = socket.user.id;
      const isOwner = doc.owner.toString() === userId;
      const isCollab = doc.collaborators.some((c) => c.user.toString() === userId);
      if (!isOwner && !isCollab) {
        return socket.emit("doc-error", { message: "Access denied" });
      }

      socket.docId = docId;
      socket.join(docId);

      if (!activeUsers[docId]) activeUsers[docId] = [];
      const name = socket.user.name || "Anonymous";
      const color = getColorFor(docId, userId);

      // Remove stale entry for this user (reconnect case), then re-add
      activeUsers[docId] = activeUsers[docId].filter((u) => u.userId !== userId);
      activeUsers[docId].push({ userId, name, socketId: socket.id, color });

      io.to(docId).emit("presence-update", activeUsers[docId]);
      console.log(`${name} joined doc ${docId}`);
    } catch (err) {
      console.error("join-doc error:", err.message);
      socket.emit("doc-error", { message: "Failed to join document" });
    }
  });

  // Receive a text change and broadcast to others in the room
  socket.on("send-changes", ({ docId, delta }) => {
    if (!socket.docId || socket.docId !== docId) return; // must have joined first
    if (!allowChangeEvent(socket.id)) return; // rate limited
    socket.to(docId).emit("receive-changes", delta);
  });

  // Save document content to DB, and periodically snapshot a version
  socket.on("save-doc", async ({ docId, content }) => {
    if (!socket.docId || socket.docId !== docId) return;
    try {
      const doc = await Document.findById(docId);
      if (!doc) return;

      doc.content = content;
      doc.updatedAt = new Date();

      const lastVersion = doc.versions[doc.versions.length - 1];
      const shouldSnapshot =
        !lastVersion || Date.now() - new Date(lastVersion.savedAt).getTime() > VERSION_SNAPSHOT_INTERVAL_MS;

      if (shouldSnapshot && content && content.trim().length > 0) {
        doc.versions.push({ content, savedBy: socket.user.id });
        // Cap history length so the document doesn't grow unbounded
        if (doc.versions.length > 100) doc.versions = doc.versions.slice(-100);
      }

      await doc.save();
      io.to(docId).emit("doc-saved");
    } catch (err) {
      console.error("Save error:", err.message);
      socket.emit("doc-error", { message: "Failed to save document" });
    }
  });

  // Cursor position broadcast (single, correct handler)
  socket.on("cursor-move", ({ docId, pos }) => {
    if (!socket.docId || socket.docId !== docId) return;
    if (!allowCursorEvent(socket.id)) return;
    const userId = socket.user.id;
    const name = socket.user.name || "Anonymous";
    const color = getColorFor(docId, userId);
    socket.to(docId).emit("cursor-update", { userId, username: name, pos, color });
  });

  // On disconnect — remove from active users and notify the room
  socket.on("disconnect", () => {
    for (const docId in activeUsers) {
      const before = activeUsers[docId].length;
      const leaving = activeUsers[docId].find((u) => u.socketId === socket.id);
      activeUsers[docId] = activeUsers[docId].filter((u) => u.socketId !== socket.id);
      if (activeUsers[docId].length !== before) {
        io.to(docId).emit("presence-update", activeUsers[docId]);
        if (leaving) io.to(docId).emit("user-left", { userId: leaving.userId });
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

// Connect DB, Redis (optional), and start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");
    await setupRedisAdapter();
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("MongoDB error:", err.message));
