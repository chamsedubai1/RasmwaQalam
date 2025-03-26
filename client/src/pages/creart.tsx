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
  
  // Always include all hooks before any early returns to avoid the
  // "Rendered fewer hooks than expected" error
  
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
  });
  
  // Fetch class submissions for an open event at class stage
  const { data: classEvents = [] } = useQuery({
    queryKey: ['/api/events?status=open&stage=class'],
  });
  
  // Using optional chaining to safely access properties
  const activeClassEvent = Array.isArray(classEvents) && classEvents.length > 0 ? classEvents[0] : null;
  const eventId = activeClassEvent && 'id' in activeClassEvent ? activeClassEvent.id : null;
  
  // Fetch submissions for class voting if there's an active class event
  const { data: classSubmissions = [], isLoading: isLoadingClassSubmissions } = useQuery({
    queryKey: eventId ? [`/api/submissions?eventId=${eventId}`] : [`/api/submissions`],
    enabled: !!eventId,
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
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: [`/api/submissions?eventId=${eventId}`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to cast vote: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Student role check - we moved this after all hooks to avoid React errors
  if (userRole !== "student") {
    return <Redirect to="/" />;
  }
  
  // Combine events with registrations and submissions
  const eventsWithDetails = Array.isArray(events) ? events.map((event: any) => {
    const isRegistered = Array.isArray(registrations) && registrations.some((r: any) => r.eventId === event.id);
    const userSubmissionsForEvent = Array.isArray(submissions) ? 
      submissions.filter((s: any) => s.eventId === event.id) : [];
    
    return {
      ...event,
      isRegistered,
      submissionCount: userSubmissionsForEvent.length,
      maxSubmissionsReached: userSubmissionsForEvent.length >= 3
    };
  }) : [];
  
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
      <h1 className="text-3xl font-bold font-heading bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent mb-6">CreArt Studio</h1>
      
      {/* Student's Events */}
      <div className="bg-white rounded-lg shadow-lg border border-blue-100 p-6 mb-8">
        <h2 className="text-xl font-semibold font-heading text-blue-800 mb-4">My Events</h2>
        {isLoadingRegistrations || isLoadingEvents || isLoadingSubmissions ? (
          <p>Loading your events...</p>
        ) : !Array.isArray(registrations) || registrations.length === 0 ? (
          <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-blue-700 mb-2">You haven't registered for any events yet.</p>
            <Button 
              variant="link" 
              className="text-blue-600 hover:text-blue-800 font-medium"
              onClick={() => window.location.href = '/events'}
            >
              Browse Events
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-blue-200 rounded-md">
            <Table>
              <TableHeader className="bg-blue-50">
                <TableRow className="border-b border-blue-200">
                  <TableHead className="text-blue-800">Event</TableHead>
                  <TableHead className="text-blue-800">Type</TableHead>
                  <TableHead className="text-blue-800">Stage</TableHead>
                  <TableHead className="text-blue-800">Submissions</TableHead>
                  <TableHead className="text-blue-800">Status</TableHead>
                  <TableHead className="text-blue-800">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventsWithDetails
                  .filter((event: any) => event.isRegistered)
                  .map((event: any) => (
                    <TableRow key={event.id} className="hover:bg-blue-50 transition-colors">
                      <TableCell className="font-medium text-blue-800">{event.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                          {event.type && typeof event.type === 'string' ? 
                            event.type.charAt(0).toUpperCase() + event.type.slice(1) : 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize text-blue-700">{event.stage}</TableCell>
                      <TableCell className="text-blue-700">{event.submissionCount}/3</TableCell>
                      <TableCell>
                        <Badge 
                          variant={event.status === 'open' ? 'default' : 'secondary'} 
                          className={event.status === 'open' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800 border-blue-200'}
                        >
                          {event.status && typeof event.status === 'string' ? 
                            event.status.charAt(0).toUpperCase() + event.status.slice(1) : 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-3">
                          {event.status === 'open' && !event.maxSubmissionsReached && (
                            <Button 
                              variant="default" 
                              size="sm"
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
                              onClick={() => handleSubmit(event.id)}
                            >
                              Submit
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="border-red-400 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-500"
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
      <div className="bg-white rounded-lg shadow-lg border border-blue-100 p-6 mb-8">
        <h2 className="text-xl font-semibold font-heading text-blue-800 mb-4">My Submissions</h2>
        
        {isLoadingSubmissions ? (
          <p className="text-blue-600">Loading your submissions...</p>
        ) : !Array.isArray(submissions) || submissions.length === 0 ? (
          <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-blue-700">You haven't submitted any art or poetry yet.</p>
            <p className="text-blue-600 text-sm mt-1">
              Register for an event and click "Submit" to create your first submission!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {submissions.map((submission: any) => (
              <div key={submission.id} className="border border-blue-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="p-4 bg-blue-50">
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-blue-900">{submission.title}</h3>
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                      {submission.contentType === "text" ? "Poetry" : "Artwork"}
                    </Badge>
                  </div>
                </div>
                
                {submission.contentType === "text" ? (
                  <div className="p-4 font-artistic text-blue-800 bg-white">
                    <p className="whitespace-pre-line">{submission.content}</p>
                  </div>
                ) : (
                  <div className="h-48 bg-blue-50 border-y border-blue-100">
                    <img 
                      src={submission.content} 
                      alt={submission.title} 
                      className="w-full h-full object-cover shadow-inner" 
                    />
                  </div>
                )}
                
                <div className="p-4 flex justify-between items-center border-t border-blue-100 bg-gradient-to-b from-white to-blue-50">
                  <div>
                    <span className="text-sm font-medium text-blue-700">
                      {submission.voteCount || 0} votes
                    </span>
                  </div>
                  <div className="text-xs text-blue-500">
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
        <div className="bg-white rounded-lg shadow-lg border border-blue-100 p-6 mb-8">
          <h2 className="text-xl font-semibold font-heading text-blue-800 mb-4">
            Class Voting - {activeClassEvent.name}
          </h2>
          
          {isLoadingClassSubmissions ? (
            <p className="text-blue-600">Loading submissions...</p>
          ) : !Array.isArray(classSubmissions) || classSubmissions.length === 0 ? (
            <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-blue-700">No submissions available for voting yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {classSubmissions.map((submission: any) => (
                <div key={submission.id} className="border border-blue-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-4 bg-blue-50">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-blue-900">{submission.title}</h3>
                      <span className="text-xs text-blue-600">{submission.userFullName || "Anonymous"}</span>
                    </div>
                  </div>
                  
                  {submission.contentType === "text" ? (
                    <div className="p-4 font-artistic text-blue-800 bg-white">
                      <p className="whitespace-pre-line">{submission.content}</p>
                    </div>
                  ) : (
                    <div className="h-48 bg-blue-50 border-y border-blue-100">
                      <img 
                        src={submission.content} 
                        alt={submission.title} 
                        className="w-full h-full object-cover shadow-inner" 
                      />
                    </div>
                  )}
                  
                  <div className="p-4 flex justify-between items-center border-t border-blue-100 bg-gradient-to-b from-white to-blue-50">
                    <div>
                      <span className="text-sm font-medium text-blue-700">
                        {submission.voteCount || 0} votes
                      </span>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full"
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