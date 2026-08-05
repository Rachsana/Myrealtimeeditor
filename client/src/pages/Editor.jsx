import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import api from "../api";

const SAVE_INTERVAL = 2000;

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Fix: MongoDB returns _id, JWT might return id — support both
  const userId = user.id || user._id;
  const userName = user.name || "Anonymous";

  const [doc, setDoc] = useState(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("Untitled Document");
  const [saveStatus, setSaveStatus] = useState("saved");
  const [presence, setPresence] = useState([]);
  const [showShare, setShowShare] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [connected, setConnected] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState({});

  const socketRef = useRef(null);
  const saveTimerRef = useRef(null);
  const textareaRef = useRef(null);

  // Load document once
  useEffect(() => {
    api.get(`/docs/${id}`)
      .then(({ data }) => {
        setDoc(data);
        setTitle(data.title);
        setContent(data.content || "");
      })
      .catch(() => navigate("/"));
  }, [id]);

  // Setup socket — only once on mount, never re-runs
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SERVER_URL || "http://localhost:5000", {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-doc", { docId: id, userId, name: userName });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("receive-changes", (delta) => {
      setContent(delta);
    });

    socket.on("presence-update", (users) => {
      setPresence(users.filter((u) => u.userId !== userId));
    });

    socket.on("cursor-update", ({ userId, username, pos, color }) => {
    setRemoteCursors((prev) => ({
        ...prev,
        [userId]: { pos, username, color }
    }));
});

    socket.on("doc-saved", () => setSaveStatus("saved"));

    return () => socket.disconnect();
  }, [id]); // only re-run if doc id changes
useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea || !socketRef.current) return;

    const sendCursor = () => {
        socketRef.current.emit("cursor-move", {
            docId: id,
            userId,
            username: userName,
            pos: textarea.selectionStart
        });
    };

    textarea.addEventListener("click", sendCursor);
    textarea.addEventListener("keyup", sendCursor);
    textarea.addEventListener("select", sendCursor);

    return () => {
        textarea.removeEventListener("click", sendCursor);
        textarea.removeEventListener("keyup", sendCursor);
        textarea.removeEventListener("select", sendCursor);
    };
}, [id]);
  // Auto-save on content change
  useEffect(() => {
    if (!socketRef.current || !socketRef.current.connected) return;
    setSaveStatus("unsaved");
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus("saving");
      socketRef.current.emit("save-doc", { docId: id, content });
    }, SAVE_INTERVAL);
    return () => clearTimeout(saveTimerRef.current);
  }, [content]);

  const handleChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    if (socketRef.current) {
      socketRef.current.emit("send-changes", { docId: id, delta: newContent });
    }
  };

  const handleTitleChange = async (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    try {
      await api.patch(`/docs/${id}/title`, { title: newTitle });
    } catch (err) {
      console.error(err);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    try {
      await api.post(`/docs/${id}/invite`, { email: inviteEmail, role: "editor" });
      setInviteMsg("✓ Invited successfully");
      setInviteEmail("");
      setTimeout(() => setInviteMsg(""), 3000);
    } catch (err) {
      setInviteMsg(err.response?.data?.message || "Failed to invite");
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const avatarColors = ["#B5D4F4", "#F5C4B3", "#9FE1CB", "#D8B4FE", "#FCA5A5"];
  const textColors = ["#0C447C", "#712B13", "#085041", "#5B21B6", "#991B1B"];

  return (
    <div style={styles.page}>
      {/* Topbar */}
      <div style={styles.topbar}>
        <span style={styles.logo} onClick={() => navigate("/")} title="Back to home">📝</span>
        <input
          style={styles.titleInput}
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled Document"
        />
        <span style={{ ...styles.pill, ...(saveStatus === "saved" ? styles.pillGreen : styles.pillAmber) }}>
          {saveStatus === "saved" ? "✓ saved" : saveStatus === "saving" ? "… saving" : "● unsaved"}
        </span>

        {/* Presence avatars */}
        <div style={styles.avatarRow}>
          <div style={{ ...styles.avatar, background: avatarColors[0], color: textColors[0], zIndex: 10 }} title={userName}>
            {userName[0]?.toUpperCase()}
          </div>
          {presence.slice(0, 3).map((u, i) => (
            <div key={u.userId} style={{ ...styles.avatar, background: avatarColors[i + 1], color: textColors[i + 1], marginLeft: -6, zIndex: 9 - i }} title={u.name}>
              {u.name?.[0]?.toUpperCase()}
            </div>
          ))}
          {presence.length > 3 && (
            <div style={{ ...styles.avatar, background: "#e5e5e5", color: "#444", marginLeft: -6 }}>+{presence.length - 3}</div>
          )}
        </div>

        <button style={styles.shareBtn} onClick={() => setShowShare(true)}>Share</button>
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        {["B", "I", "U", "H1", "H2", "•"].map((fmt) => (
          <button key={fmt} style={styles.toolBtn}>{fmt}</button>
        ))}
        <div style={styles.tbSep} />
        <span style={styles.toolLabel}>Plain text editor</span>
      </div>

      {/* Editor */}
      <div style={styles.editorWrap}>
        <textarea
          ref={textareaRef}
          style={styles.textarea}
          value={content}
          onChange={handleChange}
          placeholder={"Start typing your document here…\n\nThis editor syncs in real-time with everyone who has access."}
          spellCheck
        />
        <div
    style={{
        width: "100%",
        maxWidth: 680,
        margin: "10px auto",
        fontSize: "13px",
    }}
>
    {Object.values(remoteCursors).map((cursor) => (
        <div
            key={cursor.username}
            style={{
                color: cursor.color,
                marginBottom: "4px",
                fontWeight: 500,
            }}
        >
            🖊 {cursor.username} is editing (Cursor: {cursor.pos})
        </div>
    ))}
</div>
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span>{wordCount} words</span>
        <span>{content.length} chars</span>
        <span>{presence.length + 1} online</span>
        <span style={{ marginLeft: "auto", color: connected ? "#1D9E75" : "#ef4444" }}>
          {connected ? "● Connected" : "○ Disconnected"}
        </span>
      </div>

      {/* Share Modal */}
      {showShare && (
        <div style={styles.modalBg} onClick={() => setShowShare(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Share document</h2>
            <div style={styles.inviteRow}>
              <input
                style={styles.inviteInput}
                type="email"
                placeholder="Invite by email…"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
              <button style={styles.inviteBtn} onClick={handleInvite}>Invite</button>
            </div>
            {inviteMsg && (
              <p style={{ fontSize: 12, color: inviteMsg.startsWith("✓") ? "#1D9E75" : "#ef4444", marginBottom: 12 }}>
                {inviteMsg}
              </p>
            )}
            <div style={styles.collabList}>
              <div style={styles.collabRow}>
                <div style={{ ...styles.avatar, background: avatarColors[0], color: textColors[0] }}>
                  {userName[0]?.toUpperCase()}
                </div>
                <div style={styles.collabInfo}>
                  <div style={styles.collabName}>{userName}</div>
                  <div style={styles.collabEmail}>{user.email}</div>
                </div>
                <span style={{ ...styles.roleBadge, background: "#EEEDFE", color: "#3C3489" }}>Owner</span>
              </div>
              {doc?.collaborators?.map((c, i) => (
                <div key={c.user._id} style={styles.collabRow}>
                  <div style={{ ...styles.avatar, background: avatarColors[i + 1], color: textColors[i + 1] }}>
                    {c.user.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={styles.collabInfo}>
                    <div style={styles.collabName}>{c.user.name}</div>
                    <div style={styles.collabEmail}>{c.user.email}</div>
                  </div>
                  <span style={{ ...styles.roleBadge, background: "#E1F5EE", color: "#085041" }}>{c.role}</span>
                </div>
              ))}
            </div>
            <div style={styles.linkRow}>
              <div style={styles.linkBox}>{window.location.href}</div>
              <button style={styles.copyBtn} onClick={() => navigator.clipboard.writeText(window.location.href)}>
                Copy
              </button>
            </div>
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button style={styles.doneBtn} onClick={() => setShowShare(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { height: "100vh", display: "flex", flexDirection: "column", background: "#fff" },
  topbar: { display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: "1px solid #e5e5e5", background: "#fff" },
  logo: { fontSize: 20, cursor: "pointer" },
  titleInput: { flex: 1, fontSize: 14, fontWeight: 600, border: "none", outline: "none", background: "transparent", color: "#1a1a1a" },
  pill: { fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 500 },
  pillGreen: { background: "#E1F5EE", color: "#085041" },
  pillAmber: { background: "#FAEEDA", color: "#633806" },
  avatarRow: { display: "flex", alignItems: "center" },
  avatar: { width: 26, height: 26, borderRadius: "50%", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" },
  shareBtn: { fontSize: 12, padding: "5px 14px", border: "1px solid #e5e5e5", borderRadius: 6, background: "transparent", color: "#1a1a1a" },
  toolbar: { display: "flex", alignItems: "center", gap: 2, padding: "5px 16px", borderBottom: "1px solid #e5e5e5", background: "#fafaf9" },
  toolBtn: { padding: "3px 8px", border: "none", background: "transparent", color: "#6b6b6b", fontSize: 12, fontWeight: 600, borderRadius: 4 },
  tbSep: { width: 1, height: 16, background: "#e5e5e5", margin: "0 4px" },
  toolLabel: { fontSize: 11, color: "#9b9b9b" },
  editorWrap: { flex: 1, overflow: "auto", padding: "32px 0", background: "#fafaf9" },
  textarea: { display: "block", margin: "0 auto", width: "100%", maxWidth: 680, minHeight: "100%", padding: "0 24px", fontSize: 15, lineHeight: 1.8, border: "none", outline: "none", background: "transparent", resize: "none", color: "#1a1a1a", fontFamily: "Georgia, serif" },
  statusBar: { display: "flex", gap: 16, padding: "4px 16px", borderTop: "1px solid #e5e5e5", fontSize: 11, color: "#9b9b9b", background: "#fafaf9" },
  modalBg: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#fff", borderRadius: 12, padding: 24, width: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" },
  modalTitle: { fontSize: 16, fontWeight: 700, marginBottom: 16 },
  inviteRow: { display: "flex", gap: 8, marginBottom: 12 },
  inviteInput: { flex: 1, fontSize: 13, padding: "7px 10px", border: "1px solid #e5e5e5", borderRadius: 6, outline: "none" },
  inviteBtn: { fontSize: 12, padding: "7px 16px", background: "#534AB7", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600 },
  collabList: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 },
  collabRow: { display: "flex", alignItems: "center", gap: 10 },
  collabInfo: { flex: 1 },
  collabName: { fontSize: 13, fontWeight: 600 },
  collabEmail: { fontSize: 11, color: "#9b9b9b" },
  roleBadge: { fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 500 },
  linkRow: { display: "flex", gap: 8, paddingTop: 14, borderTop: "1px solid #e5e5e5" },
  linkBox: { flex: 1, fontSize: 11, padding: "6px 10px", background: "#f5f5f4", borderRadius: 6, color: "#6b6b6b", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  copyBtn: { fontSize: 12, padding: "6px 12px", border: "1px solid #e5e5e5", borderRadius: 6, background: "transparent" },
  doneBtn: { fontSize: 12, padding: "6px 16px", border: "1px solid #e5e5e5", borderRadius: 6, background: "transparent" },
};
