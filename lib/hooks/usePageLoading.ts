"use client";
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function usePageLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const hasLoadedRef = useRef(false);
  const visitedPagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only show loading on initial site load (first visit)
    if (!hasLoadedRef.current) {
    setIsLoading(true);
      hasLoadedRef.current = true;
    
      // Show loading for 3 seconds on initial load
    const timer = setTimeout(() => {
      setIsLoading(false);
      }, 3000);

    return () => clearTimeout(timer);
    }

    // Check if this is an AI agent page that hasn't been visited before
    const aiAgentPages = [
      '/ai-agent',
      '/marcus-johnson',
      '/alex-rivera', 
      '/maya-patel',
      '/james-wilson',
      '/elena-rodriguez',
      '/therapist',
      '/happy-pulse'
    ];

    const isAiAgentPage = aiAgentPages.includes(pathname);
    const hasVisitedBefore = visitedPagesRef.current.has(pathname);

    if (isAiAgentPage && !hasVisitedBefore) {
      // First time visiting this AI agent page
      setIsLoading(true);
      visitedPagesRef.current.add(pathname);
      
      // Show loading for 2 seconds for AI agent pages
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 2000);

      return () => clearTimeout(timer);
    }

    // For all other page navigations, don't show loading
    setIsLoading(false);
  }, [pathname]);

  return { isLoading, setIsLoading };
} 