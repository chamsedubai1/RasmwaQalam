import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Lock, Unlock, Trash, UserX, X, Database, FileText } from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface StudentTableProps {
  students: any[];
  isLoading: boolean;
  classId?: number;
}

const StudentTable: React.FC<StudentTableProps> = ({ 
  students = [],
  isLoading,
  classId
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStudent, setSelectedStudent] = React.useState<any | null>(null);
  const [showStudentDetails, setShowStudentDetails] = React.useState(false);
  const [showConfirmRemove, setShowConfirmRemove] = React.useState(false);

  // Student account mutations
  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: number) => {
      return apiRequest('PATCH', `/api/users/${studentId}`, { classId: null });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Student removed from class",
      });
      // Invalidate both general users endpoint and the specific class students endpoint
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      if (classId) {
        queryClient.invalidateQueries({ queryKey: [`/api/users?classId=${classId}`] });
      }
      setShowConfirmRemove(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to remove student: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const toggleStudentStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return apiRequest('PATCH', `/api/users/${id}`, { isActive });
    },
    onSuccess: (_, variables) => {
      const statusText = variables.isActive ? "activated" : "suspended";
      toast({
        title: "Success",
        description: `Student ${statusText} successfully`,
      });
      // Invalidate both general users endpoint and the specific class students endpoint
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      if (classId) {
        queryClient.invalidateQueries({ queryKey: [`/api/users?classId=${classId}`] });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update student status: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleViewDetails = (student: any) => {
    setSelectedStudent(student);
    setShowStudentDetails(true);
  };

  const handleToggleStatus = (student: any) => {
    toggleStudentStatusMutation.mutate({
      id: student.id,
      isActive: !student.isActive
    });
  };

  const handleRemoveConfirm = (student: any) => {
    setSelectedStudent(student);
    setShowConfirmRemove(true);
  };

  const handleRemoveStudent = () => {
    if (selectedStudent) {
      removeStudentMutation.mutate(selectedStudent.id);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoading) {
    return <p>Loading students...</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Student ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Active Events</TableHead>
            <TableHead>Submissions</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6">
                No students found
              </TableCell>
            </TableRow>
          ) : (
            students.map((student) => (
              <TableRow key={student.id}>
                <TableCell>
                  <div className="flex items-center">
                    <Avatar className="h-10 w-10 mr-4">
                      <AvatarFallback className="bg-gray-200 text-gray-500">
                        {getInitials(student.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{student.fullName}</div>
                      <div className="text-sm text-gray-500">{student.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{student.id}</TableCell>
                <TableCell>
                  <div className={`flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    student.isActive 
                      ? "bg-green-100 text-green-800" 
                      : "bg-red-100 text-red-800"
                  }`}>
                    <span className={`h-2 w-2 rounded-full mr-1.5 ${
                      student.isActive ? "bg-green-500" : "bg-red-500"
                    }`}></span>
                    {student.isActive ? "Active" : "Suspended"}
                  </div>
                </TableCell>
                <TableCell>{student.activeEvents || 0}</TableCell>
                <TableCell>{student.submissions || 0}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => handleViewDetails(student)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      className={student.isActive 
                        ? "border-yellow-300 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                        : "border-green-300 text-green-600 hover:text-green-700 hover:bg-green-50"}
                      onClick={() => handleToggleStatus(student)}
                      disabled={toggleStudentStatusMutation.isPending}
                    >
                      {student.isActive 
                        ? <><Lock className="h-4 w-4 mr-1" />Suspend</>
                        : <><Unlock className="h-4 w-4 mr-1" />Activate</>}
                    </Button>
                    
                    {classId && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveConfirm(student)}
                        disabled={removeStudentMutation.isPending}
                      >
                        <UserX className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Student Details Dialog */}
      <Dialog open={showStudentDetails} onOpenChange={setShowStudentDetails}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-gray-200 text-gray-700 text-xl">
                    {getInitials(selectedStudent.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-medium">{selectedStudent.fullName}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedStudent.role} - {selectedStudent.isActive ? 'Active' : 'Suspended'}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Username</p>
                  <p>{selectedStudent.username}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p>{selectedStudent.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">School ID</p>
                  <p>{selectedStudent.schoolId || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Grade Level</p>
                  <p>{selectedStudent.gradeLevel || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Class ID</p>
                  <p>{selectedStudent.classId || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Student ID</p>
                  <p>{selectedStudent.id}</p>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-500">Activity</p>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="bg-blue-50 p-3 rounded-md">
                    <p className="text-2xl font-semibold text-blue-600">{selectedStudent.activeEvents || 0}</p>
                    <p className="text-sm text-blue-600">Active Events</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-md">
                    <p className="text-2xl font-semibold text-green-600">{selectedStudent.submissions || 0}</p>
                    <p className="text-sm text-green-600">Submissions</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStudentDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Dialog */}
      <Dialog open={showConfirmRemove} onOpenChange={setShowConfirmRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Student</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="py-4">
              <p>
                Are you sure you want to remove <span className="font-medium">{selectedStudent.fullName}</span> from this class?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This will not delete the student account, but will unassign them from this class.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmRemove(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRemoveStudent}
              disabled={removeStudentMutation.isPending}
            >
              {removeStudentMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentTable;
