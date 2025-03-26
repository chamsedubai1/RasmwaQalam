import React from 'react';
import { Redirect } from 'wouter';
import { useUserRole } from '@/hooks/use-user-role';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { userRole } = useUserRole();
  
  // If the user is not logged in (no role), redirect to login
  if (!userRole) {
    return <Redirect to="/login" />;
  }
  
  // If the user is logged in but doesn't have the required role, redirect to appropriate page
  if (!allowedRoles.includes(userRole)) {
    // Redirect based on role
    switch (userRole) {
      case 'admin':
        return <Redirect to="/admin-dashboard" />;
      case 'teacher':
        return <Redirect to="/teacher-dashboard" />;
      case 'student':
        return <Redirect to="/home" />;
      default:
        return <Redirect to="/home" />;
    }
  }
  
  // If the user has the required role, render the children
  return <>{children}</>;
};

export default ProtectedRoute;