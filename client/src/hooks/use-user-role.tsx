import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type UserRole = "student" | "teacher" | "admin" | "schoolAdmin" | "";

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
    if (savedRole && ["student", "teacher", "admin", "schoolAdmin"].includes(savedRole)) {
      setUserRole(savedRole as UserRole);
    }
  }, []);

  useEffect(() => {
    // Save role to localStorage
    if (userRole) {
      localStorage.setItem("userRole", userRole);
    } else {
      localStorage.removeItem("userRole");
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
