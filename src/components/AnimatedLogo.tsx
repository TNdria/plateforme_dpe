import { useEffect, useState } from "react";
import logoMen from "@/assets/logoMen.jpg";
import logoDpe from "@/assets/logoDpe.jpg";
import logoMenBare from "@/assets/logoMen.png";
import logoDpeBare from "@/assets/logoDpe.png";
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
  /**
   * "boxed" (default) uses the square JPEG assets; "bare" uses the PNG
   * versions with a transparent background so only the emblem shows.
   */
  variant?: "boxed" | "bare";
}

/**
 * Animated logo that smoothly cross-fades between the MEN and DPE logos
 * in a continuous loop. Uses a subtle scale + rotate-3D feel via Tailwind
 * transitions so it looks elegant rather than flashy.
 */
const makeLogos = (men: string, dpe: string) => [
  { src: men, alt: "Ministère de l'Éducation Nationale" },
  { src: dpe, alt: "Direction de la Planification de l'Éducation" },
];

const LOGOS_BOXED = makeLogos(logoMen, logoDpe);
const LOGOS_BARE = makeLogos(logoMenBare, logoDpeBare);

export const AnimatedLogo = ({
  size = 56,
  className,
  imgClassName,
  interval = 2800,
  glow = false,
  variant = "boxed",
}: AnimatedLogoProps) => {
  const [index, setIndex] = useState(0);
  const logos = variant === "bare" ? LOGOS_BARE : LOGOS_BOXED;

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % logos.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [interval, logos.length]);

  const style = className?.match(/\b[hw]-\d/) ? undefined : { width: size, height: size };

  return (
    <div
      className={cn(
        "relative inline-block",
        variant === "boxed" && "rounded-full overflow-hidden",
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
      {logos.map((logo, i) => (
        <img
          key={logo.src}
          src={logo.src}
          alt={logo.alt}
          className={cn(
            "absolute inset-0 h-full w-full transition-all duration-1000 ease-in-out",
            variant === "boxed" ? "object-cover rounded-full" : "object-contain",
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
