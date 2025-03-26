import React, { useState } from "react";
import { useLocation } from "wouter";
import NavLink from "@/components/ui/nav-link";
import { useUserRole } from "@/hooks/use-user-role";
import { Menu, LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Header: React.FC = () => {
  const { userRole, setUserRole } = useUserRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
  const handleLogout = () => {
    // In a real app, you would make an API call to logout
    setUserRole("");
    
    toast({
      title: "Logged out",
      description: "You have been logged out successfully"
    });
    
    setLocation("/");
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
              {userRole === "student" && (
                <NavLink href="/creart" role="student">CreArt</NavLink>
              )}
              {userRole === "teacher" && (
                <NavLink href="/teacher" role="teacher">Teacher Dashboard</NavLink>
              )}
              {userRole === "admin" && (
                <NavLink href="/admin" role="admin">Admin Dashboard</NavLink>
              )}
            </nav>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-2">
            {userRole ? (
              <>
                <div className="text-white flex items-center mr-2">
                  <User className="h-4 w-4 mr-1" />
                  <span className="text-sm">{userRole}</span>
                </div>
                <Button 
                  variant="ghost"
                  className="text-white hover:bg-blue-700"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Logout
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                className="text-white hover:bg-blue-700"
                onClick={() => setLocation("/login")}
              >
                <LogIn className="h-4 w-4 mr-1" />
                Login / Register
              </Button>
            )}
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
          <div className="border-t border-blue-700 my-3"></div>
          {userRole ? (
            <Button 
              variant="ghost"
              className="w-full justify-start text-white hover:bg-blue-700"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-blue-700"
              onClick={() => setLocation("/login")}
            >
              <LogIn className="h-4 w-4 mr-2" />
              Login / Register
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
