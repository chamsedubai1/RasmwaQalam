import React, { useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { CaptchaField } from "./captcha-field";

interface TeacherRegistrationFormProps {
  onSubmit: (data: any) => Promise<void>;
  isRegistering: boolean;
}

const TeacherRegistrationForm: React.FC<TeacherRegistrationFormProps> = ({ 
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
  const [subject, setSubject] = useState("");
  
  // Field-specific error states
  const [formErrors, setFormErrors] = useState<{
    username?: string;
    password?: string;
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    selectedSchool?: string;
    subject?: string;
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
    select: (data) => data.filter((school: any) => school.isActive)
  });
  
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
      subject?: string;
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
      role: "teacher",
      schoolId: parseInt(selectedSchool),
      subject, // Optional field
      captchaText // Include CAPTCHA text for validation on the server
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
      setSubject("");
    } catch (error) {
      console.error("Registration error in form component:", error);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="teacher-firstName" className={formErrors.firstName ? "text-red-500" : ""}>
            First Name {formErrors.firstName && <span className="text-xs font-normal">- {formErrors.firstName}</span>}
          </Label>
          <Input 
            id="teacher-firstName" 
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={formErrors.firstName ? "border-red-500 focus-visible:ring-red-500" : ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="teacher-lastName" className={formErrors.lastName ? "text-red-500" : ""}>
            Last Name {formErrors.lastName && <span className="text-xs font-normal">- {formErrors.lastName}</span>}
          </Label>
          <Input 
            id="teacher-lastName" 
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={formErrors.lastName ? "border-red-500 focus-visible:ring-red-500" : ""}
            required
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="teacher-username" className={formErrors.username ? "text-red-500" : ""}>
          Username {formErrors.username && <span className="text-xs font-normal">- {formErrors.username}</span>}
        </Label>
        <Input 
          id="teacher-username" 
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={formErrors.username ? "border-red-500 focus-visible:ring-red-500" : ""}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="teacher-email" className={formErrors.email ? "text-red-500" : ""}>
          Email {formErrors.email && <span className="text-xs font-normal">- {formErrors.email}</span>}
        </Label>
        <Input 
          id="teacher-email" 
          type="email" 
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={formErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="teacher-school" className={formErrors.selectedSchool ? "text-red-500" : ""}>
          School {formErrors.selectedSchool && <span className="text-xs font-normal">- {formErrors.selectedSchool}</span>}
        </Label>
        <Select 
          value={selectedSchool} 
          onValueChange={setSelectedSchool}
        >
          <SelectTrigger 
            id="teacher-school"
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
              schools.map((school: any) => (
                <SelectItem key={school.id} value={school.id.toString()}>
                  {school.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="teacher-subject" className={formErrors.subject ? "text-red-500" : ""}>
          Subject (Optional) {formErrors.subject && <span className="text-xs font-normal">- {formErrors.subject}</span>}
        </Label>
        <Input 
          id="teacher-subject" 
          placeholder="What subject do you teach?"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={formErrors.subject ? "border-red-500 focus-visible:ring-red-500" : ""}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="teacher-password" className={formErrors.password ? "text-red-500" : ""}>
          Password {formErrors.password && <span className="text-xs font-normal">- {formErrors.password}</span>}
        </Label>
        <Input 
          id="teacher-password" 
          type="password" 
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={formErrors.password ? "border-red-500 focus-visible:ring-red-500" : ""}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="teacher-confirm-password" className={formErrors.confirmPassword ? "text-red-500" : ""}>
          Confirm Password {formErrors.confirmPassword && <span className="text-xs font-normal">- {formErrors.confirmPassword}</span>}
        </Label>
        <Input 
          id="teacher-confirm-password" 
          type="password" 
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={formErrors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}
          required
        />
      </div>
      
      <div className="space-y-2">
        <CaptchaField 
          control={form.control} 
          name="captchaText"
          label="Security Verification"
          description="Please enter the text shown in the image to verify you're not a robot"
        />
      </div>
      
      <Button 
        type="submit" 
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        disabled={isRegistering}
      >
        {isRegistering ? "Creating Account..." : "Create Teacher Account"}
      </Button>
    </form>
  );
};

export default TeacherRegistrationForm;