'use client';

import React, { useEffect, useState } from 'react';
import HeroTokenAiChat from '@/components/HeroTokenAiChat';

function TwitterEmbed() {
  const [tweet, setTweet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchRecentTweet = async () => {
      try {
        const response = await fetch('/api/recent-tweets?username=morbius_io&count=1');

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.data && data.data.length > 0) {
          setTweet(data.data[0]);
          setError(false);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Failed to fetch recent tweet:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentTweet();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div
        className="bg-black/50 backdrop-blur-md rounded-lg p-4 border border-white/10 min-h-[200px] flex items-center justify-center"
        role="status"
        aria-label="Loading recent tweet"
      >
        <div className="text-gray-400 text-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-3"
            aria-hidden="true"
          ></div>
          <p className="text-sm">Loading latest tweet...</p>
        </div>
      </div>
    );
  }

  if (error || !tweet) {
    return (
      <div
        className="bg-black/50 backdrop-blur-md rounded-lg p-4 border border-white/10"
        role="region"
        aria-label="Twitter feed error"
      >
        <header className="mb-3 text-center">
          <h3 className="text-white text-lg font-semibold flex items-center justify-center gap-2">
            <span aria-hidden="true">🐦</span>
            Latest from @morbius_io
          </h3>
        </header>
        <div className="text-gray-400 text-center py-4">
          <p className="mb-2">Unable to load recent tweet</p>
          <p className="text-sm text-gray-500 mb-4">
            Please check your connection and try again
          </p>
          <div>
            <a
              href="https://x.com/morbius_io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-300 hover:text-purple-200 underline text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 rounded px-1 py-0.5"
              aria-label="Visit Morbius on X/Twitter (opens in new tab)"
            >
              View on X/Twitter →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-black/50 backdrop-blur-md rounded-lg p-4 border border-white/10"
      role="region"
      aria-label="Recent tweet from Morbius"
    >
      <header className="mb-3 text-center">
        <h3 className="text-white text-lg font-semibold flex items-center justify-center gap-2">
          <span aria-hidden="true">🐦</span>
          Latest from @morbius_io
        </h3>
        <p className="text-gray-400 text-sm mt-1">
          Follow us on X/Twitter for updates
        </p>
      </header>

      <div className="border border-white/10 rounded-lg p-4 bg-black/30">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-white font-semibold text-sm">@morbius_io</span>
              <span className="text-gray-400 text-xs">•</span>
              <span className="text-gray-400 text-xs">{formatDate(tweet.created_at)}</span>
            </div>
            <p className="text-white text-sm leading-relaxed mb-3">
              {tweet.text}
            </p>
            <div className="flex items-center space-x-4 text-xs text-gray-400">
              <span>❤️ {tweet.public_metrics?.like_count || 0}</span>
              <span>🔄 {tweet.public_metrics?.retweet_count || 0}</span>
              <span>💬 {tweet.public_metrics?.reply_count || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-3 pt-3 border-t border-white/10 text-center">
        <a
          href="https://x.com/morbius_io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-300 hover:text-purple-200 underline text-sm transition-colors"
          aria-label="Visit Morbius on X/Twitter (opens in new tab)"
        >
          View on X/Twitter →
        </a>
      </footer>
    </div>
  );
}

export default function Home() {
  const [showBetaBanner, setShowBetaBanner] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem('beta-banner-dismissed');
    if (!dismissed) {
      setShowBetaBanner(true);
    }
  }, []);

  const handleCloseBeta = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('beta-banner-dismissed', '1');
    }
    setShowBetaBanner(false);
  };

  return (
    <div className="w-full">
      {showBetaBanner && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="relative max-w-xl w-full rounded-2xl border border-white/15 bg-white/10 p-6 text-white shadow-2xl">
            <button
              type="button"
              aria-label="Close beta notice"
              onClick={handleCloseBeta}
              className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center border border-white/20 transition"
            >
              <span className="text-lg font-bold">×</span>
            </button>
            <p className="text-lg font-semibold text-purple-200 mb-2">Beta Access Notice</p>
            <p className="text-sm leading-relaxed text-white/90">
              All features on <span className="font-semibold text-purple-300">Morbius.io</span> are currently <span className="font-semibold">FREE TO USE</span> during the BETA stage. In future, premium access will only be available through the use of{" "}
              <a
                href="https://pump.tires/token/0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-purple-300 underline underline-offset-2 hover:text-purple-200"
              >
                Morbius Tokens
              </a>.
            </p>
          </div>
        </div>
      )}
      <div className="min-h-screen relative w-full flex flex-col items-center justify-center">
        <video
          className="absolute inset-0 w-full h-full object-cover z-0"
          autoPlay
          loop
          muted
          playsInline
        >
          <source
            src="https://dvba8d38nfde7nic.public.blob.vercel-storage.com/Video/pulsechain-a2.mp4"
            type="video/mp4"
          />
        </video>
        <div className="absolute inset-0 w-full h-full bg-slate-950/20 z-10 pointer-events-none" />

        {/* Twitter Embed */}
        <div className="relative z-20 mb-8 w-full max-w-sm sm:max-w-md px-4 sm:px-0">
          <TwitterEmbed />
        </div>

        <HeroTokenAiChat />
      </div>
    </div>
  );
}
