import React, { ReactNode, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useUser } from '@/hooks/use-user';
import { useUserRole } from '@/hooks/use-user-role';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const [, setLocation] = useLocation();
  const { user, setUser } = useUser();
  const { userRole, setUserRole } = useUserRole();
  
  // Get authentication token from localStorage
  const authToken = localStorage.getItem('authToken');
  
  // Query for current user data from the API
  const { data: apiUser, isLoading } = useQuery({
    queryKey: ['/api/user'],
    enabled: !!authToken,
    staleTime: 0, // Always fetch fresh user data
  });
  
  // Effect to update user context when API data changes
  useEffect(() => {
    if (apiUser && typeof apiUser === 'object' && apiUser !== null) {
      // Safely cast the apiUser to a typed object
      const userObj = apiUser as Record<string, any>;
      
      if (typeof userObj.id === 'number' && 
          typeof userObj.username === 'string' && 
          (userObj.role === 'student' || userObj.role === 'teacher' || userObj.role === 'admin' || userObj.role === 'schoolAdmin')) {
        
        // Update user context with current user data from API
        setUser({
          id: userObj.id,
          username: userObj.username,
          fullName: userObj.fullName || userObj.username,
          role: userObj.role as 'student' | 'teacher' | 'admin' | 'schoolAdmin',
          schoolId: userObj.schoolId || null,
          classId: userObj.classId || null,
          gradeLevel: userObj.gradeLevel || null
        });
        
        // Update user role context
        setUserRole(userObj.role as 'student' | 'teacher' | 'admin' | 'schoolAdmin');
      }
    }
  }, [apiUser, setUser, setUserRole]);
  
  // If loading, show a loading indicator
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  // If no auth token or no user data, redirect to login
  if (!authToken || !user) {
    // Use setTimeout to avoid immediate redirect which can cause React errors
    setTimeout(() => {
      setLocation('/login');
    }, 0);
    return null;
  }
  
  // Check if the user's role is allowed for this route
  if (!allowedRoles.includes(userRole)) {
    // Redirect to homepage if role doesn't match
    setTimeout(() => {
      setLocation('/');
    }, 0);
    return null;
  }
  
  // User is authenticated and has the correct role
  return <>{children}</>;
};

export default ProtectedRoute;