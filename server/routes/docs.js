const express = require("express");
const Document = require("../models/Document");
const User = require("../models/User");

const router = express.Router();

// Get all docs for logged-in user (owned + shared)
router.get("/", async (req, res) => {
  try {
    const owned = await Document.find({ owner: req.user.id }).select("title updatedAt owner");
    const shared = await Document.find({ "collaborators.user": req.user.id }).select("title updatedAt owner").populate("owner", "name");
    res.json({ owned, shared });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new document
router.post("/", async (req, res) => {
  try {
    const doc = await Document.create({ owner: req.user.id, title: req.body.title || "Untitled Document" });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single document (owner or collaborator only)
router.get("/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate("owner", "name email").populate("collaborators.user", "name email");
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const isOwner = doc.owner._id.toString() === req.user.id;
    const isCollab = doc.collaborators.some((c) => c.user._id.toString() === req.user.id);

    if (!isOwner && !isCollab) return res.status(403).json({ message: "Access denied" });

    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update document title
router.patch("/:id/title", async (req, res) => {
  try {
    const doc = await Document.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      { title: req.body.title, updatedAt: new Date() },
      { new: true }
    );
    if (!doc) return res.status(403).json({ message: "Not allowed" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add collaborator by email
router.post("/:id/invite", async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user.id });
    if (!doc) return res.status(403).json({ message: "Not allowed" });

    const invitee = await User.findOne({ email: req.body.email });
    if (!invitee) return res.status(404).json({ message: "User not found" });

    const already = doc.collaborators.some((c) => c.user.toString() === invitee._id.toString());
    if (already) return res.status(400).json({ message: "Already a collaborator" });

    doc.collaborators.push({ user: invitee._id, role: req.body.role || "editor" });
    await doc.save();

    res.json({ message: "Collaborator added" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete document (owner only)
router.delete("/:id", async (req, res) => {
  try {
    const doc = await Document.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    if (!doc) return res.status(403).json({ message: "Not allowed" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
