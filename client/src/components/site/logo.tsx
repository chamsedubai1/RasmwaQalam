import React from "react";
import logoImage from "../../assets/Design sans titre (3).png";

interface LogoProps {
  className?: string;
}

export const FazaaLogo: React.FC<LogoProps> = ({ className = "h-24 w-auto" }) => {
  return (
    <img
      src={logoImage}
      className={className}
      alt="FAZAA Art Logo"
    />
  );
};

export default FazaaLogo;