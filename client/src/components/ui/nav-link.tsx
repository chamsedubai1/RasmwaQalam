import React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/use-user-role";

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
  role = "all"
}) => {
  const [location] = useLocation();
  const { userRole } = useUserRole();
  const isActive = location === href;
  const baseClass = "text-white hover:bg-blue-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors";

  // If this is a role-specific link and user doesn't have that role, don't render
  if (role !== "all" && role !== userRole) {
    return null;
  }

  return (
    <Link 
      href={href}
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
