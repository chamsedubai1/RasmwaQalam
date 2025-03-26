import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ClassTable from "@/components/dashboard/class-table";
import StudentTable from "@/components/dashboard/student-table";
import EventTable from "@/components/dashboard/event-table";
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
  Plus
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
  
  // We'd typically get this from the authentication context in a real app
  const teacherId = 4; // Using the ID of the teacher we created earlier
  
  // Fetch classes taught by this teacher
  const { data: classes = [], isLoading: isLoadingClasses, refetch: refetchClasses } = useQuery({
    queryKey: [`/api/classes?teacherId=${teacherId}`],
  });
  
  // Fetch students for selected class
  const { data: students = [], isLoading: isLoadingStudents, refetch: refetchStudents } = useQuery({
    queryKey: selectedClassId ? [`/api/users?classId=${selectedClassId}`] : [`/api/users`],
    enabled: !!selectedClassId,
  });
  
  // Fetch open events
  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['/api/events?status=open'],
  });
  
  // Fetch schools for dropdown
  const { data: schools = [], isLoading: isLoadingSchools } = useQuery({
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
  if (userRole !== "teacher") {
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
    
    const userData = {
      username: studentUsername,
      password: studentPassword,
      email: studentEmail,
      fullName: studentFullName,
      role: "student",
      schoolId: Number(classes.find((c: any) => c.id === selectedClassId)?.schoolId),
      classId: selectedClassId,
      gradeLevel: classes.find((c: any) => c.id === selectedClassId)?.gradeLevel,
      isActive: true
    };
    
    addStudentMutation.mutate(userData);
  };
  
  return (
    <div>
      <h1 className="text-3xl font-bold font-heading text-gray-800 mb-6">Teacher Dashboard</h1>
      
      <Tabs defaultValue="classes" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-8 w-full border-b border-gray-200">
          <TabsTrigger value="classes" className="flex-1">My Classes</TabsTrigger>
          <TabsTrigger value="students" className="flex-1">Student Submissions</TabsTrigger>
          <TabsTrigger value="events" className="flex-1">Events</TabsTrigger>
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
                classes={classes} 
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
                  ? `Students in ${classes.find((c: any) => c.id === selectedClassId)?.name || 'Class'}`
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
                  students={students} 
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
        
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Open Events</CardTitle>
            </CardHeader>
            <CardContent>
              <EventTable 
                events={events} 
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
