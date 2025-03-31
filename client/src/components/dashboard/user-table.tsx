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

interface UserTableProps {
  users: any[];
  isLoading: boolean;
  onEdit?: (user: any) => void;
}

const UserTable: React.FC<UserTableProps> = ({ 
  users = [],
  isLoading,
  onEdit
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggleUserActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number, isActive: boolean }) => {
      return apiRequest('PATCH', `/api/users/${id}`, { isActive });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User status updated",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update user: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/users/${id}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User deleted",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete user: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleToggleActive = (id: number, currentStatus: boolean) => {
    toggleUserActiveMutation.mutate({ id, isActive: !currentStatus });
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      deleteUserMutation.mutate(id);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getRoleDisplay = (role: string) => {
    const roleColors: Record<string, string> = {
      'student': 'bg-blue-100 text-blue-800 border border-blue-200',
      'teacher': 'bg-purple-100 text-purple-800 border border-purple-200',
      'admin': 'bg-red-100 text-red-800 border border-red-200'
    };
    
    return {
      color: roleColors[role] || 'bg-gray-100 text-gray-800',
      label: role.charAt(0).toUpperCase() + role.slice(1)
    };
  };

  if (isLoading) {
    return <p>Loading users...</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>School</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-6">
              No users found
            </TableCell>
          </TableRow>
        ) : (
          users.map((user) => {
            const roleDisplay = getRoleDisplay(user.role);
            
            return (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center">
                    <Avatar className="h-10 w-10 mr-4">
                      <AvatarFallback className="bg-gray-200 text-gray-500">
                        {getInitials(user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{user.fullName}</div>
                  </div>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleDisplay.color}`}>
                    {roleDisplay.label}
                  </span>
                </TableCell>
                <TableCell>{user.schoolName || "N/A"}</TableCell>
                <TableCell>{user.className || "N/A"}</TableCell>
                <TableCell>{user.gradeLevel || "N/A"}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                    {user.isActive ? 'Active' : 'Locked'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => {
                        const userData = {
                          id: user.id,
                          username: user.username,
                          fullName: user.fullName,
                          email: user.email,
                          role: user.role,
                          schoolId: user.schoolId,
                          classId: user.classId,
                          isActive: user.isActive
                        };
                        
                        if (onEdit) {
                          onEdit(userData);
                        } else {
                          // Fallback if onEdit is not provided
                          console.log("Editing user:", userData);
                          toast({
                            description: "Edit user functionality is being implemented"
                          });
                        }
                      }}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className={user.isActive 
                        ? "border-yellow-300 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50" 
                        : "border-green-300 text-green-600 hover:text-green-700 hover:bg-green-50"}
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                      disabled={toggleUserActiveMutation.isPending}
                    >
                      {user.isActive ? 'Lock' : 'Unlock'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(user.id)}
                      disabled={deleteUserMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
};

export default UserTable;
