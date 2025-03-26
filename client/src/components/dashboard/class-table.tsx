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
}

const ClassTable: React.FC<ClassTableProps> = ({ 
  classes = [],
  isLoading,
  onManage
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
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cls.isLocked ? 'bg-gray-100 text-gray-800' : 'bg-success bg-opacity-10 text-success'}`}>
                  {cls.isLocked ? 'Locked' : 'Active'}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button 
                    variant="link" 
                    className="text-primary px-0 h-auto"
                    onClick={() => onManage(cls.id)}
                  >
                    Manage
                  </Button>
                  <Button 
                    variant="link" 
                    className={cls.isLocked ? "text-success px-0 h-auto" : "text-warning px-0 h-auto"}
                    onClick={() => handleToggleLock(cls.id, cls.isLocked)}
                    disabled={lockMutation.isPending}
                  >
                    {cls.isLocked ? 'Unlock' : 'Lock'}
                  </Button>
                  <Button 
                    variant="link" 
                    className="text-danger px-0 h-auto"
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
