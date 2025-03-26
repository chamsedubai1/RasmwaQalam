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
        <SelectTrigger className="w-[110px] text-white bg-indigo-700 border-none focus:ring-primary">
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="student">Student</SelectItem>
          <SelectItem value="teacher">Teacher</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
      <div className="ml-3 text-sm bg-indigo-800 text-white px-2 py-1 rounded">
        <span>
          {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
        </span>
      </div>
    </div>
  );
};

export default UserRoleSelector;
