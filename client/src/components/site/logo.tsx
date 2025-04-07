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
        {/* Main app icon gradient - orange to pink */}
        <linearGradient id="app-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF9D00" />
          <stop offset="40%" stopColor="#FF7B51" />
          <stop offset="70%" stopColor="#FF5B95" />
          <stop offset="100%" stopColor="#FF41C6" />
        </linearGradient>
        
        {/* Paper gradient - white to light orange */}
        <linearGradient id="paper-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FFF0DD" />
        </linearGradient>
        
        {/* Pencil gradient - yellow to orange */}
        <linearGradient id="pencil-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="100%" stopColor="#FF9E2D" />
        </linearGradient>
        
        {/* Pencil tip gradient */}
        <linearGradient id="pencil-tip-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF436B" />
          <stop offset="100%" stopColor="#D9338F" />
        </linearGradient>
        
        {/* Palette gradient - blue to purple */}
        <linearGradient id="palette-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3949AB" />
          <stop offset="100%" stopColor="#304FFE" />
        </linearGradient>
        
        {/* Text gradient for right side */}
        <linearGradient id="text-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#304FFE" />
          <stop offset="100%" stopColor="#2041DE" />
        </linearGradient>
        
        {/* Futuristic glows and effects */}
        <filter id="glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        
        <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feFlood floodColor="#5D45FF" floodOpacity="0.8" result="glow-color" />
          <feComposite operator="in" in="glow-color" in2="blur" result="colored-blur" />
          <feComposite operator="over" in="SourceGraphic" in2="colored-blur" />
        </filter>
      </defs>
      
      {/* App icon - Rounded square with gradient */}
      <rect x="35" y="120" width="220" height="220" rx="45" fill="url(#app-icon-gradient)" filter="url(#glow)" />

      {/* Paper and lines */}
      <rect x="65" y="140" width="80" height="100" rx="5" fill="url(#paper-gradient)" />
      <rect x="75" y="160" width="60" height="3" rx="1.5" fill="#FF5B95" />
      <rect x="75" y="175" width="50" height="3" rx="1.5" fill="#FF5B95" />
      <rect x="75" y="190" width="55" height="3" rx="1.5" fill="#FF5B95" />
      
      {/* Pencil - angled and futuristic */}
      <g transform="rotate(-35, 180, 170)">
        <rect x="130" y="150" width="100" height="16" rx="8" fill="url(#pencil-gradient)" />
        <polygon points="230,150 250,158 230,166" fill="url(#pencil-tip-gradient)" />
        <rect x="130" y="154" width="60" height="8" rx="4" fill="#FFECB3" />
      </g>
      
      {/* Artist's palette */}
      <path d="M130,220 C90,220 90,270 110,290 C130,310 170,300 180,270 C190,240 170,220 130,220 Z" 
        fill="url(#palette-gradient)" filter="url(#neon-glow)" />
      
      {/* Paint dots on palette */}
      <circle cx="120" cy="240" r="7" fill="#FF5252" filter="url(#glow)" />
      <circle cx="140" cy="250" r="7" fill="#FFEB3B" filter="url(#glow)" />
      <circle cx="160" cy="240" r="7" fill="#69F0AE" filter="url(#glow)" />
      
      {/* Arabic text - stylized and futuristic */}
      <g filter="url(#neon-glow)">
        <path d="M340,170 C350,170 360,180 360,200 L360,230 C360,240 350,250 340,250 L330,250 C320,250 315,240 315,230 L315,170 L340,170 Z" fill="url(#text-gradient)" />
        <path d="M315,210 L350,210" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        
        <path d="M380,170 C390,170 400,180 400,200 L400,230 C400,240 390,250 380,250 L370,250 C360,250 355,240 355,230 L355,170 L380,170 Z" fill="url(#text-gradient)" />
        <path d="M355,210 L390,210" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        
        <path d="M420,250 L420,170 C440,170 460,180 460,200 C460,220 440,230 420,230" fill="none" stroke="url(#text-gradient)" strokeWidth="15" strokeLinecap="round" />
      </g>
      
      {/* Second line of Arabic text */}
      <g filter="url(#neon-glow)" transform="translate(0, 60)">
        <path d="M340,170 C350,170 360,180 360,200 L360,230 C360,240 350,250 340,250 L330,250 C320,250 315,240 315,230 L315,170 L340,170 Z" fill="url(#text-gradient)" />
        <path d="M315,210 L350,210" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        
        <path d="M380,190 L380,250" fill="none" stroke="url(#text-gradient)" strokeWidth="15" strokeLinecap="round" />
        <circle cx="380" cy="175" r="9" fill="url(#text-gradient)" />
        
        <path d="M400,250 L400,170 C420,170 440,180 440,200 C440,220 420,230 400,230" fill="none" stroke="url(#text-gradient)" strokeWidth="15" strokeLinecap="round" />
      </g>
      
      {/* Futuristic decorative elements */}
      <circle cx="450" cy="170" r="6" fill="#41C6FF" filter="url(#glow)" />
      <circle cx="450" cy="230" r="6" fill="#41C6FF" filter="url(#glow)" />
      <circle cx="450" cy="290" r="6" fill="#41C6FF" filter="url(#glow)" />
    </svg>
  );
};

export default FazaaLogo;