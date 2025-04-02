import React from "react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/use-user-role";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface EventCardProps {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  type: string;
  status: string;
  stage: string;
  endDate: string;
  onSubmit: (eventId: number) => void;
}

const EventCard: React.FC<EventCardProps> = ({
  id,
  name,
  description,
  imageUrl,
  type,
  status,
  stage,
  endDate,
  onSubmit
}) => {
  const { userRole } = useUserRole();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get the authenticated user's ID
  const userId = user?.id;

  // Check if user is registered for this event (for students only)
  const { data: registrations = [], isLoading: isLoadingRegistrations } = useQuery<any[]>({
    queryKey: ['/api/registrations', userRole === 'student' && userId ? `?userId=${userId}` : null],
    enabled: userRole === 'student' && !!userId // Only run the query if we have a valid user ID
  });

  // Check if the user is registered for this event
  const isRegistered = registrations.some((reg: any) => reg.eventId === id);

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async () => {
      // Safety check for user ID
      if (!userId) {
        throw new Error("You must be logged in to register");
      }
      
      return apiRequest('POST', '/api/registrations', { userId, eventId: id });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Registered for ${name}`,
      });
      // Invalidate the specific query with the user's ID
      queryClient.invalidateQueries({ queryKey: ['/api/registrations', `?userId=${userId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to register: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Unregister mutation
  const unregisterMutation = useMutation({
    mutationFn: async () => {
      // Safety check for user ID
      if (!userId) {
        throw new Error("You must be logged in to unregister");
      }
      
      return apiRequest('DELETE', `/api/registrations?userId=${userId}&eventId=${id}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Unregistered from ${name}`,
      });
      // Invalidate the specific query with the user's ID
      queryClient.invalidateQueries({ queryKey: ['/api/registrations', `?userId=${userId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to unregister: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleRegister = () => {
    registerMutation.mutate();
  };

  const handleUnregister = () => {
    unregisterMutation.mutate();
  };

  const handleSubmit = () => {
    onSubmit(id);
  };

  const getStatusBadgeColor = () => {
    switch (status) {
      case 'open':
        return 'bg-warning';
      case 'upcoming':
        return 'bg-indigo-300';
      case 'closed':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getTypeBadgeColor = () => {
    switch (type) {
      case 'poetry':
        return 'bg-primary';
      case 'painting':
        return 'bg-secondary';
      default:
        return 'bg-gray-400';
    }
  };

  const getEndDateText = () => {
    if (status === 'upcoming') {
      return `Starts in ${getDaysRemaining(endDate)} days`;
    } else if (status === 'open') {
      return `Ends in ${getDaysRemaining(endDate)} days`;
    } else {
      return `Ended ${getDaysRemaining(endDate)} days ago`;
    }
  };

  const getDaysRemaining = (dateStr: string) => {
    const endDate = new Date(dateStr);
    const today = new Date();
    const diffTime = Math.abs(endDate.getTime() - today.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="h-48 bg-gray-200 relative">
        <img 
          src={imageUrl} 
          alt={name} 
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3">
          <span className={`${getStatusBadgeColor()} text-white text-xs font-semibold px-2 py-1 rounded-full`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
        <div className="absolute bottom-3 left-3">
          <span className={`${getTypeBadgeColor()} bg-opacity-90 text-white text-xs font-semibold px-2 py-1 rounded-full`}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-heading font-semibold text-lg mb-2">{name}</h3>
        <p className="text-gray-600 text-sm mb-3">{description}</p>
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-medium bg-gray-100 text-gray-800 px-2 py-1 rounded">
            {stage.charAt(0).toUpperCase() + stage.slice(1)} Stage
          </span>
          <span className="text-xs text-gray-500">{getEndDateText()}</span>
        </div>
        {userRole === 'student' && (
          <div className="flex flex-wrap gap-2">
            {status === 'open' && (
              <>
                {isRegistered ? (
                  <Button
                    variant="outline"
                    className="border-red-500 text-red-500 hover:bg-red-50"
                    onClick={handleUnregister}
                    disabled={isLoadingRegistrations || unregisterMutation.isPending}
                  >
                    Unregister
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    className="bg-primary hover:bg-indigo-700"
                    onClick={handleRegister}
                    disabled={isLoadingRegistrations || registerMutation.isPending}
                  >
                    Register
                  </Button>
                )}
                {isRegistered && (
                  <Button
                    variant="default"
                    className="bg-secondary hover:bg-green-600 text-white"
                    onClick={handleSubmit}
                  >
                    Submit
                  </Button>
                )}
              </>
            )}
            {status === 'upcoming' && (
              <Button disabled className="bg-gray-300 text-gray-600 cursor-not-allowed">
                Coming Soon
              </Button>
            )}
            {status === 'closed' && (
              <Button disabled className="bg-gray-300 text-gray-600 cursor-not-allowed">
                Event Closed
              </Button>
            )}
          </div>
        )}
        {userRole !== 'student' && (
          <Button
            variant="link"
            className="text-primary hover:text-indigo-700 p-0 h-auto"
          >
            View Details
          </Button>
        )}
      </div>
    </div>
  );
};

export default EventCard;
