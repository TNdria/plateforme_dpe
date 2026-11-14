import type { HTMLAttributes } from "react";
import {
  getEtablissementIconHtml,
  getSchoolLevelIconHtml,
  normalizeSchoolLevel,
  getEtablissementIconColor,
  type EtablissementIconType,
} from "@/lib/etablissementIcons";

type SchoolLevelIconProps = HTMLAttributes<HTMLSpanElement> & {
  level: unknown;
};

type EtablissementIconProps = HTMLAttributes<HTMLSpanElement> & {
  type: unknown;
  size?: number;
};

/** Silhouette pleine centrale d'un niveau scolaire. */
export function SchoolLevelIcon({ level, className, style, ...props }: SchoolLevelIconProps) {
  const normalizedLevel = normalizeSchoolLevel(level);
  const iconHtml = getSchoolLevelIconHtml(normalizedLevel, "width:1em;height:1em", "", 24);
  if (!iconHtml) {
    return <span className={className} aria-label="Niveau scolaire non identifié" />;
  }

  return (
    <span
      className={`inline-flex items-center justify-center leading-none ${className ?? ""}`}
      style={{ color: normalizedLevel ? getEtablissementIconColor(normalizedLevel) : undefined, ...style }}
      aria-hidden="true"
      {...props}
      dangerouslySetInnerHTML={{ __html: iconHtml }}
    />
  );
}

/** Icône commune d'un établissement ou d'un village. */
export function EtablissementIcon({ type, size = 16, className, style, ...props }: EtablissementIconProps) {
  const level = normalizeSchoolLevel(type);
  const iconHtml = level
    ? getSchoolLevelIconHtml(level, "width:1em;height:1em", "", size)
    : type === "village"
      ? getEtablissementIconHtml("village" as EtablissementIconType, "currentColor", size)
      : null;

  if (!iconHtml) return <span className={className} aria-label="Icône inconnue" />;

  return (
    <span
      className={`inline-flex items-center justify-center leading-none ${className ?? ""}`}
      style={{ color: level ? getEtablissementIconColor(level) : undefined, ...style }}
      aria-hidden="true"
      {...props}
      dangerouslySetInnerHTML={{ __html: iconHtml }}
    />
  );
}
