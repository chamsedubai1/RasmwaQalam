import React from "react";
import { useUserRole } from "@/hooks/use-user-role";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

const UserRoleSelector: React.FC = () => {
  const { userRole, setUserRole } = useUserRole();

  return (
    <div className="flex items-center gap-2">
      <span className="text-white">Role:</span>
      <Select value={userRole} onValueChange={setUserRole}>
        <SelectTrigger className="w-[110px] text-white bg-blue-600 border-none focus:ring-blue-400 hover:bg-blue-700 transition-colors">
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent className="bg-blue-50">
          <SelectItem value="student" className="hover:bg-blue-100">Student</SelectItem>
          <SelectItem value="teacher" className="hover:bg-blue-100">Teacher</SelectItem>
          <SelectItem value="admin" className="hover:bg-blue-100">Admin</SelectItem>
        </SelectContent>
      </Select>
      <div className="ml-3 text-sm bg-blue-700 text-white px-2 py-1 rounded-md shadow-sm">
        <span>
          {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
        </span>
      </div>
    </div>
  );
};

export default UserRoleSelector;
