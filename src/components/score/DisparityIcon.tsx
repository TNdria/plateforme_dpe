import fille from "@/assets/score/fille.png";
import garcons from "@/assets/score/garcons.png";

/**
 * Vignette « Disparité aux dépens des » — affiche l'image fille.png ou
 * garcons.png au lieu du libellé texte. Utilisé dans tous les TDB
 * (École, ZAP, CISCO, DREN) pour cohérence visuelle.
 */
export const DisparityIcon = ({
  kind,
  size = 32,
}: {
  kind: "f" | "g" | null | undefined;
  size?: number;
}) => {
  if (kind !== "f" && kind !== "g") {
    return <span style={{ color: "#777" }}>—</span>;
  }
  const src = kind === "f" ? fille : garcons;
  const alt = kind === "f" ? "Aux dépens des filles" : "Aux dépens des garçons";
  return (
    <img
      src={src}
      alt={alt}
      title={alt}
      style={{ height: size, width: "auto", display: "inline-block", verticalAlign: "middle" }}
    />
  );
};

export default DisparityIcon;
