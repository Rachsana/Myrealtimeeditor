const mongoose = require("mongoose");

const versionSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
    savedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { _id: true }
);

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    default: "Untitled Document",
  },

  content: {
    type: String,
    default: "",
  },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  collaborators: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      role: {
        type: String,
        enum: ["editor", "viewer"],
        default: "editor",
      },
    },
  ],

  // Auto-save Version History
  versions: {
    type: [versionSchema],
    default: [],
  },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
});

module.exports = mongoose.model("Document", documentSchema);
