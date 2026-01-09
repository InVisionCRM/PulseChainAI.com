import React from 'react';

export interface GeickoClassicHeaderProps {
  /** Optional custom branding URL */
  brandingUrl?: string;
  /** Optional custom logo path */
  logoPath?: string;
  /** Optional custom title */
  title?: string;
  /** Optional custom button text */
  buttonText?: string;
}

/**
 * Classic header for Geicko token analyzer
 * Displays branding, logo, and "Get Morbius" button
 */
export default function GeickoClassicHeader({
  brandingUrl = 'https://pump.tires/token/0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1',
  logoPath = '/LogoVector.svg',
  title = 'Token Analyzer',
  buttonText = 'Get Morbius',
}: GeickoClassicHeaderProps) {
  return (
    <header className="relative bg-slate-850 border-b-2 border-gray-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 md:px-3 py-2 gap-2">
        {/* Title with Logo */}
        <div className="flex items-center gap-2">
          <img
            src={logoPath}
            alt="Morbius Logo"
            className="w-6 h-6"
          />
          <h1 className="text-white text-lg font-semibold">
            <span className="text-xl sm:text-2xl font-bold text-purple-700">Morbius</span>{' '}
            {title}
          </h1>
        </div>

        {/* Get Morbius Button - Absolute positioned */}
        <a
          href={brandingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-1/2 -translate-y-1/2 right-2 px-2.5 py-1 bg-purple-700/40 backdrop-blur hover:bg-purple-700/50 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap z-10"
        >
          {buttonText}
        </a>
      </div>
    </header>
  );
}
