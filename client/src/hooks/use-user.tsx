import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type UserData = {
  id: number;
  username: string;
  fullName: string;
  role: string;
  schoolId?: number;
  classId?: number;
  gradeLevel?: string;
} | null;

interface UserContextType {
  user: UserData;
  setUser: (user: UserData) => void;
  clearUser: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUserState] = useState<UserData>(null);

  useEffect(() => {
    // Load saved user data from localStorage on initialization
    const savedUserData = localStorage.getItem("userData");
    if (savedUserData) {
      try {
        const parsedUser = JSON.parse(savedUserData);
        setUserState(parsedUser);
      } catch (e) {
        console.error("Error parsing user data from localStorage", e);
        localStorage.removeItem("userData");
      }
    }
  }, []);

  const setUser = (userData: UserData) => {
    setUserState(userData);
    if (userData) {
      localStorage.setItem("userData", JSON.stringify(userData));
    } else {
      localStorage.removeItem("userData");
    }
  };

  const clearUser = () => {
    setUserState(null);
    localStorage.removeItem("userData");
  };

  return (
    <UserContext.Provider value={{ user, setUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  
  return context;
};