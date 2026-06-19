const express = require("express");
const http = require("http");
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

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/docs", verifyToken, docRoutes);

app.get("/", (req, res) => res.json({ message: "CollabDoc API running" }));

// In-memory active users per document
const activeUsers = {}; // { docId: [ { userId, name, color } ] }

// Socket.io
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join a document room
  socket.on("join-doc", ({ docId, userId, name }) => {
    socket.join(docId);

    if (!activeUsers[docId]) activeUsers[docId] = [];

    // Assign a color to this user
    const colors = ["#378ADD", "#D85A30", "#1D9E75", "#8B5CF6", "#EC4899"];
    const color = colors[activeUsers[docId].length % colors.length];

    // Remove if already exists (reconnect case)
    activeUsers[docId] = activeUsers[docId].filter((u) => u.userId !== userId);
    activeUsers[docId].push({ userId, name, socketId: socket.id, color });

    // Broadcast updated presence to everyone in this doc
    io.to(docId).emit("presence-update", activeUsers[docId]);
    console.log(`${name} joined doc ${docId}`);
  });

  // Receive a text change and broadcast to others in the room
  socket.on("send-changes", ({ docId, delta }) => {
    socket.to(docId).emit("receive-changes", delta);
  });

  // Save document content to DB
  socket.on("save-doc", async ({ docId, content }) => {
    try {
      await Document.findByIdAndUpdate(docId, { content, updatedAt: new Date() });
      io.to(docId).emit("doc-saved");
    } catch (err) {
      console.error("Save error:", err.message);
    }
  });

  // Cursor position broadcast
  socket.on("cursor-move", ({ docId, userId, name, color, position }) => {
    socket.to(docId).emit("cursor-update", { userId, name, color, position });
  });

  // On disconnect — remove from active users
  socket.on("disconnect", () => {
    for (const docId in activeUsers) {
      const before = activeUsers[docId].length;
      activeUsers[docId] = activeUsers[docId].filter(
        (u) => u.socketId !== socket.id
      );
      if (activeUsers[docId].length !== before) {
        io.to(docId).emit("presence-update", activeUsers[docId]);
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

// Connect DB and start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("MongoDB error:", err.message));
