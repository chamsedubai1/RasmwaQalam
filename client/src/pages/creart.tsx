import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SubmissionModal from "@/components/site/submission-modal";
import { useUserRole } from "@/hooks/use-user-role";
import { Redirect } from "wouter";

interface SubmissionWithVotes {
  id: number;
  title: string;
  contentType: string;
  content: string;
  userFullName: string;
  voteCount: number;
  hasVoted?: boolean;
}

const CreArt: React.FC = () => {
  const { userRole } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitEventId, setSubmitEventId] = useState<number | null>(null);
  
  // Student role check
  if (userRole !== "student") {
    return <Redirect to="/" />;
  }
  
  // Mock user ID (in a real app, this would come from authentication)
  const userId = 1;
  
  // Fetch user registrations
  const { data: registrations = [], isLoading: isLoadingRegistrations } = useQuery({
    queryKey: [`/api/registrations?userId=${userId}`],
  });
  
  // Fetch events
  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['/api/events'],
  });
  
  // Fetch user submissions
  const { data: submissions = [], isLoading: isLoadingSubmissions } = useQuery({
    queryKey: [`/api/submissions?userId=${userId}`],
    enabled: !!userId,
  });
  
  // Fetch class submissions for an open event at class stage
  const { data: classEvents = [] } = useQuery({
    queryKey: ['/api/events?status=open&stage=class'],
  });
  
  const activeClassEvent = classEvents[0] || null;
  const eventId = activeClassEvent?.id;
  
  // Fetch submissions for class voting if there's an active class event
  const { data: classSubmissions = [], isLoading: isLoadingClassSubmissions } = useQuery({
    queryKey: eventId ? [`/api/submissions?eventId=${eventId}`] : null,
    enabled: !!eventId,
  });
  
  // Combine events with registrations and submissions
  const eventsWithDetails = events.map((event: any) => {
    const isRegistered = registrations.some((r: any) => r.eventId === event.id);
    const userSubmissionsForEvent = submissions.filter((s: any) => s.eventId === event.id);
    
    return {
      ...event,
      isRegistered,
      submissionCount: userSubmissionsForEvent.length,
      maxSubmissionsReached: userSubmissionsForEvent.length >= 3
    };
  });
  
  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: (submissionId: number) => {
      return apiRequest('POST', '/api/votes', {
        submissionId,
        voterId: userId
      });
    },
    onSuccess: () => {
      toast({
        title: "Vote cast successfully",
        description: "Your vote has been recorded",
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/submissions?eventId=${eventId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to cast vote: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  const handleSubmit = (eventId: number) => {
    setSubmitEventId(eventId);
  };
  
  const handleCloseModal = () => {
    setSubmitEventId(null);
  };
  
  const handleVote = (submissionId: number) => {
    voteMutation.mutate(submissionId);
  };
  
  return (
    <div>
      <h1 className="text-3xl font-bold font-heading text-gray-800 mb-6">CreArt Studio</h1>
      
      {/* Student's Events */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold font-heading mb-4">My Events</h2>
        {isLoadingRegistrations || isLoadingEvents || isLoadingSubmissions ? (
          <p>Loading your events...</p>
        ) : registrations.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500 mb-2">You haven't registered for any events yet.</p>
            <Button 
              variant="link" 
              className="text-primary"
              onClick={() => window.location.href = '/events'}
            >
              Browse Events
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventsWithDetails
                  .filter((event: any) => event.isRegistered)
                  .map((event: any) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${event.type === 'poetry' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                          {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{event.stage}</TableCell>
                      <TableCell>{event.submissionCount}/3</TableCell>
                      <TableCell>
                        <Badge variant={event.status === 'open' ? 'default' : 'secondary'} className={event.status === 'open' ? 'bg-warning text-white' : ''}>
                          {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-3">
                          {event.status === 'open' && !event.maxSubmissionsReached && (
                            <Button 
                              variant="default" 
                              size="sm"
                              className="bg-secondary hover:bg-green-600 text-white"
                              onClick={() => handleSubmit(event.id)}
                            >
                              Submit
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-danger hover:text-red-700 border-red-500"
                            onClick={() => {
                              // This would call the unregister API in a real app
                              toast({
                                title: "Feature coming soon",
                                description: "Unregistration will be available in the next update",
                              });
                            }}
                          >
                            Unregister
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      
      {/* My Submissions Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold font-heading mb-4">My Submissions</h2>
        
        {isLoadingSubmissions ? (
          <p>Loading your submissions...</p>
        ) : submissions.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">You haven't submitted any art or poetry yet.</p>
            <p className="text-gray-500 text-sm mt-1">
              Register for an event and click "Submit" to create your first submission!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {submissions.map((submission: any) => (
              <div key={submission.id} className="border rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-gray-900">{submission.title}</h3>
                    <Badge variant="outline" className="bg-primary/10 text-primary">
                      {submission.contentType === "text" ? "Poetry" : "Artwork"}
                    </Badge>
                  </div>
                </div>
                
                {submission.contentType === "text" ? (
                  <div className="p-4 font-artistic text-gray-800">
                    <p className="whitespace-pre-line">{submission.content}</p>
                  </div>
                ) : (
                  <div className="h-48 bg-gray-200">
                    <img 
                      src={submission.content} 
                      alt={submission.title} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                )}
                
                <div className="p-4 flex justify-between items-center border-t">
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {submission.voteCount || 0} votes
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Submitted to event #{submission.eventId}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Class Voting Section */}
      {activeClassEvent && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold font-heading mb-4">
            Class Voting - {activeClassEvent.name}
          </h2>
          
          {isLoadingClassSubmissions ? (
            <p>Loading submissions...</p>
          ) : classSubmissions.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No submissions available for voting yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {classSubmissions.map((submission: SubmissionWithVotes) => (
                <div key={submission.id} className="border rounded-lg overflow-hidden">
                  <div className="p-4 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-900">{submission.title}</h3>
                      <span className="text-xs text-gray-500">{submission.userFullName || "Anonymous"}</span>
                    </div>
                  </div>
                  
                  {submission.contentType === "text" ? (
                    <div className="p-4 font-artistic text-gray-800">
                      <p className="whitespace-pre-line">{submission.content}</p>
                    </div>
                  ) : (
                    <div className="h-48 bg-gray-200">
                      <img 
                        src={submission.content} 
                        alt={submission.title} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  )}
                  
                  <div className="p-4 flex justify-between items-center border-t">
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        {submission.voteCount || 0} votes
                      </span>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-primary hover:bg-indigo-700 text-white rounded-full"
                      onClick={() => handleVote(submission.id)}
                      disabled={submission.hasVoted || voteMutation.isPending}
                    >
                      {submission.hasVoted ? "Voted" : "Vote"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Submission Modal */}
      <SubmissionModal
        eventId={submitEventId}
        isOpen={submitEventId !== null}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default CreArt;
