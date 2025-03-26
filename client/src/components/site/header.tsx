import React, { useState } from "react";
import NavLink from "@/components/ui/nav-link";
import UserRoleSelector from "@/components/ui/user-role-selector";
import { useUserRole } from "@/hooks/use-user-role";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

const Header: React.FC = () => {
  const { userRole } = useUserRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className="bg-gradient-to-r from-blue-800 to-indigo-900 shadow-lg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-white font-bold text-xl font-heading tracking-wider">ArtChallenge</span>
            </div>
            <nav className="hidden sm:ml-6 sm:flex sm:space-x-8 items-center">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/about">About Us</NavLink>
              <NavLink href="/events">Events</NavLink>
              <NavLink href="/gallery">Gallery</NavLink>
              <NavLink href="/schools">Schools</NavLink>
              <NavLink href="/partners">Partners</NavLink>
              <NavLink href="/creart" role="student">CreArt</NavLink>
              <NavLink href="/teacher" role="teacher">Teacher Dashboard</NavLink>
              <NavLink href="/admin" role="admin">Admin Dashboard</NavLink>
            </nav>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <UserRoleSelector />
          </div>
          <div className="flex items-center sm:hidden">
            <Button
              variant="ghost"
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-blue-600 transition-colors"
              onClick={toggleMobileMenu}
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      <div className={`sm:hidden bg-blue-900 ${mobileMenuOpen ? '' : 'hidden'}`} id="mobile-menu">
        <div className="px-2 pt-2 pb-3 space-y-1">
          <NavLink href="/" className="block">Home</NavLink>
          <NavLink href="/about" className="block">About Us</NavLink>
          <NavLink href="/events" className="block">Events</NavLink>
          <NavLink href="/gallery" className="block">Gallery</NavLink>
          <NavLink href="/schools" className="block">Schools</NavLink>
          <NavLink href="/partners" className="block">Partners</NavLink>
          {userRole === "student" && (
            <NavLink href="/creart" className="block" role="student">CreArt</NavLink>
          )}
          {userRole === "teacher" && (
            <NavLink href="/teacher" className="block" role="teacher">Teacher Dashboard</NavLink>
          )}
          {userRole === "admin" && (
            <NavLink href="/admin" className="block" role="admin">Admin Dashboard</NavLink>
          )}
          <div className="mt-3 px-3">
            <UserRoleSelector />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
