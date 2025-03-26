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

  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: number) => {
      return apiRequest('PATCH', `/api/users/${studentId}`, { classId: null });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Student removed from class",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to remove student: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleRemoveStudent = (studentId: number) => {
    if (window.confirm("Are you sure you want to remove this student from the class?")) {
      removeStudentMutation.mutate(studentId);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoading) {
    return <p>Loading students...</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Student ID</TableHead>
          <TableHead>Active Events</TableHead>
          <TableHead>Submissions</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-6">
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
              <TableCell>{student.activeEvents || 0}</TableCell>
              <TableCell>{student.submissions || 0}</TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button 
                    variant="link" 
                    className="text-primary px-0 h-auto"
                    onClick={() => {
                      toast({
                        description: "Student details view coming soon!"
                      });
                    }}
                  >
                    View Details
                  </Button>
                  {classId && (
                    <Button 
                      variant="link" 
                      className="text-danger px-0 h-auto"
                      onClick={() => handleRemoveStudent(student.id)}
                      disabled={removeStudentMutation.isPending}
                    >
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
  );
};

export default StudentTable;
