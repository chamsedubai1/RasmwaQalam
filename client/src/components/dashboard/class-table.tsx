import React, { useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  
  // State for the confirmation dialog
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [classToModify, setClassToModify] = useState<{id: number, isLocked: boolean} | null>(null);

  const lockMutation = useMutation({
    mutationFn: async ({ id, isLocked }: { id: number, isLocked: boolean }) => {
      await apiRequest('PATCH', `/api/classes/${id}`, { isLocked });
      return { id, isLocked }; // Return the updated values directly
    },
    onSuccess: (updatedClass) => {
      // Immediately update the cache for this specific class
      queryClient.setQueryData(['/api/classes'], (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        
        return oldData.map(cls => 
          cls.id === updatedClass.id ? { ...cls, isLocked: updatedClass.isLocked } : cls
        );
      });
      
      // Also refetch to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      
      // Show success message with the updated status
      toast({
        title: `Class ${updatedClass.isLocked ? 'locked' : 'unlocked'} successfully`,
        description: updatedClass.isLocked 
          ? "New students will not be able to register for this class. Existing students are unaffected." 
          : "Students can now register for this class.",
      });
    },
    onError: (error: any) => {
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
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to delete class: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Function to open the confirmation dialog
  const openLockConfirmation = (id: number, currentStatus: boolean) => {
    setClassToModify({ id, isLocked: currentStatus });
    setIsConfirmOpen(true);
  };
  
  // Execute the lock toggle after confirmation
  const confirmLockToggle = () => {
    if (classToModify) {
      const newLockedStatus = !classToModify.isLocked;
      lockMutation.mutate({ 
        id: classToModify.id, 
        isLocked: newLockedStatus
      });
      
      // Close the dialog
      setIsConfirmOpen(false);
    }
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
    <div>
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {classToModify?.isLocked 
                ? "Unlock class" 
                : "Lock class"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {classToModify?.isLocked 
                ? "This will allow new students to register for this class. Existing students will not be affected." 
                : "This will prevent new students from registering for this class. Existing students will not be affected."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmLockToggle}
              className={classToModify?.isLocked 
                ? "bg-green-600 hover:bg-green-700" 
                : "bg-yellow-600 hover:bg-yellow-700"}
            >
              {classToModify?.isLocked ? "Unlock class" : "Lock class"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Class Name</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Students</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6">
                No classes found
              </TableCell>
            </TableRow>
          ) : (
            classes.map((cls: any) => (
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
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    cls.isSecondaryTeacher || cls.secondaryTeacherIds?.length > 0
                      ? "bg-purple-100 text-purple-800" 
                      : "bg-blue-100 text-blue-800"
                  }`}>
                    {cls.isSecondaryTeacher || cls.secondaryTeacherIds?.length > 0 ? "Secondary" : "Primary"}
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
                      onClick={() => openLockConfirmation(cls.id, cls.isLocked)}
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
    </div>
  );
};

export default ClassTable;
