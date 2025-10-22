import { createContext, ReactNode, useContext, useState, useEffect } from "react";

type User = {
  id: number;
  username: string;
  fullName: string;
  role: "student" | "teacher" | "admin" | "schoolAdmin";
  schoolId: number | null;
  classId: number | null;
  gradeLevel: string | null;
};

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  clearUser: () => void;
}

export const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  
  // Try to load user data from localStorage on initialization
  useEffect(() => {
    try {
      const savedUserData = localStorage.getItem('userData');
      if (savedUserData) {
        const parsedUser = JSON.parse(savedUserData);
        if (parsedUser && typeof parsedUser === 'object' && 
            typeof parsedUser.id === 'number' && 
            typeof parsedUser.username === 'string' &&
            ['student', 'teacher', 'admin', 'schoolAdmin'].includes(parsedUser.role)) {
          setUser(parsedUser);
        }
      }
    } catch (error) {
      console.error("Error loading user data from localStorage:", error);
    }
  }, []);
  
  // Save user data to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('userData', JSON.stringify(user));
    } else {
      localStorage.removeItem('userData');
    }
  }, [user]);

  const clearUser = () => {
    setUser(null);
    // SECURITY ENHANCEMENT: No need to remove authToken from localStorage
    // Tokens are now in httpOnly cookies and cleared by server on logout
    localStorage.removeItem('userData');
    localStorage.removeItem('userRole');
  };

  return (
    <UserContext.Provider value={{ user, setUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}