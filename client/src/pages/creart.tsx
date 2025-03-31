import React, { useState, useEffect } from "react";
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
import { useUser } from "@/hooks/use-user";
import { Redirect } from "wouter";
import {
  Palette,
  Pen,
  Award,
  Vote,
  LayoutDashboard,
  PlusCircle,
  XCircle,
  FileImage,
  FileText,
  Clock,
  Trophy,
  Heart,
  Loader2,
  Sparkles,
  CheckCircle2,
  Star
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitEventId, setSubmitEventId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("events");
  
  // Always include all hooks before any early returns to avoid the
  // "Rendered fewer hooks than expected" error
  
  // Get the authenticated user's ID
  const userId = user?.id;
  
  // Fetch user registrations - only run the query if we have a valid userId
  const { data: registrations = [], isLoading: isLoadingRegistrations } = useQuery({
    // Use array notation for query key to ensure proper cache invalidation
    queryKey: ['/api/registrations', userId],
    queryFn: async () => {
      if (!userId) {
        return [];
      }
      console.log('Fetching registrations for user:', userId);
      const response = await fetch(`/api/registrations?userId=${userId}`);
      if (!response.ok) {
        console.error('Failed to fetch registrations:', await response.text());
        throw new Error('Failed to fetch registrations');
      }
      const data = await response.json();
      console.log('Fetched registrations:', data);
      return data;
    },
    enabled: !!userId, // Only run the query if userId exists and is not falsy
    staleTime: 0, // Don't cache the results
    refetchOnWindowFocus: true // Refetch when the window regains focus
  });
  
  // Fetch events
  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['/api/events'],
  });
  
  // Fetch user submissions - only run the query if we have a valid userId
  const { data: submissions = [], isLoading: isLoadingSubmissions } = useQuery({
    queryKey: [`/api/submissions?userId=${userId}`],
    enabled: !!userId, // Only run the query if userId exists and is not falsy
  });
  
  // Fetch class submissions for an open event at class stage
  const { data: classEvents = [] } = useQuery({
    queryKey: ['/api/events?status=open&stage=class'],
  });
  
  // Using optional chaining to safely access properties
  const activeClassEvent = Array.isArray(classEvents) && classEvents.length > 0 ? classEvents[0] : null;
  const eventId = activeClassEvent && 'id' in activeClassEvent ? activeClassEvent.id : null;
  
  // Get user's classId from the user context
  const classId = user?.classId;

  // Fetch submissions for class voting if there's an active class event
  const { data: classSubmissions = [], isLoading: isLoadingClassSubmissions } = useQuery({
    queryKey: ['/api/submissions', { eventId, forVoting: true, currentUserId: userId, classId }],
    queryFn: async () => {
      if (!eventId || !userId || !classId) {
        console.log('Missing required parameters for class submissions query:', { eventId, userId, classId });
        return [];
      }
      
      const url = `/api/submissions?eventId=${eventId}&forVoting=true&currentUserId=${userId}&classId=${classId}`;
      console.log('Fetching class submissions with URL:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Class submissions fetch error:', errorText);
        throw new Error(`Failed to fetch class submissions: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`Fetched ${data.length} class submissions:`, data);
      return data;
    },
    enabled: !!eventId && !!userId && !!classId && activeTab === 'voting',
    staleTime: 0, // Don't cache the results
    refetchOnWindowFocus: true // Refetch when the window regains focus
  });
  
  // Debug logging for class voting
  useEffect(() => {
    if (activeTab === 'voting') {
      console.log('Class voting debug info:', {
        classId,
        userId,
        eventId,
        submissionsCount: Array.isArray(classSubmissions) ? classSubmissions.length : 0,
        allQueryParamsPresent: !!eventId && !!userId && !!classId
      });
    }
  }, [activeTab, classSubmissions, classId, eventId, userId]);
  
  // Define interface for voting stats
  interface VotingStats {
    votesUsed: number;
    maxVotes: number;
    remaining: number;
  }
  
  // Fetch voting stats to know how many votes are remaining
  const { data: votingStats, isLoading: isLoadingVotingStats } = useQuery<VotingStats>({
    queryKey: ['/api/votes/count-by-voter', { voterId: userId, eventId }],
    queryFn: async () => {
      if (!eventId || !userId) {
        console.log('Missing required parameters for voting stats query:', { eventId, userId });
        return { votesUsed: 0, maxVotes: 3, remaining: 3 };
      }
      
      const url = `/api/votes/count-by-voter?voterId=${userId}&eventId=${eventId}`;
      console.log('Fetching voting stats with URL:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Voting stats fetch error:', errorText);
        throw new Error(`Failed to fetch voting stats: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Fetched voting stats:', data);
      return data;
    },
    enabled: !!eventId && !!userId && activeTab === 'voting',
    staleTime: 0, // Don't cache the results
    refetchOnWindowFocus: true // Refetch when the window regains focus
  });
  
  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: (submissionId: number) => {
      // Safety check to ensure we have a valid user ID
      if (!userId) {
        throw new Error("You must be logged in to vote");
      }
      
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
      if (eventId && userId) {
        // Invalidate both submissions and voting stats using the proper array format
        queryClient.invalidateQueries({ 
          queryKey: ['/api/submissions', { eventId, forVoting: true, currentUserId: userId, classId }] 
        });
        
        // Also invalidate voting stats to update the vote counter
        queryClient.invalidateQueries({
          queryKey: ['/api/votes/count-by-voter', { voterId: userId, eventId }]
        });
      }
    },
    onError: (error: any) => {
      // Check if this is the max votes reached error
      if (error.message && error.message.includes('Maximum number of votes')) {
        toast({
          title: "Vote limit reached",
          description: "You have already used your 3 votes for this event",
          variant: "destructive"
        });
        
        // Force refresh the voting stats
        if (eventId && userId) {
          // Refresh submissions to update UI using proper array format
          queryClient.invalidateQueries({
            queryKey: ['/api/submissions', { eventId, forVoting: true, currentUserId: userId, classId }]
          });
          
          // Refresh voting stats using proper array format
          queryClient.invalidateQueries({
            queryKey: ['/api/votes/count-by-voter', { voterId: userId, eventId }]
          });
        }
      } else {
        toast({
          title: "Error",
          description: `Failed to cast vote: ${error.message}`,
          variant: "destructive"
        });
      }
    }
  });
  
  // Student role check - we moved this after all hooks to avoid React errors
  if (userRole !== "student") {
    return <Redirect to="/" />;
  }
  
  // Debug registrations
  useEffect(() => {
    if (activeTab === 'events') {
      console.log('Registrations for display:', registrations);
      console.log('Events for display:', events);
    }
  }, [activeTab, registrations, events]);

  // Combine events with registrations and submissions
  const eventsWithDetails = Array.isArray(events) ? events.map((event: any) => {
    // Debug each registration check
    console.log(`Checking event ${event.id} (${event.name}) against registrations`);
    
    // Use double equality (==) for comparing numbers since one might be a string
    const isRegistered = Array.isArray(registrations) && registrations.some((r: any) => {
      const matches = Number(r.eventId) === Number(event.id);
      console.log(`  Registration check: ${r.eventId} === ${event.id} ? ${matches}`);
      return matches;
    });
    
    const userSubmissionsForEvent = Array.isArray(submissions) ? 
      submissions.filter((s: any) => s.eventId === event.id) : [];
    
    console.log(`  Event ${event.id} registered: ${isRegistered}, submissions: ${userSubmissionsForEvent.length}`);
    
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
      {/* Hero Section */}
      <div className="relative rounded-xl overflow-hidden mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 opacity-90"></div>
        <div className="absolute inset-0 overflow-hidden opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJ3aGl0ZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMiIvPjwvZz48L3N2Zz4=')]"></div>
        </div>
        <div className="absolute bottom-0 right-0 w-64 h-64 opacity-20">
          <Palette className="w-full h-full text-white" />
        </div>
        <div className="relative z-10 py-12 px-6 sm:px-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full">
              <Sparkles className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-heading text-white mb-4">
            CreArt Studio
          </h1>
          <p className="text-lg text-indigo-100 max-w-2xl mx-auto mb-8">
            Your creative workspace to participate in challenges, submit artwork, and vote on creative masterpieces
          </p>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center justify-center">
              <FileImage className="h-6 w-6 text-white mb-2" />
              <span className="text-2xl font-bold text-white">{Array.isArray(submissions) ? submissions.filter((s: any) => s.contentType === 'image').length : 0}</span>
              <span className="text-xs text-indigo-100">Artworks</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center justify-center">
              <FileText className="h-6 w-6 text-white mb-2" />
              <span className="text-2xl font-bold text-white">{Array.isArray(submissions) ? submissions.filter((s: any) => s.contentType === 'text').length : 0}</span>
              <span className="text-xs text-indigo-100">Poems</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center justify-center">
              <Award className="h-6 w-6 text-white mb-2" />
              <span className="text-2xl font-bold text-white">{Array.isArray(registrations) ? registrations.length : 0}</span>
              <span className="text-xs text-indigo-100">Competitions</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs Navigation */}
      <Tabs defaultValue="events" value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid w-full grid-cols-3 bg-white rounded-xl p-1 shadow-sm border border-blue-100">
          <TabsTrigger 
            value="events" 
            className="flex items-center justify-center gap-2 rounded-lg py-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>My Events</span>
          </TabsTrigger>
          <TabsTrigger 
            value="submissions" 
            className="flex items-center justify-center gap-2 rounded-lg py-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
          >
            <Palette className="h-4 w-4" />
            <span>My Submissions</span>
          </TabsTrigger>
          <TabsTrigger 
            value="voting" 
            className="flex items-center justify-center gap-2 rounded-lg py-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
            disabled={!activeClassEvent}
          >
            <Vote className="h-4 w-4" />
            <span>Class Voting</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="events" className="mt-4">
          <div className="bg-white rounded-lg shadow-lg border border-blue-100 p-6">
            <div className="flex items-center mb-4">
              <Clock className="h-5 w-5 text-blue-600 mr-2" />
              <h2 className="text-xl font-semibold font-heading text-blue-800">My Registered Events</h2>
            </div>
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
        </TabsContent>
        
        <TabsContent value="submissions" className="mt-4">
          <div className="bg-white rounded-lg shadow-lg border border-blue-100 p-6">
            <div className="flex items-center mb-4">
              <Palette className="h-5 w-5 text-blue-600 mr-2" />
              <h2 className="text-xl font-semibold font-heading text-blue-800">My Submissions</h2>
            </div>
            
            {isLoadingSubmissions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : !Array.isArray(submissions) || submissions.length === 0 ? (
              <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-100">
                <div className="inline-block h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-4 mx-auto">
                  <Palette className="h-8 w-8 text-blue-400" />
                </div>
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
        </TabsContent>
        
        <TabsContent value="voting" className="mt-4">
          {activeClassEvent && (
            <div className="bg-white rounded-lg shadow-lg border border-blue-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Vote className="h-5 w-5 text-blue-600 mr-2" />
                  <h2 className="text-xl font-semibold font-heading text-blue-800">
                    Class Voting - {activeClassEvent.name}
                  </h2>
                </div>
                
                {/* Voting Stats */}
                {!isLoadingVotingStats && votingStats && (
                  <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 flex items-center space-x-3">
                    <div className="text-sm text-blue-700">
                      <span className="font-bold">{votingStats.remaining}</span> of <span className="font-bold">{votingStats.maxVotes}</span> votes remaining
                    </div>
                    <div className="h-2 w-20 bg-blue-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600" 
                        style={{ 
                          width: `${Math.max(0, (votingStats.maxVotes - votingStats.votesUsed) / votingStats.maxVotes * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Fallback when stats are loading */}
                {isLoadingVotingStats && (
                  <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 flex items-center space-x-3">
                    <div className="text-sm text-blue-700">
                      <span className="font-medium">Loading voting stats...</span>
                    </div>
                    <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                  </div>
                )}
              </div>
              
              {isLoadingClassSubmissions ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : !Array.isArray(classSubmissions) || classSubmissions.length === 0 ? (
                <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="inline-block h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-4 mx-auto">
                    <Vote className="h-8 w-8 text-blue-400" />
                  </div>
                  <p className="text-blue-700">No submissions available for voting yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {classSubmissions.map((submission: any) => (
                    <div key={submission.id} className="border border-blue-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all group">
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
                          className={submission.hasVoted 
                            ? "bg-green-600 hover:bg-green-700 text-white rounded-full"
                            : votingStats && votingStats.remaining <= 0
                              ? "bg-gray-400 text-white rounded-full cursor-not-allowed"
                              : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full"}
                          onClick={() => handleVote(submission.id)}
                          disabled={submission.hasVoted || voteMutation.isPending || (votingStats && votingStats.remaining <= 0)}
                          title={votingStats && votingStats.remaining <= 0 ? "You have used all your votes" : ""}
                        >
                          {submission.hasVoted ? (
                            <><CheckCircle2 className="h-4 w-4 mr-1" /> Voted</>
                          ) : votingStats && votingStats.remaining <= 0 ? (
                            <><Vote className="h-4 w-4 mr-1" /> No votes left</>
                          ) : (
                            <><Heart className="h-4 w-4 mr-1" /> Vote</>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
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