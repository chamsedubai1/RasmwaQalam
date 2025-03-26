import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type UserRole = "student" | "teacher" | "admin";

interface UserRoleContextType {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

interface UserRoleProviderProps {
  children: ReactNode;
}

export const UserRoleProvider: React.FC<UserRoleProviderProps> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole>("student");

  useEffect(() => {
    // Load saved role from localStorage on initialization
    const savedRole = localStorage.getItem("userRole") as UserRole | null;
    if (savedRole && ["student", "teacher", "admin"].includes(savedRole)) {
      setUserRole(savedRole as UserRole);
    }
  }, []);

  useEffect(() => {
    // Save role to localStorage and update visible elements
    localStorage.setItem("userRole", userRole);
    
    // Hide all role-specific elements
    document.querySelectorAll('[data-role]').forEach(el => {
      el.classList.add('hidden');
    });
    
    // Show elements for current role and those marked for all
    document.querySelectorAll(`[data-role="all"], [data-role="${userRole}"]`).forEach(el => {
      el.classList.remove('hidden');
    });
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
