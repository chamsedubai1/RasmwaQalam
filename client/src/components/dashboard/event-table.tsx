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
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Users } from "lucide-react";

interface EventTableProps {
  events: any[];
  isLoading: boolean;
  isAdmin?: boolean;
  onEdit?: (eventData: any) => void;
  onManageParticipants?: (eventId: number) => void;
}

const EventTable: React.FC<EventTableProps> = ({ 
  events = [],
  isLoading,
  isAdmin = false,
  onEdit,
  onManageParticipants
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const promoteEventStageMutation = useMutation({
    mutationFn: async (eventData: { id: number, stage: string }) => {
      const stageMap: Record<string, string> = {
        'class': 'school',
        'school': 'country',
        'country': 'global',
        'global': 'global'
      };
      
      const nextStage = stageMap[eventData.stage] || eventData.stage;
      
      return apiRequest('PATCH', `/api/events/${eventData.id}`, { 
        stage: nextStage 
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event stage promoted",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to promote event stage: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const closeEventMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/events/${id}`, { status: 'closed' });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event closed",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to close event: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handlePromoteStage = (id: number, currentStage: string) => {
    if (currentStage === 'global') {
      toast({
        description: "Event is already at the global stage",
      });
      return;
    }
    
    promoteEventStageMutation.mutate({ id, stage: currentStage });
  };

  const handleCloseEvent = (id: number) => {
    if (window.confirm("Are you sure you want to close this event?")) {
      closeEventMutation.mutate(id);
    }
  };

  const getTypeDisplay = (type: string) => {
    const typeColors: Record<string, string> = {
      'poetry': 'bg-primary bg-opacity-10 text-primary',
      'painting': 'bg-secondary bg-opacity-10 text-secondary'
    };
    
    return {
      color: typeColors[type] || 'bg-gray-100 text-gray-800',
      label: type.charAt(0).toUpperCase() + type.slice(1)
    };
  };

  const getStatusDisplay = (status: string) => {
    const statusColors: Record<string, string> = {
      'open': 'bg-warning bg-opacity-10 text-warning',
      'upcoming': 'bg-indigo-300 bg-opacity-10 text-indigo-500',
      'closed': 'bg-gray-300 bg-opacity-10 text-gray-500'
    };
    
    return {
      color: statusColors[status] || 'bg-gray-100 text-gray-800',
      label: status.charAt(0).toUpperCase() + status.slice(1)
    };
  };

  if (isLoading) {
    return <p>Loading events...</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Current Stage</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Participants</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-6">
              No events found
            </TableCell>
          </TableRow>
        ) : (
          events.map((event) => {
            const typeDisplay = getTypeDisplay(event.type);
            const statusDisplay = getStatusDisplay(event.status);
            
            return (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.name}</TableCell>
                <TableCell>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeDisplay.color}`}>
                    {typeDisplay.label}
                  </span>
                </TableCell>
                <TableCell className="capitalize">{event.stage}</TableCell>
                <TableCell>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusDisplay.color}`}>
                    {statusDisplay.label}
                  </span>
                </TableCell>
                <TableCell>{event.participantCount || 0}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => {
                        const eventData = {
                          id: event.id,
                          name: event.name,
                          description: event.description,
                          type: event.type,
                          status: event.status,
                          stage: event.stage,
                          startDate: event.startDate,
                          endDate: event.endDate,
                          imageUrl: event.imageUrl
                        };
                        
                        if (isAdmin && onEdit) {
                          onEdit(eventData);
                        } else {
                          // Would navigate to event page
                          toast({
                            description: "Event detail view will be implemented here"
                          });
                        }
                      }}
                    >
                      {isAdmin ? "Edit" : "View"}
                    </Button>
                    
                    {isAdmin && (
                      <>
                        {event.status === 'open' && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-purple-300 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                              onClick={() => handlePromoteStage(event.id, event.stage)}
                              disabled={promoteEventStageMutation.isPending}
                            >
                              Promote Stage
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleCloseEvent(event.id)}
                              disabled={closeEventMutation.isPending}
                            >
                              Close
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-green-300 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => {
                            if (onManageParticipants) {
                              onManageParticipants(event.id);
                            } else {
                              toast({
                                description: "Participants management not implemented",
                              });
                            }
                          }}
                        >
                          <Users className="h-3.5 w-3.5 mr-1" />
                          Manage Participants
                        </Button>
                      </>
                    )}
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

export default EventTable;
