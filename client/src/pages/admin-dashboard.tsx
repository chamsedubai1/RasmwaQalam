import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/use-user-role";
import { Redirect } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import UserTable from "@/components/dashboard/user-table";
import EventTable from "@/components/dashboard/event-table";
import ClassTable from "@/components/dashboard/class-table";
import StudentTable from "@/components/dashboard/student-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, SearchIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const AdminDashboard: React.FC = () => {
  const { userRole } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("users");
  const [roleFilter, setRoleFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Create dialogs
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showCreateEventDialog, setShowCreateEventDialog] = useState(false);
  const [showCreateSchoolDialog, setShowCreateSchoolDialog] = useState(false);
  const [showCreateClassDialog, setShowCreateClassDialog] = useState(false);
  
  // Edit dialogs
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showEditEventDialog, setShowEditEventDialog] = useState(false);
  const [showEditSchoolDialog, setShowEditSchoolDialog] = useState(false);
  
  // Form state for school
  const [schoolName, setSchoolName] = useState("");
  const [schoolDescription, setSchoolDescription] = useState("");
  const [schoolWebsite, setSchoolWebsite] = useState("");
  const [schoolStatus, setSchoolStatus] = useState("true"); // active by default
  const [schoolImageUrl, setSchoolImageUrl] = useState("");
  const [showEditClassDialog, setShowEditClassDialog] = useState(false);
  
  // Form state for users
  const [userFullName, setUserFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userUsername, setUserUsername] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRoleValue, setUserRoleValue] = useState("student");
  const [userSchoolId, setUserSchoolId] = useState("");
  const [userClassId, setUserClassId] = useState("");
  const [userIsActive, setUserIsActive] = useState(true);
  
  // Selected item IDs for edit operations
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  
  // Delete dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItemToDelete, setSelectedItemToDelete] = useState<{ type: string; id: number } | null>(null);
  
  // Student management dialog
  const [showStudentsDialog, setShowStudentsDialog] = useState(false);
  
  // Always include hooks before any early returns to avoid React errors
  
  // Fetch all users
  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/users'],
  });
  
  // Fetch all schools
  const { data: schools = [], isLoading: isLoadingSchools } = useQuery({
    queryKey: ['/api/schools'],
  });
  
  // Fetch all events for event management
  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['/api/events'],
  });
  
  // Fetch all classes for class management
  const { data: classes = [], isLoading: isLoadingClasses } = useQuery({
    queryKey: ['/api/classes'],
  });
  
  // Admin role check - moved after all hooks to avoid React errors
  if (userRole !== "admin") {
    return <Redirect to="/" />;
  }
  
  // Get school names for each user
  const usersWithSchoolNames = allUsers.map((user: any) => {
    const school = schools.find((s: any) => s.id === user.schoolId);
    const userClass = classes.find((c: any) => c.id === user.classId);
    return {
      ...user,
      schoolName: school ? school.name : "N/A",
      className: userClass ? userClass.name : "N/A"
    };
  });
  
  // Filter users
  const filteredUsers = usersWithSchoolNames.filter((user: any) => {
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesSchool = schoolFilter === "all" || user.schoolId?.toString() === schoolFilter;
    const matchesSearch = searchQuery === "" || 
      (user.fullName && user.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.username && user.username.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesRole && matchesSchool && matchesSearch;
  });
  
  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      return apiRequest("POST", "/api/users", userData);
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      // Reset form fields
      setUserFullName("");
      setUserEmail("");
      setUserUsername("");
      setUserPassword("");
      setUserRoleValue("student");
      setUserSchoolId("");
      setUserClassId("");
      setUserIsActive(true);
      
      // Close dialog
      setShowCreateUserDialog(false);
      
      // Success message
      toast({
        title: "User Created",
        description: "User has been successfully created",
      });
    },
    onError: (error: any) => {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description: "Failed to create user. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number, userData: any }) => {
      return apiRequest("PATCH", `/api/users/${id}`, userData);
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      // Reset form fields
      setUserFullName("");
      setUserEmail("");
      setUserUsername("");
      setUserPassword("");
      setUserRoleValue("student");
      setUserSchoolId("");
      setUserClassId("");
      setUserIsActive(true);
      setSelectedUserId(null);
      
      // Close dialog
      setShowEditUserDialog(false);
      
      // Success message
      toast({
        title: "User Updated",
        description: "User has been successfully updated",
      });
    },
    onError: (error: any) => {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: "Failed to update user. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleCreateUser = () => {
    // Validate form fields
    if (!userFullName || !userEmail || !userUsername || !userPassword) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // Build user data and submit using mutation
    const userData = {
      fullName: userFullName,
      email: userEmail,
      username: userUsername,
      password: userPassword,
      role: userRoleValue,
      schoolId: userSchoolId ? parseInt(userSchoolId) : null,
      classId: userClassId ? parseInt(userClassId) : null,
      isActive: userIsActive
    };
    
    // Call the mutation with user data
    createUserMutation.mutate(userData);
  };
  
  // Form state for event
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventType, setEventType] = useState("poetry");
  const [eventStatus, setEventStatus] = useState("upcoming");
  const [eventStage, setEventStage] = useState("class");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventImageUrl, setEventImageUrl] = useState("");

  const handleCreateEvent = () => {
    // Validate form fields
    if (!eventName || !eventDescription || !eventType || !eventStatus || !eventStartDate || !eventEndDate) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // In a real app, this would call the API to create an event with the form data
    console.log({
      name: eventName,
      description: eventDescription,
      type: eventType,
      status: eventStatus,
      stage: eventStage,
      startDate: new Date(eventStartDate),
      endDate: new Date(eventEndDate),
      imageUrl: eventImageUrl || null
    });
    
    // Reset form fields
    setEventName("");
    setEventDescription("");
    setEventType("poetry");
    setEventStatus("upcoming");
    setEventStage("class");
    setEventStartDate("");
    setEventEndDate("");
    setEventImageUrl("");
    
    // Close dialog
    setShowCreateEventDialog(false);
    
    // Success message
    toast({
      title: "Event Created",
      description: "Event has been successfully created",
    });
  };
  
  const handleEditEvent = (eventData: any) => {
    // Set selected event ID
    setSelectedEventId(eventData.id);
    
    // Pre-populate form fields with selected event data
    setEventName(eventData.name || '');
    setEventDescription(eventData.description || '');
    setEventType(eventData.type || 'poetry');
    setEventStatus(eventData.status || 'upcoming');
    setEventStage(eventData.stage || 'class');
    
    // Format dates for input fields (YYYY-MM-DD)
    if (eventData.startDate) {
      const startDate = new Date(eventData.startDate);
      setEventStartDate(startDate.toISOString().split('T')[0]);
    }
    
    if (eventData.endDate) {
      const endDate = new Date(eventData.endDate);
      setEventEndDate(endDate.toISOString().split('T')[0]);
    }
    
    setEventImageUrl(eventData.imageUrl || '');
    
    // Open edit dialog
    setShowEditEventDialog(true);
  };
  
  const handleUpdateEvent = () => {
    // Validate form fields
    if (!eventName || !eventDescription || !eventType || !eventStatus || !eventStartDate || !eventEndDate) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // In a real app, this would call the API to update the event with the form data
    console.log({
      id: selectedEventId,
      name: eventName,
      description: eventDescription,
      type: eventType,
      status: eventStatus,
      stage: eventStage,
      startDate: new Date(eventStartDate),
      endDate: new Date(eventEndDate),
      imageUrl: eventImageUrl || null
    });
    
    // Reset form fields
    setEventName("");
    setEventDescription("");
    setEventType("poetry");
    setEventStatus("upcoming");
    setEventStage("class");
    setEventStartDate("");
    setEventEndDate("");
    setEventImageUrl("");
    setSelectedEventId(null);
    
    // Close dialog
    setShowEditEventDialog(false);
    
    // Success message
    toast({
      title: "Event Updated",
      description: "Event has been successfully updated",
    });
  };
  
  const handleCreateSchool = () => {
    setShowCreateSchoolDialog(false);
    // In a real app, this would call the API to create a school
    toast({
      title: "School Created",
      description: "School has been successfully created",
    });
  };
  
  const handleUpdateSchool = () => {
    // Close the dialog
    setShowEditSchoolDialog(false);
    
    // In a real app, this would call the API to update the school
    console.log({
      id: selectedSchoolId,
      name: schoolName,
      description: schoolDescription,
      websiteUrl: schoolWebsite,
      isActive: schoolStatus === "true",
      imageUrl: schoolImageUrl
    });
    
    // Reset form state
    setSchoolName("");
    setSchoolDescription("");
    setSchoolWebsite("");
    setSchoolStatus("true");
    setSchoolImageUrl("");
    setSelectedSchoolId(null);
    
    // Show success message
    toast({
      title: "School Updated",
      description: "School has been successfully updated",
    });
  };
  
  // Form state for class creation
  const [className, setClassName] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [isClassActive, setIsClassActive] = useState(true);

  // Create class mutation
  const createClassMutation = useMutation({
    mutationFn: async (classData: any) => {
      return apiRequest("POST", "/api/classes", classData);
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      
      // Reset form fields
      setClassName("");
      setSelectedSchool("");
      setSelectedGrade("");
      setSelectedTeacher("");
      setIsClassActive(true);
      
      // Close dialog
      setShowCreateClassDialog(false);
      
      // Success message
      toast({
        title: "Class Created",
        description: "Class has been successfully created",
      });
    },
    onError: (error: any) => {
      console.error("Error creating class:", error);
      toast({
        title: "Error",
        description: "Failed to create class. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleCreateClass = () => {
    // Validate form fields
    if (!className || !selectedSchool || !selectedGrade || !selectedTeacher) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // Build class data and submit using mutation
    const classData = {
      name: className,
      schoolId: parseInt(selectedSchool),
      gradeLevel: `Grade ${selectedGrade}`,
      teacherId: parseInt(selectedTeacher),
      isLocked: !isClassActive
    };
    
    // Call the mutation with class data
    createClassMutation.mutate(classData);
  };

  const handleEditClass = (classData: any) => {
    // Set selected class ID
    setSelectedClassId(classData.id);
    
    // Pre-populate form fields with selected class data
    setClassName(classData.name || '');
    setSelectedSchool(classData.schoolId ? classData.schoolId.toString() : '');
    
    // Handle different grade formats - some might be "Grade 9", others "9th"
    const gradeLevel = classData.gradeLevel || '';
    const grade = gradeLevel.includes('Grade ') 
      ? gradeLevel.replace('Grade ', '') 
      : gradeLevel.replace(/[^0-9]/g, '');
    setSelectedGrade(grade);
    
    setSelectedTeacher(classData.teacherId ? classData.teacherId.toString() : '');
    setIsClassActive(classData.isLocked === undefined ? true : !classData.isLocked);
    
    // Open edit dialog
    setShowEditClassDialog(true);
  };
  
  // Update class mutation
  const updateClassMutation = useMutation({
    mutationFn: async (classData: any) => {
      return apiRequest("PATCH", `/api/classes/${classData.id}`, {
        name: classData.name,
        schoolId: classData.schoolId,
        gradeLevel: classData.gradeLevel,
        teacherId: classData.teacherId,
        isLocked: classData.isLocked
      });
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      
      // Reset form fields
      setClassName("");
      setSelectedSchool("");
      setSelectedGrade("");
      setSelectedTeacher("");
      setIsClassActive(true);
      setSelectedClassId(null);
      
      // Close dialog
      setShowEditClassDialog(false);
      
      // Success message
      toast({
        title: "Class Updated",
        description: "Class has been successfully updated",
      });
    },
    onError: (error: any) => {
      console.error("Error updating class:", error);
      toast({
        title: "Error",
        description: "Failed to update class. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleUpdateClass = () => {
    // Validate form fields
    if (!className || !selectedSchool || !selectedGrade || !selectedTeacher) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // Check if class ID is selected
    if (!selectedClassId) {
      toast({
        title: "Error",
        description: "No class selected for update",
        variant: "destructive",
      });
      return;
    }
    
    // Build class data and submit using mutation
    const classData = {
      id: selectedClassId,
      name: className,
      schoolId: parseInt(selectedSchool),
      gradeLevel: `Grade ${selectedGrade}`,
      teacherId: parseInt(selectedTeacher),
      isLocked: !isClassActive
    };
    
    // Call the mutation with class data
    updateClassMutation.mutate(classData);
  };
  
  return (
    <div>
      <h1 className="text-3xl font-bold font-heading text-gray-800 mb-6">Admin Dashboard</h1>
      
      <Tabs defaultValue="users" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-8 w-full border-b border-gray-200">
          <TabsTrigger value="users" className="flex-1">Users</TabsTrigger>
          <TabsTrigger value="schools" className="flex-1">Schools</TabsTrigger>
          <TabsTrigger value="classes" className="flex-1">Classes</TabsTrigger>
          <TabsTrigger value="events" className="flex-1">Events</TabsTrigger>
          <TabsTrigger value="reports" className="flex-1">Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Manage Users</CardTitle>
              <Button onClick={() => setShowCreateUserDialog(true)}>
                Create New User
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex flex-wrap gap-4">
                  <div className="relative flex-grow">
                    <Input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <SearchIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Schools" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Schools</SelectItem>
                      {schools.map((school: any) => (
                        <SelectItem key={school.id} value={school.id.toString()}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <UserTable 
                users={filteredUsers} 
                isLoading={isLoadingUsers} 
                onEdit={(userData) => {
                  // Set selected user ID
                  setSelectedUserId(userData.id);
                  
                  // Pre-populate form fields with selected user data
                  setUserFullName(userData.fullName || '');
                  setUserEmail(userData.email || '');
                  setUserUsername(userData.username || '');
                  setUserPassword(''); // Don't populate password for security reasons
                  setUserRoleValue(userData.role || 'student');
                  setUserSchoolId(userData.schoolId ? userData.schoolId.toString() : '');
                  setUserClassId(userData.classId ? userData.classId.toString() : '');
                  setUserIsActive(userData.isActive);
                  
                  // Open edit dialog
                  setShowEditUserDialog(true);
                }}
              />
              
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">1</span> to{" "}
                  <span className="font-medium">{filteredUsers.length}</span> of{" "}
                  <span className="font-medium">{filteredUsers.length}</span> results
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" disabled>Previous</Button>
                  <Button variant="default" size="sm" className="bg-primary">1</Button>
                  <Button variant="outline" size="sm" disabled>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="events">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Manage Events</CardTitle>
              <Button onClick={() => setShowCreateEventDialog(true)}>
                Create New Event
              </Button>
            </CardHeader>
            <CardContent>
              <EventTable 
                events={events} 
                isLoading={isLoadingEvents}
                isAdmin={true}
                onEdit={handleEditEvent}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="schools">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Manage Schools</CardTitle>
              <Button onClick={() => setShowCreateSchoolDialog(true)}>
                Add New School
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingSchools ? (
                <div className="text-center py-8">
                  <p className="text-blue-600">Loading schools...</p>
                </div>
              ) : schools.length === 0 ? (
                <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-blue-700">No schools found. Add your first school!</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-blue-200 rounded-md">
                  <table className="w-full">
                    <thead className="bg-blue-50">
                      <tr className="border-b border-blue-200">
                        <th className="text-left p-3 text-blue-800">Name</th>
                        <th className="text-left p-3 text-blue-800">Website</th>
                        <th className="text-left p-3 text-blue-800">Status</th>
                        <th className="text-left p-3 text-blue-800">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schools.map((school: any) => (
                        <tr key={school.id} className="border-b border-blue-100 hover:bg-blue-50">
                          <td className="p-3 text-blue-800 font-medium">{school.name}</td>
                          <td className="p-3">
                            {school.websiteUrl ? (
                              <a 
                                href={school.websiteUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {school.websiteUrl}
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={school.isActive ? "default" : "secondary"}
                              className={school.isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800"}
                            >
                              {school.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => {
                                  // Set selected school ID
                                  setSelectedSchoolId(school.id);
                                  
                                  // Pre-populate form fields with selected school data
                                  setSchoolName(school.name || '');
                                  setSchoolDescription(school.description || '');
                                  setSchoolWebsite(school.websiteUrl || '');
                                  setSchoolStatus(school.isActive ? 'true' : 'false');
                                  setSchoolImageUrl(school.imageUrl || '');
                                  
                                  // Open edit dialog
                                  setShowEditSchoolDialog(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedSchoolId(school.id);
                                  toast({
                                    description: "Delete School functionality coming soon!",
                                    variant: "destructive"
                                  });
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="classes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Manage Classes</CardTitle>
              <Button onClick={() => setShowCreateClassDialog(true)}>
                Create New Class
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingClasses ? (
                <div className="text-center py-8">
                  <p className="text-blue-600">Loading classes...</p>
                </div>
              ) : classes.length === 0 ? (
                <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-blue-700">No classes found. Create your first class!</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-blue-200 rounded-md">
                  <table className="w-full">
                    <thead className="bg-blue-50">
                      <tr className="border-b border-blue-200">
                        <th className="text-left p-3 text-blue-800">Class Name</th>
                        <th className="text-left p-3 text-blue-800">School</th>
                        <th className="text-left p-3 text-blue-800">Grade</th>
                        <th className="text-left p-3 text-blue-800">Teacher</th>
                        <th className="text-left p-3 text-blue-800">Status</th>
                        <th className="text-left p-3 text-blue-800">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.map((classItem: any) => {
                        const school = schools.find((s: any) => s.id === classItem.schoolId);
                        const teacher = allUsers.find((u: any) => u.id === classItem.teacherId);
                        
                        return (
                          <tr key={classItem.id} className="border-b border-blue-100 hover:bg-blue-50">
                            <td className="p-3 text-blue-800 font-medium">{classItem.name}</td>
                            <td className="p-3">{school?.name || <span className="text-gray-400">-</span>}</td>
                            <td className="p-3">{classItem.gradeLevel || <span className="text-gray-400">-</span>}</td>
                            <td className="p-3">{teacher?.fullName || <span className="text-gray-400">-</span>}</td>
                            <td className="p-3">
                              <Badge
                                variant={classItem.isLocked ? "secondary" : "default"}
                                className={classItem.isLocked ? "bg-gray-100 text-gray-800" : "bg-green-100 text-green-800 border-green-200"}
                              >
                                {classItem.isLocked ? "Locked" : "Active"}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => {
                                    setSelectedClassId(classItem.id);
                                    setShowEditClassDialog(true);
                                    // Pre-populate form
                                    handleEditClass(classItem);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => {
                                    setSelectedClassId(classItem.id);
                                    setShowStudentsDialog(true);
                                  }}
                                >
                                  Students
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setSelectedClassId(classItem.id);
                                    setShowDeleteDialog(true);
                                    toast({
                                      description: "Delete confirmation coming soon!"
                                    });
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>System Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Reports and analytics coming soon.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Create User Dialog */}
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="user-fullName">Full Name</Label>
                <Input id="user-fullName" placeholder="Enter full name" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-email">Email</Label>
                <Input id="user-email" type="email" placeholder="Enter email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="user-username">Username</Label>
                <Input id="user-username" placeholder="Enter username" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-password">Password</Label>
                <Input id="user-password" type="password" placeholder="Enter password" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="user-role">Role</Label>
                <Select>
                  <SelectTrigger id="user-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-school">School</Label>
                <Select>
                  <SelectTrigger id="user-school">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school: any) => (
                      <SelectItem key={school.id} value={school.id.toString()}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreateUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit User Dialog */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-user-fullName">Full Name</Label>
                <Input 
                  id="edit-user-fullName" 
                  placeholder="Enter full name"
                  value={userFullName}
                  onChange={(e) => setUserFullName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-user-email">Email</Label>
                <Input 
                  id="edit-user-email" 
                  type="email" 
                  placeholder="Enter email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-user-username">Username</Label>
                <Input 
                  id="edit-user-username" 
                  placeholder="Enter username"
                  value={userUsername}
                  onChange={(e) => setUserUsername(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-user-password">Password (leave blank to keep current)</Label>
                <Input 
                  id="edit-user-password" 
                  type="password" 
                  placeholder="Enter new password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-user-role">Role</Label>
                <Select value={userRoleValue} onValueChange={setUserRoleValue}>
                  <SelectTrigger id="edit-user-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-user-school">School</Label>
                <Select value={userSchoolId} onValueChange={setUserSchoolId}>
                  <SelectTrigger id="edit-user-school">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {schools.map((school: any) => (
                      <SelectItem key={school.id} value={school.id.toString()}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-user-class">Class</Label>
                <Select value={userClassId} onValueChange={setUserClassId}>
                  <SelectTrigger id="edit-user-class">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {classes
                      .filter((c: any) => !userSchoolId || c.schoolId.toString() === userSchoolId)
                      .map((classItem: any) => (
                        <SelectItem key={classItem.id} value={classItem.id.toString()}>
                          {classItem.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-user-status">Status</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox 
                    id="edit-user-status" 
                    checked={userIsActive}
                    onCheckedChange={(checked) => setUserIsActive(checked === true)}
                  />
                  <label
                    htmlFor="edit-user-status"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Active
                  </label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={() => {
              // Handle update logic
              setShowEditUserDialog(false);
              
              // In a real app, this would call the API to update the user
              console.log({
                id: selectedUserId,
                fullName: userFullName,
                email: userEmail,
                username: userUsername,
                password: userPassword, // Only include if not empty
                role: userRoleValue,
                schoolId: userSchoolId ? parseInt(userSchoolId) : null,
                classId: userClassId ? parseInt(userClassId) : null,
                isActive: userIsActive
              });
              
              // Reset form
              setUserFullName("");
              setUserEmail("");
              setUserUsername("");
              setUserPassword("");
              setUserRoleValue("student");
              setUserSchoolId("");
              setUserClassId("");
              setUserIsActive(true);
              setSelectedUserId(null);
              
              // Show success message
              toast({
                title: "User Updated",
                description: "User has been successfully updated",
              });
            }}>
              Update User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Class Dialog */}
      <Dialog open={showEditClassDialog} onOpenChange={setShowEditClassDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-class-name">Class Name</Label>
              <Input 
                id="edit-class-name" 
                placeholder="Enter class name" 
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-class-school">School</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger id="edit-class-school">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school: any) => (
                      <SelectItem key={school.id} value={school.id.toString()}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-class-grade">Grade Level</Label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger id="edit-class-grade">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
                      <SelectItem key={grade} value={grade.toString()}>
                        Grade {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-class-teacher">Teacher</Label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger id="edit-class-teacher">
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter((user: any) => user.role === "teacher")
                    .map((teacher: any) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="edit-class-active" 
                checked={isClassActive}
                onCheckedChange={setIsClassActive}
              />
              <Label htmlFor="edit-class-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdateClass}>Update Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Event Dialog */}
      <Dialog open={showCreateEventDialog} onOpenChange={setShowCreateEventDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="event-name">Event Name</Label>
              <Input 
                id="event-name" 
                placeholder="Enter event name" 
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea 
                id="event-description" 
                placeholder="Enter event description"
                className="min-h-[100px]"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="event-type">Event Type</Label>
                <Select 
                  value={eventType} 
                  onValueChange={setEventType}
                >
                  <SelectTrigger id="event-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poetry">Poetry</SelectItem>
                    <SelectItem value="painting">Painting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-status">Status</Label>
                <Select 
                  value={eventStatus} 
                  onValueChange={setEventStatus}
                >
                  <SelectTrigger id="event-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="event-stage">Event Stage</Label>
                <Select 
                  value={eventStage} 
                  onValueChange={setEventStage}
                >
                  <SelectTrigger id="event-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">Class</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="country">Country</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="event-start">Start Date</Label>
                <Input 
                  id="event-start" 
                  type="date"
                  placeholder="Select start date" 
                  value={eventStartDate}
                  onChange={(e) => setEventStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-end">End Date</Label>
                <Input 
                  id="event-end" 
                  type="date"
                  placeholder="Select end date" 
                  value={eventEndDate}
                  onChange={(e) => setEventEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-image">Image URL</Label>
              <Input 
                id="event-image" 
                placeholder="Enter image URL" 
                value={eventImageUrl}
                onChange={(e) => setEventImageUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreateEvent}>Create Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Event Dialog */}
      <Dialog open={showEditEventDialog} onOpenChange={setShowEditEventDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-event-name">Event Name</Label>
              <Input 
                id="edit-event-name" 
                placeholder="Enter event name" 
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-event-description">Description</Label>
              <Textarea 
                id="edit-event-description" 
                placeholder="Enter event description"
                className="min-h-[100px]"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-event-type">Event Type</Label>
                <Select 
                  value={eventType} 
                  onValueChange={setEventType}
                >
                  <SelectTrigger id="edit-event-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poetry">Poetry</SelectItem>
                    <SelectItem value="painting">Painting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-event-status">Status</Label>
                <Select 
                  value={eventStatus} 
                  onValueChange={setEventStatus}
                >
                  <SelectTrigger id="edit-event-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-event-stage">Event Stage</Label>
                <Select 
                  value={eventStage} 
                  onValueChange={setEventStage}
                >
                  <SelectTrigger id="edit-event-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">Class</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="country">Country</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-event-start">Start Date</Label>
                <Input 
                  id="edit-event-start" 
                  type="date"
                  placeholder="Select start date" 
                  value={eventStartDate}
                  onChange={(e) => setEventStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-event-end">End Date</Label>
                <Input 
                  id="edit-event-end" 
                  type="date"
                  placeholder="Select end date" 
                  value={eventEndDate}
                  onChange={(e) => setEventEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-event-image">Image URL</Label>
              <Input 
                id="edit-event-image" 
                placeholder="Enter image URL" 
                value={eventImageUrl}
                onChange={(e) => setEventImageUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdateEvent}>Update Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create School Dialog */}
      <Dialog open={showCreateSchoolDialog} onOpenChange={setShowCreateSchoolDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New School</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="school-name">School Name</Label>
              <Input 
                id="school-name" 
                placeholder="Enter school name" 
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="school-description">Description</Label>
              <Textarea 
                id="school-description" 
                placeholder="Enter school description"
                className="min-h-[80px]"
                value={schoolDescription}
                onChange={(e) => setSchoolDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="school-website">Website URL</Label>
                <Input 
                  id="school-website" 
                  placeholder="Enter website URL" 
                  value={schoolWebsite}
                  onChange={(e) => setSchoolWebsite(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="school-status">Status</Label>
                <Select 
                  value={schoolStatus}
                  onValueChange={setSchoolStatus}
                >
                  <SelectTrigger id="school-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="school-image">Logo/Image URL</Label>
              <Input 
                id="school-image" 
                placeholder="Enter image URL" 
                value={schoolImageUrl}
                onChange={(e) => setSchoolImageUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreateSchool}>Create School</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit School Dialog */}
      <Dialog open={showEditSchoolDialog} onOpenChange={setShowEditSchoolDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit School</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-school-name">School Name</Label>
              <Input 
                id="edit-school-name" 
                placeholder="Enter school name" 
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-school-description">Description</Label>
              <Textarea 
                id="edit-school-description" 
                placeholder="Enter school description"
                className="min-h-[80px]"
                value={schoolDescription}
                onChange={(e) => setSchoolDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-school-website">Website URL</Label>
                <Input 
                  id="edit-school-website" 
                  placeholder="Enter website URL" 
                  value={schoolWebsite}
                  onChange={(e) => setSchoolWebsite(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-school-status">Status</Label>
                <Select 
                  value={schoolStatus}
                  onValueChange={setSchoolStatus}
                >
                  <SelectTrigger id="edit-school-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-school-image">Logo/Image URL</Label>
              <Input 
                id="edit-school-image" 
                placeholder="Enter image URL" 
                value={schoolImageUrl}
                onChange={(e) => setSchoolImageUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdateSchool}>Update School</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Class Dialog */}
      <Dialog open={showCreateClassDialog} onOpenChange={setShowCreateClassDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="class-name">Class Name</Label>
              <Input 
                id="class-name" 
                placeholder="Enter class name" 
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="class-school">School</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger id="class-school">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school: any) => (
                      <SelectItem key={school.id} value={school.id.toString()}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="class-grade">Grade Level</Label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger id="class-grade">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
                      <SelectItem key={grade} value={grade.toString()}>
                        Grade {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="class-teacher">Teacher</Label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger id="class-teacher">
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter((user: any) => user.role === "teacher")
                    .map((teacher: any) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="class-active" 
                checked={isClassActive}
                onCheckedChange={setIsClassActive}
              />
              <Label htmlFor="class-active">Class is Active</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreateClass}>Create Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Students dialog */}
      <Dialog open={showStudentsDialog} onOpenChange={setShowStudentsDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manage Students</DialogTitle>
          </DialogHeader>
          
          {selectedClassId && (
            <>
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">
                  {classes.find((c: any) => c.id === selectedClassId)?.name || "Class"} Students
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Manage students enrolled in this class
                </p>
              </div>
              
              {/* Students table */}
              <StudentTable
                students={allUsers.filter((user: any) => 
                  user.role === "student" && user.classId === selectedClassId
                )}
                isLoading={isLoadingUsers}
                classId={selectedClassId}
              />
              
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setShowStudentsDialog(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
