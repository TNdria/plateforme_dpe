import { memo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallbackSrc?: string;
  blurHash?: string;
  priority?: boolean;
}

/**
 * Optimized image component for 4G/low bandwidth
 * Features:
 * - Native lazy loading
 * - Blur placeholder during load
 * - Error fallback
 * - Proper aspect ratio to prevent layout shift
 */
const OptimizedImage = memo(({
  src,
  alt,
  width,
  height,
  className,
  fallbackSrc = "/placeholder.svg",
  blurHash,
  priority = false,
}: OptimizedImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  const imageSrc = hasError ? fallbackSrc : src;

  return (
    <div 
      className={cn(
        "relative overflow-hidden bg-muted",
        className
      )}
      style={{
        width: width ? `${width}px` : undefined,
        height: height ? `${height}px` : undefined,
      }}
    >
      {/* Blur placeholder */}
      {!isLoaded && !hasError && (
        <div 
          className="absolute inset-0 shimmer"
          style={{
            backgroundColor: blurHash ? `#${blurHash.slice(0, 6)}` : undefined,
          }}
        />
      )}
      
      <img
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
});

OptimizedImage.displayName = "OptimizedImage";

export default OptimizedImage;
