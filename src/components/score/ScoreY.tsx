import smiling from "@/assets/score/smiling.webp";
import neutre from "@/assets/score/neutre.webp";
import sweat from "@/assets/score/sweat.webp";
import confused from "@/assets/score/confused.webp";
import crying from "@/assets/score/crying.webp";

/**
 * Score Y synthétique selon tdb_pdf.py / tdb_cisco_pdf.py
 * Y = moyenne(100 - red_ensemble, txRetentionTotal, TPA, tx_admis)
 * Seuils:
 *   >= 80 : smiling
 *   60-80 : neutre
 *   40-60 : sweat
 *   20-40 : confused
 *   <  20 : crying
 */
export function computeScoreY(row: Record<string, any>): number {
  try {
    const red = Math.min(Number(row.red_ensemble || 0), 100);
    const ret = Number(row.txRetentionTotal || 0);
    const tpa = Number(row.TPA || 0);
    const cepe = Number(row.tx_admis || 0);
    const vals = [100 - red, ret, tpa, cepe].filter((v) => !isNaN(v) && isFinite(v));
    if (vals.length === 0) return 50;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(mean * 10) / 10;
  } catch {
    return 50;
  }
}

export function scoreEmoji(y: number): string {
  if (y >= 80) return smiling;
  if (y >= 60) return neutre;
  if (y >= 40) return sweat;
  if (y >= 20) return confused;
  return crying;
}

export function scoreLabel(y: number): string {
  if (y >= 80) return "Très bon";
  if (y >= 60) return "Bon";
  if (y >= 40) return "Moyen";
  if (y >= 20) return "Faible";
  return "Critique";
}

interface Props {
  value: number;
  size?: number;
  showLabel?: boolean;
  showValue?: boolean;
}

export const ScoreY = ({ value, size = 32, showLabel = false, showValue = true }: Props) => {
  const src = scoreEmoji(value);
  const label = scoreLabel(value);
  return (
    <div className="inline-flex items-center gap-2">
      <img src={src} alt={label} width={size} height={size} className="object-contain" />
      {showValue && <span className="font-bold text-sm tabular-nums">{value.toFixed(1)}</span>}
      {showLabel && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
};
