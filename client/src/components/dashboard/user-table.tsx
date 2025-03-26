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
}

const UserTable: React.FC<UserTableProps> = ({ 
  users = [],
  isLoading
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
      'student': 'bg-primary bg-opacity-10 text-primary',
      'teacher': 'bg-secondary bg-opacity-10 text-secondary',
      'admin': 'bg-accent bg-opacity-10 text-accent'
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
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-6">
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
                <TableCell>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isActive ? 'bg-success bg-opacity-10 text-success' : 'bg-gray-100 text-gray-800'}`}>
                    {user.isActive ? 'Active' : 'Locked'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button 
                      variant="link" 
                      className="text-primary px-0 h-auto"
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="link" 
                      className={user.isActive ? "text-warning px-0 h-auto" : "text-success px-0 h-auto"}
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                      disabled={toggleUserActiveMutation.isPending}
                    >
                      {user.isActive ? 'Lock' : 'Unlock'}
                    </Button>
                    <Button 
                      variant="link" 
                      className="text-danger px-0 h-auto"
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
