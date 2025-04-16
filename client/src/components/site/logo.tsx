import React from "react";
import logoImage from "../../assets/rasm-wa-qalam-logo.png";

interface LogoProps {
  className?: string;
}

export const RasmWaQalamLogo: React.FC<LogoProps> = ({ className = "h-24 w-auto" }) => {
  return (
    <img
      src={logoImage}
      className={className}
      alt="RASM wa QALAM Logo"
    />
  );
};

// For backward compatibility
export const FazaaLogo = RasmWaQalamLogo;

export default RasmWaQalamLogo;