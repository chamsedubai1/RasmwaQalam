import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useForm, FormProvider } from "react-hook-form";
import { School, Class } from "@shared/schema";
import { CaptchaField } from "./captcha-field";

interface StudentRegistrationFormProps {
  onSubmit: (data: any) => Promise<void>;
  isRegistering: boolean;
}

const StudentRegistrationForm: React.FC<StudentRegistrationFormProps> = ({ 
  onSubmit, 
  isRegistering 
}) => {
  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  
  // Field-specific error states
  const [formErrors, setFormErrors] = useState<{
    username?: string;
    password?: string;
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    selectedSchool?: string;
    selectedGrade?: string;
    selectedClass?: string;
    captchaText?: string;
  }>({});
  
  // Initialize react-hook-form for CAPTCHA
  const form = useForm({
    defaultValues: {
      captchaText: "",
    }
  });
  
  const { toast } = useToast();
  
  // Fetch schools data
  const { data: schools = [], isLoading: isLoadingSchools } = useQuery({
    queryKey: ['/api/schools'],
    select: (data: any) => data.filter((school: any) => school.isActive)
  });
  
  // Fetch classes based on selected school
  const { data: classes = [], isLoading: isLoadingClasses } = useQuery({
    queryKey: ['/api/classes', selectedSchool],
    enabled: !!selectedSchool,
    select: (data: any) => {
      // Filter classes by school if a school is selected
      if (selectedSchool) {
        return data.filter((classItem: any) => 
          classItem.schoolId === parseInt(selectedSchool) && !classItem.isLocked
        );
      }
      return [];
    }
  });
  
  // Reset class selection when school changes
  useEffect(() => {
    setSelectedClass("");
  }, [selectedSchool]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset previous errors
    setFormErrors({});
    
    // Get CAPTCHA text from react-hook-form
    const captchaText = form.getValues("captchaText");
    
    // Field-specific validation with detailed error messages
    const errors: {
      username?: string;
      password?: string;
      confirmPassword?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      selectedSchool?: string;
      selectedGrade?: string;
      selectedClass?: string;
      captchaText?: string;
    } = {};
    
    if (!firstName) {
      errors.firstName = "First name is required";
    }
    
    if (!lastName) {
      errors.lastName = "Last name is required";
    }
    
    if (!username) {
      errors.username = "Username is required";
    } else if (username.length < 4) {
      errors.username = "Username must be at least 4 characters";
    }
    
    if (!email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = "Email format is invalid";
    }
    
    if (!selectedSchool) {
      errors.selectedSchool = "School selection is required";
    }
    
    if (!selectedGrade) {
      errors.selectedGrade = "Grade selection is required";
    }
    
    if (!selectedClass) {
      errors.selectedClass = "Class selection is required";
    }
    
    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    
    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }
    
    if (!captchaText) {
      errors.captchaText = "Please enter the security verification code";
    }
    
    // Check if there are any errors
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      
      toast({
        title: "Validation Error",
        description: "Please correct the highlighted fields",
        variant: "destructive"
      });
      return;
    }
    
    // Prepare data for submission
    const registrationData = {
      username,
      password,
      fullName: `${firstName} ${lastName}`,
      email,
      role: "student",
      schoolId: parseInt(selectedSchool),
      classId: parseInt(selectedClass),
      gradeLevel: selectedGrade,
      captchaText  // Include CAPTCHA text for validation on the server
    };
    
    try {
      await onSubmit(registrationData);
      
      // Reset form fields on success
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setFirstName("");
      setLastName("");
      setEmail("");
      setSelectedSchool("");
      setSelectedGrade("");
      setSelectedClass("");
    } catch (error) {
      console.error("Registration error in form component:", error);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName" className={formErrors.firstName ? "text-red-500" : ""}>
            First Name {formErrors.firstName && <span className="text-xs font-normal">- {formErrors.firstName}</span>}
          </Label>
          <Input 
            id="firstName" 
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={formErrors.firstName ? "border-red-500 focus-visible:ring-red-500" : ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName" className={formErrors.lastName ? "text-red-500" : ""}>
            Last Name {formErrors.lastName && <span className="text-xs font-normal">- {formErrors.lastName}</span>}
          </Label>
          <Input 
            id="lastName" 
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={formErrors.lastName ? "border-red-500 focus-visible:ring-red-500" : ""}
            required
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="username" className={formErrors.username ? "text-red-500" : ""}>
          Username {formErrors.username && <span className="text-xs font-normal">- {formErrors.username}</span>}
        </Label>
        <Input 
          id="username" 
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={formErrors.username ? "border-red-500 focus-visible:ring-red-500" : ""}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email" className={formErrors.email ? "text-red-500" : ""}>
          Email {formErrors.email && <span className="text-xs font-normal">- {formErrors.email}</span>}
        </Label>
        <Input 
          id="email" 
          type="email" 
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={formErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="school" className={formErrors.selectedSchool ? "text-red-500" : ""}>
          School {formErrors.selectedSchool && <span className="text-xs font-normal">- {formErrors.selectedSchool}</span>}
        </Label>
        <Select 
          value={selectedSchool} 
          onValueChange={setSelectedSchool}
        >
          <SelectTrigger 
            id="school"
            className={formErrors.selectedSchool ? "border-red-500 focus-visible:ring-red-500" : ""}
          >
            <SelectValue placeholder="Select your school" />
          </SelectTrigger>
          <SelectContent>
            {isLoadingSchools ? (
              <SelectItem value="loading" disabled>Loading schools...</SelectItem>
            ) : schools.length === 0 ? (
              <SelectItem value="none" disabled>No schools available</SelectItem>
            ) : (
              schools.map((school) => (
                <SelectItem key={school.id} value={school.id.toString()}>
                  {school.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="grade" className={formErrors.selectedGrade ? "text-red-500" : ""}>
            Grade {formErrors.selectedGrade && <span className="text-xs font-normal">- {formErrors.selectedGrade}</span>}
          </Label>
          <Select 
            value={selectedGrade} 
            onValueChange={setSelectedGrade}
          >
            <SelectTrigger 
              id="grade"
              className={formErrors.selectedGrade ? "border-red-500 focus-visible:ring-red-500" : ""}
            >
              <SelectValue placeholder="Select grade" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
                <SelectItem key={grade} value={`Grade ${grade}`}>
                  Grade {grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="class" className={formErrors.selectedClass ? "text-red-500" : ""}>
            Class {formErrors.selectedClass && <span className="text-xs font-normal">- {formErrors.selectedClass}</span>}
          </Label>
          <Select 
            value={selectedClass} 
            onValueChange={setSelectedClass}
            disabled={!selectedSchool || isLoadingClasses}
          >
            <SelectTrigger 
              id="class"
              className={formErrors.selectedClass ? "border-red-500 focus-visible:ring-red-500" : ""}
            >
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {!selectedSchool ? (
                <SelectItem value="select-school" disabled>Select a school first</SelectItem>
              ) : isLoadingClasses ? (
                <SelectItem value="loading" disabled>Loading classes...</SelectItem>
              ) : classes.length === 0 ? (
                <SelectItem value="none" disabled>No classes available</SelectItem>
              ) : (
                classes.map((classItem) => (
                  <SelectItem key={classItem.id} value={classItem.id.toString()}>
                    {classItem.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password" className={formErrors.password ? "text-red-500" : ""}>
          Password {formErrors.password && <span className="text-xs font-normal">- {formErrors.password}</span>}
        </Label>
        <Input 
          id="password" 
          type="password" 
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={formErrors.password ? "border-red-500 focus-visible:ring-red-500" : ""}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="confirm-password" className={formErrors.confirmPassword ? "text-red-500" : ""}>
          Confirm Password {formErrors.confirmPassword && <span className="text-xs font-normal">- {formErrors.confirmPassword}</span>}
        </Label>
        <Input 
          id="confirm-password" 
          type="password" 
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={formErrors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}
          required
        />
      </div>
      
      <div className="space-y-2">
        <FormProvider {...form}>
          <CaptchaField 
            control={form.control} 
            name="captchaText"
            label="Security Verification"
            description="Please enter the text shown in the image to verify you're not a robot"
          />
        </FormProvider>
      </div>
      
      <Button 
        type="submit" 
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        disabled={isRegistering}
      >
        {isRegistering ? "Creating Account..." : "Create Student Account"}
      </Button>
    </form>
  );
};

export default StudentRegistrationForm;