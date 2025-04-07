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
      {/* Logo Background and Gradients */}
      <defs>
        {/* Icon gradient - orange */}
        <linearGradient id="icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF9800" />
          <stop offset="100%" stopColor="#FF5722" />
        </linearGradient>
        
        {/* Paper gradient */}
        <linearGradient id="paper-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F5F5F5" />
        </linearGradient>
        
        {/* Pencil gradient */}
        <linearGradient id="pencil-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD54F" />
          <stop offset="100%" stopColor="#FFA000" />
        </linearGradient>
        
        {/* Palette gradient - blue */}
        <linearGradient id="palette-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3F51B5" />
          <stop offset="100%" stopColor="#2196F3" />
        </linearGradient>
        
        {/* Text color - blue */}
        <linearGradient id="text-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3F51B5" />
          <stop offset="100%" stopColor="#303F9F" />
        </linearGradient>
        
        {/* Simple shadow */}
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="2" dy="2" stdDeviation="2" floodColor="#00000022" />
        </filter>
      </defs>
      
      {/* App icon - Rounded square */}
      <rect x="60" y="100" width="180" height="180" rx="30" fill="url(#icon-gradient)" filter="url(#shadow)" />

      {/* Paper with lines */}
      <rect x="80" y="120" width="70" height="90" rx="3" fill="url(#paper-gradient)" />
      <rect x="90" y="140" width="50" height="3" rx="1" fill="#FF5722" />
      <rect x="90" y="155" width="40" height="3" rx="1" fill="#FF5722" />
      <rect x="90" y="170" width="45" height="3" rx="1" fill="#FF5722" />
      
      {/* Pencil */}
      <g transform="rotate(-30, 165, 160)">
        <rect x="120" y="140" width="90" height="14" rx="7" fill="url(#pencil-gradient)" />
        <polygon points="210,140 225,147 210,154" fill="#F44336" />
        <rect x="120" y="143" width="50" height="8" rx="4" fill="#FFECB3" />
      </g>
      
      {/* Artist's palette */}
      <path d="M130,200 C100,200 100,240 120,260 C140,280 170,270 180,240 C190,210 160,200 130,200 Z" 
        fill="url(#palette-gradient)" filter="url(#shadow)" />
      
      {/* Paint dots on palette */}
      <circle cx="130" cy="225" r="6" fill="#F44336" />
      <circle cx="150" cy="235" r="6" fill="#FFEB3B" />
      <circle cx="170" cy="225" r="6" fill="#4CAF50" />

      {/* Arabic text - simple and clean */}
      <g fill="url(#text-gradient)">
        {/* First row Arabic text */}
        <path d="M310,170 Q330,170 330,190 Q330,210 310,210 L300,210 Q280,210 280,190 L280,140 L310,140 Q330,140 330,160 Q330,180 310,180 L290,180" 
          stroke="url(#text-gradient)" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        
        <path d="M350,140 Q370,140 370,160 Q370,180 350,180 L360,180 Q380,180 380,200 Q380,210 360,210 L340,210" 
          stroke="url(#text-gradient)" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        
        <path d="M400,140 L400,210 Q420,210 420,190 Q420,170 400,170" 
          stroke="url(#text-gradient)" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      
      {/* Second row Arabic text */}
      <g fill="url(#text-gradient)" transform="translate(0, 100)">
        <path d="M310,170 Q330,170 330,190 Q330,210 310,210 L300,210 Q280,210 280,190 L280,140 L310,140 Q330,140 330,160 Q330,180 310,180 L290,180" 
          stroke="url(#text-gradient)" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        
        <circle cx="350" cy="150" r="8" fill="url(#text-gradient)" />
        <path d="M350,165 L350,210" 
          stroke="url(#text-gradient)" strokeWidth="10" fill="none" strokeLinecap="round" />
        
        <path d="M390,140 L390,210 Q410,210 410,190 Q410,170 390,170" 
          stroke="url(#text-gradient)" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
};

export default FazaaLogo;