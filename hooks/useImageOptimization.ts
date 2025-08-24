import { useState, useEffect, useCallback } from 'react';
import { getOptimizedImageUrl, preloadImage } from '@/lib/image-optimization';

interface UseImageOptimizationOptions {
  priority?: 'high' | 'low';
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  width?: number;
  height?: number;
  preload?: boolean;
}

export function useImageOptimization(
  src: string,
  options: UseImageOptimizationOptions = {}
) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [optimizedSrc, setOptimizedSrc] = useState(src);

  const {
    priority = 'low',
    quality = 75,
    format = 'webp',
    width,
    height,
    preload = false,
  } = options;

  // Generate optimized URL
  useEffect(() => {
    const optimized = getOptimizedImageUrl(src, { quality, format, width, height });
    setOptimizedSrc(optimized);
  }, [src, quality, format, width, height]);

  // Preload image if requested
  useEffect(() => {
    if (preload && src) {
      preloadImage(src, priority);
    }
  }, [preload, src, priority]);

  // Load image and get dimensions
  const loadImage = useCallback(() => {
    if (!src) return;

    const img = new Image();
    
    img.onload = () => {
      setIsLoaded(true);
      setIsError(false);
      setDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      setIsError(true);
      setIsLoaded(false);
    };

    img.src = src;
  }, [src]);

  // Auto-load image
  useEffect(() => {
    loadImage();
  }, [loadImage]);

  // Retry loading
  const retry = useCallback(() => {
    setIsLoaded(false);
    setIsError(false);
    setDimensions(null);
    loadImage();
  }, [loadImage]);

  return {
    src: optimizedSrc,
    isLoaded,
    isError,
    dimensions,
    retry,
    loadImage,
  };
}

export function useLazyImage(
  src: string,
  options: UseImageOptimizationOptions & { threshold?: number } = {}
) {
  const [isInView, setIsInView] = useState(false);
  const [ref, setRef] = useState<HTMLElement | null>(null);
  const imageOptimization = useImageOptimization(isInView ? src : '', options);

  useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: '50px',
      }
    );

    observer.observe(ref);

    return () => {
      if (ref) {
        observer.unobserve(ref);
      }
    };
  }, [ref, options.threshold]);

  return {
    ...imageOptimization,
    ref: setRef,
    isInView,
  };
}

export function useImagePreloader(images: string[]) {
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount] = useState(images.length);

  useEffect(() => {
    if (images.length === 0) return;

    let mounted = true;
    const loadedImages = new Set<string>();

    const loadImage = (src: string) => {
      if (loadedImages.has(src)) return;

      const img = new Image();
      img.onload = () => {
        if (mounted) {
          loadedImages.add(src);
          setLoadedCount(loadedImages.size);
        }
      };
      img.src = src;
    };

    // Load all images
    images.forEach(loadImage);

    return () => {
      mounted = false;
    };
  }, [images]);

  const progress = totalCount > 0 ? (loadedCount / totalCount) * 100 : 0;

  return {
    loadedCount,
    totalCount,
    progress,
    isComplete: loadedCount === totalCount,
  };
}
