import React, { useState } from "react";
import { useLocation } from "wouter";
import NavLink from "@/components/ui/nav-link";
import { useUserRole } from "@/hooks/use-user-role";
import { useUser } from "@/hooks/use-user";
import { useLanguage } from "@/hooks/use-language";
import { Menu, LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FazaaLogo } from "@/components/site/logo";
import LanguageSwitcher from "@/components/site/language-switcher";

const Header: React.FC = () => {
  const { userRole, setUserRole } = useUserRole();
  const { user, clearUser } = useUser();
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
  const handleLogout = async () => {
    try {
      // Call API to logout
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Always clear local user data and redirect
      setUserRole("");
      clearUser();
      localStorage.removeItem('authToken');
      
      toast({
        title: t("message.success"),
        description: t("nav.logout") + " " + t("message.success").toLowerCase()
      });
      
      setLocation("/");
    }
  };

  return (
    <header className="bg-gradient-to-r from-blue-800 to-indigo-900 shadow-lg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-24">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <div className="flex items-center">
                <a href="/" className="flex items-center">
                  <FazaaLogo className="h-24 w-auto mr-2" />
                  <span className="text-white font-bold text-xl font-heading tracking-wider sr-only">
                    FAZAA - Art
                  </span>
                </a>
              </div>
            </div>
            <nav className="hidden sm:ml-6 sm:flex sm:space-x-8 items-center">
              <NavLink href="/" role="all">{t("nav.home")}</NavLink>
              <NavLink href="/about" role="all">{t("nav.about")}</NavLink>
              <NavLink href="/events" role="all">{t("nav.events")}</NavLink>
              <NavLink href="/gallery" role="all">{t("nav.gallery")}</NavLink>
              <NavLink href="/schools" role="all">{t("nav.schools")}</NavLink>
              <NavLink href="/partners" role="all">{t("nav.partners")}</NavLink>
              <NavLink href="/creart" role="student">{t("nav.creart")}</NavLink>
              <NavLink href="/teacher" role="teacher">{t("nav.teacher_dashboard")}</NavLink>
              <NavLink href="/admin" role="admin">{t("nav.admin_dashboard")}</NavLink>
            </nav>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-2">
            <LanguageSwitcher className="text-white" />
            
            {userRole ? (
              <>
                <div className="text-white flex items-center mr-2">
                  <User className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">
                    {user?.fullName || userRole}
                  </span>
                </div>
                <Button 
                  variant="ghost"
                  className="text-white hover:bg-blue-700"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  {t("nav.logout")}
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                className="text-white hover:bg-blue-700"
                onClick={() => setLocation("/login")}
              >
                <LogIn className="h-4 w-4 mr-1" />
                {t("nav.login_register")}
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
          <div className="flex justify-center py-4">
            <FazaaLogo className="h-32 w-auto" />
          </div>
          <NavLink href="/" className="block" role="all">{t("nav.home")}</NavLink>
          <NavLink href="/about" className="block" role="all">{t("nav.about")}</NavLink>
          <NavLink href="/events" className="block" role="all">{t("nav.events")}</NavLink>
          <NavLink href="/gallery" className="block" role="all">{t("nav.gallery")}</NavLink>
          <NavLink href="/schools" className="block" role="all">{t("nav.schools")}</NavLink>
          <NavLink href="/partners" className="block" role="all">{t("nav.partners")}</NavLink>
          <NavLink href="/creart" className="block" role="student">{t("nav.creart")}</NavLink>
          <NavLink href="/teacher" className="block" role="teacher">{t("nav.teacher_dashboard")}</NavLink>
          <NavLink href="/admin" className="block" role="admin">{t("nav.admin_dashboard")}</NavLink>
          
          <div className="border-t border-blue-700 my-3"></div>
          
          <div className="flex justify-center mb-3">
            <LanguageSwitcher className="text-white" />
          </div>
          
          {userRole ? (
            <Button 
              variant="ghost"
              className="w-full justify-start text-white hover:bg-blue-700"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t("nav.logout")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-blue-700"
              onClick={() => setLocation("/login")}
            >
              <LogIn className="h-4 w-4 mr-2" />
              {t("nav.login_register")}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
