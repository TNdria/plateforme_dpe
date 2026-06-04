import fille from "@/assets/score/fille.png";
import garcons from "@/assets/score/garcons.png";

/**
 * Petit sticker fille/garçon pour annoter les lignes "par genre" dans les TDB.
 * Inspiré des templates Python tdb_dren_n2.html / tdb_pdf.py.
 */
export const GenderSticker = ({
  gender,
  size = 22,
}: {
  gender: "f" | "g";
  size?: number;
}) => {
  const src = gender === "f" ? fille : garcons;
  const alt = gender === "f" ? "Fille" : "Garçon";
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className="object-contain inline-block align-middle"
      style={{ marginRight: 4 }}
    />
  );
};

export const GenderLabel = ({
  gender,
  size = 18,
}: {
  gender: "f" | "g";
  size?: number;
}) => (
  <span className="inline-flex items-center gap-1">
    <GenderSticker gender={gender} size={size} />
    <span>{gender === "f" ? "Fille" : "Garçon"}</span>
  </span>
);
