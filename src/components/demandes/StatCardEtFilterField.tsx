export function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

export function FilterField({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <label className="space-y-1 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
