import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useUserRole } from "@/hooks/use-user-role";
import { useUser } from "@/hooks/use-user";
import { useLanguage } from "@/hooks/use-language";
import StudentRegistrationForm from "@/components/auth/student-registration-form";
import TeacherRegistrationForm from "@/components/auth/teacher-registration-form";
import ForgotPasswordDialog from "@/components/auth/forgot-password-dialog";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setUserRole } = useUserRole();
  const { user, setUser } = useUser();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("login");
  const [registrationRole, setRegistrationRole] = useState("student");
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  
  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Effect to check if user is already logged in
  useEffect(() => {
    // If user is already logged in, redirect to the appropriate page
    if (user) {
      switch (user.role) {
        case "admin":
          setLocation("/admin");
          break;
        case "schoolAdmin":
          setLocation("/school-admin");
          break;
        case "teacher":
          setLocation("/teacher");
          break;
        case "student":
          setLocation("/");
          break;
        default:
          break;
      }
    }
    
    // Always clear login form fields when component mounts
    setLoginUsername("");
    setLoginPassword("");
  }, [user, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginUsername || !loginPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoggingIn(true);
    
    try {
      const response = await apiRequest('POST', '/api/auth/login', {
        username: loginUsername,
        password: loginPassword
      });
      
      // SECURITY ENHANCEMENT: Store user data (tokens now in httpOnly cookies)
      console.log("Login successful:", response);
      
      // Handle cookie-based authentication response
      if (response.user) {
        const userData = {
          id: response.user.id,
          username: response.user.username,
          fullName: response.user.fullName || response.user.username,
          role: response.user.role,
          schoolId: response.user.schoolId,
          classId: response.user.classId,
          gradeLevel: response.user.gradeLevel
        };
        
        // Set user role for basic authorization
        setUserRole(response.user.role);
        
        // Set full user data in context
        setUser(userData);
        
        // SECURITY: The real access/refresh tokens live in HttpOnly cookies
        // (set by the server in this same response). We can't see them from
        // JS, which is the point. The localStorage values below are NOT real
        // tokens — they're a client-only marker that the user has logged in,
        // used by ProtectedRoute and a handful of legacy query `enabled`
        // checks to decide whether to even try authenticated requests.
        // When the cookie is missing or expired, those requests will 401
        // anyway and the user will be bounced to /login.
        localStorage.setItem('authToken', 'cookie-based');
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('userRole', response.user.role);
        
        // Redirect based on role
        switch (response.user.role) {
          case "admin":
            setLocation("/admin");
            break;
          case "schoolAdmin":
            setLocation("/school-admin");
            break;
          case "teacher":
            setLocation("/teacher");
            break;
          case "student":
            setLocation("/");
            break;
          default:
            setLocation("/");
        }
      }
      
      toast({
        title: "Success",
        description: "You have been logged in successfully"
      });
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: "Invalid username or password",
        variant: "destructive"
      });
    } finally {
      setIsLoggingIn(false);
    }
  };
  
  const handleRegister = async (registrationData: any) => {
    setIsRegistering(true);
    
    try {
      // Send registration data to the API
      const response = await apiRequest('POST', '/api/auth/register', registrationData);
      
      console.log("Registration successful:", response);
      
      // Auto-login user after successful registration
      if (response && response.id) {
        // Create user object
        const userData = {
          id: response.id,
          username: response.username,
          fullName: response.fullName || response.username,
          role: response.role,
          schoolId: response.schoolId,
          classId: response.classId,
          gradeLevel: response.gradeLevel
        };
        
        // Set user role for basic authorization
        setUserRole(response.role);
        
        // Set full user data in context
        setUser(userData);
        
        // Store auth token and user data in localStorage
        localStorage.setItem('authToken', `${response.username}:${Date.now()}`);
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('userRole', response.role);
        
        // Redirect to appropriate page based on role
        switch (response.role) {
          case "admin":
            setLocation("/admin");
            break;
          case "schoolAdmin":
            setLocation("/school-admin");
            break;
          case "teacher":
            setLocation("/teacher");
            break;
          case "student":
            setLocation("/creart");
            break;
          default:
            setLocation("/");
        }
        
        toast({
          title: "Success",
          description: "Your account has been created and you are now logged in."
        });
      } else {
        // Just switch to login form if auto-login fails
        toast({
          title: "Success",
          description: "Your account has been created. You can now log in."
        });
        
        // Switch to login tab
        setActiveTab("login");
        
        // Pre-fill login form with the username
        setLoginUsername(registrationData.username);
        setLoginPassword("");
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Error",
        description: "There was an error creating your account. Please try again.",
        variant: "destructive"
      });
      throw error; // Re-throw to let the form component know there was an error
    } finally {
      setIsRegistering(false);
    }
  };
  
  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <div className="w-full max-w-md">
        <Card className="border-2 border-blue-100">
          <CardHeader className="space-y-1 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="text-2xl font-bold text-center text-blue-800">RASM wa QALAM</CardTitle>
            <CardDescription className="text-center">
              {t("nav.login_register")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
                <TabsTrigger value="register">{t("auth.register")}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">{t("auth.username")}</Label>
                    <Input 
                      id="username" 
                      type="text" 
                      placeholder={t("auth.username_placeholder")}
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{t("auth.password")}</Label>
                      <Button 
                        type="button" 
                        variant="link" 
                        className="px-0 text-xs text-blue-600"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsForgotPasswordOpen(true);
                        }}
                      >
                        {t("auth.forgot_password")}
                      </Button>
                    </div>
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder={t("auth.password_placeholder")}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    disabled={isLoggingIn}
                  >
                    {isLoggingIn ? t("auth.logging_in") : t("auth.login")}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="register-as">{t("auth.register_as")}</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant={registrationRole === "student" ? "default" : "outline"}
                        className={
                          registrationRole === "student" 
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" 
                            : ""
                        }
                        onClick={() => setRegistrationRole("student")}
                      >
                        {t("auth.student")}
                      </Button>
                      <Button
                        type="button"
                        variant={registrationRole === "teacher" ? "default" : "outline"}
                        className={
                          registrationRole === "teacher" 
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" 
                            : ""
                        }
                        onClick={() => setRegistrationRole("teacher")}
                      >
                        {t("auth.teacher")}
                      </Button>
                      <Button
                        type="button"
                        variant={registrationRole === "schoolAdmin" ? "default" : "outline"}
                        className={
                          registrationRole === "schoolAdmin" 
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" 
                            : ""
                        }
                        onClick={() => setRegistrationRole("schoolAdmin")}
                      >
                        {t("auth.school_admin")}
                      </Button>
                    </div>
                  </div>
                  
                  {registrationRole === "student" ? (
                    <StudentRegistrationForm 
                      onSubmit={handleRegister}
                      isRegistering={isRegistering}
                    />
                  ) : (
                    <TeacherRegistrationForm 
                      onSubmit={handleRegister}
                      isRegistering={isRegistering}
                      isSchoolAdmin={registrationRole === "schoolAdmin"}
                    />
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-6">
            <p className="text-xs text-center text-gray-700">
              {t("auth.terms_agreement")}
            </p>
          </CardFooter>
        </Card>
      </div>
      
      <ForgotPasswordDialog 
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
}