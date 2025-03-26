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
  
  const { toast } = useToast();
  
  // Fetch schools data
  const { data: schools = [], isLoading: isLoadingSchools } = useQuery({
    queryKey: ['/api/schools'],
    select: (data) => data.filter((school: any) => school.isActive)
  });
  
  // Fetch classes based on selected school
  const { data: classes = [], isLoading: isLoadingClasses } = useQuery({
    queryKey: ['/api/classes', selectedSchool],
    enabled: !!selectedSchool,
    select: (data) => {
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
    
    // Validation
    if (!username || !password || !confirmPassword || 
        !firstName || !lastName || !email || 
        !selectedSchool || !selectedGrade || !selectedClass) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
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
      gradeLevel: selectedGrade
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
          <Label htmlFor="firstName">First Name</Label>
          <Input 
            id="firstName" 
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input 
            id="lastName" 
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input 
          id="username" 
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input 
          id="email" 
          type="email" 
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="school">School</Label>
        <Select 
          value={selectedSchool} 
          onValueChange={setSelectedSchool}
        >
          <SelectTrigger id="school">
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
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="grade">Grade</Label>
          <Select 
            value={selectedGrade} 
            onValueChange={setSelectedGrade}
          >
            <SelectTrigger id="grade">
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
          <Label htmlFor="class">Class</Label>
          <Select 
            value={selectedClass} 
            onValueChange={setSelectedClass}
            disabled={!selectedSchool || isLoadingClasses}
          >
            <SelectTrigger id="class">
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
                classes.map((classItem: any) => (
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
        <Label htmlFor="password">Password</Label>
        <Input 
          id="password" 
          type="password" 
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <Input 
          id="confirm-password" 
          type="password" 
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
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