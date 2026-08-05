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

// List version history for a document (owner or collaborator only)
router.get("/:id/versions", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .select("owner collaborators versions")
      .populate("versions.savedBy", "name email");
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const isOwner = doc.owner.toString() === req.user.id;
    const isCollab = doc.collaborators.some((c) => c.user.toString() === req.user.id);
    if (!isOwner && !isCollab) return res.status(403).json({ message: "Access denied" });

    // Most recent first, don't send full content in the list (keep it light)
    const versions = doc.versions
      .slice()
      .reverse()
      .map((v) => ({
        _id: v._id,
        savedAt: v.savedAt,
        savedBy: v.savedBy,
        preview: (v.content || "").slice(0, 120),
      }));

    res.json(versions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Restore a specific version as the current content (owner or collaborator only)
router.post("/:id/restore/:versionId", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const isOwner = doc.owner.toString() === req.user.id;
    const isCollab = doc.collaborators.some((c) => c.user.toString() === req.user.id);
    if (!isOwner && !isCollab) return res.status(403).json({ message: "Access denied" });

    const version = doc.versions.id(req.params.versionId);
    if (!version) return res.status(404).json({ message: "Version not found" });

    // Snapshot current content before overwriting, so restoring is itself undoable
    doc.versions.push({ content: doc.content, savedBy: req.user.id });
    doc.content = version.content;
    doc.updatedAt = new Date();
    await doc.save();

    res.json({ message: "Restored", content: doc.content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------------------------------------------------------------------------
// AI-assisted change summary.
// Compares the two most recent versions and returns a short, plain-English
// summary of what changed — using an LLM if OPENAI_API_KEY is configured,
// otherwise a lightweight heuristic diff so the feature still works with
// zero external dependencies / no paid key required.
// ---------------------------------------------------------------------------
function heuristicDiffSummary(oldText = "", newText = "") {
  const oldWords = new Set(oldText.split(/\s+/).filter(Boolean));
  const newWords = new Set(newText.split(/\s+/).filter(Boolean));
  const added = [...newWords].filter((w) => !oldWords.has(w));
  const removed = [...oldWords].filter((w) => !newWords.has(w));
  const lengthDelta = newText.length - oldText.length;

  if (added.length === 0 && removed.length === 0) {
    return "No meaningful changes detected between these versions.";
  }
  const parts = [];
  if (lengthDelta > 0) parts.push(`grew by about ${lengthDelta} characters`);
  else if (lengthDelta < 0) parts.push(`shrank by about ${Math.abs(lengthDelta)} characters`);
  if (added.length) parts.push(`added terms like "${added.slice(0, 5).join('", "')}"`);
  if (removed.length) parts.push(`removed terms like "${removed.slice(0, 5).join('", "')}"`);
  return `This edit ${parts.join(", ")}. (Heuristic summary — set OPENAI_API_KEY for AI-generated summaries.)`;
}

async function aiDiffSummary(oldText, newText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return heuristicDiffSummary(oldText, newText);

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "You summarize edits to a shared document in one or two short sentences, in plain English, for a collaborator who wasn't watching. Be concise and specific about what actually changed.",
          },
          {
            role: "user",
            content: `PREVIOUS VERSION:\n${(oldText || "(empty)").slice(0, 3000)}\n\nNEW VERSION:\n${(newText || "(empty)").slice(0, 3000)}`,
          },
        ],
      }),
    });

    if (!resp.ok) throw new Error(`OpenAI API returned ${resp.status}`);
    const data = await resp.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    return summary || heuristicDiffSummary(oldText, newText);
  } catch (err) {
    console.error("AI summary failed, falling back to heuristic:", err.message);
    return heuristicDiffSummary(oldText, newText);
  }
}

// Summarize what changed between the two most recent versions
router.get("/:id/summarize", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).select("owner collaborators versions content");
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const isOwner = doc.owner.toString() === req.user.id;
    const isCollab = doc.collaborators.some((c) => c.user.toString() === req.user.id);
    if (!isOwner && !isCollab) return res.status(403).json({ message: "Access denied" });

    const versions = doc.versions;
    if (versions.length === 0) {
      return res.json({ summary: "No version history yet — keep editing and a snapshot will be saved automatically." });
    }

    const newest = versions[versions.length - 1];
    const previous = versions.length > 1 ? versions[versions.length - 2] : { content: "" };

    const summary = await aiDiffSummary(previous.content, newest.content || doc.content);
    res.json({ summary, comparedAt: newest.savedAt });
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
