import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/use-user-role";
import { useUser } from "@/hooks/use-user";
import { Redirect } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ClassTable from "@/components/dashboard/class-table";
import StudentTable from "@/components/dashboard/student-table";
import EventTable from "@/components/dashboard/event-table";
import SubmissionValidationTable from "@/components/dashboard/submission-validation-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Edit, 
  Trash, 
  Lock, 
  Unlock,
  Plus,
  GraduationCap,
  School,
  Users,
  BookOpen,
  CalendarDays,
  ClipboardList,
  BarChart,
  Award,
  FileText,
  ClipboardCheck
} from "lucide-react";

const TeacherDashboard: React.FC = () => {
  const { userRole } = useUserRole();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("classes");
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [showAddClassDialog, setShowAddClassDialog] = useState(false);
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [showEditClassDialog, setShowEditClassDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  
  // Form state for adding a class
  const [className, setClassName] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedGradeLevel, setSelectedGradeLevel] = useState("");
  
  // Form state for adding a student
  const [studentEmail, setStudentEmail] = useState("");
  const [studentFullName, setStudentFullName] = useState("");
  const [studentUsername, setStudentUsername] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  
  // Get current user data from context
  const { user } = useUser();
  
  // Use the logged-in teacher's ID from context
  const teacherId = user?.id || null;
  
  // Debug log for troubleshooting
  console.log("Current teacher ID:", teacherId);
  console.log("Current user data:", user);
  
  // Fetch the most up-to-date user data from server
  const { data: currentUserFromApi, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/user'],
    staleTime: 0, // Make sure we always get the latest user data
    retry: 3,     // Retry failed requests
    // Only enable this query if we have authentication token
    enabled: !!localStorage.getItem('authToken'),
  });
  
  // Debug output for teacher data from API
  console.log("Current teacher data from API:", currentUserFromApi);
  
  // Fetch classes based on teacher role
  const { data: classes = [], isLoading: isLoadingClasses, refetch: refetchClasses } = useQuery<any[]>({
    queryKey: [userRole === "teacher" 
      ? `/api/classes?teacherId=${teacherId}` 
      : `/api/classes?secondaryTeacherId=${teacherId}`
    ],
    enabled: !!teacherId,
  });
  
  // Get the first class if available (teacher can only have one class)
  const teacherClassId = classes && classes.length > 0 ? classes[0].id : null;
  
  // Use the teacherClassId as the selectedClassId if not already set
  React.useEffect(() => {
    if (teacherClassId && !selectedClassId) {
      setSelectedClassId(teacherClassId);
    }
  }, [teacherClassId, selectedClassId]);
  
  // Fetch students for the teacher's class only
  const { data: students = [], isLoading: isLoadingStudents, refetch: refetchStudents } = useQuery<any[]>({
    queryKey: [`/api/users?classId=${teacherClassId}`],
    enabled: !!teacherClassId,
  });
  
  // Fetch open events
  const { data: events = [], isLoading: isLoadingEvents } = useQuery<any[]>({
    queryKey: ['/api/events?status=open'],
  });
  
  // Fetch schools for dropdown
  const { data: schools = [], isLoading: isLoadingSchools } = useQuery<any[]>({
    queryKey: ['/api/schools'],
  });
  
  // Add class mutation
  const createClassMutation = useMutation({
    mutationFn: async (classData: any) => {
      return apiRequest('POST', '/api/classes', classData);
    },
    onSuccess: () => {
      setShowAddClassDialog(false);
      toast({
        title: "Success",
        description: "Class created successfully",
      });
      // Reset form
      setClassName("");
      setSelectedSchoolId("");
      setSelectedGradeLevel("");
      // Refresh classes list
      refetchClasses();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to create class: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Update class mutation
  const updateClassMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest('PATCH', `/api/classes/${id}`, data);
    },
    onSuccess: () => {
      setShowEditClassDialog(false);
      toast({
        title: "Success",
        description: "Class updated successfully",
      });
      // Reset form
      setEditingClass(null);
      // Refresh classes list
      refetchClasses();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update class: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Delete class mutation
  const deleteClassMutation = useMutation({
    mutationFn: async (classId: number) => {
      await apiRequest('DELETE', `/api/classes/${classId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Class deleted successfully",
      });
      // Refresh classes list
      refetchClasses();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to delete class: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Add student mutation
  const addStudentMutation = useMutation({
    mutationFn: async (userData: any) => {
      return apiRequest('POST', '/api/users', userData);
    },
    onSuccess: () => {
      setShowAddStudentDialog(false);
      toast({
        title: "Success",
        description: "Student added to class successfully",
      });
      // Reset form
      setStudentEmail("");
      setStudentFullName("");
      setStudentUsername("");
      setStudentPassword("");
      // Refresh students list
      refetchStudents();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to add student: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Teacher role check - moved after all hooks to avoid React errors
  if (userRole !== "teacher" && userRole !== "secondaryTeacher") {
    return <Redirect to="/" />;
  }
  
  const handleManageClass = (classId: number) => {
    setSelectedClassId(classId);
    setActiveTab("students");
  };
  
  const handleEditClass = (classData: any) => {
    setEditingClass(classData);
    setClassName(classData.name);
    setSelectedSchoolId(classData.schoolId.toString());
    setSelectedGradeLevel(classData.gradeLevel);
    setShowEditClassDialog(true);
  };
  
  const handleDeleteClass = (classId: number) => {
    if (window.confirm("Are you sure you want to delete this class? This action cannot be undone.")) {
      deleteClassMutation.mutate(classId);
    }
  };
  
  const handleAddClass = () => {
    if (!className || !selectedSchoolId || !selectedGradeLevel) {
      toast({
        title: "Missing fields",
        description: "Please fill out all required fields",
        variant: "destructive"
      });
      return;
    }
    
    const classData = {
      name: className,
      schoolId: Number(selectedSchoolId),
      gradeLevel: selectedGradeLevel,
      teacherId: teacherId,
      isLocked: false
    };
    
    createClassMutation.mutate(classData);
  };
  
  const handleUpdateClass = () => {
    if (!className || !selectedSchoolId || !selectedGradeLevel) {
      toast({
        title: "Missing fields",
        description: "Please fill out all required fields",
        variant: "destructive"
      });
      return;
    }
    
    const classData = {
      name: className,
      schoolId: Number(selectedSchoolId),
      gradeLevel: selectedGradeLevel
    };
    
    updateClassMutation.mutate({ id: editingClass.id, data: classData });
  };
  
  const handleToggleClassLock = (classId: number, isLocked: boolean) => {
    updateClassMutation.mutate({ 
      id: classId, 
      data: { isLocked: !isLocked } 
    });
  };
  
  const handleAddStudent = () => {
    if (!studentUsername || !studentPassword || !studentEmail || !studentFullName) {
      toast({
        title: "Missing fields",
        description: "Please fill out all required fields",
        variant: "destructive"
      });
      return;
    }
    
    if (!teacherClassId) {
      toast({
        title: "No class assigned",
        description: "You must have a class assigned to add students",
        variant: "destructive"
      });
      return;
    }
    
    const classData = classes[0]; // Teacher should only have one class
    
    const userData = {
      username: studentUsername,
      password: studentPassword,
      email: studentEmail,
      fullName: studentFullName,
      role: "student",
      schoolId: Number(classData.schoolId),
      classId: teacherClassId,
      gradeLevel: classData.gradeLevel,
      isActive: true
    };
    
    addStudentMutation.mutate(userData);
  };
  
  // Fetch submissions for the teacher's class
  const { data: submissions = [], isLoading: isLoadingSubmissions } = useQuery<any[]>({
    queryKey: [`/api/submissions?classId=${teacherClassId}`],
    enabled: !!teacherClassId,
  });
  
  // Calculate summary metrics
  const totalClasses = (classes as any[]).length;
  const totalStudents = (students as any[]).length;
  const activeEvents = (events as any[]).length;
  const totalSubmissions = (submissions as any[]).length;
  
  return (
    <div>
      {/* Header Section */}
      <div className="relative rounded-xl overflow-hidden mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-90"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJ3aGl0ZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMiIvPjwvZz48L3N2Zz4=')] opacity-10"></div>
        <div className="relative z-10 py-8 px-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold font-heading mb-2">Teacher Dashboard</h1>
              <p className="text-blue-100">Manage your classes, students, and review submissions</p>
            </div>
            <div className="hidden md:block">
              <GraduationCap className="h-16 w-16 text-white/30" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
              <School className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">Classes</p>
              <p className="text-2xl font-bold">{totalClasses}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100 hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center">
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center mr-4">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-indigo-600 font-medium">Students</p>
              <p className="text-2xl font-bold">{totalStudents}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center">
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mr-4">
              <CalendarDays className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-600 font-medium">Events</p>
              <p className="text-2xl font-bold">{activeEvents}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
              <ClipboardCheck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600 font-medium">Submissions</p>
              <p className="text-2xl font-bold">{totalSubmissions}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="classes" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white p-1 border rounded-lg shadow-sm">
          <TabsTrigger value="classes" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <School className="h-4 w-4" />
            <span>My Classes</span>
          </TabsTrigger>
          <TabsTrigger value="students" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <Users className="h-4 w-4" />
            <span>Students</span>
          </TabsTrigger>
          <TabsTrigger value="submissions" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <ClipboardCheck className="h-4 w-4" />
            <span>Submissions</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <CalendarDays className="h-4 w-4" />
            <span>Events</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="classes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My Classes</CardTitle>
              <Button onClick={() => setShowAddClassDialog(true)}>
                Add New Class
              </Button>
            </CardHeader>
            <CardContent>
              <ClassTable 
                classes={classes as any[]} 
                isLoading={isLoadingClasses}
                onManage={handleManageClass}
                onEdit={handleEditClass}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="students">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {selectedClassId 
                  ? `Students in ${(classes as any[]).find((c: any) => c.id === selectedClassId)?.name || 'Class'}`
                  : "Students"
                }
              </CardTitle>
              {selectedClassId && (
                <Button onClick={() => setShowAddStudentDialog(true)}>
                  Add New Student
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {selectedClassId ? (
                <StudentTable 
                  students={students as any[]} 
                  isLoading={isLoadingStudents}
                  classId={selectedClassId}
                />
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">Please select a class to manage students.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedClassId 
                  ? `Submission Validation for ${(classes as any[]).find((c: any) => c.id === selectedClassId)?.name || 'Class'}`
                  : "Submission Validation"
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedClassId ? (
                <SubmissionValidationTable classId={selectedClassId} />
              ) : (
                <div className="text-center py-8 bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground">Please select a class to manage submissions.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Open Events</CardTitle>
            </CardHeader>
            <CardContent>
              <EventTable 
                events={events as any[]} 
                isLoading={isLoadingEvents}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Add Class Dialog */}
      <Dialog open={showAddClassDialog} onOpenChange={setShowAddClassDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Class</DialogTitle>
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
            <div className="grid gap-2">
              <Label htmlFor="school-select">School</Label>
              <Select 
                value={selectedSchoolId} 
                onValueChange={setSelectedSchoolId}
              >
                <SelectTrigger id="school-select">
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
              <Label htmlFor="grade-level">Grade Level</Label>
              <Select 
                value={selectedGradeLevel} 
                onValueChange={setSelectedGradeLevel}
              >
                <SelectTrigger id="grade-level">
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
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleAddClass}
              disabled={createClassMutation.isPending}
            >
              {createClassMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Class"
              )}
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
            <div className="grid gap-2">
              <Label htmlFor="edit-school-select">School</Label>
              <Select 
                value={selectedSchoolId} 
                onValueChange={setSelectedSchoolId}
              >
                <SelectTrigger id="edit-school-select">
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
              <Label htmlFor="edit-grade-level">Grade Level</Label>
              <Select 
                value={selectedGradeLevel} 
                onValueChange={setSelectedGradeLevel}
              >
                <SelectTrigger id="edit-grade-level">
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
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleUpdateClass}
              disabled={updateClassMutation.isPending}
            >
              {updateClassMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Class"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Student Dialog */}
      <Dialog open={showAddStudentDialog} onOpenChange={setShowAddStudentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Student to Class</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="student-username">Username</Label>
              <Input 
                id="student-username" 
                placeholder="Enter username"
                value={studentUsername}
                onChange={(e) => setStudentUsername(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="student-password">Password</Label>
              <Input 
                id="student-password" 
                type="password"
                placeholder="Enter password"
                value={studentPassword}
                onChange={(e) => setStudentPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="student-fullname">Full Name</Label>
              <Input 
                id="student-fullname" 
                placeholder="Enter full name"
                value={studentFullName}
                onChange={(e) => setStudentFullName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="student-email">Email</Label>
              <Input 
                id="student-email" 
                placeholder="Enter email address"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleAddStudent}
              disabled={addStudentMutation.isPending}
            >
              {addStudentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Student...
                </>
              ) : (
                "Add Student"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherDashboard;
