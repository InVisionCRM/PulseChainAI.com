'use client';

import { useState } from 'react';

export default function MorbiusBanner() {
  const [showModal, setShowModal] = useState(false);
  
  return (
    <>
      {/* Banner */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-purple-900/95 via-blue-900/95 to-purple-900/95 backdrop-blur-sm border-b border-purple-500/30 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-center gap-2 text-sm text-white">
            <span className="text-yellow-300">⚠️</span>
            <span>
              <button
                onClick={() => setShowModal(true)}
                className="font-semibold text-purple-300 hover:text-purple-100 underline decoration-purple-400 hover:decoration-purple-200 transition-colors"
              >
                Morbius Token
              </button>
              {' '}is required for all premium features. You are in trial mode during beta.
            </span>
          </div>
        </div>
      </div>
      
      {/* Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="relative w-full max-w-2xl bg-slate-950 rounded-xl border border-purple-500/30 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-b border-purple-500/30">
              <h3 className="text-lg font-semibold text-white">Get Morbius Token</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Content - Iframe */}
            <div className="relative">
              <iframe 
                src="https://switch.win/widget?network=pulsechain&background_color=000000&font_color=ffffff&secondary_font_color=7a7a7a&border_color=01e401&backdrop_color=transparent&from=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&to=0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1" 
                allow="clipboard-read; clipboard-write" 
                width="100%" 
                height="900px"
                className="border-0"
                title="Buy Morbius Token"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

