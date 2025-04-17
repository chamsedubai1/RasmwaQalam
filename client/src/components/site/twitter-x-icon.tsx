import React from "react";

interface TwitterXIconProps {
  size?: number;
  className?: string;
}

const TwitterXIcon: React.FC<TwitterXIconProps> = ({ size = 20, className = "" }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M 18.244 2.25 h 3.308 l -7.227 8.26 l 8.502 11.24 H 16.17 l -5.214 -6.817 L 4.99 21.75 H 1.68 l 7.73 -8.835 L 1.254 2.25 H 8.08 l 4.713 6.231 Z m -1.161 17.52 h 1.833 L 7.084 4.126 H 5.117 Z" />
    </svg>
  );
};

export default TwitterXIcon;