"use client";
import { useState, useEffect } from 'react';

export interface MobileOptimizationConfig {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  shouldDisableHeavyAnimations: boolean;
  shouldDisableBackgroundEffects: boolean;
  shouldReduceMotion: boolean;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
}

export function useMobileOptimization(): MobileOptimizationConfig {
  const [config, setConfig] = useState<MobileOptimizationConfig>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    shouldDisableHeavyAnimations: false,
    shouldDisableBackgroundEffects: false,
    shouldReduceMotion: false,
    screenWidth: 0,
    screenHeight: 0,
    devicePixelRatio: 1,
  });

  useEffect(() => {
    const updateConfig = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const pixelRatio = window.devicePixelRatio || 1;
      
      // Check for mobile device - more conservative breakpoints
      const isMobile = width <= 480; // Only very small screens
      const isTablet = width > 480 && width <= 768; // Small tablets
      const isDesktop = width > 768; // Everything else
      
      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      // Check for low-end device indicators - more conservative
      const isLowEndDevice = 
        (pixelRatio <= 1 && width <= 480) || // Low DPI + small screen
        (navigator.hardwareConcurrency <= 2) || // Very low CPU cores
        (navigator.deviceMemory && navigator.deviceMemory <= 2) || // Very low RAM
        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); // Mobile user agent
      
      // Determine optimization settings - more conservative
      const shouldDisableHeavyAnimations = isMobile || (isLowEndDevice && width <= 768) || prefersReducedMotion;
      const shouldDisableBackgroundEffects = isMobile || (isLowEndDevice && width <= 768) || prefersReducedMotion;
      const shouldReduceMotion = prefersReducedMotion || isMobile;

      setConfig({
        isMobile,
        isTablet,
        isDesktop,
        shouldDisableHeavyAnimations,
        shouldDisableBackgroundEffects,
        shouldReduceMotion,
        screenWidth: width,
        screenHeight: height,
        devicePixelRatio: pixelRatio,
      });
    };

    // Initial check
    updateConfig();

    // Listen for resize events
    window.addEventListener('resize', updateConfig);
    
    // Listen for reduced motion preference changes
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', updateConfig);

    return () => {
      window.removeEventListener('resize', updateConfig);
      mediaQuery.removeEventListener('change', updateConfig);
    };
  }, []);

  return config;
}

// Utility functions for specific optimizations
export const getOptimizedAnimationDuration = (baseDuration: number, config: MobileOptimizationConfig): number => {
  if (config.shouldReduceMotion) return 0;
  if (config.isMobile) return baseDuration * 0.5;
  return baseDuration;
};

export const shouldRenderHeavyComponent = (config: MobileOptimizationConfig): boolean => {
  return !config.shouldDisableHeavyAnimations && !config.shouldDisableBackgroundEffects;
};

export const getOptimizedBlurValue = (baseBlur: number, config: MobileOptimizationConfig): number => {
  if (config.isMobile) return Math.min(baseBlur, 10);
  return baseBlur;
}; 