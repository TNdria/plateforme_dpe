// @ts-nocheck
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const FilterField = ({ label, locked, children }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
      {label}{locked && <Info className="h-3 w-3 text-amber-600" />}
    </label>
    {children}
  </div>
);

export const StatCard = ({ icon: Icon, theme, label, value, hint }) => (
  <Card className={cn("group relative overflow-hidden shadow-sm hover:shadow-md transition-all h-full flex flex-col border-2", theme.ring)}>
    <div className="px-4 pt-4 pb-2 border-b border-border/40">
      <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground text-center">{label}</p>
    </div>
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-5 bg-gradient-to-b from-transparent to-muted/10">
      <div className="h-14 flex items-center justify-center">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", theme.iconBg)}>
          <Icon className={cn("w-6 h-6", theme.iconColor)} />
        </div>
      </div>
      <div className="h-14 flex items-center justify-center">
        <p className="text-[2.1rem] font-bold tracking-tight leading-none tabular-nums text-foreground">{value}</p>
      </div>
    </div>
    <div className="px-4 pt-3 pb-4 border-t border-border/30 text-center">
      <div className="min-h-[36px] flex items-center justify-center">
        {hint && <p className="text-xs text-muted-foreground text-center leading-relaxed">{hint}</p>}
      </div>
    </div>
  </Card>
);