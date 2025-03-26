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
  
  const { toast } = useToast();
  
  // Fetch schools data
  const { data: schools = [], isLoading: isLoadingSchools } = useQuery({
    queryKey: ['/api/schools'],
    select: (data) => data.filter((school: any) => school.isActive)
  });
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!username || !password || !confirmPassword || 
        !firstName || !lastName || !email || !selectedSchool) {
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
      role: "teacher",
      schoolId: parseInt(selectedSchool),
      subject // Optional field
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
          <Label htmlFor="teacher-firstName">First Name</Label>
          <Input 
            id="teacher-firstName" 
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="teacher-lastName">Last Name</Label>
          <Input 
            id="teacher-lastName" 
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="teacher-username">Username</Label>
        <Input 
          id="teacher-username" 
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="teacher-email">Email</Label>
        <Input 
          id="teacher-email" 
          type="email" 
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="teacher-school">School</Label>
        <Select 
          value={selectedSchool} 
          onValueChange={setSelectedSchool}
        >
          <SelectTrigger id="teacher-school">
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
        <Label htmlFor="teacher-subject">Subject (Optional)</Label>
        <Input 
          id="teacher-subject" 
          placeholder="What subject do you teach?"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="teacher-password">Password</Label>
        <Input 
          id="teacher-password" 
          type="password" 
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="teacher-confirm-password">Confirm Password</Label>
        <Input 
          id="teacher-confirm-password" 
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
        {isRegistering ? "Creating Account..." : "Create Teacher Account"}
      </Button>
    </form>
  );
};

export default TeacherRegistrationForm;