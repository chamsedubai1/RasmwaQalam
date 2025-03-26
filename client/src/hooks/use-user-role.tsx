import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type UserRole = "student" | "teacher" | "admin" | "";

interface UserRoleContextType {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

interface UserRoleProviderProps {
  children: ReactNode;
}

export const UserRoleProvider: React.FC<UserRoleProviderProps> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole>("");

  useEffect(() => {
    // Load saved role from localStorage on initialization
    const savedRole = localStorage.getItem("userRole") as UserRole | null;
    if (savedRole && ["student", "teacher", "admin"].includes(savedRole)) {
      setUserRole(savedRole as UserRole);
    }
  }, []);

  useEffect(() => {
    // Save role to localStorage and update visible elements
    if (userRole) {
      localStorage.setItem("userRole", userRole);
    } else {
      localStorage.removeItem("userRole");
    }
    
    // First show all elements marked as "all"
    document.querySelectorAll('[data-role="all"]').forEach(el => {
      el.classList.remove('hidden');
    });
    
    // Hide role-specific elements except "all"
    document.querySelectorAll('[data-role="student"], [data-role="teacher"], [data-role="admin"]').forEach(el => {
      el.classList.add('hidden');
    });
    
    // Show elements for current role if there is one
    if (userRole) {
      document.querySelectorAll(`[data-role="${userRole}"]`).forEach(el => {
        el.classList.remove('hidden');
      });
    }
  }, [userRole]);

  return (
    <UserRoleContext.Provider value={{ userRole, setUserRole }}>
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = (): UserRoleContextType => {
  const context = useContext(UserRoleContext);
  
  if (context === undefined) {
    throw new Error("useUserRole must be used within a UserRoleProvider");
  }
  
  return context;
};
