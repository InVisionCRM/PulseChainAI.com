"use client";

import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  sizes?: string;
  fill?: boolean;
  style?: React.CSSProperties;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 75,
  placeholder = 'empty',
  blurDataURL,
  sizes,
  fill = false,
  style,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Check if it's a remote image (Vercel Blob)
  const isRemoteImage = src.startsWith('https://');
  
  // Check if it's a local image
  const isLocalImage = src.startsWith('/');

  // For remote images, use regular img tag with optimization
  if (isRemoteImage) {
    return (
      <div className={`relative overflow-hidden ${className}`} style={style}>
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={`transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          } ${className}`}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setError(true);
            setIsLoading(false);
          }}
          loading={priority ? 'eager' : 'lazy'}
          style={{
            ...style,
            objectFit: 'cover',
            width: fill ? '100%' : width,
            height: fill ? '100%' : height,
          }}
        />
        {isLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
        )}
        {error && (
          <div className="absolute inset-0 bg-gray-300 flex items-center justify-center text-gray-500 text-xs">
            Failed to load
          </div>
        )}
      </div>
    );
  }

  // For local images, use Next.js Image component
  if (isLocalImage) {
    if (fill) {
      return (
        <Image
          src={src}
          alt={alt}
          fill
          className={`transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          } ${className}`}
          priority={priority}
          quality={quality}
          placeholder={placeholder}
          blurDataURL={blurDataURL}
          sizes={sizes}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setError(true);
            setIsLoading(false);
          }}
          style={{
            ...style,
            objectFit: 'cover',
          }}
          {...props}
        />
      );
    }

    return (
      <Image
        src={src}
        alt={alt}
        width={width || 100}
        height={height || 100}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${className}`}
        priority={priority}
        quality={quality}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
        sizes={sizes}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setError(true);
          setIsLoading(false);
        }}
        style={{
          ...style,
          objectFit: 'cover',
        }}
        {...props}
      />
    );
  }

  // Fallback for other cases
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      {...props}
    />
  );
}
