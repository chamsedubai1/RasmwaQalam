import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, Form } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Pencil, Plus, Search, Users } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';

export interface UsersTableProps {
  schoolFilter?: number;
  classFilter?: number;
  roleFilter?: string;
  isSchoolAdminView?: boolean;
}

export default function UsersTable({
  schoolFilter,
  classFilter,
  roleFilter,
  isSchoolAdminView = false
}: UsersTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Build the query parameters based on filters
  const buildQueryString = () => {
    const params = new URLSearchParams();
    
    if (schoolFilter) params.append('schoolId', schoolFilter.toString());
    if (classFilter) params.append('classId', classFilter.toString());
    if (roleFilter) params.append('role', roleFilter);
    
    return params.toString();
  };

  // Fetch users based on filters
  const {
    data: users,
    isLoading,
    error
  } = useQuery({
    queryKey: ['/api/users', buildQueryString()],
    queryFn: async () => {
      try {
        const queryString = buildQueryString();
        const endpoint = queryString ? `/api/users?${queryString}` : '/api/users';
        const response = await apiRequest('GET', endpoint);
        
        // Safe parsing of response
        try {
          return await response.json();
        } catch (jsonError) {
          // If there's an error parsing JSON, try to get the response text
          console.error("Error parsing JSON response:", jsonError);
          
          // If schoolFilter is provided, fall back to manual filtering
          if (schoolFilter) {
            console.log("Fetching teachers manually...");
            // Get all users and filter in the client
            const allUsersResponse = await apiRequest('GET', '/api/users');
            const allUsers = await allUsersResponse.json();
            console.log("Fetched teachers manually:", allUsers);
            return allUsers.filter((user: any) => user.schoolId === schoolFilter);
          }
          
          // Return empty array if all else fails
          return [];
        }
      } catch (error) {
        console.error("Error fetching users:", error);
        throw new Error("Failed to fetch users. Please try again.");
      }
    }
  });

  // Fetch schools for dropdown
  const { data: schools } = useQuery({
    queryKey: ['/api/schools'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/schools');
        return await response.json();
      } catch (error) {
        console.error("Error fetching schools:", error);
        return [];
      }
    }
  });

  // Fetch classes for dropdown
  const { data: classes } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/classes');
        return await response.json();
      } catch (error) {
        console.error("Error fetching classes:", error);
        return [];
      }
    }
  });

  // Filter classes by selected school in form
  const [filteredClasses, setFilteredClasses] = useState<any[]>([]);
  
  // Filter classes based on selected school
  const getFilteredClasses = (schoolId: number | null) => {
    if (!classes) return [];
    if (!schoolId) return classes;
    return classes.filter((cls: any) => cls.schoolId === schoolId);
  };

  // Define the user form schema
  const userFormSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    fullName: z.string().min(2, 'Full name is required'),
    email: z.string().email('Invalid email address'),
    role: z.enum(['student', 'teacher', 'secondaryTeacher', 'admin', 'schoolAdmin']),
    schoolId: z.number().nullable(),
    classId: z.number().nullable(),
    isActive: z.boolean().default(true)
  });

  // Create form for adding a new user
  const addForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: '',
      password: '',
      fullName: '',
      email: '',
      role: 'student',
      schoolId: schoolFilter || null,
      classId: null,
      isActive: true
    }
  });

  // Create form for editing a user
  const editForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: '',
      password: '',
      fullName: '',
      email: '',
      role: 'student',
      schoolId: null,
      classId: null,
      isActive: true
    }
  });

  // Update filtered classes when school changes in add form
  useEffect(() => {
    const subscription = addForm.watch((value, { name }) => {
      if (name === 'schoolId' && value.schoolId) {
        setFilteredClasses(getFilteredClasses(Number(value.schoolId)));
      }
    });
    return () => subscription.unsubscribe();
  }, [addForm, classes]);

  // Update filtered classes when school changes in edit form
  useEffect(() => {
    const subscription = editForm.watch((value, { name }) => {
      if (name === 'schoolId' && value.schoolId) {
        setFilteredClasses(getFilteredClasses(Number(value.schoolId)));
      }
    });
    return () => subscription.unsubscribe();
  }, [editForm, classes]);

  // Mutation to add a new user
  const addUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userFormSchema>) => {
      const response = await apiRequest('POST', '/api/users', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowAddDialog(false);
      addForm.reset();
      toast({
        title: 'Success',
        description: 'User has been created successfully',
        variant: 'default'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive'
      });
    }
  });

  // Mutation to update an existing user
  const updateUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...updateData } = data;
      const response = await apiRequest('PATCH', `/api/users/${id}`, updateData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowEditDialog(false);
      editForm.reset();
      toast({
        title: 'Success',
        description: 'User has been updated successfully',
        variant: 'default'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive'
      });
    }
  });

  // Filter users by search term
  const filteredUsers = users ? users.filter((user: any) => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return (
      user.username.toLowerCase().includes(lowerCaseSearchTerm) ||
      user.fullName.toLowerCase().includes(lowerCaseSearchTerm) ||
      user.email.toLowerCase().includes(lowerCaseSearchTerm) ||
      (user.schoolName && user.schoolName.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (user.className && user.className.toLowerCase().includes(lowerCaseSearchTerm))
    );
  }) : [];

  // Handle edit button click
  const handleEditUser = (user: any) => {
    setEditingUser(user);
    
    // Populate filtered classes for the edit form
    if (user.schoolId) {
      setFilteredClasses(getFilteredClasses(user.schoolId));
    }
    
    // Reset form and populate with user data
    editForm.reset({
      username: user.username,
      password: '', // Don't show current password
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      classId: user.classId,
      isActive: user.isActive
    });
    
    setShowEditDialog(true);
  };

  // Handle add form submission
  const onAddSubmit = (data: z.infer<typeof userFormSchema>) => {
    addUserMutation.mutate(data);
  };

  // Handle edit form submission
  const onEditSubmit = (data: z.infer<typeof userFormSchema>) => {
    if (!editingUser) return;
    
    // Only send password if it's been changed
    const updateData = {
      ...data,
      id: editingUser.id
    };
    
    // If password is empty, remove it from the update data
    if (!data.password) {
      delete updateData.password;
    }
    
    updateUserMutation.mutate(updateData);
  };

  // Determine if add button should be shown based on role
  // School admins can only add students and teachers in their school
  const shouldShowAddButton = !isSchoolAdminView || 
    (isSchoolAdminView && schoolFilter);

  // Determine which roles can be selected in the dropdown
  const allowedRoles = isSchoolAdminView ? 
    [{ value: 'student', label: 'Student' }, 
     { value: 'teacher', label: 'Teacher' }, 
     { value: 'secondaryTeacher', label: 'Secondary Teacher' }] : 
    [{ value: 'student', label: 'Student' }, 
     { value: 'teacher', label: 'Teacher' }, 
     { value: 'secondaryTeacher', label: 'Secondary Teacher' }, 
     { value: 'admin', label: 'Admin' }, 
     { value: 'schoolAdmin', label: 'School Admin' }];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {shouldShowAddButton && (
          <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Add User
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center p-8 text-destructive">
          Error loading users: {(error as Error).message}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground flex flex-col items-center">
          <Users className="h-12 w-12 mb-2" />
          <p>No users found</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <span className="capitalize">{user.role}</span>
                  </TableCell>
                  <TableCell>{user.schoolName || '-'}</TableCell>
                  <TableCell>{user.className || '-'}</TableCell>
                  <TableCell>
                    <span className={user.isActive ? 'text-green-600' : 'text-red-600'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEditUser(user)}
                      aria-label={`Edit ${user.fullName}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={addForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={addForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Enter password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={addForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter full name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={addForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="Enter email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={addForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {allowedRoles.map(role => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={addForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Active</FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={addForm.control}
                  name="schoolId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={value => field.onChange(value ? Number(value) : null)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select school" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {schools?.map((school: any) => (
                            <SelectItem key={school.id} value={String(school.id)}>
                              {school.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={addForm.control}
                  name="classId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={value => field.onChange(value ? Number(value) : null)}
                        disabled={!addForm.watch('schoolId')}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {filteredClasses?.map((cls: any) => (
                            <SelectItem key={cls.id} value={String(cls.id)}>
                              {cls.name} ({cls.gradeLevel})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addUserMutation.isPending}>
                  {addUserMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create User
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit User: {editingUser?.fullName}</DialogTitle>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password (leave blank to keep current)</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="New password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter full name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="Enter email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {allowedRoles.map(role => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Active</FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="schoolId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={value => field.onChange(value ? Number(value) : null)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select school" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {schools?.map((school: any) => (
                            <SelectItem key={school.id} value={String(school.id)}>
                              {school.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="classId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={value => field.onChange(value ? Number(value) : null)}
                        disabled={!editForm.watch('schoolId')}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {filteredClasses?.map((cls: any) => (
                            <SelectItem key={cls.id} value={String(cls.id)}>
                              {cls.name} ({cls.gradeLevel})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update User
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}