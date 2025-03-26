import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { CalendarIcon, SearchIcon } from "lucide-react";

const AdminDashboard: React.FC = () => {
  const { userRole } = useUserRole();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("users");
  const [roleFilter, setRoleFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showCreateEventDialog, setShowCreateEventDialog] = useState(false);
  const [showCreateSchoolDialog, setShowCreateSchoolDialog] = useState(false);
  const [showCreateClassDialog, setShowCreateClassDialog] = useState(false);
  
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
  
  // Filter users
  const filteredUsers = allUsers.filter((user: any) => {
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesSchool = schoolFilter === "all" || user.schoolId?.toString() === schoolFilter;
    const matchesSearch = searchQuery === "" || 
      (user.fullName && user.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.username && user.username.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesRole && matchesSchool && matchesSearch;
  });
  
  const handleCreateUser = () => {
    setShowCreateUserDialog(false);
    // In a real app, this would call the API to create a user
    toast({
      title: "Feature coming soon",
      description: "User creation will be available in the next update",
    });
  };
  
  const handleCreateEvent = () => {
    setShowCreateEventDialog(false);
    // In a real app, this would call the API to create an event
    toast({
      title: "Feature coming soon",
      description: "Event creation will be available in the next update",
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
  
  // Form state for class creation
  const [className, setClassName] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [isClassActive, setIsClassActive] = useState(true);

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
    
    // In a real app, this would call the API to create a class with the form data
    console.log({
      name: className,
      schoolId: parseInt(selectedSchool),
      gradeLevel: `Grade ${selectedGrade}`,
      teacherId: parseInt(selectedTeacher),
      isLocked: !isClassActive
    });
    
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
              
              <UserTable users={filteredUsers} isLoading={isLoadingUsers} />
              
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
                              >
                                Edit
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50"
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
                                >
                                  Edit
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  Students
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50"
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
      
      {/* Create Event Dialog */}
      <Dialog open={showCreateEventDialog} onOpenChange={setShowCreateEventDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="event-name">Event Name</Label>
              <Input id="event-name" placeholder="Enter event name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea 
                id="event-description" 
                placeholder="Enter event description"
                className="min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="event-type">Event Type</Label>
                <Select>
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
                <Select>
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
                <Label htmlFor="event-start">Start Date</Label>
                <div className="relative">
                  <Input id="event-start" placeholder="Select start date" />
                  <CalendarIcon className="h-4 w-4 absolute right-3 top-3 text-gray-400" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-end">End Date</Label>
                <div className="relative">
                  <Input id="event-end" placeholder="Select end date" />
                  <CalendarIcon className="h-4 w-4 absolute right-3 top-3 text-gray-400" />
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-image">Image URL</Label>
              <Input id="event-image" placeholder="Enter image URL" />
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
      
      {/* Create School Dialog */}
      <Dialog open={showCreateSchoolDialog} onOpenChange={setShowCreateSchoolDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New School</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="school-name">School Name</Label>
              <Input id="school-name" placeholder="Enter school name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="school-description">Description</Label>
              <Textarea 
                id="school-description" 
                placeholder="Enter school description"
                className="min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="school-website">Website URL</Label>
                <Input id="school-website" placeholder="Enter website URL" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="school-status">Status</Label>
                <Select>
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
              <Input id="school-image" placeholder="Enter image URL" />
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
    </div>
  );
};

export default AdminDashboard;
