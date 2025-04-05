import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  UserPlus, 
  UserMinus, 
  Loader2, 
  AlignJustify, 
  School, 
  User, 
  Users, 
  Trash, 
  CheckCircle2, 
  PlusCircle
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface SecondaryTeacherManagementProps {
  onRefreshData?: () => void;
}

const SecondaryTeacherManagement: React.FC<SecondaryTeacherManagementProps> = ({ onRefreshData }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddAssignmentDialog, setShowAddAssignmentDialog] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [selectedSecondaryTeacherId, setSelectedSecondaryTeacherId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  
  // Fetch all assignments
  const { 
    data: assignments = [], 
    isLoading: isLoadingAssignments,
    refetch: refetchAssignments
  } = useQuery<any[]>({
    queryKey: ['/api/secondary-teacher-assignments'],
  });
  
  // Fetch all teachers
  const { 
    data: teachers = [], 
    isLoading: isLoadingTeachers 
  } = useQuery<any[]>({
    queryKey: ['/api/users?role=teacher'],
  });
  
  // Fetch all secondary teachers
  const { 
    data: secondaryTeachers = [], 
    isLoading: isLoadingSecondaryTeachers 
  } = useQuery<any[]>({
    queryKey: ['/api/users?role=secondaryTeacher'],
  });
  
  // Fetch all classes
  const { 
    data: classes = [], 
    isLoading: isLoadingClasses 
  } = useQuery<any[]>({
    queryKey: ['/api/classes'],
  });
  
  // Create secondary teacher assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (assignmentData: any) => {
      return apiRequest('POST', '/api/secondary-teacher-assignments', assignmentData);
    },
    onSuccess: () => {
      setShowAddAssignmentDialog(false);
      toast({
        title: "Success",
        description: "Secondary teacher assignment created successfully",
      });
      // Reset form
      setSelectedTeacherId("");
      setSelectedSecondaryTeacherId("");
      setSelectedClassId("");
      // Refresh assignments list
      refetchAssignments();
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      if (onRefreshData) {
        onRefreshData();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to create assignment: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Delete secondary teacher assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      return apiRequest('DELETE', `/api/secondary-teacher-assignments/${assignmentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Secondary teacher assignment removed successfully",
      });
      // Refresh assignments list
      refetchAssignments();
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      if (onRefreshData) {
        onRefreshData();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to remove assignment: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  const handleAddAssignment = () => {
    if (!selectedTeacherId || !selectedSecondaryTeacherId || !selectedClassId) {
      toast({
        title: "Missing fields",
        description: "Please fill out all required fields",
        variant: "destructive"
      });
      return;
    }
    
    const assignmentData = {
      teacherId: Number(selectedTeacherId),
      secondaryTeacherId: Number(selectedSecondaryTeacherId),
      classId: Number(selectedClassId),
    };
    
    createAssignmentMutation.mutate(assignmentData);
  };
  
  const handleDeleteAssignment = (assignmentId: number) => {
    if (window.confirm("Are you sure you want to remove this assignment? This action cannot be undone.")) {
      deleteAssignmentMutation.mutate(assignmentId);
    }
  };
  
  // Find class and teacher names for display
  const getTeacherName = (teacherId: number) => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher ? teacher.fullName : "Unknown Teacher";
  };
  
  const getSecondaryTeacherName = (teacherId: number) => {
    const teacher = secondaryTeachers.find(t => t.id === teacherId);
    return teacher ? teacher.fullName : "Unknown Teacher";
  };
  
  const getClassName = (classId: number) => {
    const cls = classes.find(c => c.id === classId);
    return cls ? cls.name : "Unknown Class";
  };
  
  const getSchoolName = (classId: number) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return "Unknown School";
    
    const school = cls.schoolName || "Unknown School";
    return school;
  };

  if (isLoadingAssignments || isLoadingTeachers || isLoadingSecondaryTeachers || isLoadingClasses) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Secondary Teacher Assignments</CardTitle>
        <Button onClick={() => setShowAddAssignmentDialog(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add New Assignment
        </Button>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No secondary teacher assignments found. Click the button above to add one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Primary Teacher</TableHead>
                <TableHead>Secondary Teacher</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment: any) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div className="font-medium">{getClassName(assignment.classId)}</div>
                  </TableCell>
                  <TableCell>{getSchoolName(assignment.classId)}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 mr-2">
                        Primary
                      </Badge>
                      {getTeacherName(assignment.teacherId)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 mr-2">
                        Secondary
                      </Badge>
                      {getSecondaryTeacherName(assignment.secondaryTeacherId)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDeleteAssignment(assignment.id)}
                    >
                      <Trash className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      
      {/* Add Assignment Dialog */}
      <Dialog open={showAddAssignmentDialog} onOpenChange={setShowAddAssignmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Secondary Teacher Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="classSelect">Select Class</Label>
              <Select 
                value={selectedClassId} 
                onValueChange={setSelectedClassId}
              >
                <SelectTrigger id="classSelect">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id.toString()}>
                      {cls.name} ({cls.schoolName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacherSelect">Primary Teacher</Label>
              <Select 
                value={selectedTeacherId} 
                onValueChange={setSelectedTeacherId}
              >
                <SelectTrigger id="teacherSelect">
                  <SelectValue placeholder="Select primary teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher: any) => (
                    <SelectItem key={teacher.id} value={teacher.id.toString()}>
                      {teacher.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondaryTeacherSelect">Secondary Teacher</Label>
              <Select 
                value={selectedSecondaryTeacherId} 
                onValueChange={setSelectedSecondaryTeacherId}
              >
                <SelectTrigger id="secondaryTeacherSelect">
                  <SelectValue placeholder="Select secondary teacher" />
                </SelectTrigger>
                <SelectContent>
                  {secondaryTeachers.map((teacher: any) => (
                    <SelectItem key={teacher.id} value={teacher.id.toString()}>
                      {teacher.fullName}
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
            <Button onClick={handleAddAssignment} disabled={createAssignmentMutation.isPending}>
              {createAssignmentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Assign Teacher
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SecondaryTeacherManagement;