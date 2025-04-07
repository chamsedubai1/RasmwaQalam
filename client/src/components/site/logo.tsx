import React from "react";
import logoImage from "../../assets/logo.png";

interface LogoProps {
  className?: string;
}

export const FazaaLogo: React.FC<LogoProps> = ({ className = "h-24 w-auto" }) => {
  return (
    <img 
      src={logoImage} 
      alt="FAZAA Art Logo" 
      className={className}
    />
  );
};

export default FazaaLogo;