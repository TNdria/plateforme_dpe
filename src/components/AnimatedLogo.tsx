import { useEffect, useState } from "react";
import logoMen from "@/assets/logoMen.jpg";
import logoDpe from "@/assets/logoDpe.jpg";
import { cn } from "@/lib/utils";

interface AnimatedLogoProps {
  /** Diameter in pixels (used for the wrapper) */
  size?: number;
  /** Tailwind classes for the wrapper (overrides size if you pass h-X w-X) */
  className?: string;
  /** Tailwind classes applied to each <img> */
  imgClassName?: string;
  /** Interval between swaps in ms */
  interval?: number;
  /** When true, render a soft glow ring behind the logo (hero / login) */
  glow?: boolean;
}

/**
 * Animated logo that smoothly cross-fades between the MEN and DPE logos
 * in a continuous loop. Uses a subtle scale + rotate-3D feel via Tailwind
 * transitions so it looks elegant rather than flashy.
 */
const LOGOS = [
  { src: logoMen, alt: "Ministère de l'Éducation Nationale" },
  { src: logoDpe, alt: "Direction de la Planification de l'Éducation" },
];

export const AnimatedLogo = ({
  size = 56,
  className,
  imgClassName,
  interval = 2800,
  glow = false,
}: AnimatedLogoProps) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % LOGOS.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [interval]);

  const style = className?.match(/\b[hw]-\d/) ? undefined : { width: size, height: size };

  return (
    <div
      className={cn(
        "relative inline-block rounded-full overflow-hidden",
        glow && "ring-2 ring-white/20 shadow-[0_0_24px_rgba(255,255,255,0.25)]",
        className,
      )}
      style={style}
      aria-label="Logo MEN / DPE"
    >
      {glow && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 via-transparent to-accent/30 animate-pulse pointer-events-none"
        />
      )}
      {LOGOS.map((logo, i) => (
        <img
          key={logo.src}
          src={logo.src}
          alt={logo.alt}
          className={cn(
            "absolute inset-0 h-full w-full object-cover rounded-full transition-all duration-1000 ease-in-out",
            i === index
              ? "opacity-100 scale-100 rotate-0"
              : "opacity-0 scale-110 -rotate-6",
            imgClassName,
          )}
          draggable={false}
        />
      ))}
    </div>
  );
};

export default AnimatedLogo;
