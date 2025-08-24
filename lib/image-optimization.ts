/**
 * Image optimization utilities for better performance
 */

export interface ImageOptimizationConfig {
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * Generate optimized image URL for Vercel Blob images
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  config: ImageOptimizationConfig = {}
): string {
  if (!originalUrl.includes('dvba8d38nfde7nic.public.blob.vercel-storage.com')) {
    return originalUrl;
  }

  const { quality = 75, format = 'webp', width, height, fit = 'cover' } = config;
  
  // For Vercel Blob, we can't use Next.js Image optimization directly
  // But we can add query parameters for potential future optimization
  const url = new URL(originalUrl);
  
  if (quality) url.searchParams.set('q', quality.toString());
  if (format) url.searchParams.set('f', format);
  if (width) url.searchParams.set('w', width.toString());
  if (height) url.searchParams.set('h', height.toString());
  if (fit) url.searchParams.set('fit', fit);
  
  return url.toString();
}

/**
 * Get appropriate image sizes for responsive images
 */
export function getResponsiveImageSizes(containerWidth: number): string {
  if (containerWidth <= 640) return '100vw';
  if (containerWidth <= 768) return '50vw';
  if (containerWidth <= 1024) return '33vw';
  if (containerWidth <= 1280) return '25vw';
  return '20vw';
}

/**
 * Generate srcSet for responsive images
 */
export function generateSrcSet(
  baseUrl: string,
  widths: number[],
  config: ImageOptimizationConfig = {}
): string {
  return widths
    .map(width => {
      const optimizedUrl = getOptimizedImageUrl(baseUrl, { ...config, width });
      return `${optimizedUrl} ${width}w`;
    })
    .join(', ');
}

/**
 * Preload critical images
 */
export function preloadImage(src: string, priority: 'high' | 'low' = 'low'): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  link.fetchPriority = priority;
  
  document.head.appendChild(link);
}

/**
 * Lazy load images with Intersection Observer
 */
export function setupLazyLoading(): void {
  if (typeof window === 'undefined') return;

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      }
    });
  });

  // Observe all images with data-src attribute
  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

/**
 * Get image dimensions from URL or element
 */
export function getImageDimensions(
  src: string,
  element?: HTMLImageElement
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (element && element.naturalWidth && element.naturalHeight) {
      resolve({
        width: element.naturalWidth,
        height: element.naturalHeight,
      });
      return;
    }

    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Calculate aspect ratio for responsive images
 */
export function calculateAspectRatio(width: number, height: number): number {
  return width / height;
}

/**
 * Generate placeholder for images
 */
export function generatePlaceholder(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  canvas.width = width;
  canvas.height = height;
  
  // Create a subtle gradient placeholder
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f3f4f6');
  gradient.addColorStop(1, '#e5e7eb');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  return canvas.toDataURL('image/jpeg', 0.1);
}
