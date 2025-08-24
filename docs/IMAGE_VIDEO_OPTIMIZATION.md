# Image and Video Optimization Guide

This document outlines the optimization strategies implemented for images and videos in the PulseChain AI Dashboard.

## 🚀 Performance Improvements

### 1. Next.js Image Optimization
- **WebP/AVIF Support**: Automatic format conversion for better compression
- **Responsive Images**: Multiple sizes for different screen densities
- **Lazy Loading**: Images load only when they come into view
- **Caching**: 30-day cache TTL for static assets

### 2. Custom Optimized Components

#### OptimizedImage Component
```tsx
import { OptimizedImage } from '@/components/ui/optimized-image';

// For remote images (Vercel Blob)
<OptimizedImage
  src="https://dvba8d38nfde7nic.public.blob.vercel-storage.com/images/hexgradient"
  alt="Background"
  width={1920}
  height={1080}
  priority={true}
  quality={85}
/>

// For local images
<OptimizedImage
  src="/HEXagon (1).svg"
  alt="HEX Logo"
  width={24}
  height={24}
  fill={false}
/>
```

#### OptimizedVideo Component
```tsx
import { OptimizedVideo } from '@/components/ui/optimized-video';

<OptimizedVideo
  src="https://dvba8d38nfde7nic.public.blob.vercel-storage.com/Video/videotext"
  className="w-full h-full"
  autoPlay={true}
  muted={true}
  loop={true}
  preload="metadata"
/>
```

### 3. Performance Hooks

#### useImageOptimization
```tsx
import { useImageOptimization } from '@/hooks/useImageOptimization';

const { src, isLoaded, isError, dimensions, retry } = useImageOptimization(
  imageUrl,
  {
    priority: 'high',
    quality: 85,
    format: 'webp',
    preload: true
  }
);
```

#### useLazyImage
```tsx
import { useLazyImage } from '@/hooks/useLazyImage';

const { ref, isInView, isLoaded } = useLazyImage(imageUrl, {
  threshold: 0.1,
  quality: 75
});

return <div ref={ref}>{isInView && <img src={imageUrl} />}</div>;
```

## 📊 Optimization Strategies

### Image Optimization
1. **Format Conversion**: Automatic WebP/AVIF for supported browsers
2. **Quality Control**: Configurable compression (default: 75%)
3. **Responsive Sizes**: Multiple breakpoints for different devices
4. **Lazy Loading**: Intersection Observer for viewport-based loading
5. **Preloading**: Critical images loaded with high priority

### Video Optimization
1. **Preload Control**: Metadata-only preloading by default
2. **Lazy Loading**: Videos load when needed
3. **Error Handling**: Graceful fallbacks for failed loads
4. **Performance Monitoring**: Loading states and progress tracking

### Vercel Blob Integration
1. **Remote Pattern Support**: Configured in next.config.js
2. **Query Parameters**: Future optimization support
3. **Caching Headers**: Long-term caching for static assets

## 🔧 Configuration

### Next.js Config
```js
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'dvba8d38nfde7nic.public.blob.vercel-storage.com',
      port: '',
      pathname: '/**',
    },
  ],
  formats: ['image/webp', 'image/avif'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
}
```

### Webpack Optimizations
- **Code Splitting**: Vendor and common chunk separation
- **Tree Shaking**: Unused code elimination
- **Compression**: Gzip compression enabled
- **Caching**: Long-term cache headers

## 📈 Performance Metrics

### Expected Improvements
- **Image Loading**: 30-50% faster with WebP/AVIF
- **Video Performance**: Reduced bandwidth with metadata preloading
- **Bundle Size**: Smaller chunks with code splitting
- **Cache Hit Rate**: 90%+ with proper caching headers

### Monitoring
- **Core Web Vitals**: LCP, FID, CLS improvements
- **Bundle Analysis**: Webpack bundle analyzer
- **Performance Audits**: Lighthouse CI integration

## 🚨 Best Practices

### Do's
- ✅ Use OptimizedImage for all images
- ✅ Set appropriate quality levels (75-85%)
- ✅ Implement lazy loading for below-fold content
- ✅ Preload critical above-fold images
- ✅ Use WebP format when possible

### Don'ts
- ❌ Don't use regular `<img>` tags
- ❌ Don't skip alt text for accessibility
- ❌ Don't load all videos on page load
- ❌ Don't ignore error states
- ❌ Don't skip responsive image sizes

## 🔄 Migration Guide

### From Regular Images
```tsx
// Before
<img src="/logo.png" alt="Logo" />

// After
<OptimizedImage
  src="/logo.png"
  alt="Logo"
  width={100}
  height={100}
  priority={true}
/>
```

### From Regular Videos
```tsx
// Before
<video src="/video.mp4" autoPlay muted loop />

// After
<OptimizedVideo
  src="/video.mp4"
  autoPlay={true}
  muted={true}
  loop={true}
  preload="metadata"
/>
```

## 📚 Additional Resources

- [Next.js Image Optimization](https://nextjs.org/docs/basic-features/image-optimization)
- [WebP Format Guide](https://developers.google.com/speed/webp)
- [AVIF Format Guide](https://web.dev/compress-images-avif/)
- [Performance Best Practices](https://web.dev/performance/)
- [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
