import React from "react";
import { Hammer } from "lucide-react";

export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="card" style={{ padding: 48, textAlign: "center", maxWidth: 620, margin: "40px auto" }}>
      <div style={{ display: "inline-grid", placeItems: "center", width: 56, height: 56, borderRadius: 16, background: "var(--accent-soft)", color: "var(--accent)", marginBottom: 16 }}>
        <Hammer size={26} />
      </div>
      <h2 style={{ fontSize: 24, marginBottom: 8 }}>{title}</h2>
      <p className="muted" style={{ margin: 0 }}>{note}</p>
      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Раздел в разработке — по плану приоритетов.</p>
    </div>
  );
}
