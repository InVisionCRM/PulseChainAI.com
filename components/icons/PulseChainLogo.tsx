import React from 'react';

interface PulseChainLogoProps {
  className?: string;
}

const PulseChainLogo: React.FC<PulseChainLogoProps> = ({ className = "w-8 h-8" }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" fill="#8B5CF6" />
      <path
        d="M7 12l3 3 7-7"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default PulseChainLogo; 