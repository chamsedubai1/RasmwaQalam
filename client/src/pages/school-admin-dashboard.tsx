import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, School, BookOpen, GraduationCap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

// Import dashboard components
import UsersTable from '@/components/dashboard/users-table';
import ClassTable from '@/components/dashboard/class-table';
import SecondaryTeacherManagement from '@/components/dashboard/secondary-teacher-management';
import TeacherRoleManagement from '@/components/dashboard/teacher-role-management';

export default function SchoolAdminDashboard() {
  const [location, setLocation] = useState('/school-admin-dashboard');
  const [currentTab, setCurrentTab] = useState('overview');
  const [activeSchoolId, setActiveSchoolId] = useState<number | null>(null);
  
  // Get current user
  const { data: currentUser, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
  });

  // Get the school data for this school admin
  const { data: schoolData, isLoading: isLoadingSchool } = useQuery({
    queryKey: ['/api/schools', currentUser?.schoolId],
    queryFn: async () => {
      if (!currentUser?.schoolId) return null;
      const response = await apiRequest('GET', `/api/schools/${currentUser.schoolId}`);
      return response.json();
    },
    enabled: !!currentUser?.schoolId,
  });

  // Set the active school ID when user data is loaded
  useEffect(() => {
    if (currentUser?.schoolId) {
      setActiveSchoolId(currentUser.schoolId);
    }
  }, [currentUser]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    setLocation(`/school-admin-dashboard?tab=${value}`);
  };

  if (isLoadingUser || isLoadingSchool) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Ensure the user is a school admin and redirect if not
  if (!currentUser || currentUser.role !== 'schoolAdmin') {
    // This will be handled by the protected route, but just in case
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">School Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your school's users, classes, and teachers.
          </p>
        </div>
        <Card className="w-full md:w-auto">
          <CardHeader className="p-4">
            <CardTitle className="text-lg">
              {schoolData?.name || 'Your School'}
            </CardTitle>
            <CardDescription>School Admin: {currentUser.fullName}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="overview" value={currentTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 lg:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="teacherRoles">Teacher Roles</TabsTrigger>
          <TabsTrigger value="secondaryTeachers">Secondary Teachers</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Loading...</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Loading...</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Loading...</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Submissions</CardTitle>
                <School className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Loading...</div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>School Details</CardTitle>
                <CardDescription>Information about your school</CardDescription>
              </CardHeader>
              <CardContent>
                {schoolData ? (
                  <div className="space-y-2">
                    <div>
                      <span className="font-semibold">Name:</span> {schoolData.name}
                    </div>
                    <div>
                      <span className="font-semibold">Status:</span>{' '}
                      <span className={schoolData.isActive ? 'text-green-600' : 'text-red-600'}>
                        {schoolData.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold">Website:</span>{' '}
                      {schoolData.websiteUrl ? (
                        <a href={schoolData.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {schoolData.websiteUrl}
                        </a>
                      ) : (
                        'Not provided'
                      )}
                    </div>
                    <div>
                      <span className="font-semibold">Description:</span>{' '}
                      {schoolData.description || 'No description available'}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">School information not available</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks for school administration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleTabChange('users')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Manage Users
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleTabChange('classes')}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Manage Classes
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleTabChange('teacherRoles')}
                >
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Manage Teachers
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>School Users</CardTitle>
              <CardDescription>Manage all users in your school</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSchoolId ? (
                <UsersTable schoolFilter={activeSchoolId} isSchoolAdminView={true} />
              ) : (
                <div className="flex justify-center items-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Classes Tab */}
        <TabsContent value="classes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>School Classes</CardTitle>
              <CardDescription>Manage all classes in your school</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSchoolId ? (
                <ClassTable schoolFilter={activeSchoolId} isSchoolAdminView={true} />
              ) : (
                <div className="flex justify-center items-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teacher Roles Tab */}
        <TabsContent value="teacherRoles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Teacher Roles</CardTitle>
              <CardDescription>Manage teacher roles within your school</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSchoolId ? (
                <TeacherRoleManagement schoolFilter={activeSchoolId} isSchoolAdminView={true} />
              ) : (
                <div className="flex justify-center items-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Secondary Teachers Tab */}
        <TabsContent value="secondaryTeachers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Secondary Teacher Assignments</CardTitle>
              <CardDescription>Manage secondary teacher assignments for classes</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSchoolId ? (
                <SecondaryTeacherManagement schoolFilter={activeSchoolId} isSchoolAdminView={true} />
              ) : (
                <div className="flex justify-center items-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}