import React from "react";

export default function DemandeDetailModal({ open = false, children = null }: { open?: boolean; children?: React.ReactNode }) {
  if (!open) return null;
  return <div className="rounded-lg border bg-card p-4 text-sm">{children}</div>;
}
