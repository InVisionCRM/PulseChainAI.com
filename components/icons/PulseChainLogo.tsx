
import React from 'react';

const PulseChainLogo: React.FC<{ className?: string }> = ({ className = 'h-8 w-auto' }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M100 0L121.231 69.0983H195.106L136.937 111.803L158.169 180.902L100 138.197L41.8312 180.902L63.0625 111.803L4.89379 69.0983H78.7688L100 0Z" fill="#A100FFFF" />
  </svg>
);

export default PulseChainLogo;
