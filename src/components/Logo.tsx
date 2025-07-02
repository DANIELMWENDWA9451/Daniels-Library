import React from 'react';

const Logo = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-lg"
  >
    <rect x="4" y="8" width="40" height="32" rx="6" fill="#232946" stroke="#8bb4f8" strokeWidth="2" />
    <rect x="10" y="14" width="28" height="20" rx="3" fill="#fff" fillOpacity="0.08" />
    <path d="M14 18h20M14 22h20M14 26h20" stroke="#8bb4f8" strokeWidth="2" strokeLinecap="round" />
    <rect x="8" y="10" width="4" height="28" rx="2" fill="#8bb4f8" fillOpacity="0.7" />
    <rect x="36" y="10" width="4" height="28" rx="2" fill="#8bb4f8" fillOpacity="0.7" />
    <ellipse cx="24" cy="36" rx="8" ry="2" fill="#8bb4f8" fillOpacity="0.15" />
  </svg>
);

export default Logo;
