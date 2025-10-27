"use client";

import { useState, useRef, useEffect } from 'react';

interface OptimizedVideoProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  playsInline?: boolean;
  poster?: string;
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

export function OptimizedVideo({
  src,
  className = '',
  autoPlay = false,
  muted = true,
  loop = false,
  preload = 'metadata',
  playsInline = true,
  poster,
  width,
  height,
  style,
  onLoad,
  onError,
  onPlay,
  onPause,
  onEnded,
  ...props
}: OptimizedVideoProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      setIsLoading(false);
      onLoad?.();
    };

    const handleError = () => {
      setError(true);
      setIsLoading(false);
      onError?.();
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPause?.();
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onLoad, onError, onPlay, onPause, onEnded]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {/* Loading placeholder */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading video...</div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 bg-gray-300 flex items-center justify-center text-gray-500 text-sm">
          Failed to load video
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        preload={preload}
        playsInline={playsInline}
        poster={poster}
        width={width}
        height={height}
        style={{
          objectFit: 'cover',
          width: width || '100%',
          height: height || '100%',
        }}
        {...props}
      />

      {/* Play/Pause overlay for better UX */}
      {!isLoading && !error && !autoPlay && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
          <div className="bg-slate-950/50 rounded-full p-3">
            {isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
