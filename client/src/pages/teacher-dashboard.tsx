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

const TeacherDashboard: React.FC = () => {
  const { userRole } = useUserRole();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("classes");
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [showAddClassDialog, setShowAddClassDialog] = useState(false);
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  
  // Always include hooks before any early returns to avoid React errors
  
  // Mock teacher ID (in a real app, this would come from authentication)
  const teacherId = 1;
  
  // Fetch classes taught by this teacher
  const { data: classes = [], isLoading: isLoadingClasses } = useQuery({
    queryKey: [`/api/classes?teacherId=${teacherId}`],
  });
  
  // Fetch students for selected class
  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
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
  
  // Teacher role check - moved after all hooks to avoid React errors
  if (userRole !== "teacher") {
    return <Redirect to="/" />;
  }
  
  const handleManageClass = (classId: number) => {
    setSelectedClassId(classId);
    setActiveTab("students");
  };
  
  const handleAddClass = () => {
    setShowAddClassDialog(false);
    // In a real app, this would call the API to create a class
    toast({
      title: "Feature coming soon",
      description: "Class creation will be available in the next update",
    });
  };
  
  const handleAddStudent = () => {
    setShowAddStudentDialog(false);
    // In a real app, this would call the API to add a student to class
    toast({
      title: "Feature coming soon",
      description: "Student addition will be available in the next update",
    });
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
              <Input id="class-name" placeholder="Enter class name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="school-select">School</Label>
              <Select>
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
              <Select>
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
            <Button onClick={handleAddClass}>Create Class</Button>
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
              <Label htmlFor="student-email">Student Email</Label>
              <Input id="student-email" placeholder="Enter student email" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleAddStudent}>Add Student</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherDashboard;
