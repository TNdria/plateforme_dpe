/**
 * MadagascarPin — silhouette sobre de Madagascar utilisée comme repère
 * de position dans les grilles d'efficience des tableaux de bord.
 * Remplace l'ancien sticker « moto ».
 */
interface Props {
  size?: number;
  color?: string;
  title?: string;
  style?: React.CSSProperties;
}

export const MadagascarPin = ({ size = 22, color = '#c62828', title = 'Position', style }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    role="img"
    aria-label={title}
    style={style}
  >
    <title>{title}</title>
    <path
      d="M63 6c4 0 7 4 6 9-1 6-4 11-4 17 0 7 4 12 5 19 2 9-1 18-5 26-4 9-9 17-15 24-3 4-7 8-12 8-4 0-7-4-7-9 0-6 3-11 5-17 3-8 4-16 5-25 1-11 3-22 8-32 4-9 8-17 14-20z"
      fill={color}
      stroke="#ffffff"
      strokeWidth={4}
      strokeLinejoin="round"
      paintOrder="stroke"
    />
  </svg>
);

export default MadagascarPin;
