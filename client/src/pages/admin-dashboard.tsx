import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/use-user-role";
import { Redirect } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { InsertSchool } from "@shared/schema";
import { AlertCircle, ActivitySquare } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import ImageUpload from '@/components/ui/image-upload';
import UsersTable from "@/components/dashboard/users-table";
import EventTable from "@/components/dashboard/event-table";
import ClassTable from "@/components/dashboard/class-table";
import StudentTable from "@/components/dashboard/student-table";
import SecondaryTeacherManagement from "@/components/dashboard/secondary-teacher-management";
import TeacherRoleManagement from "@/components/dashboard/teacher-role-management";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  WideDialog,
  WideDialogContent,
  WideDialogHeader,
  WideDialogTitle,
  WideDialogFooter,
  WideDialogClose,
  WideDialogDescription,
} from "@/components/ui/wide-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CalendarIcon, 
  SearchIcon, 
  Users, 
  School as SchoolIcon, 
  GraduationCap, 
  Calendar,
  ClipboardList,
  BarChart,
  Briefcase,
  UserCog,
  Building,
  Download,
  Upload,
  FileSpreadsheet,
  FilePlus,
  FileText,
  Library,
  BookOpen,
  PieChart,
  Loader2,
  Eye,
  Mail,
  Award,
  Image as ImageIcon
} from "lucide-react";
import { 
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";

// ParticipantsTable component for showing event participants
const ParticipantsTable = ({ eventId }: { eventId: number | null }) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingWinner, setIsMarkingWinner] = useState(false);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(50);
  const [filters, setFilters] = useState({
    name: "",
    school: "",
    class: "",
    grade: "",
    hasSubmitted: "all"
  });
  const { toast } = useToast();
  
  // Function to mark a submission as a winner
  const markAsWinner = async (submissionId: number, stage: string) => {
    if (!eventId || !submissionId) return;
    
    setIsMarkingWinner(true);
    
    try {
      const response = await fetch('/api/submissions/mark-winners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventId,
          stage,
          winnerIds: [submissionId]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark as winner');
      }
      
      toast({
        title: "Success",
        description: `Submission marked as winner for ${stage} stage`,
      });
      
      // Refresh the participants data
      fetchParticipants();
      
    } catch (err) {
      console.error('Error marking winner:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to mark as winner',
        variant: "destructive"
      });
    } finally {
      setIsMarkingWinner(false);
    }
  };
  
  // Sort function
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter participants based on current filters
  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      const nameMatch = p.name?.toLowerCase().includes(filters.name.toLowerCase()) || !filters.name;
      const schoolMatch = p.schoolName?.toLowerCase().includes(filters.school.toLowerCase()) || !filters.school;
      const classMatch = p.className?.toLowerCase().includes(filters.class.toLowerCase()) || !filters.class;
      const gradeMatch = p.gradeLevel?.toLowerCase().includes(filters.grade.toLowerCase()) || !filters.grade;
      const submissionMatch = 
        filters.hasSubmitted === "all" || 
        (filters.hasSubmitted === "yes" && p.hasSubmitted) || 
        (filters.hasSubmitted === "no" && !p.hasSubmitted);

      return nameMatch && schoolMatch && classMatch && gradeMatch && submissionMatch;
    });
  }, [participants, filters]);

  // Sort filtered participants
  const sortedParticipants = useMemo(() => {
    return [...filteredParticipants].sort((a, b) => {
      let valA, valB;
      
      // Handle special cases for different field types
      switch (sortField) {
        case "name":
          valA = a.name || "";
          valB = b.name || "";
          break;
        case "school":
          valA = a.schoolName || "";
          valB = b.schoolName || "";
          break;
        case "class":
          valA = a.className || "";
          valB = b.className || "";
          break;
        case "grade":
          valA = a.gradeLevel || "";
          valB = b.gradeLevel || "";
          break;
        case "registrationDate":
          valA = a.registrationDate ? new Date(a.registrationDate).getTime() : 0;
          valB = b.registrationDate ? new Date(b.registrationDate).getTime() : 0;
          break;
        case "submissionTitle":
          valA = a.submissionTitle || "";
          valB = b.submissionTitle || "";
          break;
        case "voteCount":
          valA = a.voteCount || 0;
          valB = b.voteCount || 0;
          break;
        case "stage":
          valA = a.currentStage || "";
          valB = b.currentStage || "";
          break;
        default:
          valA = a[sortField] || "";
          valB = b[sortField] || "";
      }
      
      // Compare based on direction
      const comparison = typeof valA === "number" 
        ? valA - valB
        : String(valA).localeCompare(String(valB));
        
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredParticipants, sortField, sortDirection]);

  // Define the fetchParticipants function outside useEffect
  const fetchParticipants = async () => {
    if (!eventId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/events/${eventId}/participants`);
      if (!response.ok) {
        throw new Error('Failed to fetch participants');
      }
      
      // The API now returns a complete participant entry for each submission
      // with all the details we need, so we don't need to make additional requests
      const data = await response.json();
      console.log(`Loaded ${data.length} participants (submissions) from the API`);
      
      // The participant data now includes all the fields we need directly from the API
      setParticipants(data);
    } catch (err) {
      console.error('Error fetching participants:', err);
      setError('Failed to load participants data');
      toast({
        title: 'Error',
        description: 'Failed to load participants data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchParticipants();
  }, [eventId, toast]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md text-red-800">
        <p>{error}</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-2"
          onClick={() => {
            if (eventId) {
              setIsLoading(true);
              fetch(`/api/events/${eventId}/participants`)
                .then(res => res.json())
                .then(data => {
                  setParticipants(data);
                  setError(null);
                })
                .catch(err => {
                  console.error(err);
                  setError('Failed to load participants data');
                })
                .finally(() => setIsLoading(false));
            }
          }}
        >
          Retry
        </Button>
      </div>
    );
  }
  
  if (!participants.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        No participants found for this event.
      </div>
    );
  }
  
  // Function to render a sortable column header
  const SortableHeader = ({ label, field }: { label: string, field: string }) => (
    <th 
      className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {label}
        {sortField === field && (
          <span className="ml-1">
            {sortDirection === "asc" ? "↑" : "↓"}
          </span>
        )}
      </div>
    </th>
  );

  // Add filter fields
  const filterFields = (
    <div className="bg-white p-4 mb-4 rounded-md shadow-sm">
      <h3 className="text-sm font-medium mb-2">Filter Participants</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <Label htmlFor="nameFilter" className="mb-1 block text-xs">Name</Label>
          <Input
            id="nameFilter"
            value={filters.name}
            onChange={(e) => setFilters({...filters, name: e.target.value})}
            placeholder="Filter by name"
            className="text-xs"
          />
        </div>
        <div>
          <Label htmlFor="schoolFilter" className="mb-1 block text-xs">School</Label>
          <Input
            id="schoolFilter"
            value={filters.school}
            onChange={(e) => setFilters({...filters, school: e.target.value})}
            placeholder="Filter by school"
            className="text-xs"
          />
        </div>
        <div>
          <Label htmlFor="classFilter" className="mb-1 block text-xs">Class</Label>
          <Input
            id="classFilter"
            value={filters.class}
            onChange={(e) => setFilters({...filters, class: e.target.value})}
            placeholder="Filter by class"
            className="text-xs"
          />
        </div>
        <div>
          <Label htmlFor="gradeFilter" className="mb-1 block text-xs">Grade</Label>
          <Input
            id="gradeFilter"
            value={filters.grade}
            onChange={(e) => setFilters({...filters, grade: e.target.value})}
            placeholder="Filter by grade"
            className="text-xs"
          />
        </div>
        <div>
          <Label htmlFor="submissionFilter" className="mb-1 block text-xs">Submission Status</Label>
          <Select 
            value={filters.hasSubmitted} 
            onValueChange={(value) => setFilters({...filters, hasSubmitted: value})}
          >
            <SelectTrigger id="submissionFilter" className="text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Submitted</SelectItem>
              <SelectItem value="no">Not Submitted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  // Calculate pagination
  const pageCount = Math.ceil(sortedParticipants.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedParticipants.slice(indexOfFirstItem, indexOfLastItem);
  
  // Handle page changes
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };
  
  // Container with expanded width
  return (
    <div className="w-full mx-auto">
      {filterFields}
      
      {/* Pagination status */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">
          Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, sortedParticipants.length)} of {sortedParticipants.length} participants
        </p>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            First
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm mx-2">
            Page {currentPage} of {pageCount}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === pageCount}
          >
            Next
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(pageCount)}
            disabled={currentPage === pageCount}
          >
            Last
          </Button>
        </div>
      </div>
      
      {/* Card-based layout for better space utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {currentItems.map((participant) => (
          <div 
            key={participant.id} 
            className={`p-4 rounded-lg border ${
              participant.classWinner ? "bg-blue-50 border-blue-200" :
              participant.schoolWinner ? "bg-purple-50 border-purple-200" :
              participant.countryWinner ? "bg-amber-50 border-amber-200" :
              participant.globalWinner ? "bg-emerald-50 border-emerald-200" : 
              "bg-white border-gray-200"
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{participant.name}</h3>
                <div className="text-sm text-gray-500">
                  {participant.schoolName} • {participant.className} • Grade {participant.gradeLevel}
                </div>
              </div>
              
              <div className="flex space-x-2">
                {participant.hasSubmitted && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(`/submission/${participant.submissionId}`, '_blank');
                      }}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Award className="h-3.5 w-3.5 mr-1" />
                          Mark Winner
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Select Stage</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => markAsWinner(participant.submissionId, 'class')}
                          disabled={isMarkingWinner}
                        >
                          Class Winner
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => markAsWinner(participant.submissionId, 'school')}
                          disabled={isMarkingWinner}
                        >
                          School Winner
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => markAsWinner(participant.submissionId, 'country')}
                          disabled={isMarkingWinner}
                        >
                          Country Winner
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => markAsWinner(participant.submissionId, 'global')}
                          disabled={isMarkingWinner}
                        >
                          Global Winner
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
                
                {!participant.hasSubmitted && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Send reminder email
                      if (!participant.hasSubmitted && eventId) {
                        // Now we need to use userId instead of id since we're working with submission-based entries
                        fetch(`/api/events/${eventId}/reminder`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ userId: participant.userId }),
                        })
                          .then((res) => {
                            if (res.ok) {
                              toast({
                                title: "Reminder Sent",
                                description: `Email reminder sent to ${participant.name}`,
                              });
                            } else {
                              throw new Error('Failed to send reminder');
                            }
                          })
                          .catch((error) => {
                            toast({
                              title: "Error",
                              description: "Failed to send reminder",
                              variant: "destructive",
                            });
                          });
                      }
                    }}
                  >
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    Send Reminder
                  </Button>
                )}
              </div>
            </div>
            
            {/* Submission information and statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <h4 className="text-xs uppercase font-medium text-gray-500 mb-1">Submission Details</h4>
                {participant.hasSubmitted ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-500">Title:</span>
                      <p className="text-sm font-medium">{participant.submissionTitle}</p>
                    </div>
                    <div className="flex space-x-4">
                      <div>
                        <span className="text-xs text-gray-500">Stage:</span>
                        <p className="text-sm font-medium capitalize">{participant.currentStage}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Votes:</span>
                        <p className="text-sm font-medium">{participant.voteCount}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Submitted:</span>
                      <p className="text-sm font-medium">{participant.submittedAt ? new Date(participant.submittedAt).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 px-3 bg-gray-50 rounded-md text-gray-500 text-sm italic">
                    No submission yet
                  </div>
                )}
              </div>
              
              <div>
                <h4 className="text-xs uppercase font-medium text-gray-500 mb-1">Winner Status</h4>
                {participant.hasSubmitted ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline" className={`${participant.classWinner ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      Class {participant.classWinner ? "Winner ✓" : "Stage"}
                    </Badge>
                    <Badge variant="outline" className={`${participant.schoolWinner ? "bg-purple-100 text-purple-800 border-purple-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      School {participant.schoolWinner ? "Winner ✓" : "Stage"}
                    </Badge>
                    <Badge variant="outline" className={`${participant.countryWinner ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      Country {participant.countryWinner ? "Winner ✓" : "Stage"}
                    </Badge>
                    <Badge variant="outline" className={`${participant.globalWinner ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      Global {participant.globalWinner ? "Winner ✓" : "Stage"}
                    </Badge>
                  </div>
                ) : (
                  <div className="py-2 px-3 bg-gray-50 rounded-md text-gray-500 text-sm italic">
                    Not applicable
                  </div>
                )}
              </div>
            </div>
            
            {/* Additional participant information */}
            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
              <span>Registered: {participant.registrationDate ? new Date(participant.registrationDate).toLocaleDateString() : 'N/A'}</span>
              <span className="mx-2">•</span>
              <span>ID: {participant.userId}</span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Traditional table view for mobile - Hidden on larger screens */}
      <div className="overflow-x-auto w-full mt-4 lg:hidden">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader label="Name" field="name" />
              <SortableHeader label="School" field="school" />
              <SortableHeader label="Submission" field="submissionTitle" />
              <SortableHeader label="Votes" field="voteCount" />
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentItems.map((participant) => (
              <tr key={`table-${participant.id}`} className={
                participant.classWinner ? "bg-blue-50" :
                participant.schoolWinner ? "bg-purple-50" :
                participant.countryWinner ? "bg-amber-50" :
                participant.globalWinner ? "bg-emerald-50" : ""
              }>
                <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {participant.name}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                  {participant.schoolName}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                  {participant.hasSubmitted ? participant.submissionTitle : '-'}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                  {participant.hasSubmitted ? participant.voteCount : '-'}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (participant.hasSubmitted) {
                        window.open(`/submission/${participant.submissionId}`, '_blank');
                      } else {
                        // Send reminder email
                        if (eventId) {
                          fetch(`/api/events/${eventId}/reminder`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ userId: participant.userId }),
                          })
                            .then((res) => {
                              if (res.ok) {
                                toast({
                                  title: "Reminder Sent",
                                  description: `Email reminder sent to ${participant.name}`,
                                });
                              } else {
                                throw new Error('Failed to send reminder');
                              }
                            })
                            .catch((error) => {
                              toast({
                                title: "Error",
                                description: "Failed to send reminder",
                                variant: "destructive",
                              });
                            });
                        }
                      }
                    }}
                  >
                    {participant.hasSubmitted ? (
                      <>
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </>
                    ) : (
                      <>
                        <Mail className="h-3.5 w-3.5 mr-1" />
                        Remind
                      </>
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Bottom pagination for mobile view too */}
      <div className="mt-6 flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, sortedParticipants.length)} of {sortedParticipants.length} participants
        </p>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            First
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm mx-2">
            Page {currentPage} of {pageCount}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === pageCount}
          >
            Next
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(pageCount)}
            disabled={currentPage === pageCount}
          >
            Last
          </Button>
        </div>
      </div>
    </div>
  );
};

// Data export function defined outside component
const handleExportData = (entity: string, format: string) => {
  // Create a link element to trigger the download
  const link = document.createElement('a');
  link.href = `/api/export/${entity}/${format}`;
  link.download = `${entity}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const AdminDashboard: React.FC = () => {
  const { userRole } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("users");
  
  // For export functionality
  const [isExporting, setIsExporting] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReportEventId, setSelectedReportEventId] = useState<number | null>(null);
  
  // Gallery management state variables
  const [gallerySearchQuery, setGallerySearchQuery] = useState("");
  const [galleryTypeFilter, setGalleryTypeFilter] = useState("all");
  const [galleryFeaturedFilter, setGalleryFeaturedFilter] = useState("all");
  const [showCreateGalleryItemDialog, setShowCreateGalleryItemDialog] = useState(false);
  const [showEditGalleryItemDialog, setShowEditGalleryItemDialog] = useState(false);
  const [showDeleteGalleryItemDialog, setShowDeleteGalleryItemDialog] = useState(false);
  const [showDeleteGalleryItemConfirmDialog, setShowDeleteGalleryItemConfirmDialog] = useState(false);
  const [selectedGalleryItem, setSelectedGalleryItem] = useState<any>(null);
  
  // Form state for gallery items
  const [galleryItemTitle, setGalleryItemTitle] = useState("");
  const [galleryItemDescription, setGalleryItemDescription] = useState("");
  const [galleryItemType, setGalleryItemType] = useState<"image" | "poem">("image");
  const [galleryItemContent, setGalleryItemContent] = useState("");
  const [galleryItemFeatured, setGalleryItemFeatured] = useState(false);
  const [galleryItemIsActive, setGalleryItemIsActive] = useState(true);
  const [galleryItemOrderIndex, setGalleryItemOrderIndex] = useState<number>(0);
  // State for managing submissions for an event
  const [eventSubmissions, setEventSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<number[]>([]);
  
  // Create dialogs
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showCreateEventDialog, setShowCreateEventDialog] = useState(false);
  const [showCreateSchoolDialog, setShowCreateSchoolDialog] = useState(false);
  const [showCreateClassDialog, setShowCreateClassDialog] = useState(false);
  const [showCreatePartnerDialog, setShowCreatePartnerDialog] = useState(false);
  
  // Edit dialogs
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showEditEventDialog, setShowEditEventDialog] = useState(false);
  const [showEditSchoolDialog, setShowEditSchoolDialog] = useState(false);
  const [showEditPartnerDialog, setShowEditPartnerDialog] = useState(false);
  
  // Form state for school
  const [schoolName, setSchoolName] = useState("");
  const [schoolDescription, setSchoolDescription] = useState("");
  const [schoolWebsite, setSchoolWebsite] = useState("");
  const [schoolCityId, setSchoolCityId] = useState("");
  const [schoolStatus, setSchoolStatus] = useState("true"); // active by default
  const [schoolImageUrl, setSchoolImageUrl] = useState("");
  const [showEditClassDialog, setShowEditClassDialog] = useState(false);
  
  // Form state for users with validation error tracking
  const [userFullName, setUserFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userUsername, setUserUsername] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRoleValue, setUserRoleValue] = useState("student");
  const [userSchoolId, setUserSchoolId] = useState("");
  const [userClassId, setUserClassId] = useState("");
  const [userIsActive, setUserIsActive] = useState(true);
  
  // Field-specific error states
  const [formErrors, setFormErrors] = useState<{
    fullName?: string;
    email?: string;
    username?: string;
    password?: string;
    schoolId?: string;
    classId?: string;
  }>({});
  
  // Selected item IDs for edit operations
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  
  // Delete dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItemToDelete, setSelectedItemToDelete] = useState<{ type: string; id: number } | null>(null);
  
  // Student management dialog
  const [showStudentsDialog, setShowStudentsDialog] = useState(false);
  
  // Participants management dialog
  const [showParticipantsDialog, setShowParticipantsDialog] = useState(false);
  
  // Voting history dialog
  const [showVotingHistoryDialog, setShowVotingHistoryDialog] = useState(false);
  const [votingHistoryData, setVotingHistoryData] = useState<any>(null);
  const [isLoadingVotingHistory, setIsLoadingVotingHistory] = useState(false);
  
  // Always include hooks before any early returns to avoid React errors
  
  // Fetch all users
  const { data: allUsers = [], isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/users'],
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 1000, // Consider data stale after 1 second
  });
  
  // Fetch reports statistics
  const { data: statistics, isLoading: isLoadingStatistics, refetch: refetchStatistics } = useQuery({
    queryKey: ['/api/reports/statistics'],
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 1000, // Consider data stale after 1 second
  });
  
  // Fetch all cities for dropdowns
  const { data: cities = [], isLoading: isLoadingCities } = useQuery({
    queryKey: ['/api/cities'],
    queryFn: async () => {
      const response = await fetch('/api/cities');
      if (!response.ok) {
        throw new Error('Failed to fetch cities');
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
    staleTime: 60000, // Consider data stale after 1 minute
  });

  // Fetch all schools (including inactive ones for admin)
  const { data: schools = [], isLoading: isLoadingSchools, refetch: refetchSchools } = useQuery({
    queryKey: ['/api/schools'],
    queryFn: async () => {
      // Add showInactive=true parameter to fetch all schools regardless of status
      const response = await fetch('/api/schools?showInactive=true');
      if (!response.ok) {
        throw new Error('Failed to fetch schools');
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 1000, // Consider data stale after 1 second
  });
  
  // Fetch all events for event management (including disabled events)
  const { data: events = [], isLoading: isLoadingEvents, refetch: refetchEvents } = useQuery({
    queryKey: ['/api/events', 'admin'],
    queryFn: async () => {
      const response = await fetch('/api/events?includeDisabled=true');
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 1000, // Consider data stale after 1 second
  });
  
  // Fetch all classes for class management
  const { data: classes = [], isLoading: isLoadingClasses, refetch: refetchClasses } = useQuery({
    queryKey: ['/api/classes'],
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 1000, // Consider data stale after 1 second
  });
  
  // Fetch all partners for partner management (including inactive ones)
  const { data: partners = [], isLoading: isLoadingPartners, refetch: refetchPartners } = useQuery({
    queryKey: ['/api/partners'],
    queryFn: async () => {
      // Add showInactive=true parameter to fetch all partners regardless of status
      const response = await fetch('/api/partners?showInactive=true');
      if (!response.ok) {
        throw new Error('Failed to fetch partners');
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 1000, // Consider data stale after 1 second
  });
  
  // Fetch all gallery items for gallery management
  const { data: galleryItems = [], isLoading: isLoadingGalleryItems, refetch: refetchGalleryItems } = useQuery({
    queryKey: ['/api/gallery-items'],
    queryFn: async () => {
      const response = await fetch('/api/gallery-items');
      if (!response.ok) {
        throw new Error('Failed to fetch gallery items');
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 1000, // Consider data stale after 1 second
  });
  
  // Admin role check - moved after all hooks to avoid React errors
  if (userRole !== "admin") {
    return <Redirect to="/" />;
  }
  
  // Calculate dashboard statistics
  // Data import function - moved inside component to access toast
  const handleImportClick = (entity: string) => {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json,.xlsx,.txt';
    input.style.display = 'none';
    document.body.appendChild(input);
    
    // Store the entity type as a data attribute
    input.dataset.entity = entity;
    
    // Set up the change event handler using function defined inside component
    input.onchange = (event) => handleFileSelect(event, entity);
    
    // Trigger file selection dialog
    input.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(input);
    }, 5000);
  };

  // Handle file selection for import - moved inside component to access toast and queryClient
  const handleFileSelect = async (event: Event, entity: string) => {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    
    if (!file || !entity) return;
    
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // Determine file format from extension
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
      formData.append('format', fileExtension);
      
      // Send the file to the import API
      const response = await fetch(`/api/import/${entity}`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      
      // Refresh data based on entity type
      queryClient.invalidateQueries({ queryKey: [`/api/${entity}`] });
      
      // Show success message
      toast({
        title: "Import Successful",
        description: `${entity} data has been imported successfully`,
      });
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import data",
        variant: "destructive",
      });
    }
  };


  
  const totalUsers = (allUsers as any[]).length;
  const totalStudents = (allUsers as any[]).filter((user: any) => user.role === 'student').length;
  const totalTeachers = (allUsers as any[]).filter((user: any) => user.role === 'teacher').length;
  const totalSchools = (schools as any[]).length;
  const totalClasses = (classes as any[]).length;
  const totalEvents = (events as any[]).length;
  const activeEvents = (events as any[]).filter((event: any) => event.status === 'open').length;
  const upcomingEvents = (events as any[]).filter((event: any) => event.status === 'upcoming').length;
  
  // Filter gallery items based on user search and filters
  const filteredGalleryItems = useMemo(() => {
    return (galleryItems as any[]).filter((item: any) => {
      // Filter by search query (case insensitive)
      const matchesSearch = 
        gallerySearchQuery === '' || 
        (item.title && item.title.toLowerCase().includes(gallerySearchQuery.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(gallerySearchQuery.toLowerCase()));
      
      // Filter by type
      const matchesType = 
        galleryTypeFilter === 'all' || 
        item.type === (galleryTypeFilter === 'image' ? 'image' : 'poem');
      
      // Filter by featured status
      const matchesFeatured = 
        galleryFeaturedFilter === 'all' || 
        (galleryFeaturedFilter === 'featured' && item.featured) || 
        (galleryFeaturedFilter === 'not-featured' && !item.featured);
      
      return matchesSearch && matchesType && matchesFeatured;
    });
  }, [galleryItems, gallerySearchQuery, galleryTypeFilter, galleryFeaturedFilter]);
  
  // Get school names for each user
  const usersWithSchoolNames = (allUsers as any[]).map((user: any) => {
    const school = (schools as any[]).find((s: any) => s.id === user.schoolId);
    const userClass = (classes as any[]).find((c: any) => c.id === user.classId);
    return {
      ...user,
      schoolName: school ? school.name : "N/A",
      className: userClass ? userClass.name : "N/A"
    };
  });
  
  // Filter users
  const filteredUsers = usersWithSchoolNames.filter((user: any) => {
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesSchool = schoolFilter === "all" || user.schoolId?.toString() === schoolFilter;
    const matchesSearch = searchQuery === "" || 
      (user.fullName && user.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.username && user.username.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesRole && matchesSchool && matchesSearch;
  });
  
  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      return apiRequest("POST", "/api/users", userData);
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      // Reset form fields
      setUserFullName("");
      setUserEmail("");
      setUserUsername("");
      setUserPassword("");
      setUserRoleValue("student");
      setUserSchoolId("");
      setUserClassId("");
      setUserIsActive(true);
      
      // Close dialog
      setShowCreateUserDialog(false);
      
      // Success message
      toast({
        title: "User Created",
        description: "User has been successfully created",
      });
    },
    onError: (error: any) => {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description: "Failed to create user. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number, userData: any }) => {
      return apiRequest("PATCH", `/api/users/${id}`, userData);
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      // Reset form fields
      setUserFullName("");
      setUserEmail("");
      setUserUsername("");
      setUserPassword("");
      setUserRoleValue("student");
      setUserSchoolId("");
      setUserClassId("");
      setUserIsActive(true);
      setSelectedUserId(null);
      
      // Close dialog
      setShowEditUserDialog(false);
      
      // Success message
      toast({
        title: "User Updated",
        description: "User has been successfully updated",
      });
    },
    onError: (error: any) => {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: "Failed to update user. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleCreateUser = () => {
    // Reset previous errors
    setFormErrors({});
    
    // Validate form fields with specific error messages
    const errors: {
      fullName?: string;
      email?: string;
      username?: string;
      password?: string;
      schoolId?: string;
      classId?: string;
    } = {};
    
    if (!userFullName) {
      errors.fullName = "Full name is required";
    }
    
    if (!userEmail) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(userEmail)) {
      errors.email = "Email format is invalid";
    }
    
    if (!userUsername) {
      errors.username = "Username is required";
    } else if (userUsername.length < 4) {
      errors.username = "Username must be at least 4 characters";
    }
    
    if (!userPassword) {
      errors.password = "Password is required";
    } else if (userPassword.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    
    // If role is student or teacher, schoolId is required
    if ((userRoleValue === "student" || userRoleValue === "teacher") && !userSchoolId) {
      errors.schoolId = "School selection is required";
    }
    
    // If role is student, classId is required
    if (userRoleValue === "student" && !userClassId) {
      errors.classId = "Class selection is required";
    }
    
    // Check if there are any errors
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      
      // Show toast with main error message
      toast({
        title: "Validation Error",
        description: "Please correct the highlighted fields",
        variant: "destructive",
      });
      return;
    }
    
    // Build user data and submit using mutation
    const userData = {
      fullName: userFullName,
      email: userEmail,
      username: userUsername,
      password: userPassword,
      role: userRoleValue,
      schoolId: userSchoolId ? parseInt(userSchoolId) : null,
      classId: userClassId ? parseInt(userClassId) : null,
      isActive: userIsActive
    };
    
    // Call the mutation with user data
    createUserMutation.mutate(userData);
  };
  
  // Form state for event
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventType, setEventType] = useState("poetry");
  const [eventStatus, setEventStatus] = useState("upcoming");
  const [eventStage, setEventStage] = useState("class");
  const [eventMode, setEventMode] = useState("allowAI"); // Default to allowing AI creation
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventImageUrl, setEventImageUrl] = useState("");
  const [eventIsEnabled, setEventIsEnabled] = useState(true);
  
  // Form state for partner
  const [partnerName, setPartnerName] = useState("");
  const [partnerDescription, setPartnerDescription] = useState("");
  const [partnerWebsite, setPartnerWebsite] = useState("");
  const [partnerLogoUrl, setPartnerLogoUrl] = useState("");
  const [partnerIsActive, setPartnerIsActive] = useState(true);

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      try {
        const response = await apiRequest("POST", "/api/events", eventData);
        return response;
      } catch (error) {
        console.error("Event creation error details:", error);
        // If it's a response with error details
        if (error && typeof error === 'object' && 'json' in error) {
          try {
            const errorDetails = await (error as any).json();
            console.error("Validation errors:", errorDetails);
          } catch (e) {
            console.error("Could not parse error response");
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      // Force invalidate all events queries to refresh data everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events', 'admin'] });
      
      // We need to ensure the query cache is completely reset
      // This makes sure the events page will get fresh data
      queryClient.resetQueries({ queryKey: ['/api/events'] });
      
      // Reset form fields
      setEventName("");
      setEventDescription("");
      setEventType("poetry");
      setEventStatus("upcoming");
      setEventStage("class");
      setEventStartDate("");
      setEventEndDate("");
      setEventImageUrl("");
      
      // Close dialog
      setShowCreateEventDialog(false);
      
      // Success message
      toast({
        title: "Event Created",
        description: "Event has been successfully created",
      });
    },
    onError: (error: any) => {
      console.error("Error creating event:", error);
      // Try to extract validation errors for better feedback
      let errorMessage = "Failed to create event. Please try again.";
      if (error?.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleCreateEvent = () => {
    // Validate form fields
    if (!eventName || !eventDescription || !eventType || !eventStatus || !eventStartDate || !eventEndDate) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // Build event data and submit using mutation
    const eventData = {
      name: eventName,
      description: eventDescription,
      type: eventType,
      status: eventStatus,
      stage: eventStage,
      mode: eventMode, // Add event mode
      startDate: new Date(eventStartDate).toISOString(),
      endDate: new Date(eventEndDate).toISOString(),
      imageUrl: eventImageUrl || null
    };
    
    console.log(eventData); // For debugging
    
    // Call the mutation with event data
    createEventMutation.mutate(eventData);
  };
  
  const handleEditEvent = (eventData: any) => {
    // Set selected event ID
    setSelectedEventId(eventData.id);
    
    // Pre-populate form fields with selected event data
    setEventName(eventData.name || '');
    setEventDescription(eventData.description || '');
    setEventType(eventData.type || 'poetry');
    setEventStatus(eventData.status || 'upcoming');
    setEventStage(eventData.stage || 'class');
    setEventMode(eventData.mode || 'allowAI'); // Set event mode, default to allowAI if not present
    setEventIsEnabled(eventData.isEnabled !== false); // Default to true if not specified
    
    // Format dates for input fields (YYYY-MM-DD)
    if (eventData.startDate) {
      const startDate = new Date(eventData.startDate);
      setEventStartDate(startDate.toISOString().split('T')[0]);
    }
    
    if (eventData.endDate) {
      const endDate = new Date(eventData.endDate);
      setEventEndDate(endDate.toISOString().split('T')[0]);
    }
    
    setEventImageUrl(eventData.imageUrl || '');
    
    // Open edit dialog
    setShowEditEventDialog(true);
  };
  
  const handleManageParticipants = (eventId: number) => {
    setSelectedEventId(eventId);
    setShowParticipantsDialog(true);
  };
  
  const handleViewVotingHistory = async (eventId: number) => {
    setSelectedEventId(eventId);
    setShowVotingHistoryDialog(true);
    setIsLoadingVotingHistory(true);
    setVotingHistoryData(null);
    
    try {
      const response = await fetch(`/api/events/${eventId}/voting-history`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch voting history: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Voting history API response:", data);
      
      // Process the raw API data into a format suitable for the UI
      const processedData = {
        eventName: data.event.name,
        eventStatus: data.event.status,
        eventStage: data.event.currentStage,
        
        // Class stage
        classStage: {
          // Basic stats
          totalSubmissions: data.stats.totalSubmissions,
          totalVotes: data.history.classStage.winners.length > 0 
            ? data.history.classStage.winners.reduce((sum: number, winner: any) => sum + (winner.voteCount || 0), 0)
            : 0,
          winnersCount: data.history.classStage.winners.length,
          completed: data.history.classStage.completed,
          
          // Format winners data for UI - Handle empty arrays safely
          winners: Array.isArray(data.history.classStage.winners) 
            ? data.history.classStage.winners.map((winner: any) => ({
                id: winner.id,
                studentName: winner.userFullName,
                className: winner.className,
                schoolName: winner.schoolName,
                gradeLevel: winner.gradeLevel,
                voteCount: winner.voteCount || 0,
                thumbnail: winner.thumbnail,
                title: winner.title
              }))
            : []
        },
        
        // School stage
        schoolStage: {
          totalSubmissions: data.history.schoolStage.winners.length,
          totalVotes: data.history.schoolStage.winners.length > 0
            ? data.history.schoolStage.winners.reduce((sum: number, winner: any) => sum + (winner.voteCount || 0), 0)
            : 0,
          winnersCount: data.history.schoolStage.winners.length,
          completed: data.history.schoolStage.completed,
          
          winners: Array.isArray(data.history.schoolStage.winners)
            ? data.history.schoolStage.winners.map((winner: any) => ({
                id: winner.id,
                studentName: winner.userFullName,
                className: winner.className,
                schoolName: winner.schoolName,
                gradeLevel: winner.gradeLevel,
                voteCount: winner.voteCount || 0,
                thumbnail: winner.thumbnail,
                title: winner.title
              }))
            : []
        },
        
        // Country stage
        countryStage: {
          totalSubmissions: data.history.countryStage.winners.length,
          totalVotes: data.history.countryStage.winners.length > 0
            ? data.history.countryStage.winners.reduce((sum: number, winner: any) => sum + (winner.voteCount || 0), 0)
            : 0,
          winnersCount: data.history.countryStage.winners.length,
          completed: data.history.countryStage.completed,
          
          winners: Array.isArray(data.history.countryStage.winners)
            ? data.history.countryStage.winners.map((winner: any) => ({
                id: winner.id,
                studentName: winner.userFullName,
                className: winner.className,
                schoolName: winner.schoolName,
                gradeLevel: winner.gradeLevel,
                voteCount: winner.voteCount || 0,
                thumbnail: winner.thumbnail,
                title: winner.title
              }))
            : []
        },
        
        // Global stage
        globalStage: {
          totalSubmissions: data.history.globalStage.winners.length,
          totalVotes: data.history.globalStage.winners.length > 0
            ? data.history.globalStage.winners.reduce((sum: number, winner: any) => sum + (winner.voteCount || 0), 0)
            : 0,
          winnersCount: data.history.globalStage.winners.length,
          completed: data.history.globalStage.completed,
          
          winners: Array.isArray(data.history.globalStage.winners)
            ? data.history.globalStage.winners.map((winner: any) => ({
                id: winner.id,
                studentName: winner.userFullName,
                className: winner.className,
                schoolName: winner.schoolName,
                gradeLevel: winner.gradeLevel,
                voteCount: winner.voteCount || 0,
                thumbnail: winner.thumbnail,
                title: winner.title
              }))
            : []
        }
      };
      
      console.log("Processed voting history data:", processedData);
      setVotingHistoryData(processedData);
    } catch (error) {
      console.error("Error fetching voting history:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch voting history",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVotingHistory(false);
    }
  };
  
  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      return apiRequest("PATCH", `/api/events/${eventData.id}`, {
        name: eventData.name,
        description: eventData.description,
        type: eventData.type,
        status: eventData.status,
        stage: eventData.stage,
        mode: eventData.mode, // Add event mode
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        imageUrl: eventData.imageUrl,
        isEnabled: eventData.isEnabled
      });
    },
    onSuccess: () => {
      // Force invalidate all events queries to refresh data everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events', 'admin'] });
      
      // We need to ensure the query cache is completely reset
      // This makes sure the events page will get fresh data
      queryClient.resetQueries({ queryKey: ['/api/events'] });
      
      // Reset form fields
      setEventName("");
      setEventDescription("");
      setEventType("poetry");
      setEventStatus("upcoming");
      setEventStage("class");
      setEventStartDate("");
      setEventEndDate("");
      setEventImageUrl("");
      setEventIsEnabled(true);
      setSelectedEventId(null);
      
      // Close dialog
      setShowEditEventDialog(false);
      
      // Success message
      toast({
        title: "Event Updated",
        description: "Event has been successfully updated and will appear in events list if enabled",
      });
    },
    onError: (error: any) => {
      console.error("Error updating event:", error);
      toast({
        title: "Error",
        description: "Failed to update event. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleUpdateEvent = () => {
    // Validate form fields
    if (!eventName || !eventDescription || !eventType || !eventStatus || !eventStartDate || !eventEndDate) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // Check if event ID is selected
    if (!selectedEventId) {
      toast({
        title: "Error",
        description: "No event selected for update",
        variant: "destructive",
      });
      return;
    }
    
    // Build event data and submit using mutation
    const eventData = {
      id: selectedEventId,
      name: eventName,
      description: eventDescription,
      type: eventType,
      status: eventStatus,
      stage: eventStage,
      mode: eventMode, // Add event mode
      startDate: new Date(eventStartDate).toISOString(),
      endDate: new Date(eventEndDate).toISOString(),
      imageUrl: eventImageUrl || null,
      isEnabled: eventIsEnabled
    };
    
    console.log(eventData); // For debugging
    
    // Call the mutation with event data
    updateEventMutation.mutate(eventData);
  };
  
  // School mutations
  const createSchoolMutation = useMutation({
    mutationFn: async (schoolData: InsertSchool) => {
      return apiRequest("POST", "/api/schools", schoolData);
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/schools'] });
      
      // Reset form fields
      setSchoolName("");
      setSchoolDescription("");
      setSchoolWebsite("");
      setSchoolCityId("");
      setSchoolStatus("true");
      setSchoolImageUrl("");
      
      // Show success toast
      toast({
        title: "School Created",
        description: "School has been successfully created",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Create School",
        description: "There was an error creating the school. Please try again.",
        variant: "destructive",
      });
      console.error("School creation error:", error);
    }
  });
  
  const updateSchoolMutation = useMutation({
    mutationFn: async (data: { id: number, schoolData: Partial<InsertSchool> }) => {
      return apiRequest("PATCH", `/api/schools/${data.id}`, data.schoolData);
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/schools'] });
      
      // Reset form state
      setSchoolName("");
      setSchoolDescription("");
      setSchoolWebsite("");
      setSchoolCityId("");
      setSchoolStatus("true");
      setSchoolImageUrl("");
      setSelectedSchoolId(null);
      
      // Show success toast
      toast({
        title: "School Updated",
        description: "School has been successfully updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Update School",
        description: "There was an error updating the school. Please try again.",
        variant: "destructive",
      });
      console.error("School update error:", error);
    }
  });

  const handleCreateSchool = () => {
    setShowCreateSchoolDialog(false);
    
    const schoolData: InsertSchool = {
      name: schoolName,
      description: schoolDescription,
      websiteUrl: schoolWebsite,
      cityId: schoolCityId ? parseInt(schoolCityId) : 1, // Default to 1 if not selected
      isActive: schoolStatus === "true",
      imageUrl: schoolImageUrl
    };
    
    createSchoolMutation.mutate(schoolData);
  };
  
  const handleUpdateSchool = () => {
    // Close the dialog
    setShowEditSchoolDialog(false);
    
    const schoolData: Partial<InsertSchool> = {
      name: schoolName,
      description: schoolDescription,
      websiteUrl: schoolWebsite,
      cityId: schoolCityId ? parseInt(schoolCityId) : undefined,
      isActive: schoolStatus === "true",
      imageUrl: schoolImageUrl
    };
    
    updateSchoolMutation.mutate({ 
      id: selectedSchoolId!, 
      schoolData 
    });
  };
  
  // Form state for class creation
  const [className, setClassName] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [isClassActive, setIsClassActive] = useState(true);
  


  // Create gallery item mutation
  const createGalleryItemMutation = useMutation({
    mutationFn: async (galleryItemData: any) => {
      return apiRequest("POST", "/api/gallery-items", galleryItemData);
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/gallery-items'] });
      
      // Reset form fields
      setGalleryItemTitle("");
      setGalleryItemDescription("");
      setGalleryItemContent("");
      setGalleryItemType("image");
      setGalleryItemFeatured(false);
      setGalleryItemIsActive(true);
      setGalleryItemOrderIndex(0);
      
      // Close dialog
      setShowCreateGalleryItemDialog(false);
      
      // Success message
      toast({
        title: "Gallery Item Created",
        description: "Gallery item has been successfully created",
      });
    },
    onError: (error: any) => {
      console.error("Error creating gallery item:", error);
      toast({
        title: "Error",
        description: "Failed to create gallery item. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update gallery item mutation
  const updateGalleryItemMutation = useMutation({
    mutationFn: async (galleryItemData: any) => {
      return apiRequest("PATCH", `/api/gallery-items/${galleryItemData.id}`, {
        title: galleryItemData.title,
        content: galleryItemData.content,
        type: galleryItemData.type,
        description: galleryItemData.description,
        featured: galleryItemData.featured,
        isActive: galleryItemData.isActive,
        orderIndex: galleryItemData.orderIndex || 0
      });
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/gallery-items'] });
      
      // Reset form fields
      setGalleryItemTitle("");
      setGalleryItemDescription("");
      setGalleryItemContent("");
      setGalleryItemType("image");
      setGalleryItemFeatured(false);
      setGalleryItemIsActive(true);
      setGalleryItemOrderIndex(0);
      setSelectedGalleryItem(null);
      
      // Close dialog
      setShowEditGalleryItemDialog(false);
      
      // Success message
      toast({
        title: "Gallery Item Updated",
        description: "Gallery item has been successfully updated",
      });
    },
    onError: (error: any) => {
      console.error("Error updating gallery item:", error);
      toast({
        title: "Error",
        description: "Failed to update gallery item. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete gallery item mutation
  const deleteGalleryItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/gallery-items/${id}`);
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/gallery-items'] });
      
      // Reset selected item
      setSelectedGalleryItem(null);
      
      // Close dialog
      setShowDeleteGalleryItemDialog(false);
      setShowDeleteGalleryItemConfirmDialog(false);
      
      // Success message
      toast({
        title: "Gallery Item Deleted",
        description: "Gallery item has been successfully deleted",
      });
    },
    onError: (error: any) => {
      console.error("Error deleting gallery item:", error);
      toast({
        title: "Error",
        description: "Failed to delete gallery item. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Handle gallery item operations
  const handleCreateGalleryItem = () => {
    // Validate form fields
    if (!galleryItemTitle || !galleryItemContent) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields (title and content)",
        variant: "destructive",
      });
      return;
    }
    
    // Build gallery item data and submit using mutation
    const galleryItemData = {
      title: galleryItemTitle,
      content: galleryItemContent,
      type: galleryItemType,
      description: galleryItemDescription || null,
      featured: galleryItemFeatured,
      isActive: galleryItemIsActive,
      orderIndex: galleryItemOrderIndex || 0,
      // No need to provide createdBy since it will be added by the server based on the logged-in user
      // Include createdAt and updatedAt - the server will handle these values if omitted, but providing them
      // can help ensure consistency
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('Submitting gallery item data:', galleryItemData);
    
    // Call the mutation with gallery item data
    createGalleryItemMutation.mutate(galleryItemData);
  };

  const handleEditGalleryItem = (itemData: any) => {
    // Set selected gallery item
    setSelectedGalleryItem(itemData);
    
    // Pre-populate form fields with selected gallery item data
    setGalleryItemTitle(itemData.title || "");
    setGalleryItemDescription(itemData.description || "");
    setGalleryItemContent(itemData.content || "");
    setGalleryItemType(itemData.type || "image");
    setGalleryItemFeatured(itemData.featured !== undefined ? itemData.featured : false);
    setGalleryItemIsActive(itemData.isActive !== undefined ? itemData.isActive : true);
    setGalleryItemOrderIndex(itemData.orderIndex || 0);
    
    // Open edit dialog
    setShowEditGalleryItemDialog(true);
  };

  const handleUpdateGalleryItem = () => {
    // Validate form fields
    if (!galleryItemTitle || !galleryItemContent) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields (title and content)",
        variant: "destructive",
      });
      return;
    }
    
    // Check if gallery item is selected
    if (!selectedGalleryItem) {
      toast({
        title: "Error",
        description: "No gallery item selected for update",
        variant: "destructive",
      });
      return;
    }
    
    // Build gallery item data and submit using mutation
    const galleryItemData = {
      id: selectedGalleryItem.id,
      title: galleryItemTitle,
      content: galleryItemContent,
      type: galleryItemType,
      description: galleryItemDescription || "",
      featured: galleryItemFeatured,
      isActive: galleryItemIsActive,
      orderIndex: galleryItemOrderIndex || 0
    };
    
    // Call the mutation with gallery item data
    updateGalleryItemMutation.mutate(galleryItemData);
  };

  const handleDeleteGalleryItem = (itemData: any) => {
    // Set selected gallery item and open confirm dialog
    setSelectedGalleryItem(itemData);
    setShowDeleteGalleryItemConfirmDialog(true);
  };

  const confirmDeleteGalleryItem = () => {
    // Check if gallery item is selected
    if (!selectedGalleryItem) {
      toast({
        title: "Error",
        description: "No gallery item selected for deletion",
        variant: "destructive",
      });
      return;
    }
    
    // Call the mutation with gallery item id
    deleteGalleryItemMutation.mutate(selectedGalleryItem.id);
  };

  // Create partner mutation
  const createPartnerMutation = useMutation({
    mutationFn: async (partnerData: any) => {
      return apiRequest("POST", "/api/partners", partnerData);
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/partners'] });
      
      // Reset form fields
      setPartnerName("");
      setPartnerDescription("");
      setPartnerWebsite("");
      setPartnerLogoUrl("");
      setPartnerIsActive(true);
      
      // Close dialog
      setShowCreatePartnerDialog(false);
      
      // Success message
      toast({
        title: "Partner Created",
        description: "Partner has been successfully created",
      });
    },
    onError: (error: any) => {
      console.error("Error creating partner:", error);
      toast({
        title: "Error",
        description: "Failed to create partner. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update partner mutation
  const updatePartnerMutation = useMutation({
    mutationFn: async (partnerData: any) => {
      return apiRequest("PATCH", `/api/partners/${partnerData.id}`, {
        name: partnerData.name,
        description: partnerData.description,
        websiteUrl: partnerData.websiteUrl,
        logoUrl: partnerData.logoUrl,
        isActive: partnerData.isActive
      });
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/partners'] });
      
      // Reset form fields
      setPartnerName("");
      setPartnerDescription("");
      setPartnerWebsite("");
      setPartnerLogoUrl("");
      setPartnerIsActive(true);
      setSelectedPartnerId(null);
      
      // Close dialog
      setShowEditPartnerDialog(false);
      
      // Success message
      toast({
        title: "Partner Updated",
        description: "Partner has been successfully updated",
      });
    },
    onError: (error: any) => {
      console.error("Error updating partner:", error);
      toast({
        title: "Error",
        description: "Failed to update partner. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleCreatePartner = () => {
    // Validate form fields
    if (!partnerName || !partnerDescription) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields (name and description)",
        variant: "destructive",
      });
      return;
    }
    
    // Build partner data and submit using mutation
    const partnerData = {
      name: partnerName,
      description: partnerDescription,
      websiteUrl: partnerWebsite || "",
      logoUrl: partnerLogoUrl || "",
      partnerType: "sponsor", // Adding the required partnerType field
      isActive: partnerIsActive
    };
    
    // Call the mutation with partner data
    createPartnerMutation.mutate(partnerData);
  };

  const handleEditPartner = (partnerData: any) => {
    // Set selected partner ID
    setSelectedPartnerId(partnerData.id);
    
    // Pre-populate form fields with selected partner data
    setPartnerName(partnerData.name || "");
    setPartnerDescription(partnerData.description || "");
    setPartnerWebsite(partnerData.websiteUrl || "");
    setPartnerLogoUrl(partnerData.logoUrl || "");
    setPartnerIsActive(partnerData.isActive !== undefined ? partnerData.isActive : true);
    
    // Open edit dialog
    setShowEditPartnerDialog(true);
  };

  const handleUpdatePartner = () => {
    // Validate form fields
    if (!partnerName || !partnerDescription) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields (name and description)",
        variant: "destructive",
      });
      return;
    }
    
    // Check if partner ID is selected
    if (!selectedPartnerId) {
      toast({
        title: "Error",
        description: "No partner selected for update",
        variant: "destructive",
      });
      return;
    }
    
    // Build partner data and submit using mutation
    const partnerData = {
      id: selectedPartnerId,
      name: partnerName,
      description: partnerDescription,
      websiteUrl: partnerWebsite || "",
      logoUrl: partnerLogoUrl || "",
      partnerType: "sponsor", // Adding the required partnerType field
      isActive: partnerIsActive
    };
    
    // Call the mutation with partner data
    updatePartnerMutation.mutate(partnerData);
  };
  
  // Create class mutation
  const createClassMutation = useMutation({
    mutationFn: async (classData: any) => {
      return apiRequest("POST", "/api/classes", classData);
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      
      // Reset form fields
      setClassName("");
      setSelectedSchool("");
      setSelectedGrade("");
      setSelectedTeacher("");
      setIsClassActive(true);
      
      // Close dialog
      setShowCreateClassDialog(false);
      
      // Success message
      toast({
        title: "Class Created",
        description: "Class has been successfully created",
      });
    },
    onError: (error: any) => {
      console.error("Error creating class:", error);
      toast({
        title: "Error",
        description: "Failed to create class. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleCreateClass = () => {
    // Validate form fields
    if (!className || !selectedSchool || !selectedGrade || !selectedTeacher) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // Build class data and submit using mutation
    const classData = {
      name: className,
      schoolId: parseInt(selectedSchool),
      gradeLevel: `Grade ${selectedGrade}`,
      teacherId: parseInt(selectedTeacher),
      isLocked: !isClassActive
    };
    
    // Call the mutation with class data
    createClassMutation.mutate(classData);
  };

  const handleEditClass = (classData: any) => {
    // Set selected class ID
    setSelectedClassId(classData.id);
    
    // Pre-populate form fields with selected class data
    setClassName(classData.name || '');
    setSelectedSchool(classData.schoolId ? classData.schoolId.toString() : '');
    
    // Handle different grade formats - some might be "Grade 9", others "9th"
    const gradeLevel = classData.gradeLevel || '';
    const grade = gradeLevel.includes('Grade ') 
      ? gradeLevel.replace('Grade ', '') 
      : gradeLevel.replace(/[^0-9]/g, '');
    setSelectedGrade(grade);
    
    setSelectedTeacher(classData.teacherId ? classData.teacherId.toString() : '');
    setIsClassActive(classData.isLocked === undefined ? true : !classData.isLocked);
    
    // Open edit dialog
    setShowEditClassDialog(true);
  };
  
  // Update class mutation
  const updateClassMutation = useMutation({
    mutationFn: async (classData: any) => {
      return apiRequest("PATCH", `/api/classes/${classData.id}`, {
        name: classData.name,
        schoolId: classData.schoolId,
        gradeLevel: classData.gradeLevel,
        teacherId: classData.teacherId,
        isLocked: classData.isLocked
      });
    },
    onSuccess: () => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      
      // Reset form fields
      setClassName("");
      setSelectedSchool("");
      setSelectedGrade("");
      setSelectedTeacher("");
      setIsClassActive(true);
      setSelectedClassId(null);
      
      // Close dialog
      setShowEditClassDialog(false);
      
      // Success message
      toast({
        title: "Class Updated",
        description: "Class has been successfully updated",
      });
    },
    onError: (error: any) => {
      console.error("Error updating class:", error);
      toast({
        title: "Error",
        description: "Failed to update class. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleUpdateClass = () => {
    // Validate form fields
    if (!className || !selectedSchool || !selectedGrade || !selectedTeacher) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // Check if class ID is selected
    if (!selectedClassId) {
      toast({
        title: "Error",
        description: "No class selected for update",
        variant: "destructive",
      });
      return;
    }
    
    // Build class data and submit using mutation
    const classData = {
      id: selectedClassId,
      name: className,
      schoolId: parseInt(selectedSchool),
      gradeLevel: `Grade ${selectedGrade}`,
      teacherId: parseInt(selectedTeacher),
      isLocked: !isClassActive
    };
    
    // Call the mutation with class data
    updateClassMutation.mutate(classData);
  };
  
  return (
    <div>
      {/* Header Section */}
      <div className="relative rounded-xl overflow-hidden mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-indigo-800 opacity-90"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJ3aGl0ZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMiIvPjwvZz48L3N2Zz4=')] opacity-10"></div>
        <div className="relative z-10 py-8 px-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold font-heading mb-2">Admin Dashboard</h1>
              <p className="text-blue-100">Manage users, schools, classes, events and view reports</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                onClick={() => window.location.href = '/admin/monitoring'}
              >
                <ActivitySquare className="h-4 w-4 mr-2" />
                System Monitoring
              </Button>
              <div className="hidden md:block">
                <UserCog className="h-16 w-16 text-white/30" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Users</p>
              <p className="text-2xl font-bold">{totalUsers}</p>
              <div className="flex gap-2 items-center text-xs text-blue-500 mt-1">
                <span>{totalStudents} Students</span>
                <span className="h-1 w-1 rounded-full bg-blue-400"></span>
                <span>{totalTeachers} Teachers</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100 hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center">
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center mr-4">
              <SchoolIcon className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-indigo-600 font-medium">Schools</p>
              <p className="text-2xl font-bold">{totalSchools}</p>
              <p className="text-xs text-indigo-500 mt-1">{totalClasses} Classes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center">
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mr-4">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-600 font-medium">Events</p>
              <p className="text-2xl font-bold">{totalEvents}</p>
              <div className="flex gap-2 items-center text-xs text-purple-500 mt-1">
                <span>{activeEvents} Active</span>
                <span className="h-1 w-1 rounded-full bg-purple-400"></span>
                <span>{upcomingEvents} Upcoming</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
              <BarChart className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600 font-medium">Activities</p>
              <p className="text-2xl font-bold">
                {isLoadingEvents || isLoadingUsers ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  (activeEvents * 10) + totalUsers
                )}
              </p>
              <p className="text-xs text-green-500 mt-1">System monitoring</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="users" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white p-1 border rounded-lg shadow-sm">
          <TabsTrigger value="users" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <Users className="h-4 w-4" />
            <span>Users</span>
          </TabsTrigger>
          <TabsTrigger value="schools" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <Building className="h-4 w-4" />
            <span>Schools</span>
          </TabsTrigger>
          <TabsTrigger value="classes" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <Library className="h-4 w-4" />
            <span>Classes</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <Calendar className="h-4 w-4" />
            <span>Events</span>
          </TabsTrigger>
          <TabsTrigger value="partners" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <Briefcase className="h-4 w-4" />
            <span>Partners</span>
          </TabsTrigger>
          <TabsTrigger value="teacherRoles" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <UserCog className="h-4 w-4" />
            <span>Teacher Roles</span>
          </TabsTrigger>
          <TabsTrigger value="secondaryTeachers" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <Users className="h-4 w-4" />
            <span>Secondary Teachers</span>
          </TabsTrigger>
          <TabsTrigger value="gallery" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <ImageIcon className="h-4 w-4" />
            <span>Gallery</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md flex gap-2 items-center">
            <PieChart className="h-4 w-4" />
            <span>Reports</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Manage Users</CardTitle>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    refetchUsers();
                    toast({
                      title: "Refreshed",
                      description: "User list has been refreshed",
                    });
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
                </Button>
                
                {/* Import Button */}
                <Button variant="outline" onClick={() => handleImportClick("users")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Import
                </Button>
                
                {/* Export Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleExportData("users", "csv")}>
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportData("users", "json")}>
                      JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportData("users", "xlsx")}>
                      Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button onClick={() => setShowCreateUserDialog(true)}>
                  Create New User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex flex-wrap gap-4">
                  <div className="relative flex-grow">
                    <Input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <SearchIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Schools" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Schools</SelectItem>
                      {schools.map((school: any) => (
                        <SelectItem key={school.id} value={school.id.toString()}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <UsersTable 
                schoolFilter={schoolFilter === "all" ? undefined : Number(schoolFilter)}
              />
              
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">1</span> to{" "}
                  <span className="font-medium">{filteredUsers.length}</span> of{" "}
                  <span className="font-medium">{filteredUsers.length}</span> results
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" disabled>Previous</Button>
                  <Button variant="default" size="sm" className="bg-primary">1</Button>
                  <Button variant="outline" size="sm" disabled>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="events">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Manage Events</CardTitle>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    refetchEvents();
                    toast({
                      title: "Refreshed",
                      description: "Event list has been refreshed",
                    });
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
                </Button>
                
                {/* Import Button */}
                <Button variant="outline" onClick={() => handleImportClick("events")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Import
                </Button>
                
                {/* Export Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleExportData("events", "csv")}>
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportData("events", "json")}>
                      JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportData("events", "xlsx")}>
                      Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button onClick={() => setShowCreateEventDialog(true)}>
                  Create New Event
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <EventTable 
                events={events} 
                isLoading={isLoadingEvents}
                isAdmin={true}
                onEdit={handleEditEvent}
                onManageParticipants={handleManageParticipants}
                onViewVotingHistory={handleViewVotingHistory}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="partners">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Manage Partners</CardTitle>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    refetchPartners();
                    toast({
                      title: "Refreshed",
                      description: "Partner list has been refreshed",
                    });
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
                </Button>
                
                {/* Import Button */}
                <Button variant="outline" onClick={() => handleImportClick("partners")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Import
                </Button>
                
                {/* Export Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleExportData("partners", "csv")}>
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportData("partners", "json")}>
                      JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportData("partners", "xlsx")}>
                      Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button onClick={() => setShowCreatePartnerDialog(true)}>
                  Add New Partner
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPartners ? (
                <div className="text-center py-8">
                  <p className="text-blue-600">Loading partners...</p>
                </div>
              ) : partners.length === 0 ? (
                <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-blue-700">No partners found. Add your first partner!</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-blue-200 rounded-md">
                  <table className="w-full">
                    <thead className="bg-blue-50">
                      <tr className="border-b border-blue-200">
                        <th className="text-left p-3 text-blue-800">Name</th>
                        <th className="text-left p-3 text-blue-800">Website</th>
                        <th className="text-left p-3 text-blue-800">Logo</th>
                        <th className="text-left p-3 text-blue-800">Status</th>
                        <th className="text-left p-3 text-blue-800">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partners.map((partner: any) => (
                        <tr key={partner.id} className="border-b border-blue-100 hover:bg-blue-50">
                          <td className="p-3 text-blue-800 font-medium">{partner.name}</td>
                          <td className="p-3">
                            {partner.websiteUrl ? (
                              <a 
                                href={partner.websiteUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {partner.websiteUrl}
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {partner.logoUrl ? (
                              <div className="w-12 h-12 rounded-md overflow-hidden border">
                                <img 
                                  src={partner.logoUrl} 
                                  alt={`${partner.name} logo`} 
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-md flex items-center justify-center bg-blue-50 text-blue-400 border border-blue-200">
                                <Briefcase className="w-6 h-6" />
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={partner.isActive ? "default" : "secondary"}
                              className={partner.isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800"}
                            >
                              {partner.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="icon"
                                onClick={() => handleEditPartner(partner)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path></svg>
                              </Button>
                              <Button 
                                variant="outline" 
                                size="icon"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => {
                                  setSelectedItemToDelete({
                                    type: 'partner',
                                    id: partner.id
                                  });
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="schools">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Manage Schools</CardTitle>
              <div className="flex space-x-2">
                {/* Import Button */}
                <Button variant="outline" onClick={() => handleImportClick("schools")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Import
                </Button>
                
                {/* Export Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleExportData("schools", "csv")}>
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportData("schools", "json")}>
                      JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportData("schools", "xlsx")}>
                      Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button onClick={() => setShowCreateSchoolDialog(true)}>
                  Add New School
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingSchools ? (
                <div className="text-center py-8">
                  <p className="text-blue-600">Loading schools...</p>
                </div>
              ) : schools.length === 0 ? (
                <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-blue-700">No schools found. Add your first school!</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-blue-200 rounded-md">
                  <table className="w-full">
                    <thead className="bg-blue-50">
                      <tr className="border-b border-blue-200">
                        <th className="text-left p-3 text-blue-800">Name</th>
                        <th className="text-left p-3 text-blue-800">Website</th>
                        <th className="text-left p-3 text-blue-800">Status</th>
                        <th className="text-left p-3 text-blue-800">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schools.map((school: any) => (
                        <tr key={school.id} className="border-b border-blue-100 hover:bg-blue-50">
                          <td className="p-3 text-blue-800 font-medium">{school.name}</td>
                          <td className="p-3">
                            {school.websiteUrl ? (
                              <a 
                                href={school.websiteUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {school.websiteUrl}
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={school.isActive ? "default" : "secondary"}
                              className={school.isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800"}
                            >
                              {school.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => {
                                  // Set selected school ID
                                  setSelectedSchoolId(school.id);
                                  
                                  // Pre-populate form fields with selected school data
                                  setSchoolName(school.name || '');
                                  setSchoolDescription(school.description || '');
                                  setSchoolWebsite(school.websiteUrl || '');
                                  setSchoolCityId(school.cityId ? school.cityId.toString() : '');
                                  setSchoolStatus(school.isActive ? 'true' : 'false');
                                  setSchoolImageUrl(school.imageUrl || '');
                                  
                                  // Open edit dialog
                                  setShowEditSchoolDialog(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedSchoolId(school.id);
                                  toast({
                                    description: "Delete School functionality coming soon!",
                                    variant: "destructive"
                                  });
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="classes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Manage Classes</CardTitle>
              <div className="flex space-x-2">
                {/* Import Button */}
                <Button variant="outline" onClick={() => handleImportClick("classes")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Import
                </Button>
                
                {/* Export Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleExportData("classes", "csv")}>
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportData("classes", "json")}>
                      JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportData("classes", "xlsx")}>
                      Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button onClick={() => setShowCreateClassDialog(true)}>
                  Create New Class
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingClasses ? (
                <div className="text-center py-8">
                  <p className="text-blue-600">Loading classes...</p>
                </div>
              ) : (classes as any[]).length === 0 ? (
                <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-blue-700">No classes found. Create your first class!</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-blue-200 rounded-md">
                  <table className="w-full">
                    <thead className="bg-blue-50">
                      <tr className="border-b border-blue-200">
                        <th className="text-left p-3 text-blue-800">Class Name</th>
                        <th className="text-left p-3 text-blue-800">School</th>
                        <th className="text-left p-3 text-blue-800">Grade</th>
                        <th className="text-left p-3 text-blue-800">Teacher</th>
                        <th className="text-left p-3 text-blue-800">Status</th>
                        <th className="text-left p-3 text-blue-800">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(classes as any[]).map((classItem: any) => {
                        const school = (schools as any[]).find((s: any) => s.id === classItem.schoolId);
                        const teacher = (allUsers as any[]).find((u: any) => u.id === classItem.teacherId);
                        
                        return (
                          <tr key={classItem.id} className="border-b border-blue-100 hover:bg-blue-50">
                            <td className="p-3 text-blue-800 font-medium">{classItem.name}</td>
                            <td className="p-3">{school?.name || <span className="text-gray-400">-</span>}</td>
                            <td className="p-3">{classItem.gradeLevel || <span className="text-gray-400">-</span>}</td>
                            <td className="p-3">{teacher?.fullName || <span className="text-gray-400">-</span>}</td>
                            <td className="p-3">
                              <Badge
                                variant={classItem.isLocked ? "secondary" : "default"}
                                className={classItem.isLocked ? "bg-gray-100 text-gray-800" : "bg-green-100 text-green-800 border-green-200"}
                              >
                                {classItem.isLocked ? "Locked" : "Active"}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => {
                                    setSelectedClassId(classItem.id);
                                    setShowEditClassDialog(true);
                                    // Pre-populate form
                                    handleEditClass(classItem);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => {
                                    setSelectedClassId(classItem.id);
                                    setShowStudentsDialog(true);
                                  }}
                                >
                                  Students
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setSelectedItemToDelete({
                                      type: 'class',
                                      id: classItem.id
                                    });
                                    setShowDeleteDialog(true);
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="teacherRoles">
          <TeacherRoleManagement onRefreshData={() => {
            toast({
              title: "Success",
              description: "Teacher roles refreshed",
            });
            // Refresh users list to reflect role changes
            refetchUsers();
          }} />
        </TabsContent>
        
        <TabsContent value="secondaryTeachers">
          <SecondaryTeacherManagement onRefreshData={() => {
            toast({
              title: "Success",
              description: "Secondary teacher assignments refreshed",
            });
          }} />
        </TabsContent>
        
        <TabsContent value="gallery">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Manage Gallery</CardTitle>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    // Refetch gallery items
                    refetchGalleryItems();
                    toast({
                      title: "Refreshed",
                      description: "Gallery items list has been refreshed",
                    });
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
                </Button>
                
                <Button onClick={() => setShowCreateGalleryItemDialog(true)}>
                  Add Gallery Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex flex-wrap gap-4">
                  <div className="relative flex-grow">
                    <Input
                      type="text"
                      placeholder="Search gallery items..."
                      value={gallerySearchQuery}
                      onChange={(e) => setGallerySearchQuery(e.target.value)}
                      className="pl-10"
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <SearchIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  <Select value={galleryTypeFilter} onValueChange={setGalleryTypeFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="image">Images</SelectItem>
                      <SelectItem value="poem">Poems</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={galleryFeaturedFilter} onValueChange={setGalleryFeaturedFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Items" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Items</SelectItem>
                      <SelectItem value="featured">Featured Only</SelectItem>
                      <SelectItem value="not-featured">Not Featured</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {isLoadingGalleryItems ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-blue-600">Loading gallery items...</p>
                </div>
              ) : filteredGalleryItems.length === 0 ? (
                <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-blue-700">No gallery items found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGalleryItems.map((item) => (
                    <div 
                      key={item.id} 
                      className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Gallery item preview */}
                      <div className="relative w-full h-48 bg-gray-100">
                        {item.type === 'image' ? (
                          <img 
                            src={item.content} 
                            alt={item.title} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="p-4 h-full overflow-y-auto font-serif text-gray-800">
                            {item.content.substring(0, 200)}
                            {item.content.length > 200 && '...'}
                          </div>
                        )}
                        {item.featured && (
                          <div className="absolute top-2 right-2 bg-amber-500 text-white px-2 py-1 rounded-md text-xs font-semibold">
                            Featured
                          </div>
                        )}
                      </div>
                      
                      {/* Item details */}
                      <div className="p-4">
                        <h3 className="font-medium text-lg mb-1">{item.title}</h3>
                        <p className="text-sm text-gray-500 mb-2">
                          {item.type === 'image' ? 'Image' : 'Poem'} • Created {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description || 'No description'}</p>
                        
                        {/* Actions */}
                        <div className="flex justify-between">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditGalleryItem(item)}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => {
                              setSelectedGalleryItem(item);
                              setShowDeleteGalleryItemConfirmDialog(true);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reports">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>System Reports</CardTitle>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    // Refresh all data
                    refetchEvents();
                    refetchUsers();
                    refetchSchools();
                    refetchClasses();
                    refetchStatistics();
                    toast({
                      title: "Refreshed",
                      description: "Report data has been refreshed",
                    });
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Overall Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-50 rounded-lg shadow p-4 border border-blue-100">
                  <h3 className="text-sm font-medium text-blue-800 mb-1">Total Users</h3>
                  <p className="text-3xl font-bold text-blue-700">
                    {isLoadingUsers ? (
                      <span className="text-lg">Loading...</span>
                    ) : (
                      (allUsers as any[]).length
                    )}
                  </p>
                  <div className="mt-2 text-xs flex items-center text-blue-600">
                    <div className="flex space-x-2">
                      <span>{(allUsers as any[])?.filter((u: any) => u.role === 'student').length || 0} Students</span>
                      <span>•</span>
                      <span>{(allUsers as any[])?.filter((u: any) => u.role === 'teacher').length || 0} Teachers</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-indigo-50 rounded-lg shadow p-4 border border-indigo-100">
                  <h3 className="text-sm font-medium text-indigo-800 mb-1">Total Schools</h3>
                  <p className="text-3xl font-bold text-indigo-700">
                    {isLoadingSchools ? (
                      <span className="text-lg">Loading...</span>
                    ) : (
                      schools.length
                    )}
                  </p>
                  <div className="mt-2 text-xs flex items-center text-indigo-600">
                    <div className="flex space-x-2">
                      <span>{(classes as any[]).length} Classes</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-purple-50 rounded-lg shadow p-4 border border-purple-100">
                  <h3 className="text-sm font-medium text-purple-800 mb-1">Total Events</h3>
                  <p className="text-3xl font-bold text-purple-700">
                    {isLoadingEvents ? (
                      <span className="text-lg">Loading...</span>
                    ) : (
                      events.length
                    )}
                  </p>
                  <div className="mt-2 text-xs flex items-center text-purple-600">
                    <div className="flex space-x-2">
                      <span>{events?.filter((e: any) => e.status === 'open').length || 0} Open</span>
                      <span>•</span>
                      <span>{events?.filter((e: any) => e.status === 'upcoming').length || 0} Upcoming</span>
                      <span>•</span>
                      <span>{events?.filter((e: any) => e.status === 'closed').length || 0} Closed</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-lg shadow p-4 border border-green-100">
                  <h3 className="text-sm font-medium text-green-800 mb-1">Total Submissions</h3>
                  <p className="text-3xl font-bold text-green-700">
                    {isLoadingStatistics ? (
                      <span className="text-lg">Loading...</span>
                    ) : (
                      (statistics as any)?.overall?.totalSubmissions || 0
                    )}
                  </p>
                  <div className="mt-2 text-xs flex items-center text-green-600">
                    <div className="flex space-x-2">
                      <span>{(statistics as any)?.overall?.approvedSubmissions || 0} Approved</span>
                      <span>•</span>
                      <span>{(statistics as any)?.overall?.pendingSubmissions || 0} Pending</span>
                      <span>•</span>
                      <span>{(statistics as any)?.overall?.rejectedSubmissions || 0} Rejected</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Submission breakdown */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Submission Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6 border border-blue-200">
                    <h4 className="text-blue-800 font-semibold mb-3 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v15m0 0 6.713-6.712M12 18l-6.713-6.712"/><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
                      Submissions by Category
                    </h4>
                    {isLoadingStatistics ? (
                      <div className="flex justify-center items-center h-40">
                        <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                          <div className="text-sm text-blue-700 mb-1">Poetry Submissions</div>
                          <div className="text-3xl font-bold text-blue-800">{(statistics as any)?.overall?.poetrySubmissions || 0}</div>
                          <div className="text-xs text-blue-600 mt-1">
                            {Math.round((((statistics as any)?.overall?.poetrySubmissions || 0) / ((statistics as any)?.overall?.totalSubmissions || 1)) * 100)}% of total
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                          <div className="text-sm text-blue-700 mb-1">Painting Submissions</div>
                          <div className="text-3xl font-bold text-blue-800">{(statistics as any)?.overall?.paintingSubmissions || 0}</div>
                          <div className="text-xs text-blue-600 mt-1">
                            {Math.round((((statistics as any)?.overall?.paintingSubmissions || 0) / ((statistics as any)?.overall?.totalSubmissions || 1)) * 100)}% of total
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-6 border border-purple-200">
                    <h4 className="text-purple-800 font-semibold mb-3 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Submission Status
                    </h4>
                    {isLoadingStatistics ? (
                      <div className="flex justify-center items-center h-40">
                        <svg className="animate-spin h-8 w-8 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-purple-200">
                          <div className="text-sm text-purple-700 mb-1">Approved</div>
                          <div className="text-2xl font-bold text-purple-800">{(statistics as any)?.overall?.approvedSubmissions || 0}</div>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${Math.round((((statistics as any)?.overall?.approvedSubmissions || 0) / ((statistics as any)?.overall?.totalSubmissions || 1)) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-purple-200">
                          <div className="text-sm text-purple-700 mb-1">Pending</div>
                          <div className="text-2xl font-bold text-purple-800">{(statistics as any)?.overall?.pendingSubmissions || 0}</div>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-yellow-500 h-2 rounded-full"
                              style={{ width: `${Math.round((((statistics as any)?.overall?.pendingSubmissions || 0) / ((statistics as any)?.overall?.totalSubmissions || 1)) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-purple-200">
                          <div className="text-sm text-purple-700 mb-1">Rejected</div>
                          <div className="text-2xl font-bold text-purple-800">{(statistics as any)?.overall?.rejectedSubmissions || 0}</div>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full"
                              style={{ width: `${Math.round((((statistics as any)?.overall?.rejectedSubmissions || 0) / ((statistics as any)?.overall?.totalSubmissions || 1)) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Event Analytics */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Event Analytics</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Event Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Participants
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Submissions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {isLoadingEvents ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">
                            Loading events...
                          </td>
                        </tr>
                      ) : events.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">
                            No events found
                          </td>
                        </tr>
                      ) : (
                        events.map((event: any) => (
                          <tr key={event.id}>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {event.name}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                              {event.type}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full
                                ${event.status === 'open' ? 'bg-green-100 text-green-800' : 
                                  event.status === 'upcoming' ? 'bg-blue-100 text-blue-800' : 
                                    'bg-gray-100 text-gray-800'}
                              `}>
                                {event.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {event.participantCount || 0}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {event.submissionCount || 0}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* School Participation */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">School Participation</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          School Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Teachers
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Students
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Classes
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Submissions
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Approval Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {isLoadingSchools || isLoadingUsers || isLoadingClasses || isLoadingStatistics ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-500">
                            Loading school data...
                          </td>
                        </tr>
                      ) : schools.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-500">
                            No schools found
                          </td>
                        </tr>
                      ) : (
                        schools.map((school: any) => {
                          const teacherCount = (allUsers as any[]).filter((u: any) => u.role === 'teacher' && u.schoolId === school.id).length;
                          const studentCount = (allUsers as any[]).filter((u: any) => u.role === 'student' && u.schoolId === school.id).length;
                          const classCount = (classes as any[]).filter((c: any) => c.schoolId === school.id).length;
                          
                          // Get school statistics from our API data
                          const schoolStat = (statistics as any)?.schoolStats?.find((stat: any) => stat.schoolId === school.id) || {
                            totalSubmissions: 0,
                            approvedSubmissions: 0,
                            pendingSubmissions: 0,
                            rejectedSubmissions: 0
                          };
                          
                          // Calculate approval rate
                          const approvalRate = schoolStat.totalSubmissions > 0 
                            ? Math.round((schoolStat.approvedSubmissions / schoolStat.totalSubmissions) * 100) 
                            : 0;
                          
                          return (
                            <tr key={school.id}>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {school.name}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {teacherCount}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {studentCount}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {classCount}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex flex-col">
                                  <span>{schoolStat.totalSubmissions} total</span>
                                  <span className="text-xs text-gray-400">
                                    <span className="text-green-500">{schoolStat.approvedSubmissions} approved</span> / 
                                    <span className="text-yellow-500"> {schoolStat.pendingSubmissions} pending</span> / 
                                    <span className="text-red-500"> {schoolStat.rejectedSubmissions} rejected</span>
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm">
                                <div className="flex items-center">
                                  <span className={`mr-2 ${
                                    approvalRate >= 70 ? 'text-green-600' : 
                                    approvalRate >= 40 ? 'text-yellow-600' : 
                                    approvalRate > 0 ? 'text-red-600' : 'text-gray-400'
                                  }`}>
                                    {approvalRate}%
                                  </span>
                                  <div className="w-16 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full ${
                                        approvalRate >= 70 ? 'bg-green-500' : 
                                        approvalRate >= 40 ? 'bg-yellow-500' : 
                                        approvalRate > 0 ? 'bg-red-500' : 'bg-gray-300'
                                      }`} 
                                      style={{ width: `${approvalRate}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Event Report - New Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Event Report</h3>
                
                {/* Event Selection Dropdown */}
                <div className="mb-6">
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div className="w-full md:w-1/3">
                      <Label htmlFor="event-report-select">Select Event</Label>
                      <Select
                        onValueChange={(value) => {
                          setSelectedReportEventId(parseInt(value));
                        }}
                      >
                        <SelectTrigger id="event-report-select" className="mt-1">
                          <SelectValue placeholder="Choose an event" />
                        </SelectTrigger>
                        <SelectContent>
                          {events.map((event: any) => (
                            <SelectItem key={event.id} value={event.id.toString()}>
                              {event.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="mt-6"
                      variant="outline"
                      onClick={() => {
                        if (selectedReportEventId) {
                          // Fetch detailed event data for report
                          // This would usually be a separate API call, but for now we'll use existing data
                          toast({
                            title: "Report Generated",
                            description: "Event report has been updated",
                          });
                        } else {
                          toast({
                            title: "Select Event",
                            description: "Please select an event to generate the report",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Generate Report
                    </Button>
                  </div>
                </div>
                
                {selectedReportEventId && (
                  <>
                    {/* Event Overview */}
                    <div className="bg-white rounded-lg border shadow-sm p-5 mb-6">
                      {(() => {
                        const selectedEvent = events.find((e: any) => e.id === selectedReportEventId);
                        return selectedEvent ? (
                          <div>
                            <h4 className="font-bold text-xl text-blue-700 mb-3">{selectedEvent.name}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-sm text-gray-500">Event Type</p>
                                <p className="capitalize font-medium">{selectedEvent.type}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Status</p>
                                <p className="capitalize font-medium">{selectedEvent.status}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Stage</p>
                                <p className="capitalize font-medium">{selectedEvent.stage}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Start Date</p>
                                <p className="font-medium">
                                  {new Date(selectedEvent.startDate).toLocaleDateString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">End Date</p>
                                <p className="font-medium">
                                  {new Date(selectedEvent.endDate).toLocaleDateString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Total Participants</p>
                                <p className="font-medium">{selectedEvent.participantCount || 0}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p>Event not found</p>
                        );
                      })()}
                    </div>
                    
                    {/* Participation by School */}
                    <div className="bg-white rounded-lg border shadow-sm p-5 mb-6">
                      <h4 className="font-bold text-lg text-blue-700 mb-3">Participation by School</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                School
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Classes
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Students
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Submissions
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Winner
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {schools.map((school: any) => {
                              // Get classes for this school
                              const schoolClasses = (classes as any[]).filter((c: any) => c.schoolId === school.id);
                              
                              // Get students for this school
                              const schoolStudents = (allUsers as any[]).filter((u: any) => 
                                u.role === 'student' && u.schoolId === school.id
                              );
                              
                              // Calculate submissions (this would usually come from the API)
                              // Here we're using a placeholder calculation
                              const submissionCount = schoolStudents.length > 0 ? 
                                Math.floor(schoolStudents.length * 0.7) : 0;
                              
                              // Determine if this school has a winner (placeholder logic)
                              const hasWinner = schoolStudents.length > 0 && Math.random() > 0.5;
                              
                              return (
                                <tr key={school.id}>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {school.name}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {schoolClasses.length}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {schoolStudents.length}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {submissionCount}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {hasWinner ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Yes
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        No
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Class Breakdown */}
                    <div className="bg-white rounded-lg border shadow-sm p-5 mb-6">
                      <h4 className="font-bold text-lg text-blue-700 mb-3">Class Breakdown</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Class
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                School
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Grade
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Students
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Submissions
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Votes
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Winner
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {(classes as any[]).map((classItem: any) => {
                              // Get school for this class
                              const school = schools.find((s: any) => s.id === classItem.schoolId);
                              
                              // Get students for this class
                              const classStudents = (allUsers as any[]).filter((u: any) => 
                                u.role === 'student' && u.classId === classItem.id
                              );
                              
                              // Calculate submissions (placeholder)
                              const submissionCount = classStudents.length > 0 ? 
                                Math.floor(classStudents.length * 0.8) : 0;
                              
                              // Calculate votes (placeholder)
                              const voteCount = submissionCount * 3;
                              
                              // Determine if this class has a winner (placeholder)
                              const hasWinner = classStudents.length > 0;
                              
                              return (
                                <tr key={classItem.id}>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {classItem.name}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {school ? school.name : "N/A"}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {classItem.gradeLevel}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {classStudents.length}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {submissionCount}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {voteCount}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {hasWinner && submissionCount > 0 ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Yes
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        No
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Participants */}
                    <div className="bg-white rounded-lg border shadow-sm p-5 mb-6">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-lg text-blue-700">Participants</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (selectedReportEventId) {
                              // Handle export of participants list
                              const link = document.createElement('a');
                              link.href = `/api/events/${selectedReportEventId}/participants/export/csv`;
                              link.download = `event_${selectedReportEventId}_participants.csv`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" /> Export
                        </Button>
                      </div>
                      <div className="overflow-x-auto">
                        <ParticipantsTable eventId={selectedReportEventId} />
                      </div>
                    </div>
                    
                    {/* Student Submissions */}
                    <div className="bg-white rounded-lg border shadow-sm p-5">
                      <h4 className="font-bold text-lg text-blue-700 mb-3">Student Submissions</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Student
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Class
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                School
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Submission Title
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Votes
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Class Winner
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                School Winner
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Country Winner
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {(allUsers as any[])
                              .filter((user: any) => user.role === 'student')
                              .slice(0, 10) // Limit to first 10 for demonstration
                              .map((student: any, index: number) => {
                                const studentClass = (classes as any[]).find((c: any) => c.id === student.classId);
                                const school = schools.find((s: any) => s.id === student.schoolId);
                                
                                // For demonstration, we'll assume some students have submissions
                                const hasSubmission = index % 3 !== 2; // 2/3 of students have submissions
                                const voteCount = hasSubmission ? Math.floor(Math.random() * 15) : 0;
                                
                                // Determine winners at different stages
                                const isClassWinner = hasSubmission && voteCount > 10;
                                const isSchoolWinner = isClassWinner && Math.random() > 0.7;
                                const isCountryWinner = isSchoolWinner && Math.random() > 0.8;
                                
                                return (
                                  <tr key={student.id}>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {student.fullName}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {studentClass ? studentClass.name : "N/A"}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {school ? school.name : "N/A"}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {hasSubmission ? `Submission ${index + 1}` : "No submission"}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {voteCount}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {isClassWinner ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          Yes
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          No
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {isSchoolWinner ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          Yes
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          No
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {isCountryWinner ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          Yes
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          No
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* Import/Export Section */}
              <div className="mt-10">
                <h3 className="text-lg font-semibold mb-4">Data Import/Export</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Import Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Import Data</CardTitle>
                      <CardDescription>
                        Upload data files to import users, schools, classes, or events
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="users" className="w-full">
                        <TabsList className="grid grid-cols-4 mb-4">
                          <TabsTrigger value="users">Users</TabsTrigger>
                          <TabsTrigger value="schools">Schools</TabsTrigger>
                          <TabsTrigger value="classes">Classes</TabsTrigger>
                          <TabsTrigger value="events">Events</TabsTrigger>
                        </TabsList>
                        
                        {/* Users Import */}
                        <TabsContent value="users">
                          <form 
                            className="space-y-4"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const formData = new FormData(e.currentTarget);
                              
                              if (!formData.get('file')) {
                                toast({
                                  title: "No file selected",
                                  description: "Please select a file to import",
                                  variant: "destructive"
                                });
                                return;
                              }
                              
                              // Show loading toast
                              toast({
                                title: "Importing users",
                                description: "Please wait while we import the data..."
                              });
                              
                              // Send the file to the server
                              fetch('/api/import/users', {
                                method: 'POST',
                                body: formData
                              })
                              .then(res => res.json())
                              .then(data => {
                                toast({
                                  title: "Import completed",
                                  description: data.message
                                });
                                // Refresh data
                                refetchUsers();
                              })
                              .catch(err => {
                                toast({
                                  title: "Import failed",
                                  description: err.message,
                                  variant: "destructive"
                                });
                              });
                            }}
                          >
                            <div className="space-y-2">
                              <Label htmlFor="userFile">Upload User Data</Label>
                              <Input
                                id="userFile"
                                name="file"
                                type="file"
                                accept=".csv,.xlsx,.txt"
                              />
                              <p className="text-xs text-gray-500">
                                Supported formats: CSV, Excel, TXT (JSON)
                              </p>
                            </div>
                            <div className="pt-2">
                              <Button type="submit">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="m3 17 2 2 4-4"></path><path d="m3 7 2 2 4-4"></path><path d="M13 6h8"></path><path d="M13 12h8"></path><path d="M13 18h8"></path></svg>
                                Import Users
                              </Button>
                            </div>
                          </form>
                        </TabsContent>
                        
                        {/* Schools Import */}
                        <TabsContent value="schools">
                          <form 
                            className="space-y-4"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const formData = new FormData(e.currentTarget);
                              
                              if (!formData.get('file')) {
                                toast({
                                  title: "No file selected",
                                  description: "Please select a file to import",
                                  variant: "destructive"
                                });
                                return;
                              }
                              
                              toast({
                                title: "Importing schools",
                                description: "Please wait while we import the data..."
                              });
                              
                              fetch('/api/import/schools', {
                                method: 'POST',
                                body: formData
                              })
                              .then(res => res.json())
                              .then(data => {
                                toast({
                                  title: "Import completed",
                                  description: data.message
                                });
                                refetchSchools();
                              })
                              .catch(err => {
                                toast({
                                  title: "Import failed",
                                  description: err.message,
                                  variant: "destructive"
                                });
                              });
                            }}
                          >
                            <div className="space-y-2">
                              <Label htmlFor="schoolFile">Upload School Data</Label>
                              <Input
                                id="schoolFile"
                                name="file"
                                type="file"
                                accept=".csv,.xlsx,.txt"
                              />
                              <p className="text-xs text-gray-500">
                                Supported formats: CSV, Excel, TXT (JSON)
                              </p>
                            </div>
                            <div className="pt-2">
                              <Button type="submit">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="m3 17 2 2 4-4"></path><path d="m3 7 2 2 4-4"></path><path d="M13 6h8"></path><path d="M13 12h8"></path><path d="M13 18h8"></path></svg>
                                Import Schools
                              </Button>
                            </div>
                          </form>
                        </TabsContent>
                        
                        {/* Classes Import */}
                        <TabsContent value="classes">
                          <form 
                            className="space-y-4"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const formData = new FormData(e.currentTarget);
                              
                              if (!formData.get('file')) {
                                toast({
                                  title: "No file selected",
                                  description: "Please select a file to import",
                                  variant: "destructive"
                                });
                                return;
                              }
                              
                              toast({
                                title: "Importing classes",
                                description: "Please wait while we import the data..."
                              });
                              
                              fetch('/api/import/classes', {
                                method: 'POST',
                                body: formData
                              })
                              .then(res => res.json())
                              .then(data => {
                                toast({
                                  title: "Import completed",
                                  description: data.message
                                });
                                refetchClasses();
                              })
                              .catch(err => {
                                toast({
                                  title: "Import failed",
                                  description: err.message,
                                  variant: "destructive"
                                });
                              });
                            }}
                          >
                            <div className="space-y-2">
                              <Label htmlFor="classFile">Upload Class Data</Label>
                              <Input
                                id="classFile"
                                name="file"
                                type="file"
                                accept=".csv,.xlsx,.txt"
                              />
                              <p className="text-xs text-gray-500">
                                Supported formats: CSV, Excel, TXT (JSON)
                              </p>
                            </div>
                            <div className="pt-2">
                              <Button type="submit">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="m3 17 2 2 4-4"></path><path d="m3 7 2 2 4-4"></path><path d="M13 6h8"></path><path d="M13 12h8"></path><path d="M13 18h8"></path></svg>
                                Import Classes
                              </Button>
                            </div>
                          </form>
                        </TabsContent>
                        
                        {/* Events Import */}
                        <TabsContent value="events">
                          <form 
                            className="space-y-4"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const formData = new FormData(e.currentTarget);
                              
                              if (!formData.get('file')) {
                                toast({
                                  title: "No file selected",
                                  description: "Please select a file to import",
                                  variant: "destructive"
                                });
                                return;
                              }
                              
                              toast({
                                title: "Importing events",
                                description: "Please wait while we import the data..."
                              });
                              
                              fetch('/api/import/events', {
                                method: 'POST',
                                body: formData
                              })
                              .then(res => res.json())
                              .then(data => {
                                toast({
                                  title: "Import completed",
                                  description: data.message
                                });
                                refetchEvents();
                              })
                              .catch(err => {
                                toast({
                                  title: "Import failed",
                                  description: err.message,
                                  variant: "destructive"
                                });
                              });
                            }}
                          >
                            <div className="space-y-2">
                              <Label htmlFor="eventFile">Upload Event Data</Label>
                              <Input
                                id="eventFile"
                                name="file"
                                type="file"
                                accept=".csv,.xlsx,.txt"
                              />
                              <p className="text-xs text-gray-500">
                                Supported formats: CSV, Excel, TXT (JSON)
                              </p>
                            </div>
                            <div className="pt-2">
                              <Button type="submit">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="m3 17 2 2 4-4"></path><path d="m3 7 2 2 4-4"></path><path d="M13 6h8"></path><path d="M13 12h8"></path><path d="M13 18h8"></path></svg>
                                Import Events
                              </Button>
                            </div>
                          </form>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                  
                  {/* Export Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Export Data</CardTitle>
                      <CardDescription>
                        Download data for users, schools, classes, or events
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="users" className="w-full">
                        <TabsList className="grid grid-cols-4 mb-4">
                          <TabsTrigger value="users">Users</TabsTrigger>
                          <TabsTrigger value="schools">Schools</TabsTrigger>
                          <TabsTrigger value="classes">Classes</TabsTrigger>
                          <TabsTrigger value="events">Events</TabsTrigger>
                        </TabsList>
                        
                        {/* Users Export */}
                        <TabsContent value="users">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Export Format</Label>
                              <div className="flex flex-col space-y-2">
                                <div className="flex items-center space-x-4">
                                  <Button 
                                    onClick={() => handleExportData('users', 'csv')}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                    CSV
                                  </Button>
                                  <Button 
                                    onClick={() => handleExportData('users', 'xlsx')}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                    Excel
                                  </Button>
                                </div>
                                <Button 
                                  onClick={() => handleExportData('users', 'json')}
                                  variant="outline"
                                  className="w-full"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                  JSON
                                </Button>
                              </div>
                            </div>
                            <div className="pt-2">
                              <p className="text-xs text-gray-500">
                                All user data will be exported excluding sensitive information like passwords.
                              </p>
                            </div>
                          </div>
                        </TabsContent>
                        
                        {/* Schools Export */}
                        <TabsContent value="schools">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Export Format</Label>
                              <div className="flex flex-col space-y-2">
                                <div className="flex items-center space-x-4">
                                  <Button 
                                    onClick={() => handleExportData('schools', 'csv')}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                    CSV
                                  </Button>
                                  <Button 
                                    onClick={() => handleExportData('schools', 'xlsx')}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                    Excel
                                  </Button>
                                </div>
                                <Button 
                                  onClick={() => handleExportData('schools', 'json')}
                                  variant="outline"
                                  className="w-full"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                  JSON
                                </Button>
                              </div>
                            </div>
                            <div className="pt-2">
                              <p className="text-xs text-gray-500">
                                All school data will be exported in the selected format.
                              </p>
                            </div>
                          </div>
                        </TabsContent>
                        
                        {/* Classes Export */}
                        <TabsContent value="classes">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Export Format</Label>
                              <div className="flex flex-col space-y-2">
                                <div className="flex items-center space-x-4">
                                  <Button 
                                    onClick={() => handleExportData('classes', 'csv')}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                    CSV
                                  </Button>
                                  <Button 
                                    onClick={() => handleExportData('classes', 'xlsx')}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                    Excel
                                  </Button>
                                </div>
                                <Button 
                                  onClick={() => handleExportData('classes', 'json')}
                                  variant="outline"
                                  className="w-full"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                  JSON
                                </Button>
                              </div>
                            </div>
                            <div className="pt-2">
                              <p className="text-xs text-gray-500">
                                All class data will be exported in the selected format.
                              </p>
                            </div>
                          </div>
                        </TabsContent>
                        
                        {/* Events Export */}
                        <TabsContent value="events">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Export Format</Label>
                              <div className="flex flex-col space-y-2">
                                <div className="flex items-center space-x-4">
                                  <Button 
                                    onClick={() => handleExportData('events', 'csv')}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                    CSV
                                  </Button>
                                  <Button 
                                    onClick={() => handleExportData('events', 'xlsx')}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                    Excel
                                  </Button>
                                </div>
                                <Button 
                                  onClick={() => handleExportData('events', 'json')}
                                  variant="outline"
                                  className="w-full"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                  JSON
                                </Button>
                              </div>
                            </div>
                            <div className="pt-2">
                              <p className="text-xs text-gray-500">
                                All event data will be exported in the selected format.
                              </p>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Create User Dialog */}
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="user-fullName" className={formErrors.fullName ? "text-red-500" : ""}>
                  Full Name {formErrors.fullName && <span className="text-xs font-normal">- {formErrors.fullName}</span>}
                </Label>
                <Input 
                  id="user-fullName" 
                  placeholder="Enter full name" 
                  value={userFullName}
                  onChange={(e) => setUserFullName(e.target.value)}
                  className={formErrors.fullName ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-email" className={formErrors.email ? "text-red-500" : ""}>
                  Email {formErrors.email && <span className="text-xs font-normal">- {formErrors.email}</span>}
                </Label>
                <Input 
                  id="user-email" 
                  type="email" 
                  placeholder="Enter email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className={formErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="user-username" className={formErrors.username ? "text-red-500" : ""}>
                  Username {formErrors.username && <span className="text-xs font-normal">- {formErrors.username}</span>}
                </Label>
                <Input 
                  id="user-username" 
                  placeholder="Enter username"
                  value={userUsername}
                  onChange={(e) => setUserUsername(e.target.value)}
                  className={formErrors.username ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-password" className={formErrors.password ? "text-red-500" : ""}>
                  Password {formErrors.password && <span className="text-xs font-normal">- {formErrors.password}</span>}
                </Label>
                <Input 
                  id="user-password" 
                  type="password" 
                  placeholder="Enter password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className={formErrors.password ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="user-role">Role</Label>
                <Select value={userRoleValue} onValueChange={setUserRoleValue}>
                  <SelectTrigger id="user-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-school" className={formErrors.schoolId ? "text-red-500" : ""}>
                  School {formErrors.schoolId && <span className="text-xs font-normal">- {formErrors.schoolId}</span>}
                </Label>
                <Select value={userSchoolId} onValueChange={setUserSchoolId}>
                  <SelectTrigger id="user-school" className={formErrors.schoolId ? "border-red-500 focus-visible:ring-red-500" : ""}>
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school: any) => (
                      <SelectItem key={school.id} value={school.id.toString()}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreateUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit User Dialog */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-user-fullName">Full Name</Label>
                <Input 
                  id="edit-user-fullName" 
                  placeholder="Enter full name"
                  value={userFullName}
                  onChange={(e) => setUserFullName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-user-email">Email</Label>
                <Input 
                  id="edit-user-email" 
                  type="email" 
                  placeholder="Enter email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-user-username">Username</Label>
                <Input 
                  id="edit-user-username" 
                  placeholder="Enter username"
                  value={userUsername}
                  onChange={(e) => setUserUsername(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-user-password">Password (leave blank to keep current)</Label>
                <Input 
                  id="edit-user-password" 
                  type="password" 
                  placeholder="Enter new password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-user-role">Role</Label>
                <Select value={userRoleValue} onValueChange={setUserRoleValue}>
                  <SelectTrigger id="edit-user-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-user-school">School</Label>
                <Select value={userSchoolId} onValueChange={setUserSchoolId}>
                  <SelectTrigger id="edit-user-school">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {schools.map((school: any) => (
                      <SelectItem key={school.id} value={school.id.toString()}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-user-class">Class</Label>
                <Select value={userClassId} onValueChange={setUserClassId}>
                  <SelectTrigger id="edit-user-class">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {classes
                      .filter((c: any) => !userSchoolId || (c.schoolId && c.schoolId.toString() === userSchoolId))
                      .map((classItem: any) => (
                        <SelectItem key={classItem.id} value={classItem.id.toString()}>
                          {classItem.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-user-status">Status</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox 
                    id="edit-user-status" 
                    checked={userIsActive}
                    onCheckedChange={(checked) => setUserIsActive(checked === true)}
                  />
                  <label
                    htmlFor="edit-user-status"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Active
                  </label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={() => {
              // Validate form fields
              if (!userFullName || !userEmail || !userUsername) {
                toast({
                  title: "Missing Information",
                  description: "Please fill out all required fields",
                  variant: "destructive",
                });
                return;
              }
              
              // Build user data
              const userData = {
                fullName: userFullName,
                email: userEmail,
                username: userUsername,
                role: userRoleValue,
                schoolId: userSchoolId ? parseInt(userSchoolId) : null,
                classId: userClassId && userClassId !== "none" ? parseInt(userClassId) : null,
                isActive: userIsActive
              };
              
              // Add password only if provided
              if (userPassword) {
                userData.password = userPassword;
              }
              
              // Call the user update mutation
              updateUserMutation.mutate({ id: selectedUserId, userData });
            }}>
              Update User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Class Dialog */}
      <Dialog open={showEditClassDialog} onOpenChange={setShowEditClassDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-class-name">Class Name</Label>
              <Input 
                id="edit-class-name" 
                placeholder="Enter class name" 
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-class-school">School</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger id="edit-class-school">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school: any) => (
                      <SelectItem key={school.id} value={school.id.toString()}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-class-grade">Grade Level</Label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger id="edit-class-grade">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
                      <SelectItem key={grade} value={grade.toString()}>
                        Grade {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-class-teacher">Teacher</Label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger id="edit-class-teacher">
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter((user: any) => user.role === "teacher")
                    .map((teacher: any) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="edit-class-active" 
                checked={isClassActive}
                onCheckedChange={setIsClassActive}
              />
              <Label htmlFor="edit-class-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdateClass}>Update Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Event Dialog */}
      <Dialog open={showCreateEventDialog} onOpenChange={setShowCreateEventDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="event-name">Event Name</Label>
              <Input 
                id="event-name" 
                placeholder="Enter event name" 
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea 
                id="event-description" 
                placeholder="Enter event description"
                className="min-h-[80px]"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="event-type">Event Type</Label>
                <Select 
                  value={eventType} 
                  onValueChange={setEventType}
                >
                  <SelectTrigger id="event-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poetry">Poetry</SelectItem>
                    <SelectItem value="painting">Painting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-status">Status</Label>
                <Select 
                  value={eventStatus} 
                  onValueChange={setEventStatus}
                >
                  <SelectTrigger id="event-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="event-stage">Event Stage</Label>
                <Select 
                  value={eventStage} 
                  onValueChange={setEventStage}
                >
                  <SelectTrigger id="event-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">Class</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="country">Country</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-mode">Event Mode</Label>
                <Select 
                  value={eventMode} 
                  onValueChange={setEventMode}
                >
                  <SelectTrigger id="event-mode">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allowAI">Allow AI Creation</SelectItem>
                    <SelectItem value="noAI">No AI Creation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="event-start">Start Date</Label>
                <Input 
                  id="event-start" 
                  type="date"
                  placeholder="Select start date" 
                  value={eventStartDate}
                  onChange={(e) => setEventStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-end">End Date</Label>
                <Input 
                  id="event-end" 
                  type="date"
                  placeholder="Select end date" 
                  value={eventEndDate}
                  onChange={(e) => setEventEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-image">Event Image</Label>
              <div className="max-h-[200px] overflow-y-auto">
                <ImageUpload 
                  onImageUploaded={(url) => setEventImageUrl(url)}
                  existingImageUrl={eventImageUrl}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-white pt-2 border-t mt-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreateEvent}>Create Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Event Dialog */}
      <Dialog open={showEditEventDialog} onOpenChange={setShowEditEventDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-event-name">Event Name</Label>
              <Input 
                id="edit-event-name" 
                placeholder="Enter event name" 
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-event-description">Description</Label>
              <Textarea 
                id="edit-event-description" 
                placeholder="Enter event description"
                className="min-h-[80px]"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-event-type">Event Type</Label>
                <Select 
                  value={eventType} 
                  onValueChange={setEventType}
                >
                  <SelectTrigger id="edit-event-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poetry">Poetry</SelectItem>
                    <SelectItem value="painting">Painting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-event-status">Status</Label>
                <Select 
                  value={eventStatus} 
                  onValueChange={setEventStatus}
                >
                  <SelectTrigger id="edit-event-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-event-stage">Event Stage</Label>
                <Select 
                  value={eventStage} 
                  onValueChange={setEventStage}
                >
                  <SelectTrigger id="edit-event-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">Class</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="country">Country</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-event-mode">Event Mode</Label>
                <Select 
                  value={eventMode} 
                  onValueChange={setEventMode}
                >
                  <SelectTrigger id="edit-event-mode">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allowAI">Allow AI Creation</SelectItem>
                    <SelectItem value="noAI">No AI Creation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-event-start">Start Date</Label>
                <Input 
                  id="edit-event-start" 
                  type="date"
                  placeholder="Select start date" 
                  value={eventStartDate}
                  onChange={(e) => setEventStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-event-end">End Date</Label>
                <Input 
                  id="edit-event-end" 
                  type="date"
                  placeholder="Select end date" 
                  value={eventEndDate}
                  onChange={(e) => setEventEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-event-image">Event Image</Label>
              <div className="max-h-[200px] overflow-y-auto">
                <ImageUpload 
                  onImageUploaded={(url) => setEventImageUrl(url)}
                  existingImageUrl={eventImageUrl}
                />
              </div>
            </div>
            
            <div className="grid gap-2 pt-2 border-t mt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-event-enabled" className="text-base font-medium">
                  Enable Event
                  <p className="text-sm text-muted-foreground font-normal mt-1">
                    When disabled, this event won't appear on the main Events page
                  </p>
                </Label>
                <Switch
                  id="edit-event-enabled"
                  checked={eventIsEnabled}
                  onCheckedChange={setEventIsEnabled}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-white pt-2 border-t mt-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdateEvent}>Update Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create School Dialog */}
      <Dialog open={showCreateSchoolDialog} onOpenChange={setShowCreateSchoolDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New School</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="school-name">School Name</Label>
              <Input 
                id="school-name" 
                placeholder="Enter school name" 
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="school-description">Description</Label>
              <Textarea 
                id="school-description" 
                placeholder="Enter school description"
                className="min-h-[80px]"
                value={schoolDescription}
                onChange={(e) => setSchoolDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="school-city">City</Label>
                <Select 
                  value={schoolCityId}
                  onValueChange={setSchoolCityId}
                >
                  <SelectTrigger id="school-city">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingCities ? (
                      <SelectItem value="loading" disabled>Loading cities...</SelectItem>
                    ) : cities.length === 0 ? (
                      <SelectItem value="none" disabled>No cities available</SelectItem>
                    ) : (
                      cities.map((city: any) => (
                        <SelectItem key={city.id} value={city.id.toString()}>
                          {city.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="school-website">Website URL</Label>
                <Input 
                  id="school-website" 
                  placeholder="Enter website URL" 
                  value={schoolWebsite}
                  onChange={(e) => setSchoolWebsite(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="school-status">Status</Label>
              <Select 
                value={schoolStatus}
                onValueChange={setSchoolStatus}
              >
                <SelectTrigger id="school-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="school-image">School Logo/Image</Label>
              <div className="max-h-[200px] overflow-y-auto">
                <ImageUpload 
                  onImageUploaded={(url) => setSchoolImageUrl(url)}
                  existingImageUrl={schoolImageUrl}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-white pt-2 border-t mt-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreateSchool}>Create School</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit School Dialog */}
      <Dialog open={showEditSchoolDialog} onOpenChange={setShowEditSchoolDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit School</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-school-name">School Name</Label>
              <Input 
                id="edit-school-name" 
                placeholder="Enter school name" 
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-school-description">Description</Label>
              <Textarea 
                id="edit-school-description" 
                placeholder="Enter school description"
                className="min-h-[80px]"
                value={schoolDescription}
                onChange={(e) => setSchoolDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-school-city">City</Label>
                <Select 
                  value={schoolCityId}
                  onValueChange={setSchoolCityId}
                >
                  <SelectTrigger id="edit-school-city">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingCities ? (
                      <SelectItem value="loading" disabled>Loading cities...</SelectItem>
                    ) : cities.length === 0 ? (
                      <SelectItem value="none" disabled>No cities available</SelectItem>
                    ) : (
                      cities.map((city: any) => (
                        <SelectItem key={city.id} value={city.id.toString()}>
                          {city.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-school-website">Website URL</Label>
                <Input 
                  id="edit-school-website" 
                  placeholder="Enter website URL" 
                  value={schoolWebsite}
                  onChange={(e) => setSchoolWebsite(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-school-status">Status</Label>
              <Select 
                value={schoolStatus}
                onValueChange={setSchoolStatus}
              >
                <SelectTrigger id="edit-school-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-school-image">School Logo/Image</Label>
              <ImageUpload 
                onImageUploaded={(url) => setSchoolImageUrl(url)}
                existingImageUrl={schoolImageUrl}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdateSchool}>Update School</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Class Dialog */}
      <Dialog open={showCreateClassDialog} onOpenChange={setShowCreateClassDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="class-name">Class Name</Label>
              <Input 
                id="class-name" 
                placeholder="Enter class name" 
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="class-school">School</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger id="class-school">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school: any) => (
                      <SelectItem key={school.id} value={school.id.toString()}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="class-grade">Grade Level</Label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger id="class-grade">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
                      <SelectItem key={grade} value={grade.toString()}>
                        Grade {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="class-teacher">Teacher</Label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger id="class-teacher">
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter((user: any) => user.role === "teacher")
                    .map((teacher: any) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="class-active" 
                checked={isClassActive}
                onCheckedChange={setIsClassActive}
              />
              <Label htmlFor="class-active">Class is Active</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreateClass}>Create Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Students dialog */}
      <Dialog open={showStudentsDialog} onOpenChange={setShowStudentsDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manage Students</DialogTitle>
          </DialogHeader>
          
          {selectedClassId && (
            <>
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">
                  {classes.find((c: any) => c.id === selectedClassId)?.name || "Class"} Students
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Manage students enrolled in this class
                </p>
              </div>
              
              {/* Students table */}
              <StudentTable
                students={allUsers.filter((user: any) => 
                  user.role === "student" && user.classId === selectedClassId
                )}
                isLoading={isLoadingUsers}
                classId={selectedClassId}
              />
              
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setShowStudentsDialog(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Participants Management Dialog */}
      <WideDialog open={showParticipantsDialog} onOpenChange={setShowParticipantsDialog}>
        <WideDialogContent>
          <WideDialogHeader>
            <WideDialogTitle>Manage Event Participants</WideDialogTitle>
            <WideDialogDescription>
              View and manage participants for this event
            </WideDialogDescription>
          </WideDialogHeader>
          
          {selectedEventId && (
            <>
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">
                  {events.find((e: any) => e.id === selectedEventId)?.name || "Event"} Participants
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Track submissions, votes, and winners
                </p>
              </div>
              
              {/* Participants table with increased height to show more submissions */}
              <div className="overflow-y-auto h-[calc(100vh-240px)]">
                <ParticipantsTable eventId={selectedEventId} />
              </div>
              
              <WideDialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setShowParticipantsDialog(false)}>
                  Close
                </Button>
              </WideDialogFooter>
            </>
          )}
        </WideDialogContent>
      </WideDialog>

      {/* Voting History Dialog */}
      <WideDialog open={showVotingHistoryDialog} onOpenChange={setShowVotingHistoryDialog}>
        <WideDialogContent>
          <WideDialogHeader>
            <WideDialogTitle>Voting History</WideDialogTitle>
            <WideDialogDescription>
              View detailed voting statistics for this event across all stages
            </WideDialogDescription>
          </WideDialogHeader>
          
          {selectedEventId && (
            <>
              {isLoadingVotingHistory ? (
                <div className="py-10 flex justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="text-sm text-muted-foreground">Loading voting history...</p>
                  </div>
                </div>
              ) : votingHistoryData ? (
                <div className="overflow-auto max-h-[70vh]">
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <h3 className="text-lg font-medium text-blue-800 mb-2">Event Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-blue-600">Status</p>
                        <p className="capitalize">{votingHistoryData.eventStatus}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-600">Current Stage</p>
                        <p className="capitalize">{votingHistoryData.eventStage}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Class Stage Voting */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
                        <h3 className="text-white font-semibold">Class Stage Voting</h3>
                      </div>
                      <div className="p-4">
                        {votingHistoryData.classStage ? (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                              <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                                <p className="text-xs text-blue-600 font-medium">Total Submissions</p>
                                <p className="text-xl font-bold">{votingHistoryData.classStage.totalSubmissions}</p>
                              </div>
                              <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                                <p className="text-xs text-blue-600 font-medium">Total Votes</p>
                                <p className="text-xl font-bold">{votingHistoryData.classStage.totalVotes}</p>
                              </div>
                              <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                                <p className="text-xs text-blue-600 font-medium">Winning Submissions</p>
                                <p className="text-xl font-bold">{votingHistoryData.classStage.winnersCount}</p>
                              </div>
                            </div>
                            
                            <h4 className="font-medium mb-2 text-blue-700">Top Winners</h4>
                            {votingHistoryData.classStage.winners && votingHistoryData.classStage.winners.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr className="bg-blue-50">
                                      <th className="text-left p-2 text-xs font-semibold text-blue-800">Rank</th>
                                      <th className="text-left p-2 text-xs font-semibold text-blue-800">Student</th>
                                      <th className="text-left p-2 text-xs font-semibold text-blue-800">Class</th>
                                      <th className="text-left p-2 text-xs font-semibold text-blue-800">Votes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {votingHistoryData.classStage.winners.map((winner: any, index: number) => (
                                      <tr key={index} className="border-b border-blue-100">
                                        <td className="p-2 font-medium">{index + 1}</td>
                                        <td className="p-2">{winner.studentName}</td>
                                        <td className="p-2">{winner.className}</td>
                                        <td className="p-2">{winner.voteCount}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No winners information available for this stage.</p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">No data available for the class stage.</p>
                        )}
                      </div>
                    </div>

                    {/* School Stage Voting */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3">
                        <h3 className="text-white font-semibold">School Stage Voting</h3>
                      </div>
                      <div className="p-4">
                        {votingHistoryData.schoolStage ? (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                              <div className="bg-indigo-50 p-3 rounded-md border border-indigo-100">
                                <p className="text-xs text-indigo-600 font-medium">Total Submissions</p>
                                <p className="text-xl font-bold">{votingHistoryData.schoolStage.totalSubmissions}</p>
                              </div>
                              <div className="bg-indigo-50 p-3 rounded-md border border-indigo-100">
                                <p className="text-xs text-indigo-600 font-medium">Total Votes</p>
                                <p className="text-xl font-bold">{votingHistoryData.schoolStage.totalVotes}</p>
                              </div>
                              <div className="bg-indigo-50 p-3 rounded-md border border-indigo-100">
                                <p className="text-xs text-indigo-600 font-medium">Winning Submissions</p>
                                <p className="text-xl font-bold">{votingHistoryData.schoolStage.winnersCount}</p>
                              </div>
                            </div>
                            
                            <h4 className="font-medium mb-2 text-indigo-700">Top Winners</h4>
                            {votingHistoryData.schoolStage.winners && votingHistoryData.schoolStage.winners.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr className="bg-indigo-50">
                                      <th className="text-left p-2 text-xs font-semibold text-indigo-800">Rank</th>
                                      <th className="text-left p-2 text-xs font-semibold text-indigo-800">Student</th>
                                      <th className="text-left p-2 text-xs font-semibold text-indigo-800">Class</th>
                                      <th className="text-left p-2 text-xs font-semibold text-indigo-800">Votes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {votingHistoryData.schoolStage.winners.map((winner: any, index: number) => (
                                      <tr key={index} className="border-b border-indigo-100">
                                        <td className="p-2 font-medium">{index + 1}</td>
                                        <td className="p-2">{winner.studentName}</td>
                                        <td className="p-2">{winner.className}</td>
                                        <td className="p-2">{winner.voteCount}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No winners information available for this stage.</p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">No data available for the school stage.</p>
                        )}
                      </div>
                    </div>

                    {/* Country Stage Voting */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3">
                        <h3 className="text-white font-semibold">Country Stage Voting</h3>
                      </div>
                      <div className="p-4">
                        {votingHistoryData.countryStage ? (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                              <div className="bg-purple-50 p-3 rounded-md border border-purple-100">
                                <p className="text-xs text-purple-600 font-medium">Total Submissions</p>
                                <p className="text-xl font-bold">{votingHistoryData.countryStage.totalSubmissions}</p>
                              </div>
                              <div className="bg-purple-50 p-3 rounded-md border border-purple-100">
                                <p className="text-xs text-purple-600 font-medium">Total Votes</p>
                                <p className="text-xl font-bold">{votingHistoryData.countryStage.totalVotes}</p>
                              </div>
                              <div className="bg-purple-50 p-3 rounded-md border border-purple-100">
                                <p className="text-xs text-purple-600 font-medium">Winning Submissions</p>
                                <p className="text-xl font-bold">{votingHistoryData.countryStage.winnersCount}</p>
                              </div>
                            </div>
                            
                            <h4 className="font-medium mb-2 text-purple-700">Top Winners</h4>
                            {votingHistoryData.countryStage.winners && votingHistoryData.countryStage.winners.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr className="bg-purple-50">
                                      <th className="text-left p-2 text-xs font-semibold text-purple-800">Rank</th>
                                      <th className="text-left p-2 text-xs font-semibold text-purple-800">Student</th>
                                      <th className="text-left p-2 text-xs font-semibold text-purple-800">School</th>
                                      <th className="text-left p-2 text-xs font-semibold text-purple-800">Votes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {votingHistoryData.countryStage.winners.map((winner: any, index: number) => (
                                      <tr key={index} className="border-b border-purple-100">
                                        <td className="p-2 font-medium">{index + 1}</td>
                                        <td className="p-2">{winner.studentName}</td>
                                        <td className="p-2">{winner.schoolName}</td>
                                        <td className="p-2">{winner.voteCount}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No winners information available for this stage.</p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">No data available for the country stage.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-yellow-500" />
                    <p className="text-lg font-medium">No voting history available</p>
                    <p className="text-sm text-muted-foreground max-w-md">
                      There is no voting data available for this event yet. This may be because the event hasn't started or no votes have been cast.
                    </p>
                  </div>
                </div>
              )}
              
              <WideDialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setShowVotingHistoryDialog(false)}>
                  Close
                </Button>
              </WideDialogFooter>
            </>
          )}
        </WideDialogContent>
      </WideDialog>

      {/* Create Partner Dialog */}
      <Dialog open={showCreatePartnerDialog} onOpenChange={setShowCreatePartnerDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Partner</DialogTitle>
            <DialogDescription>
              Add a new partner to collaborate with your organization
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="partnerName" className="mb-2 block">
                Partner Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="partnerName"
                placeholder="Enter partner name"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="partnerDescription" className="mb-2 block">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="partnerDescription"
                placeholder="Enter a description of this partner"
                rows={3}
                value={partnerDescription}
                onChange={(e) => setPartnerDescription(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="partnerWebsite" className="mb-2 block">
                Website (Optional)
              </Label>
              <Input
                id="partnerWebsite"
                placeholder="https://www.example.com"
                value={partnerWebsite}
                onChange={(e) => setPartnerWebsite(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="partnerLogo" className="mb-2 block">
                Logo Image (Optional)
              </Label>
              <ImageUpload
                onImageUploaded={(url) => setPartnerLogoUrl(url)}
                existingImageUrl={partnerLogoUrl}
                className="w-full"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="partnerActive"
                checked={partnerIsActive}
                onCheckedChange={setPartnerIsActive}
              />
              <Label htmlFor="partnerActive">
                Active (shown on public pages)
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePartnerDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePartner}>
              Create Partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Partner Dialog */}
      <Dialog open={showEditPartnerDialog} onOpenChange={setShowEditPartnerDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
            <DialogDescription>
              Update partner information
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="editPartnerName" className="mb-2 block">
                Partner Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="editPartnerName"
                placeholder="Enter partner name"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="editPartnerDescription" className="mb-2 block">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="editPartnerDescription"
                placeholder="Enter a description of this partner"
                rows={3}
                value={partnerDescription}
                onChange={(e) => setPartnerDescription(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="editPartnerWebsite" className="mb-2 block">
                Website (Optional)
              </Label>
              <Input
                id="editPartnerWebsite"
                placeholder="https://www.example.com"
                value={partnerWebsite}
                onChange={(e) => setPartnerWebsite(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="editPartnerLogo" className="mb-2 block">
                Logo Image (Optional)
              </Label>
              <ImageUpload
                onImageUploaded={(url) => setPartnerLogoUrl(url)}
                existingImageUrl={partnerLogoUrl}
                className="w-full"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="editPartnerActive"
                checked={partnerIsActive}
                onCheckedChange={setPartnerIsActive}
              />
              <Label htmlFor="editPartnerActive">
                Active (shown on public pages)
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPartnerDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePartner}>
              Update Partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedItemToDelete?.type === 'class' && (
              <p>
                Are you sure you want to delete this class? This action cannot be undone.
                All students will be unassigned from this class.
              </p>
            )}
            {selectedItemToDelete?.type === 'school' && (
              <p>
                Are you sure you want to delete this school? This action cannot be undone.
                All classes and students associated with this school will be affected.
              </p>
            )}
            {selectedItemToDelete?.type === 'partner' && (
              <p>
                Are you sure you want to delete this partner? This action cannot be undone.
              </p>
            )}
            {selectedItemToDelete?.type === 'event' && (
              <p>
                Are you sure you want to delete this event? This action cannot be undone.
                All registrations and submissions for this event will be deleted.
              </p>
            )}
            {selectedItemToDelete?.type === 'user' && (
              <p>
                Are you sure you want to delete this user? This action cannot be undone.
                All data associated with this user will be permanently removed.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteDialog(false);
                setSelectedItemToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={async () => {
                if (!selectedItemToDelete) return;
                
                try {
                  // Determine API endpoint based on item type
                  // Handle plural forms correctly (e.g., 'class' → 'classes')
                  const endpoint = selectedItemToDelete.type === 'class' 
                    ? `/api/classes/${selectedItemToDelete.id}`
                    : `/api/${selectedItemToDelete.type}s/${selectedItemToDelete.id}`;
                  
                  // Delete the item
                  const response = await fetch(endpoint, {
                    method: 'DELETE',
                  });
                  
                  if (!response.ok) {
                    throw new Error(`Failed to delete ${selectedItemToDelete.type}`);
                  }
                  
                  // Show success message
                  toast({
                    title: "Success",
                    description: `${selectedItemToDelete.type} deleted successfully`,
                  });
                  
                  // Refresh data
                  switch (selectedItemToDelete.type) {
                    case 'class':
                      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
                      break;
                    case 'school':
                      queryClient.invalidateQueries({ queryKey: ['/api/schools'] });
                      break;
                    case 'partner':
                      queryClient.invalidateQueries({ queryKey: ['/api/partners'] });
                      break;
                    case 'event':
                      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
                      break;
                    case 'user':
                      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
                      break;
                  }
                  
                } catch (error) {
                  console.error('Delete error:', error);
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : 'Failed to delete item',
                    variant: "destructive",
                  });
                } finally {
                  setShowDeleteDialog(false);
                  setSelectedItemToDelete(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Gallery Item Dialog */}
      <Dialog open={showCreateGalleryItemDialog} onOpenChange={setShowCreateGalleryItemDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add New Gallery Item</DialogTitle>
            <DialogDescription>
              Add a new image or poem to the gallery
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="galleryItemTitle" className="text-right">
                Title
              </Label>
              <Input
                id="galleryItemTitle"
                value={galleryItemTitle}
                onChange={(e) => setGalleryItemTitle(e.target.value)}
                className="col-span-3"
                placeholder="Enter gallery item title"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="galleryItemType" className="text-right">
                Type
              </Label>
              <Select
                value={galleryItemType}
                onValueChange={(value: "image" | "poem") => setGalleryItemType(value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="poem">Poem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="galleryItemDescription" className="text-right">
                Description
              </Label>
              <Textarea
                id="galleryItemDescription"
                value={galleryItemDescription}
                onChange={(e) => setGalleryItemDescription(e.target.value)}
                className="col-span-3"
                placeholder="Enter a brief description"
                rows={3}
              />
            </div>
            
            {galleryItemType === "image" ? (
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="galleryItemContent" className="text-right pt-2">
                  Upload Image
                </Label>
                <div className="col-span-3">
                  <div 
                    className={`border-2 border-dashed rounded-md p-6 transition-colors ${
                      galleryItemContent ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-primary"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      const files = e.dataTransfer.files;
                      if (files && files.length > 0) {
                        const file = files[0];
                        
                        // Check if the file is an image
                        if (!file.type.startsWith('image/')) {
                          toast({
                            title: "Invalid file type",
                            description: "Please upload an image file (JPEG, PNG, GIF, etc.)",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        // Upload the file
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        try {
                          // Add a bearer token for authorization
                          const token = localStorage.getItem('authToken');
                          const response = await fetch('/api/upload', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`
                            },
                            body: formData
                          });
                          
                          const data = await response.json();
                          if (response.ok) {
                            setGalleryItemContent(data.url);
                            toast({
                              title: "Image uploaded",
                              description: "Image has been uploaded successfully"
                            });
                          } else {
                            throw new Error(data.message || 'Upload failed');
                          }
                        } catch (error) {
                          console.error('Error uploading image:', error);
                          toast({
                            title: "Upload failed",
                            description: error.message || "Failed to upload image. Please try again.",
                            variant: "destructive"
                          });
                        }
                      }
                    }}
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <input
                        type="file"
                        id="imageUpload"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            const file = files[0];
                            
                            // Upload the file
                            const formData = new FormData();
                            formData.append('file', file);
                            
                            try {
                              // Add a bearer token for authorization
                              const token = localStorage.getItem('authToken');
                              const response = await fetch('/api/upload', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${token}`
                                },
                                body: formData
                              });
                              
                              const data = await response.json();
                              if (response.ok) {
                                setGalleryItemContent(data.url);
                                toast({
                                  title: "Image uploaded",
                                  description: "Image has been uploaded successfully"
                                });
                              } else {
                                throw new Error(data.message || 'Upload failed');
                              }
                            } catch (error) {
                              console.error('Error uploading image:', error);
                              toast({
                                title: "Upload failed",
                                description: error.message || "Failed to upload image. Please try again.",
                                variant: "destructive"
                              });
                            }
                          }
                        }}
                      />
                      
                      {galleryItemContent ? (
                        <div className="w-full">
                          <img 
                            src={galleryItemContent} 
                            alt="Uploaded preview" 
                            className="max-h-48 mx-auto object-contain rounded-md"
                          />
                          <div className="flex justify-center gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                document.getElementById('imageUpload')?.click();
                              }}
                            >
                              Change Image
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setGalleryItemContent('')}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-10 w-10 text-gray-400" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                            />
                          </svg>
                          <p className="text-sm text-gray-600">Drag and drop an image here, or click to browse</p>
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => {
                              document.getElementById('imageUpload')?.click();
                            }}
                          >
                            Select Image
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="galleryItemContent" className="text-right pt-2">
                  Poem Content
                </Label>
                <Textarea
                  id="galleryItemContent"
                  value={galleryItemContent}
                  onChange={(e) => setGalleryItemContent(e.target.value)}
                  className="col-span-3"
                  placeholder="Enter poem content"
                  rows={6}
                />
              </div>
            )}
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="galleryItemFeatured" className="text-right">
                Featured
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Switch
                  id="galleryItemFeatured"
                  checked={galleryItemFeatured}
                  onCheckedChange={setGalleryItemFeatured}
                />
                <Label htmlFor="galleryItemFeatured">
                  {galleryItemFeatured ? "Featured" : "Not Featured"}
                </Label>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="galleryItemIsActive" className="text-right">
                Active
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Switch
                  id="galleryItemIsActive"
                  checked={galleryItemIsActive}
                  onCheckedChange={setGalleryItemIsActive}
                />
                <Label htmlFor="galleryItemIsActive">
                  {galleryItemIsActive ? "Active" : "Inactive"}
                </Label>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="galleryItemOrderIndex" className="text-right">
                Display Order
              </Label>
              <Input
                id="galleryItemOrderIndex"
                type="number"
                value={galleryItemOrderIndex.toString()}
                onChange={(e) => setGalleryItemOrderIndex(parseInt(e.target.value) || 0)}
                className="col-span-3"
                placeholder="Display order (0 = default)"
              />
            </div>
            
            {galleryItemType === "image" && galleryItemContent && (
              <div className="col-span-4 mt-2">
                <Label className="mb-2 block">Preview:</Label>
                <div className="border rounded-md overflow-hidden w-full h-48">
                  <img 
                    src={galleryItemContent}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Invalid+Image+URL';
                    }}
                  />
                </div>
              </div>
            )}
            
            {galleryItemType === "poem" && galleryItemContent && (
              <div className="col-span-4 mt-2">
                <Label className="mb-2 block">Preview:</Label>
                <div className="border rounded-md p-4 max-h-48 overflow-y-auto font-serif">
                  {galleryItemContent}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGalleryItemDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateGalleryItem}
              disabled={!galleryItemTitle || !galleryItemContent}
            >
              Add Gallery Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Gallery Item Dialog */}
      <Dialog open={showEditGalleryItemDialog} onOpenChange={setShowEditGalleryItemDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Gallery Item</DialogTitle>
            <DialogDescription>
              Update gallery item details
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editGalleryItemTitle" className="text-right">
                Title
              </Label>
              <Input
                id="editGalleryItemTitle"
                value={galleryItemTitle}
                onChange={(e) => setGalleryItemTitle(e.target.value)}
                className="col-span-3"
                placeholder="Enter gallery item title"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editGalleryItemType" className="text-right">
                Type
              </Label>
              <Select
                value={galleryItemType}
                onValueChange={(value: "image" | "poem") => setGalleryItemType(value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="poem">Poem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editGalleryItemDescription" className="text-right">
                Description
              </Label>
              <Textarea
                id="editGalleryItemDescription"
                value={galleryItemDescription}
                onChange={(e) => setGalleryItemDescription(e.target.value)}
                className="col-span-3"
                placeholder="Enter a brief description"
                rows={3}
              />
            </div>
            
            {galleryItemType === "image" ? (
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="editGalleryItemContent" className="text-right pt-2">
                  Upload Image
                </Label>
                <div className="col-span-3">
                  <div 
                    className={`border-2 border-dashed rounded-md p-6 transition-colors ${
                      galleryItemContent ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-primary"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      const files = e.dataTransfer.files;
                      if (files && files.length > 0) {
                        const file = files[0];
                        
                        // Check if the file is an image
                        if (!file.type.startsWith('image/')) {
                          toast({
                            title: "Invalid file type",
                            description: "Please upload an image file (JPEG, PNG, GIF, etc.)",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        // Upload the file
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        try {
                          // Add a bearer token for authorization
                          const token = localStorage.getItem('authToken');
                          const response = await fetch('/api/upload', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`
                            },
                            body: formData
                          });
                          
                          const data = await response.json();
                          if (response.ok) {
                            setGalleryItemContent(data.url);
                            toast({
                              title: "Image uploaded",
                              description: "Image has been uploaded successfully"
                            });
                          } else {
                            throw new Error(data.message || 'Upload failed');
                          }
                        } catch (error) {
                          console.error('Error uploading image:', error);
                          toast({
                            title: "Upload failed",
                            description: error.message || "Failed to upload image. Please try again.",
                            variant: "destructive"
                          });
                        }
                      }
                    }}
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <input
                        type="file"
                        id="editImageUpload"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            const file = files[0];
                            
                            // Upload the file
                            const formData = new FormData();
                            formData.append('file', file);
                            
                            try {
                              // Add a bearer token for authorization
                              const token = localStorage.getItem('authToken');
                              const response = await fetch('/api/upload', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${token}`
                                },
                                body: formData
                              });
                              
                              const data = await response.json();
                              if (response.ok) {
                                setGalleryItemContent(data.url);
                                toast({
                                  title: "Image uploaded",
                                  description: "Image has been uploaded successfully"
                                });
                              } else {
                                throw new Error(data.message || 'Upload failed');
                              }
                            } catch (error) {
                              console.error('Error uploading image:', error);
                              toast({
                                title: "Upload failed",
                                description: error.message || "Failed to upload image. Please try again.",
                                variant: "destructive"
                              });
                            }
                          }
                        }}
                      />
                      
                      {galleryItemContent ? (
                        <div className="w-full">
                          <img 
                            src={galleryItemContent} 
                            alt="Uploaded preview" 
                            className="max-h-48 mx-auto object-contain rounded-md"
                          />
                          <div className="flex justify-center gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                document.getElementById('editImageUpload')?.click();
                              }}
                            >
                              Change Image
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setGalleryItemContent('')}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-10 w-10 text-gray-400" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                            />
                          </svg>
                          <p className="text-sm text-gray-600">Drag and drop an image here, or click to browse</p>
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => {
                              document.getElementById('editImageUpload')?.click();
                            }}
                          >
                            Select Image
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="editGalleryItemContent" className="text-right pt-2">
                  Poem Content
                </Label>
                <Textarea
                  id="editGalleryItemContent"
                  value={galleryItemContent}
                  onChange={(e) => setGalleryItemContent(e.target.value)}
                  className="col-span-3"
                  placeholder="Enter poem content"
                  rows={6}
                />
              </div>
            )}
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editGalleryItemFeatured" className="text-right">
                Featured
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Switch
                  id="editGalleryItemFeatured"
                  checked={galleryItemFeatured}
                  onCheckedChange={setGalleryItemFeatured}
                />
                <Label htmlFor="editGalleryItemFeatured">
                  {galleryItemFeatured ? "Featured" : "Not Featured"}
                </Label>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editGalleryItemIsActive" className="text-right">
                Active
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Switch
                  id="editGalleryItemIsActive"
                  checked={galleryItemIsActive}
                  onCheckedChange={setGalleryItemIsActive}
                />
                <Label htmlFor="editGalleryItemIsActive">
                  {galleryItemIsActive ? "Active" : "Inactive"}
                </Label>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editGalleryItemOrderIndex" className="text-right">
                Display Order
              </Label>
              <Input
                id="editGalleryItemOrderIndex"
                type="number"
                value={galleryItemOrderIndex.toString()}
                onChange={(e) => setGalleryItemOrderIndex(parseInt(e.target.value) || 0)}
                className="col-span-3"
                placeholder="Display order (0 = default)"
              />
            </div>
            
            {galleryItemType === "image" && galleryItemContent && (
              <div className="col-span-4 mt-2">
                <Label className="mb-2 block">Preview:</Label>
                <div className="border rounded-md overflow-hidden w-full h-48">
                  <img 
                    src={galleryItemContent}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Invalid+Image+URL';
                    }}
                  />
                </div>
              </div>
            )}
            
            {galleryItemType === "poem" && galleryItemContent && (
              <div className="col-span-4 mt-2">
                <Label className="mb-2 block">Preview:</Label>
                <div className="border rounded-md p-4 max-h-48 overflow-y-auto font-serif">
                  {galleryItemContent}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditGalleryItemDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateGalleryItem}
              disabled={!galleryItemTitle || !galleryItemContent}
            >
              Update Gallery Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Gallery Item Confirmation Dialog */}
      <Dialog open={showDeleteGalleryItemConfirmDialog} onOpenChange={setShowDeleteGalleryItemConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              Are you sure you want to delete this gallery item? This action cannot be undone.
            </p>
            {selectedGalleryItem && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md">
                <p className="font-medium">{selectedGalleryItem.title}</p>
                <p className="text-sm text-gray-500">
                  {selectedGalleryItem.type === 'image' ? 'Image' : 'Poem'} • 
                  {selectedGalleryItem.featured ? ' Featured' : ' Not Featured'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteGalleryItemConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteGalleryItem}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
