import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { UserRoleProvider, useUserRole } from "@/hooks/use-user-role";
import { UserProvider } from "@/hooks/use-user";
import { LanguageProvider, useLanguage } from "@/hooks/use-language";
import Header from "@/components/site/header";
import Footer from "@/components/site/footer";
import Home from "@/pages/home";
import About from "@/pages/about";
import Events from "@/pages/events";
import Gallery from "@/pages/gallery";
import Schools from "@/pages/schools";
import Partners from "@/pages/partners";
import CreArt from "@/pages/creart";
import TeacherDashboard from "@/pages/teacher-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminMonitoring from "@/pages/admin-monitoring";
import SchoolAdminDashboard from "@/pages/school-admin-dashboard";
import SubmissionView from "@/pages/submission-view";
import Login from "@/pages/login";
import UploadTest from "@/pages/upload-test";
import ProtectedRoute from "@/components/auth/protected-route";
import { useEffect } from "react";

function Router() {
  const [location] = useLocation();
  const { userRole } = useUserRole();
  const { language } = useLanguage();
  
  // Log for debugging navigation and auth state
  useEffect(() => {
    console.log("Current path:", location);
    console.log("User role:", userRole);
    console.log("Current language:", language);
  }, [location, userRole, language]);
  
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 min-h-[calc(100vh-150px)]">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/about" component={About} />
          <Route path="/events" component={Events} />
          <Route path="/gallery" component={Gallery} />
          <Route path="/schools" component={Schools} />
          <Route path="/partners" component={Partners} />
          <Route path="/login" component={Login} />
          <Route path="/submission/:id" component={SubmissionView} />
          <Route path="/upload-test" component={UploadTest} />
          
          {/* Protected routes */}
          <Route path="/creart">
            <ProtectedRoute allowedRoles={['student']}>
              <CreArt />
            </ProtectedRoute>
          </Route>
          
          <Route path="/teacher">
            <ProtectedRoute allowedRoles={['teacher']}>
              <TeacherDashboard />
            </ProtectedRoute>
          </Route>
          
          <Route path="/admin">
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          </Route>
          
          <Route path="/admin/monitoring">
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminMonitoring />
            </ProtectedRoute>
          </Route>
          
          <Route path="/school-admin">
            <ProtectedRoute allowedRoles={['schoolAdmin']}>
              <SchoolAdminDashboard />
            </ProtectedRoute>
          </Route>
          
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <UserRoleProvider>
          <LanguageProvider>
            <Router />
            <Toaster />
          </LanguageProvider>
        </UserRoleProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
