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
        {/* Icon gradient - orange to blue */}
        <linearGradient id="icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF9800" />
          <stop offset="100%" stopColor="#3F51B5" />
        </linearGradient>
        
        {/* Paper gradient */}
        <linearGradient id="paper-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FAFAFA" />
        </linearGradient>
        
        {/* Pencil gradient */}
        <linearGradient id="pencil-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFC107" />
          <stop offset="100%" stopColor="#FF9800" />
        </linearGradient>
        
        {/* Text color - blue */}
        <linearGradient id="text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3F51B5" />
          <stop offset="100%" stopColor="#304FFE" />
        </linearGradient>
        
        {/* Palette gradient */}
        <linearGradient id="palette-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3F51B5" />
          <stop offset="100%" stopColor="#5C6BC0" />
        </linearGradient>
        
        {/* Simple shadow */}
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="1" dy="1" stdDeviation="1" floodColor="#00000022" />
        </filter>
      </defs>
      
      {/* App icon - Rounded square like in the image */}
      <rect x="30" y="120" width="220" height="220" rx="45" fill="url(#icon-gradient)" filter="url(#shadow)" />

      {/* Paper with lines */}
      <rect x="50" y="145" width="80" height="95" rx="3" fill="url(#paper-gradient)" />
      <rect x="60" y="165" width="60" height="3" rx="1.5" fill="#FF5722" />
      <rect x="60" y="180" width="50" height="3" rx="1.5" fill="#FF5722" />
      <rect x="60" y="195" width="55" height="3" rx="1.5" fill="#FF5722" />
      
      {/* Pencil */}
      <g transform="rotate(-30, 180, 165)">
        <rect x="120" y="135" width="100" height="16" rx="8" fill="url(#pencil-gradient)" />
        <polygon points="220,135 235,143 220,151" fill="#F44336" />
        <rect x="120" y="138" width="60" height="10" rx="5" fill="#FFECB3" />
      </g>
      
      {/* Artist's palette */}
      <path d="M130,220 C100,220 100,270 120,290 C140,310 170,300 180,270 C190,240 160,220 130,220 Z" 
        fill="url(#palette-gradient)" filter="url(#shadow)" />
      
      {/* Paint dots on palette - from image */}
      <circle cx="120" cy="245" r="6" fill="#F44336" />
      <circle cx="140" cy="260" r="6" fill="#FFEB3B" />
      <circle cx="160" cy="245" r="6" fill="#4CAF50" />

      {/* Arabic text - exactly as in the provided image */}
      <g transform="translate(260, 160)">
        {/* First letter */}
        <path d="M0,0 C10,0 20,5 20,20 C20,35 10,40 0,40 L-10,40 C-20,40 -30,35 -30,20 L-30,-40 L0,-40 C10,-40 20,-35 20,-20 C20,-5 10,0 0,0 Z" 
          fill="url(#text-gradient)" />
        
        {/* Center line in first letter */}
        <rect x="-25" y="0" width="40" height="3" rx="1.5" fill="#FFFFFF" />
        
        {/* Second letter */}
        <path d="M40,-40 C50,-40 60,-35 60,-20 C60,-5 50,0 40,0 L50,0 C60,0 70,5 70,20 C70,35 60,40 50,40 L30,40" 
          fill="none" stroke="url(#text-gradient)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          
        {/* Third letter */}
        <path d="M100,-40 L100,40 C120,40 140,35 140,20 C140,5 120,0 100,0" 
          fill="none" stroke="url(#text-gradient)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      
      {/* Second line of Arabic text */}
      <g transform="translate(260, 260)">
        {/* First letter */}
        <path d="M0,0 C10,0 20,5 20,20 C20,35 10,40 0,40 L-10,40 C-20,40 -30,35 -30,20 L-30,-40 L0,-40 C10,-40 20,-35 20,-20 C20,-5 10,0 0,0 Z" 
          fill="url(#text-gradient)" />
        
        {/* Center line in first letter */}
        <rect x="-25" y="0" width="40" height="3" rx="1.5" fill="#FFFFFF" />
        
        {/* Dot letter */}
        <circle cx="40" cy="-25" r="8" fill="url(#text-gradient)" />
        <path d="M40,-10 L40,40" 
          stroke="url(#text-gradient)" strokeWidth="12" fill="none" strokeLinecap="round" />
        
        {/* Last letter */}
        <path d="M80,-40 L80,40 C100,40 120,35 120,20 C120,5 100,0 80,0" 
          fill="none" stroke="url(#text-gradient)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
};

export default FazaaLogo;