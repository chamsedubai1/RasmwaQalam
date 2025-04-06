import React, { useState, useMemo } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  PlusCircle,
  Search,
  ArrowDownUp
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
import { ScrollArea } from "@/components/ui/scroll-area";

interface SecondaryTeacherManagementProps {
  onRefreshData?: () => void;
  schoolFilter?: number;
  isSchoolAdminView?: boolean;
}

const SecondaryTeacherManagement: React.FC<SecondaryTeacherManagementProps> = ({ 
  onRefreshData,
  schoolFilter,
  isSchoolAdminView = false
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddAssignmentDialog, setShowAddAssignmentDialog] = useState(false);
  const [showClassTeachersDialog, setShowClassTeachersDialog] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [selectedSecondaryTeacherId, setSelectedSecondaryTeacherId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("className");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Fetch all assignments, filtered by school if schoolFilter is provided
  const { 
    data: assignments = [], 
    isLoading: isLoadingAssignments,
    refetch: refetchAssignments
  } = useQuery<any[]>({
    queryKey: ['/api/secondary-teacher-assignments', schoolFilter ? `school=${schoolFilter}` : ''],
    queryFn: () => {
      const url = schoolFilter 
        ? `/api/secondary-teacher-assignments?schoolId=${schoolFilter}` 
        : '/api/secondary-teacher-assignments';
      return fetch(url).then(res => {
        if (!res.ok) throw new Error('Failed to fetch assignments');
        return res.json();
      });
    },
  });
  
  // Fetch all teachers, filtered by school if schoolFilter is provided
  const { 
    data: teachers = [], 
    isLoading: isLoadingTeachers 
  } = useQuery<any[]>({
    queryKey: ['/api/users?role=teacher', schoolFilter ? `school=${schoolFilter}` : ''],
    queryFn: () => {
      const url = schoolFilter 
        ? `/api/users?role=teacher&schoolId=${schoolFilter}` 
        : '/api/users?role=teacher';
      return fetch(url).then(res => {
        if (!res.ok) throw new Error('Failed to fetch teachers');
        return res.json();
      });
    },
  });
  
  // Fetch all secondary teachers, filtered by school if schoolFilter is provided
  const { 
    data: secondaryTeachers = [], 
    isLoading: isLoadingSecondaryTeachers 
  } = useQuery<any[]>({
    queryKey: ['/api/users?role=secondaryTeacher', schoolFilter ? `school=${schoolFilter}` : ''],
    queryFn: () => {
      const url = schoolFilter 
        ? `/api/users?role=secondaryTeacher&schoolId=${schoolFilter}` 
        : '/api/users?role=secondaryTeacher';
      return fetch(url).then(res => {
        if (!res.ok) throw new Error('Failed to fetch secondary teachers');
        return res.json();
      });
    },
  });
  
  // Fetch all classes, filtered by school if schoolFilter is provided
  const { 
    data: classes = [], 
    isLoading: isLoadingClasses,
    refetch: refetchClasses 
  } = useQuery<any[]>({
    queryKey: ['/api/classes', schoolFilter ? `school=${schoolFilter}` : ''],
    queryFn: () => {
      const url = schoolFilter 
        ? `/api/classes?schoolId=${schoolFilter}` 
        : '/api/classes';
      return fetch(url).then(res => {
        if (!res.ok) throw new Error('Failed to fetch classes');
        return res.json();
      });
    },
  });

  // Process classes to include teacher assignments
  const processedClasses = useMemo(() => {
    if (!classes.length) {
      return [];
    }
    
    // Handle cases where there might be no assignments or secondary teachers yet
    if (!assignments.length || !teachers.length || !secondaryTeachers.length) {
      return classes.map((cls: any) => {
        const primaryTeacher = teachers.find(t => t.id === cls.teacherId);
        return {
          ...cls,
          primaryTeacherName: primaryTeacher ? primaryTeacher.fullName : "Unknown Teacher",
          secondaryTeachers: []
        };
      });
    }

    return classes.map((cls: any) => {
      // Find primary teacher
      const primaryTeacher = teachers.find(t => t.id === cls.teacherId);
      
      // Find all secondary teacher assignments for this class
      const classAssignments = assignments.filter((a: any) => a.classId === cls.id);
      
      // Get secondary teacher details
      const secondaryTeachersList = classAssignments.map((assignment: any) => {
        const teacher = secondaryTeachers.find(t => t.id === assignment.secondaryTeacherId);
        return {
          id: assignment.id,
          teacherId: assignment.secondaryTeacherId,
          name: teacher ? teacher.fullName : "Unknown Teacher",
          assignmentId: assignment.id
        };
      });
      
      return {
        ...cls,
        primaryTeacherName: primaryTeacher ? primaryTeacher.fullName : "Unknown Teacher",
        secondaryTeachers: secondaryTeachersList
      };
    });
  }, [classes, assignments, teachers, secondaryTeachers]);

  // Filter and sort the classes
  const filteredClasses = useMemo(() => {
    return processedClasses
      .filter((cls: any) => {
        if (!searchQuery) return true;
        const searchLower = searchQuery.toLowerCase();
        return (
          cls.name.toLowerCase().includes(searchLower) ||
          cls.schoolName?.toLowerCase().includes(searchLower) ||
          cls.primaryTeacherName?.toLowerCase().includes(searchLower) ||
          cls.secondaryTeachers.some((t: any) => t.name.toLowerCase().includes(searchLower))
        );
      })
      .sort((a: any, b: any) => {
        let valA, valB;
        
        // Handle different sort fields
        switch (sortField) {
          case "className":
            valA = a.name || "";
            valB = b.name || "";
            break;
          case "schoolName":
            valA = a.schoolName || "";
            valB = b.schoolName || "";
            break;
          case "primaryTeacher":
            valA = a.primaryTeacherName || "";
            valB = b.primaryTeacherName || "";
            break;
          case "secondaryCount":
            valA = a.secondaryTeachers?.length || 0;
            valB = b.secondaryTeachers?.length || 0;
            break;
          default:
            valA = a[sortField] || "";
            valB = b[sortField] || "";
        }
        
        // Compare based on direction
        const comparison = typeof valA === "number" 
          ? valA - valB
          : String(valA).localeCompare(String(valB));
        
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [processedClasses, searchQuery, sortField, sortDirection]);
  
  // Create secondary teacher assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (assignmentData: any) => {
      return apiRequest('POST', '/api/secondary-teacher-assignments', assignmentData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Secondary teacher assignment created successfully",
      });
      // Reset form
      setSelectedSecondaryTeacherId("");
      // Refresh assignments list
      refetchAssignments();
      refetchClasses();
      queryClient.invalidateQueries({ 
        queryKey: ['/api/secondary-teacher-assignments', schoolFilter ? `school=${schoolFilter}` : ''] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/classes', schoolFilter ? `school=${schoolFilter}` : ''] 
      });
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
      refetchClasses();
      queryClient.invalidateQueries({ 
        queryKey: ['/api/secondary-teacher-assignments', schoolFilter ? `school=${schoolFilter}` : ''] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/classes', schoolFilter ? `school=${schoolFilter}` : ''] 
      });
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
    if (!selectedSecondaryTeacherId) {
      toast({
        title: "Missing fields",
        description: "Please select a secondary teacher",
        variant: "destructive"
      });
      return;
    }
    
    if (!selectedClass) {
      toast({
        title: "Missing class",
        description: "Please select a class first",
        variant: "destructive"
      });
      return;
    }
    
    // Check if this assignment already exists
    const existingAssignment = assignments.find(
      (a: any) => 
        a.classId === Number(selectedClassId) && 
        a.teacherId === selectedClass.teacherId &&
        a.secondaryTeacherId === Number(selectedSecondaryTeacherId)
    );
    
    if (existingAssignment) {
      toast({
        title: "Duplicate assignment",
        description: "This secondary teacher is already assigned to this class",
        variant: "destructive"
      });
      return;
    }
    
    const assignmentData = {
      teacherId: selectedClass.teacherId,
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
  
  const handleManageTeachers = (classData: any) => {
    setSelectedClass(classData);
    setSelectedClassId(classData.id.toString());
    setShowClassTeachersDialog(true);
  };
  
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Helper functions for display
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
  
  const getTeacherName = (teacherId: number) => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher ? teacher.fullName : "Unknown Teacher";
  };
  
  const getSecondaryTeacherName = (teacherId: number) => {
    const teacher = secondaryTeachers.find(t => t.id === teacherId);
    return teacher ? teacher.fullName : "Unknown Teacher";
  };

  // Sortable header component
  const SortableHeader = ({ label, field }: { label: string, field: string }) => (
    <TableHead
      className="cursor-pointer hover:bg-gray-50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        {sortField === field && (
          <ArrowDownUp className="h-3 w-3" />
        )}
      </div>
    </TableHead>
  );

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
        <div className="flex space-x-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-500" />
            <Input
              placeholder="Search classes or teachers..."
              className="pl-8 w-[240px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredClasses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No classes found. Please add classes and teachers first.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="Class Name" field="className" />
                  <SortableHeader label="School" field="schoolName" />
                  <SortableHeader label="Primary Teacher" field="primaryTeacher" />
                  <SortableHeader label="Secondary Teachers" field="secondaryCount" />
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.map((cls: any) => (
                  <TableRow key={cls.id}>
                    <TableCell>
                      <div className="font-medium">{cls.name}</div>
                    </TableCell>
                    <TableCell>{cls.schoolName}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 mr-2">
                          Primary
                        </Badge>
                        {cls.primaryTeacherName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 mr-2">
                          {cls.secondaryTeachers.length}
                        </Badge>
                        {cls.secondaryTeachers.length > 0 
                          ? `${cls.secondaryTeachers[0].name}${cls.secondaryTeachers.length > 1 ? ` +${cls.secondaryTeachers.length - 1} more` : ''}`
                          : "None"
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-purple-300 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        onClick={() => handleManageTeachers(cls)}
                      >
                        <Users className="h-3.5 w-3.5 mr-1" />
                        Manage Teachers
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
      
      {/* Manage Secondary Teachers Dialog */}
      <Dialog open={showClassTeachersDialog} onOpenChange={setShowClassTeachersDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedClass && `Manage Secondary Teachers for ${selectedClass.name}`}
            </DialogTitle>
            <DialogDescription>
              Add or remove secondary teachers assigned to this class
            </DialogDescription>
          </DialogHeader>
          
          {selectedClass && (
            <div className="space-y-6">
              {/* Class info */}
              <div className="bg-blue-50 p-4 rounded-md">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Class</p>
                    <p className="font-semibold">{selectedClass.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600 font-medium">School</p>
                    <p className="font-semibold">{selectedClass.schoolName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Primary Teacher</p>
                    <p className="font-semibold">{selectedClass.primaryTeacherName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Grade Level</p>
                    <p className="font-semibold">{selectedClass.gradeLevel}</p>
                  </div>
                </div>
              </div>
              
              {/* Current secondary teachers */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold">Current Secondary Teachers</h3>
                  <div className="flex items-center space-x-2">
                    <Select 
                      value={selectedSecondaryTeacherId} 
                      onValueChange={setSelectedSecondaryTeacherId}
                    >
                      <SelectTrigger id="secondaryTeacherSelect" className="w-[240px]">
                        <SelectValue placeholder="Select a teacher to add" />
                      </SelectTrigger>
                      <SelectContent>
                        {secondaryTeachers
                          .filter((st: any) => !selectedClass.secondaryTeachers.some((t: any) => t.teacherId === st.id))
                          .map((teacher: any) => (
                            <SelectItem key={teacher.id} value={teacher.id.toString()}>
                              {teacher.fullName}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                    <Button 
                      size="sm" 
                      onClick={handleAddAssignment}
                      disabled={!selectedSecondaryTeacherId || createAssignmentMutation.isPending}
                    >
                      {createAssignmentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlusCircle className="h-4 w-4" />
                      )}
                      <span className="ml-1">Add</span>
                    </Button>
                  </div>
                </div>
                
                {selectedClass.secondaryTeachers.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 rounded-md text-gray-500">
                    No secondary teachers assigned to this class yet
                  </div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedClass.secondaryTeachers.map((teacher: any) => (
                          <TableRow key={teacher.id}>
                            <TableCell>
                              <div className="flex items-center">
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 mr-2">
                                  Secondary
                                </Badge>
                                {teacher.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleDeleteAssignment(teacher.assignmentId)}
                                disabled={deleteAssignmentMutation.isPending}
                              >
                                {deleteAssignmentMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Trash className="h-4 w-4 mr-1" />
                                )}
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowClassTeachersDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SecondaryTeacherManagement;