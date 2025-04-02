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
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ClassTableProps {
  classes: any[];
  isLoading: boolean;
  onManage: (classId: number) => void;
  onEdit?: (classData: any) => void;
}

const ClassTable: React.FC<ClassTableProps> = ({ 
  classes = [],
  isLoading,
  onManage,
  onEdit
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const lockMutation = useMutation({
    mutationFn: async ({ id, isLocked }: { id: number, isLocked: boolean }) => {
      return apiRequest('PATCH', `/api/classes/${id}`, { isLocked });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Class status updated",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update class: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/classes/${id}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Class deleted",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete class: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleToggleLock = (id: number, currentStatus: boolean) => {
    lockMutation.mutate({ id, isLocked: !currentStatus });
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this class?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <p>Loading classes...</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Class Name</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead>Students</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {classes.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-6">
              No classes found
            </TableCell>
          </TableRow>
        ) : (
          classes.map((cls) => (
            <TableRow key={cls.id}>
              <TableCell className="font-medium">{cls.name}</TableCell>
              <TableCell>{cls.gradeLevel}</TableCell>
              <TableCell>{cls.studentCount || 0}</TableCell>
              <TableCell>
                <div className={`flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  cls.isLocked 
                    ? "bg-red-100 text-red-800" 
                    : "bg-green-100 text-green-800"
                }`}>
                  <span className={`h-2 w-2 rounded-full mr-1.5 ${
                    cls.isLocked ? "bg-red-500" : "bg-green-500"
                  }`}></span>
                  {cls.isLocked ? "Locked" : "Active"}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => onManage(cls.id)}
                  >
                    Manage
                  </Button>
                  {onEdit && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-purple-300 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                      onClick={() => onEdit(cls)}
                    >
                      Edit
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={cls.isLocked 
                      ? "border-green-300 text-green-600 hover:text-green-700 hover:bg-green-50" 
                      : "border-yellow-300 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"}
                    onClick={() => handleToggleLock(cls.id, cls.isLocked)}
                    disabled={lockMutation.isPending}
                  >
                    {cls.isLocked ? 'Unlock' : 'Lock'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(cls.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
};

export default ClassTable;
