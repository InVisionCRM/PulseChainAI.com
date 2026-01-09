import React from 'react';

export interface GeickoWebsiteTabProps {
  /** Website URL to embed */
  websiteLink: string | null;
}

/**
 * Website tab for Geicko
 * Embeds token's official website in an iframe or shows fallback message
 */
export default function GeickoWebsiteTab({ websiteLink }: GeickoWebsiteTabProps) {
  return (
    <div className="w-full flex items-center justify-center p-4">
      {websiteLink ? (
        <iframe
          src={websiteLink}
          width="100%"
          height="720"
          className="border-0 rounded w-full max-w-6xl min-h-[720px]"
          title="Token Website"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <div className="text-center text-gray-400">
          <p className="text-lg mb-2">No website available</p>
          <p className="text-sm">
            This token doesn&apos;t have a website listed on DexScreener
          </p>
        </div>
      )}
    </div>
  );
}
