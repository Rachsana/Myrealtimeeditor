import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", form);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>📝 CollabDoc</div>
        <h2 style={styles.title}>Welcome back</h2>
        <p style={styles.sub}>Sign in to your account</p>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" placeholder="you@example.com"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input style={styles.input} type="password" placeholder="••••••••"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={styles.switch}>Don't have an account? <Link to="/register" style={styles.link}>Register</Link></p>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f4" },
  card: { background: "#fff", borderRadius: 12, padding: "36px 40px", width: 360, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  logo: { fontSize: 20, fontWeight: 600, marginBottom: 20, textAlign: "center" },
  title: { fontSize: 22, fontWeight: 600, marginBottom: 4 },
  sub: { fontSize: 13, color: "#6b6b6b", marginBottom: 20 },
  error: { background: "#fef2f2", color: "#b91c1c", fontSize: 13, padding: "8px 12px", borderRadius: 6, marginBottom: 14 },
  field: { marginBottom: 14, display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 12, color: "#6b6b6b" },
  input: { fontSize: 13, padding: "8px 10px", border: "1px solid #e5e5e5", borderRadius: 6, outline: "none" },
  btn: { width: "100%", padding: "9px", fontSize: 13, fontWeight: 600, background: "#534AB7", color: "#fff", border: "none", borderRadius: 6, marginTop: 4 },
  switch: { fontSize: 12, color: "#6b6b6b", textAlign: "center", marginTop: 16 },
  link: { color: "#534AB7", fontWeight: 600, textDecoration: "none" },
};
