import React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  role?: string;
}

const NavLink: React.FC<NavLinkProps> = ({
  href,
  children,
  className,
  activeClassName = "bg-blue-600 text-white font-bold",
  role
}) => {
  const [location] = useLocation();
  const isActive = location === href;
  const baseClass = "text-white hover:bg-blue-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors";

  return (
    <Link 
      href={href}
      data-role={role || "all"}
      className={cn(
        baseClass,
        isActive ? activeClassName : "",
        className
      )}
    >
      {children}
    </Link>
  );
};

export default NavLink;
