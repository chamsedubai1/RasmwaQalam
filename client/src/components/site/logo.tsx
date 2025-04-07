import React from "react";

interface LogoProps {
  className?: string;
}

export const FazaaLogo: React.FC<LogoProps> = ({ className = "h-24 w-auto" }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      className={className}
      role="img"
      aria-label="FAZAA Art Logo"
    >
      <defs>
        {/* Brush handle gradient */}
        <linearGradient id="brushHandleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2196F3" />
          <stop offset="100%" stopColor="#1565C0" />
        </linearGradient>
        
        {/* Brush bristles gradient */}
        <linearGradient id="brushBristlesGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFA726" />
          <stop offset="100%" stopColor="#FB8C00" />
        </linearGradient>
        
        {/* Pencil body gradient */}
        <linearGradient id="pencilBodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#673AB7" />
          <stop offset="100%" stopColor="#4527A0" />
        </linearGradient>
        
        {/* Pencil tip gradient */}
        <linearGradient id="pencilTipGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E91E63" />
          <stop offset="100%" stopColor="#C2185B" />
        </linearGradient>
        
        {/* Paint splashes */}
        <radialGradient id="orangeSplash" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#FFB74D" />
          <stop offset="100%" stopColor="#FF9800" />
        </radialGradient>
        
        <radialGradient id="redSplash" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#EF5350" />
          <stop offset="100%" stopColor="#E53935" />
        </radialGradient>
        
        <radialGradient id="greenSplash" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#66BB6A" />
          <stop offset="100%" stopColor="#43A047" />
        </radialGradient>
        
        <radialGradient id="blueSplash" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#42A5F5" />
          <stop offset="100%" stopColor="#1E88E5" />
        </radialGradient>
        
        <radialGradient id="purpleSplash" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#AB47BC" />
          <stop offset="100%" stopColor="#8E24AA" />
        </radialGradient>
        
        {/* Drop shadow */}
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="3" dy="3" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>
      
      {/* Background color drops */}
      <g filter="url(#shadow)">
        {/* Orange splash */}
        <path d="M250,180 C280,150 310,170 325,200 C340,230 320,280 290,290 C260,300 210,270 220,230 C230,190 220,210 250,180 Z" 
             fill="url(#orangeSplash)" />
        {/* Red splash */}
        <path d="M340,300 C370,290 385,310 390,335 C395,360 370,380 345,375 C320,370 310,340 340,300 Z" 
             fill="url(#redSplash)" />
        {/* Green leaf shape */}
        <path d="M270,250 C290,220 325,210 345,230 C365,250 350,280 325,290 C300,300 250,280 270,250 Z" 
             fill="url(#greenSplash)" />
      </g>
      
      {/* Paint drops and splatters */}
      <circle cx="150" cy="180" r="10" fill="url(#orangeSplash)" filter="url(#shadow)" />
      <circle cx="370" cy="150" r="12" fill="url(#greenSplash)" filter="url(#shadow)" />
      <circle cx="320" cy="90" r="15" fill="url(#orangeSplash)" filter="url(#shadow)" />
      <circle cx="400" cy="230" r="8" fill="url(#blueSplash)" filter="url(#shadow)" />
      <circle cx="170" cy="300" r="10" fill="url(#purpleSplash)" filter="url(#shadow)" />
      <circle cx="230" cy="350" r="9" fill="url(#redSplash)" filter="url(#shadow)" />
      <circle cx="370" cy="360" r="7" fill="url(#purpleSplash)" filter="url(#shadow)" />
      <circle cx="130" cy="250" r="8" fill="url(#blueSplash)" filter="url(#shadow)" />
      
      {/* Small paint dots */}
      <circle cx="180" cy="150" r="3" fill="#E53935" />
      <circle cx="350" cy="120" r="4" fill="#1E88E5" />
      <circle cx="410" cy="200" r="3" fill="#43A047" />
      <circle cx="300" cy="370" r="3" fill="#8E24AA" />
      <circle cx="150" cy="320" r="4" fill="#FF9800" />
      <circle cx="200" cy="100" r="3" fill="#E91E63" />
      <circle cx="100" cy="240" r="3" fill="#FFC107" />
      <circle cx="420" cy="280" r="4" fill="#1E88E5" />
      
      {/* Paint brush */}
      <g transform="rotate(-30, 200, 250)" filter="url(#shadow)">
        {/* Brush handle */}
        <rect x="120" y="240" width="160" height="20" rx="10" fill="url(#brushHandleGradient)" />
        
        {/* Metal part */}
        <rect x="120" y="243" width="30" height="14" rx="7" fill="#E0E0E0" />
        <rect x="125" y="240" width="2" height="20" fill="#BDBDBD" />
        <rect x="135" y="240" width="2" height="20" fill="#BDBDBD" />
        <rect x="145" y="240" width="2" height="20" fill="#BDBDBD" />
        
        {/* Brush bristles */}
        <path d="M100,250 C70,210 90,170 120,250 Z" fill="url(#brushBristlesGradient)" />
      </g>
      
      {/* Pencil */}
      <g transform="rotate(30, 300, 200)" filter="url(#shadow)">
        {/* Pencil body */}
        <rect x="200" y="190" width="200" height="20" rx="5" fill="url(#pencilBodyGradient)" />
        
        {/* Pencil metal band */}
        <rect x="200" y="190" width="15" height="20" rx="2" fill="#E0E0E0" />
        <rect x="203" y="190" width="2" height="20" fill="#BDBDBD" />
        <rect x="210" y="190" width="2" height="20" fill="#BDBDBD" />
        
        {/* Pencil eraser */}
        <rect x="185" y="190" width="15" height="20" rx="3" fill="#E91E63" />
        
        {/* Pencil tip */}
        <polygon points="400,190 425,200 400,210" fill="url(#pencilTipGradient)" />
      </g>
    </svg>
  );
};

export default FazaaLogo;