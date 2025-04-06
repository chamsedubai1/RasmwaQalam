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
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface TeacherRoleManagementProps {
  onRefreshData?: () => void;
  schoolFilter?: number;
  isSchoolAdminView?: boolean;
}

interface Teacher {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  schoolId: number | null;
  classId: number | null;
  schoolName: string | null;
  className: string | null;
  gradeLevel: string | null;
  isActive: boolean;
}

const TeacherRoleManagement: React.FC<TeacherRoleManagementProps> = ({ 
  onRefreshData, 
  schoolFilter,
  isSchoolAdminView = false 
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("fullName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [showRoleChangeDialog, setShowRoleChangeDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [teacherData, setTeacherData] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch all teachers (both primary and secondary)
  useEffect(() => {
    const fetchTeachers = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log("Fetching teachers manually...");
        
        // Build query string with role filter and optional school filter
        let endpoint = "/api/users?role=teacher,secondaryTeacher";
        
        // Add school filter if provided
        if (schoolFilter) {
          endpoint += `&schoolId=${schoolFilter}`;
        }
        
        const res = await fetch(endpoint);
        
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log("Fetched teachers manually:", data);
        
        if (!Array.isArray(data)) {
          throw new Error("API did not return an array");
        }
        
        // Filter to include only teachers and secondary teachers
        const teachersOnly = data.filter(user => 
          user.role === "teacher" || user.role === "secondaryTeacher"
        );
        
        console.log("Filtered teachers:", teachersOnly);
        setTeacherData(teachersOnly);
      } catch (err) {
        console.error("Error fetching teachers:", err);
        setError(err instanceof Error ? err.message : "Failed to load teachers");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTeachers();
  }, [schoolFilter]);
  
  // Manually refetch teachers
  const refetchTeachers = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Build query string with role filter and optional school filter
      let endpoint = "/api/users?role=teacher,secondaryTeacher";
      
      // Add school filter if provided
      if (schoolFilter) {
        endpoint += `&schoolId=${schoolFilter}`;
      }
      
      const res = await fetch(endpoint);
      
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (!Array.isArray(data)) {
        throw new Error("API did not return an array");
      }
      
      // Filter to include only teachers and secondary teachers
      const teachersOnly = data.filter(user => 
        user.role === "teacher" || user.role === "secondaryTeacher"
      );
      
      console.log("Refreshed teachers count:", teachersOnly.length);
      setTeacherData(teachersOnly);
      
      toast({
        title: "Teachers refreshed",
        description: `Loaded ${teachersOnly.length} teachers`,
      });
    } catch (err) {
      console.error("Error refreshing teachers:", err);
      setError(err instanceof Error ? err.message : "Failed to refresh teachers");
      
      toast({
        title: "Refresh failed",
        description: err instanceof Error ? err.message : "Failed to refresh teachers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mutation for updating teacher role
  const updateTeacherRole = async (teacherId: number, newRole: string) => {
    try {
      const res = await fetch(`/api/users/${teacherId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      
      toast({
        title: "Teacher role updated",
        description: `The teacher's role has been successfully updated.`,
      });
      
      setShowRoleChangeDialog(false);
      await refetchTeachers();
      
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error("Error updating teacher role:", err);
      
      toast({
        title: "Failed to update teacher role",
        description: err instanceof Error ? err.message : "An error occurred while updating the teacher role.",
        variant: "destructive",
      });
    }
  };

  // Handle role change
  const handleRoleChange = () => {
    if (!selectedTeacher || !selectedRole) return;
    updateTeacherRole(selectedTeacher.id, selectedRole);
  };

  // Handle opening the role change dialog
  const openRoleChangeDialog = (teacher: Teacher) => {
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
  const filteredTeachers = teacherData.filter((teacher) => {
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
    let aValue = a[sortField as keyof Teacher] || "";
    let bValue = b[sortField as keyof Teacher] || "";
    
    // Convert to strings if they aren't already
    const aValueStr = typeof aValue === "string" ? aValue.toLowerCase() : String(aValue).toLowerCase();
    const bValueStr = typeof bValue === "string" ? bValue.toLowerCase() : String(bValue).toLowerCase();
    
    if (sortDirection === "asc") {
      return aValueStr > bValueStr ? 1 : -1;
    } else {
      return aValueStr < bValueStr ? 1 : -1;
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading teachers</AlertTitle>
        <AlertDescription>
          {error}
          <div className="mt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={refetchTeachers}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Try Again
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          {isSchoolAdminView 
            ? "School Teachers Role Management" 
            : "Teacher Role Management"}
        </CardTitle>
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
            onClick={refetchTeachers}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-sm text-gray-500">
            Total teachers: <strong>{teacherData.length}</strong> (Primary: {teacherData.filter(t => t.role === "teacher").length}, Secondary: {teacherData.filter(t => t.role === "secondaryTeacher").length})
          </p>
        </div>
        
        {sortedTeachers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {teacherData.length === 0 ? 
              "No teachers found. Please add teachers first." : 
              "No teachers match your search criteria. Try a different search term."}
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
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
                {sortedTeachers.map((teacher) => (
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
          </div>
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
                  disabled={!selectedRole || selectedRole === selectedTeacher.role}
                >
                  <UserCog className="h-4 w-4 mr-1" />
                  Update Role
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