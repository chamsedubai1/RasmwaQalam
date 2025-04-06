import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Loader2, 
  RefreshCw,
  UserCog,
  Users
} from "lucide-react";

interface TeacherRoleManagementProps {
  onRefreshData?: () => void;
}

const TeacherRoleManagement: React.FC<TeacherRoleManagementProps> = ({ onRefreshData }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("fullName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [showRoleChangeDialog, setShowRoleChangeDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  
  // Fetch all teachers (both primary and secondary)
  const { 
    data: teachers = [], 
    isLoading: isLoadingTeachers,
    refetch: refetchTeachers 
  } = useQuery<any[]>({
    queryKey: ['/api/users', 'teachers'],
    queryFn: async () => {
      console.log("Fetching teachers only...");
      const res = await apiRequest("GET", "/api/users?role=teacher,secondaryTeacher");
      const data = await res.json();
      console.log("Fetched teachers:", data);
      return data;
    }
  });

  // Mutation for updating teacher role
  const updateTeacherRoleMutation = useMutation({
    mutationFn: async ({ teacherId, newRole }: { teacherId: number, newRole: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${teacherId}`, { role: newRole });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Teacher role updated",
        description: `The teacher's role has been successfully updated.`,
      });
      setShowRoleChangeDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/users', 'teachers'] });
      if (onRefreshData) onRefreshData();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update teacher role",
        description: error.message || "An error occurred while updating the teacher role.",
        variant: "destructive",
      });
    }
  });

  // Handle role change
  const handleRoleChange = () => {
    if (!selectedTeacher || !selectedRole) return;
    
    updateTeacherRoleMutation.mutate({
      teacherId: selectedTeacher.id,
      newRole: selectedRole
    });
  };

  // Handle opening the role change dialog
  const openRoleChangeDialog = (teacher: any) => {
    setSelectedTeacher(teacher);
    setSelectedRole(teacher.role);
    setShowRoleChangeDialog(true);
  };

  // Sorting function
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter teachers based on search query
  const filteredTeachers = teachers.filter((teacher: any) => {
    const searchText = searchQuery.toLowerCase();
    return (
      teacher.fullName.toLowerCase().includes(searchText) ||
      teacher.username.toLowerCase().includes(searchText) ||
      teacher.email.toLowerCase().includes(searchText) ||
      (teacher.schoolName && teacher.schoolName.toLowerCase().includes(searchText)) ||
      (teacher.className && teacher.className.toLowerCase().includes(searchText))
    );
  });

  // Sort the filtered teachers
  const sortedTeachers = [...filteredTeachers].sort((a, b) => {
    let aValue = a[sortField] || "";
    let bValue = b[sortField] || "";
    
    // Convert to strings if they aren't already
    aValue = typeof aValue === "string" ? aValue.toLowerCase() : aValue.toString();
    bValue = typeof bValue === "string" ? bValue.toLowerCase() : bValue.toString();
    
    if (sortDirection === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Create a sortable table header component
  const SortableHeader = ({ label, field }: { label: string, field: string }) => (
    <TableHead 
      className="cursor-pointer hover:bg-gray-50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        {sortField === field && (
          <span className="text-blue-600">
            {sortDirection === "asc" ? " ↑" : " ↓"}
          </span>
        )}
      </div>
    </TableHead>
  );

  if (isLoadingTeachers) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Teacher Role Management</CardTitle>
        <div className="flex space-x-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-500" />
            <Input
              placeholder="Search teachers..."
              className="pl-8 w-[240px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchTeachers()}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sortedTeachers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No teachers found. Please add teachers first.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader label="Name" field="fullName" />
                <SortableHeader label="Username" field="username" />
                <SortableHeader label="Email" field="email" />
                <SortableHeader label="Role" field="role" />
                <SortableHeader label="School" field="schoolName" />
                <SortableHeader label="Class" field="className" />
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTeachers.map((teacher: any) => (
                <TableRow key={teacher.id}>
                  <TableCell className="font-medium">{teacher.fullName}</TableCell>
                  <TableCell>{teacher.username}</TableCell>
                  <TableCell>{teacher.email}</TableCell>
                  <TableCell>
                    {teacher.role === "teacher" ? (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                        Primary Teacher
                      </Badge>
                    ) : (
                      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">
                        Secondary Teacher
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{teacher.schoolName || "-"}</TableCell>
                  <TableCell>{teacher.className || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRoleChangeDialog(teacher)}
                    >
                      <UserCog className="h-4 w-4 mr-1" />
                      Change Role
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Role Change Dialog */}
      <Dialog open={showRoleChangeDialog} onOpenChange={setShowRoleChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Teacher Role</DialogTitle>
            <DialogDescription>
              Assign {selectedTeacher?.fullName} as a Primary or Secondary Teacher
            </DialogDescription>
          </DialogHeader>
          
          {selectedTeacher && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-md">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Name</p>
                    <p className="font-semibold">{selectedTeacher.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Current Role</p>
                    <p className="font-semibold">
                      {selectedTeacher.role === "teacher" ? "Primary Teacher" : "Secondary Teacher"}
                    </p>
                  </div>
                  {selectedTeacher.schoolName && (
                    <div>
                      <p className="text-sm text-blue-600 font-medium">School</p>
                      <p className="font-semibold">{selectedTeacher.schoolName}</p>
                    </div>
                  )}
                  {selectedTeacher.className && (
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Class</p>
                      <p className="font-semibold">{selectedTeacher.className}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign Role</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Primary Teacher</SelectItem>
                    <SelectItem value="secondaryTeacher">Secondary Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowRoleChangeDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRoleChange}
                  disabled={!selectedRole || selectedRole === selectedTeacher.role || updateTeacherRoleMutation.isPending}
                >
                  {updateTeacherRoleMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <UserCog className="h-4 w-4 mr-1" />
                      Update Role
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TeacherRoleManagement;