import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Home() {
  const [docs, setDocs] = useState({ owned: [], shared: [] });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const { data } = await api.get("/docs");
      setDocs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createDoc = async () => {
    try {
      const { data } = await api.post("/docs", { title: "Untitled Document" });
      navigate(`/doc/${data._id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteDoc = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this document?")) return;
    try {
      await api.delete(`/docs/${id}`);
      fetchDocs();
    } catch (err) {
      console.error(err);
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const formatDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div style={styles.page}>
      {/* Topbar */}
      <div style={styles.topbar}>
        <span style={styles.logo}>📝 CollabDoc</span>
        <div style={styles.userRow}>
          <span style={styles.userName}>{user.name}</span>
          <button onClick={logout} style={styles.logoutBtn}>Logout</button>
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.heading}>My Documents</h1>
          <button onClick={createDoc} style={styles.newBtn}>+ New Document</button>
        </div>

        {loading ? (
          <p style={styles.empty}>Loading…</p>
        ) : (
          <>
            {docs.owned.length === 0 && docs.shared.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No documents yet</p>
                <p style={{ fontSize: 13, color: "#6b6b6b", marginBottom: 20 }}>Create your first document to get started</p>
                <button onClick={createDoc} style={styles.newBtn}>+ New Document</button>
              </div>
            ) : (
              <>
                {docs.owned.length > 0 && (
                  <>
                    <h2 style={styles.sectionTitle}>Created by me</h2>
                    <div style={styles.grid}>
                      {docs.owned.map((doc) => (
                        <div key={doc._id} style={styles.card} onClick={() => navigate(`/doc/${doc._id}`)}>
                          <div style={styles.cardIcon}>📄</div>
                          <div style={styles.cardTitle}>{doc.title}</div>
                          <div style={styles.cardDate}>Updated {formatDate(doc.updatedAt)}</div>
                          <button onClick={(e) => deleteDoc(doc._id, e)} style={styles.deleteBtn}>🗑</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {docs.shared.length > 0 && (
                  <>
                    <h2 style={{ ...styles.sectionTitle, marginTop: 32 }}>Shared with me</h2>
                    <div style={styles.grid}>
                      {docs.shared.map((doc) => (
                        <div key={doc._id} style={styles.card} onClick={() => navigate(`/doc/${doc._id}`)}>
                          <div style={styles.cardIcon}>🤝</div>
                          <div style={styles.cardTitle}>{doc.title}</div>
                          <div style={styles.cardDate}>By {doc.owner?.name} · {formatDate(doc.updatedAt)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f5f5f4" },
  topbar: { background: "#fff", borderBottom: "1px solid #e5e5e5", padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { fontSize: 18, fontWeight: 700 },
  userRow: { display: "flex", alignItems: "center", gap: 12 },
  userName: { fontSize: 13, color: "#444" },
  logoutBtn: { fontSize: 12, padding: "5px 12px", border: "1px solid #e5e5e5", borderRadius: 6, background: "transparent", color: "#444" },
  content: { maxWidth: 900, margin: "0 auto", padding: "32px 24px" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  heading: { fontSize: 24, fontWeight: 700 },
  newBtn: { fontSize: 13, fontWeight: 600, padding: "8px 16px", background: "#534AB7", color: "#fff", border: "none", borderRadius: 6 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: "#6b6b6b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 },
  card: { background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "16px", cursor: "pointer", position: "relative", transition: "box-shadow 0.15s" },
  cardIcon: { fontSize: 28, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  cardDate: { fontSize: 11, color: "#9b9b9b" },
  deleteBtn: { position: "absolute", top: 10, right: 10, background: "transparent", border: "none", fontSize: 14, opacity: 0.4, cursor: "pointer" },
  empty: { color: "#9b9b9b", fontSize: 14 },
  emptyState: { textAlign: "center", paddingTop: 80 },
};
