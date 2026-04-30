import { useState } from "react";
import { apiClient } from "@/api/client";

const LicenseActivation = ({ onActivated }) => {
  const [machineId, setMachineId] = useState("Loading...");
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch machine ID on mount
  useState(() => {
    apiClient.license.status().then((data) => {
      if (data?.machineId) {
        setMachineId(data.machineId);
      }
    });
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = machineId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const trimmedKey = licenseKey.trim();
      if (!trimmedKey) {
        setError("Please enter a license key.");
        setLoading(false);
        return;
      }

      await apiClient.license.activate(trimmedKey);
      onActivated();
    } catch (err) {
      setError(err.message || "Invalid license key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.lockIcon}>🔒</div>
          <h1 style={styles.title}>TurfSlot</h1>
          <p style={styles.subtitle}>License Activation Required</p>
        </div>

        {/* Machine ID */}
        <div style={styles.section}>
          <label style={styles.label}>Your Machine ID</label>
          <div style={styles.machineIdRow}>
            <code style={styles.machineIdCode}>{machineId}</code>
            <button
              onClick={handleCopy}
              style={styles.copyBtn}
              title="Copy to clipboard"
            >
              {copied ? "✓ Copied" : "📋 Copy"}
            </button>
          </div>
          <p style={styles.hint}>
            Send this ID to the developer to receive your license key.
          </p>
        </div>

        {/* License Key Input */}
        <form onSubmit={handleActivate} style={styles.section}>
          <label style={styles.label}>License Key</label>
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Paste your license key here..."
            style={styles.input}
            disabled={loading}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            style={{
              ...styles.activateBtn,
              opacity: loading ? 0.7 : 1,
            }}
            disabled={loading}
          >
            {loading ? "Verifying..." : "Activate License"}
          </button>
        </form>

        {/* Footer */}
        <p style={styles.footer}>
          Contact:{" "}
          <span style={{ color: "#60a5fa" }}>support@turf.rumon.top</span>
        </p>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "460px",
    background: "rgba(30, 41, 59, 0.95)",
    borderRadius: "16px",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    padding: "40px",
    boxShadow:
      "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(148, 163, 184, 0.05)",
  },
  header: {
    textAlign: "center",
    marginBottom: "32px",
  },
  lockIcon: {
    fontSize: "48px",
    marginBottom: "12px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#f1f5f9",
    margin: "0 0 4px 0",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: 0,
  },
  section: {
    marginBottom: "24px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "8px",
  },
  machineIdRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  machineIdCode: {
    flex: 1,
    padding: "10px 14px",
    background: "rgba(15, 23, 42, 0.8)",
    borderRadius: "8px",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    color: "#e2e8f0",
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  copyBtn: {
    padding: "10px 16px",
    background: "rgba(59, 130, 246, 0.15)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    borderRadius: "8px",
    color: "#60a5fa",
    fontSize: "13px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.2s",
  },
  hint: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "8px",
    marginBottom: 0,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    background: "rgba(15, 23, 42, 0.8)",
    borderRadius: "8px",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    color: "#e2e8f0",
    fontSize: "14px",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  error: {
    color: "#f87171",
    fontSize: "13px",
    margin: "8px 0 0 0",
  },
  activateBtn: {
    width: "100%",
    padding: "14px",
    marginTop: "16px",
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    border: "none",
    borderRadius: "10px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
    letterSpacing: "0.3px",
  },
  footer: {
    textAlign: "center",
    fontSize: "12px",
    color: "#475569",
    margin: 0,
  },
};

export default LicenseActivation;
