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
  activeClassName = "bg-indigo-700",
  role
}) => {
  const [location] = useLocation();
  const isActive = location === href;
  const baseClass = "text-white hover:bg-indigo-700 px-3 py-2 rounded-md text-sm font-medium";

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
