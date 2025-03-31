import React from "react";

interface LogoProps {
  className?: string;
}

export const FazaaLogo: React.FC<LogoProps> = ({ className = "h-8 w-auto" }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="FAZAA Art Logo"
    >
      {/* Logo Background */}
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0c4a6e" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fcd34d" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      {/* Main shape */}
      <rect x="50" y="50" width="412" height="412" rx="40" fill="url(#gradient1)" />
      
      {/* Artistic Elements - Abstract F */}
      <g filter="url(#glow)">
        {/* Horizontal lines of 'F' */}
        <rect x="120" y="150" width="280" height="40" rx="20" fill="url(#gradient2)" />
        <rect x="120" y="250" width="200" height="40" rx="20" fill="url(#gradient2)" />
        
        {/* Vertical line of 'F' */}
        <rect x="120" y="150" width="40" height="220" rx="20" fill="url(#gradient2)" />
        
        {/* Abstract artistic elements */}
        <circle cx="380" cy="350" r="60" fill="#ec4899" opacity="0.9" />
        <circle cx="320" cy="290" r="40" fill="#8b5cf6" opacity="0.9" />
        
        {/* Creative splashes */}
        <path d="M380,220 Q420,180 450,220 T480,200" stroke="#06b6d4" strokeWidth="12" fill="none" />
        <path d="M220,400 Q260,380 280,410 T320,390" stroke="#06b6d4" strokeWidth="12" fill="none" />
      </g>
      
      {/* FAZAA Text - Bold and Prominent */}
      <text
        x="256"
        y="440"
        fontSize="72"
        fontWeight="bold"
        textAnchor="middle"
        fill="white"
        style={{ fontFamily: "Arial, sans-serif" }}
        stroke="#0c4a6e"
        strokeWidth="2"
      >
        FAZAA
      </text>
      
      {/* ART Text */}
      <text
        x="400"
        y="140"
        fontSize="60"
        fontWeight="bold"
        textAnchor="middle"
        fill="white"
        style={{ fontFamily: "Arial, sans-serif" }}
        stroke="#0c4a6e"
        strokeWidth="1"
      >
        ART
      </text>
    </svg>
  );
};

export default FazaaLogo;