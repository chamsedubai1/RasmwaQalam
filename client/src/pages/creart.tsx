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
  Star,
  Plus,
  Check,
  Lightbulb,
  Download
} from "lucide-react";
import { AlertCircle } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState("prompts");
  
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
  
  // Fetch ALL open events (regardless of stage)
  const { data: openEvents = [] } = useQuery({
    queryKey: ['/api/events?status=open'],
  });
  
  // Find registered events that the student can vote on
  const registeredVotableEvents = Array.isArray(openEvents) && Array.isArray(registrations) 
    ? openEvents.filter(event => 
        registrations.some(r => r.eventId === event.id) &&
        Array.isArray(submissions) && submissions.some(s => s.eventId === event.id)
      )
    : [];
  
  console.log('Available voting events:', openEvents);
  console.log('Registered votable events with submissions:', registeredVotableEvents);
  
  // Use the first registered event that has a submission as the active event
  const activeVotingEvent = registeredVotableEvents.length > 0 ? registeredVotableEvents[0] : null;
  const eventId = activeVotingEvent && activeVotingEvent.id ? activeVotingEvent.id : null;
  
  // Get the current event's stage for display and filtering
  const currentEventStage = activeVotingEvent ? activeVotingEvent.stage : 'class';
  
  // State for selected voting stage tab (may be different from current event stage when viewing history)
  const [selectedVotingStage, setSelectedVotingStage] = useState<'class' | 'school' | 'country' | 'global'>(
    (currentEventStage as 'class' | 'school' | 'country' | 'global')
  );
  
  // Update selected voting stage when current event stage changes
  useEffect(() => {
    setSelectedVotingStage(currentEventStage as 'class' | 'school' | 'country' | 'global');
  }, [currentEventStage]);
  
  // Get user's classId from the user context
  const classId = user?.classId;

  // Fetch submissions for voting (handles different stages: class, school, country, global)
  const { data: votableSubmissions = [], isLoading: isLoadingVotableSubmissions } = useQuery({
    queryKey: ['/api/submissions', { eventId, forVoting: true, currentUserId: userId, classId, currentEventStage, requestedStage: selectedVotingStage }],
    queryFn: async () => {
      if (!eventId || !userId) {
        console.log('Missing required parameters for voting submissions query:', { eventId, userId });
        return [];
      }
      
      // Building the URL based on selected voting stage (may be different from current event stage when viewing history)
      let url = `/api/submissions?eventId=${eventId}&forVoting=true&currentUserId=${userId}&currentEventStage=${currentEventStage}&requestedStage=${selectedVotingStage}`;
      
      // Only include classId for class stage voting
      if (selectedVotingStage === 'class' && classId) {
        url += `&classId=${classId}`;
      }
      
      console.log(`Fetching ${selectedVotingStage} stage voting submissions with URL:`, url);
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Voting submissions fetch error:', errorText);
        throw new Error(`Failed to fetch voting submissions: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`Fetched ${data.length} voting submissions for ${selectedVotingStage} stage:`, data);
      return data;
    },
    // Only require classId for class stage, for other stages we don't need it
    enabled: !!eventId && !!userId && 
      (selectedVotingStage !== 'class' || !!classId) && 
      activeTab === 'voting',
    staleTime: 0, // Don't cache the results
    refetchOnWindowFocus: true, // Refetch when the window regains focus
    refetchOnMount: true // Refetch when the component mounts
  });
  
  // Debug logging for voting at any stage
  useEffect(() => {
    if (activeTab === 'voting') {
      console.log('Voting debug info:', {
        classId,
        userId,
        eventId,
        submissionsCount: Array.isArray(votableSubmissions) ? votableSubmissions.length : 0,
        allQueryParamsPresent: !!eventId && !!userId && !!classId
      });
    }
  }, [activeTab, votableSubmissions, classId, eventId, userId]);
  
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
        // Invalidate both submissions and voting stats using the proper array format and including stage
        queryClient.invalidateQueries({ 
          queryKey: ['/api/submissions', { eventId, forVoting: true, currentUserId: userId, currentEventStage }] 
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
          // Refresh submissions to update UI using proper array format and stage
          queryClient.invalidateQueries({
            queryKey: ['/api/submissions', { eventId, forVoting: true, currentUserId: userId, currentEventStage }]
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
  
  // Function to handle downloading content
  const handleDownload = (submission: any) => {
    try {
      // Create a filename based on submission title
      const sanitizedTitle = submission.title.replace(/[^a-zA-Z0-9]/g, '_');
      let filename = `${sanitizedTitle}_${submission.id}`;
      
      if (submission.contentType === "text") {
        // For text content (poems), create a text file
        const textBlob = new Blob([submission.content], { type: 'text/plain' });
        const url = URL.createObjectURL(textBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Poem Downloaded",
          description: `Your poem "${submission.title}" has been downloaded as a text file.`
        });
      } else if (submission.contentType === "image") {
        // For image content, extract the base64 data or use the URL directly
        if (submission.content.startsWith('data:')) {
          // It's a data URL, can download directly
          const link = document.createElement('a');
          link.href = submission.content;
          link.download = `${filename}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          toast({
            title: "Image Downloaded",
            description: `Your artwork "${submission.title}" has been downloaded.`
          });
        } else {
          // It's a regular URL, fetch it first
          fetch(submission.content)
            .then(response => response.blob())
            .then(blob => {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${filename}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              
              toast({
                title: "Image Downloaded",
                description: `Your artwork "${submission.title}" has been downloaded.`
              });
            })
            .catch(err => {
              console.error("Error downloading image:", err);
              toast({
                title: "Download Failed",
                description: "There was an error downloading your image. Please try again.",
                variant: "destructive"
              });
            });
        }
      }
    } catch (error) {
      console.error("Error in download function:", error);
      toast({
        title: "Download Failed",
        description: "There was an error downloading your file. Please try again.",
        variant: "destructive"
      });
    }
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
      <Tabs defaultValue="prompts" value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid w-full grid-cols-4 bg-white rounded-xl p-1 shadow-sm border border-blue-100">
          <TabsTrigger 
            value="prompts" 
            className="flex items-center justify-center gap-2 rounded-lg py-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
          >
            <Lightbulb className="h-4 w-4" />
            <span>Prompts Tutorials</span>
          </TabsTrigger>
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
            disabled={!activeVotingEvent}
          >
            <Vote className="h-4 w-4" />
            <span>{currentEventStage.charAt(0).toUpperCase() + currentEventStage.slice(1)} Voting</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="prompts" className="mt-4">
          <div className="bg-white rounded-lg shadow-lg border border-blue-100 p-6">
            <div className="flex items-center mb-4">
              <Lightbulb className="h-5 w-5 text-blue-600 mr-2" />
              <h2 className="text-xl font-semibold font-heading text-blue-800">Prompts Tutorials</h2>
            </div>
            
            <div className="prose max-w-none prose-blue">
              <h3 className="text-lg font-medium text-blue-700 border-b pb-2 border-blue-100 mt-6">What is a Prompt?</h3>
              <p>
                A prompt is a set of instructions you give to an AI system to guide it in creating the output you want. 
                The more detailed and specific your prompt, the better results you'll get.
              </p>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 my-4">
                <h4 className="font-medium text-blue-800 mb-2">💡 Key Components of a Good Prompt</h4>
                <ul className="list-disc ml-5 space-y-1">
                  <li><span className="font-medium">Be specific</span> about what you want to create</li>
                  <li><span className="font-medium">Include details</span> about style, mood, colors, or elements</li>
                  <li><span className="font-medium">Use descriptive adjectives</span> to refine the output</li>
                  <li><span className="font-medium">Mention inspirations</span> (artists, styles, or movements)</li>
                </ul>
              </div>
              
              <h3 className="text-lg font-medium text-blue-700 border-b pb-2 border-blue-100 mt-8">Poetry Prompt Techniques</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="border border-blue-200 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-white">
                  <h4 className="font-medium text-blue-800 mb-2">❌ Weak Poetry Prompt</h4>
                  <div className="bg-white p-3 rounded border border-blue-100 text-gray-600">
                    "Write a poem about spring."
                  </div>
                  <p className="text-sm mt-2 text-blue-700">
                    Too vague, doesn't specify emotion, style, or special elements.
                  </p>
                </div>
                
                <div className="border border-blue-200 rounded-lg p-4 bg-gradient-to-br from-indigo-50 to-white">
                  <h4 className="font-medium text-blue-800 mb-2">✅ Strong Poetry Prompt</h4>
                  <div className="bg-white p-3 rounded border border-blue-100 text-gray-600">
                    "Write a hopeful sonnet about spring awakening, using imagery of melting snow, new buds, and returning birds. Include subtle references to renewal and second chances. Use a gentle, flowing rhythm."
                  </div>
                  <p className="text-sm mt-2 text-blue-700">
                    Specifies form (sonnet), mood (hopeful), specific imagery, themes, and rhythm.
                  </p>
                </div>
              </div>
              
              <h3 className="text-lg font-medium text-blue-700 border-b pb-2 border-blue-100 mt-8">Artwork Prompt Techniques</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="border border-blue-200 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-white">
                  <h4 className="font-medium text-blue-800 mb-2">❌ Weak Art Prompt</h4>
                  <div className="bg-white p-3 rounded border border-blue-100 text-gray-600">
                    "Make an image of a futuristic city."
                  </div>
                  <p className="text-sm mt-2 text-blue-700">
                    Too general, doesn't specify style, mood, lighting, or unique elements.
                  </p>
                </div>
                
                <div className="border border-blue-200 rounded-lg p-4 bg-gradient-to-br from-indigo-50 to-white">
                  <h4 className="font-medium text-blue-800 mb-2">✅ Strong Art Prompt</h4>
                  <div className="bg-white p-3 rounded border border-blue-100 text-gray-600">
                    "Create a detailed digital illustration of a futuristic Dubai skyline in the year 2150, with massive vertical gardens, flying vehicles, and solar-powered towers. Use a vibrant sunset palette with golden light reflecting on glass structures. Style inspired by a mix of cyberpunk and solarpunk aesthetic with hyper-realistic details."
                  </div>
                  <p className="text-sm mt-2 text-blue-700">
                    Specifies medium, subject, time period, specific elements, color palette, lighting, and artistic style.
                  </p>
                </div>
              </div>
              
              <h3 className="text-lg font-medium text-blue-700 border-b pb-2 border-blue-100 mt-8">Advanced Prompt Strategies</h3>
              
              <div className="mt-4 space-y-4">
                <div className="border-l-4 border-blue-400 pl-4 py-1">
                  <h4 className="font-medium text-blue-800">Use Emotional Language</h4>
                  <p className="text-sm text-gray-700">
                    Include words that evoke specific emotions: "create a melancholic, haunting poem" or "design a joyful, exuberant scene"
                  </p>
                </div>
                
                <div className="border-l-4 border-blue-400 pl-4 py-1">
                  <h4 className="font-medium text-blue-800">Reference Specific Styles</h4>
                  <p className="text-sm text-gray-700">
                    For poetry: "in the style of Shakespeare's sonnets" or "like Rumi's spiritual verses"<br/>
                    For art: "in the style of Van Gogh's Starry Night" or "using Picasso's cubist approach"
                  </p>
                </div>
                
                <div className="border-l-4 border-blue-400 pl-4 py-1">
                  <h4 className="font-medium text-blue-800">Add Technical Specifications</h4>
                  <p className="text-sm text-gray-700">
                    For poetry: specify rhyme scheme, verse type, or meter<br/>
                    For art: specify camera angle, lighting type, rendering style, or perspective
                  </p>
                </div>
                
                <div className="border-l-4 border-blue-400 pl-4 py-1">
                  <h4 className="font-medium text-blue-800">Be Culturally Relevant</h4>
                  <p className="text-sm text-gray-700">
                    Include elements of local culture, landmarks, or traditions to make your creation more meaningful and connected to UAE heritage
                  </p>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-blue-100 to-indigo-100 p-5 rounded-lg mt-8">
                <h3 className="text-lg font-medium text-blue-800 mb-2">Try These Prompt Templates</h3>
                <div className="space-y-3">
                  <div className="bg-white/80 p-3 rounded border border-blue-200">
                    <span className="font-medium text-blue-700">Poetry:</span> "Write a [type of poem] about [subject] that explores the theme of [theme]. Use imagery related to [specific images] and evoke a feeling of [emotion]. Include a reference to [cultural element]."
                  </div>
                  
                  <div className="bg-white/80 p-3 rounded border border-blue-200">
                    <span className="font-medium text-blue-700">Artwork:</span> "Create a [medium] of [subject] in a [style] style. Include [specific elements] and use a color palette of [colors]. The lighting should be [lighting description] and the mood should feel [mood]."
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
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
                              {event.status === 'open' && !event.maxSubmissionsReached && event.stage === 'class' && (
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
                                  onClick={() => handleSubmit(event.id)}
                                >
                                  Submit
                                </Button>
                              )}
                              {event.status === 'open' && !event.maxSubmissionsReached && event.stage !== 'class' && (
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  className="bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm cursor-not-allowed"
                                  disabled={true}
                                  title="Submissions are only allowed during the class stage"
                                >
                                  <AlertCircle className="h-4 w-4 mr-1" /> {event.stage.charAt(0).toUpperCase() + event.stage.slice(1)} Stage
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
                      <div className="h-60 bg-blue-50 border-y border-blue-100 flex items-center justify-center p-2">
                        <img 
                          src={submission.content} 
                          alt={submission.title} 
                          className="max-w-full max-h-56 object-contain shadow-sm" 
                        />
                      </div>
                    )}
                    
                    <div className="p-4 flex flex-col gap-3 border-t border-blue-100 bg-gradient-to-b from-white to-blue-50">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-sm font-medium text-blue-700">
                            {submission.voteCount || 0} votes received
                          </span>
                        </div>
                        <div className="text-xs text-blue-500">
                          {submission.eventId === eventId 
                            ? `Submitted to: ${submission.eventName || activeVotingEvent?.name || 'current event'}` 
                            : submission.eventName 
                              ? `Submitted to: ${submission.eventName}` 
                              : `Submitted to event #${submission.eventId}`}
                        </div>
                      </div>
                      
                      {/* Download button */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full flex items-center justify-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        onClick={() => handleDownload(submission)}
                      >
                        <Download className="h-4 w-4" />
                        Download {submission.contentType === "text" ? "Poem" : "Artwork"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="voting" className="mt-4">
          {activeVotingEvent && (
            <div className="bg-white rounded-lg shadow-lg border border-blue-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Vote className="h-5 w-5 text-blue-600 mr-2" />
                  <h2 className="text-xl font-semibold font-heading text-blue-800">
                    Voting - {activeVotingEvent.name}
                  </h2>
                </div>
                
                {/* Voting Stats */}
                {!isLoadingVotingStats && votingStats && (
                  <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 flex items-center space-x-3">
                    <div className="text-sm text-blue-700">
                      <span className="font-bold">{votingStats.remaining}</span> of <span className="font-bold">{votingStats.maxVotes}</span> votes remaining (you can cast {votingStats.maxVotes} votes total)
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
              
              {/* Sub-tabs for different voting stages */}
              <Tabs value={selectedVotingStage} onValueChange={(value) => setSelectedVotingStage(value as 'class' | 'school' | 'country' | 'global')}>
                <TabsList className="w-full border-b border-blue-100 mb-6 bg-transparent p-0">
                  <TabsTrigger 
                    value="class" 
                    className={`px-5 py-2 rounded-t-lg text-sm font-medium transition-all ${
                      selectedVotingStage === 'class' 
                        ? 'bg-white border-blue-200 border-t border-l border-r text-blue-800' 
                        : (currentEventStage === 'class' || currentEventStage === 'school' || currentEventStage === 'country' || currentEventStage === 'global')
                          ? 'bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!['class', 'school', 'country', 'global'].includes(currentEventStage)}
                  >
                    Class Voting
                  </TabsTrigger>
                  
                  <TabsTrigger 
                    value="school" 
                    className={`px-5 py-2 rounded-t-lg text-sm font-medium transition-all ${
                      selectedVotingStage === 'school' 
                        ? 'bg-white border-blue-200 border-t border-l border-r text-blue-800' 
                        : (currentEventStage === 'school' || currentEventStage === 'country' || currentEventStage === 'global')
                          ? 'bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!['school', 'country', 'global'].includes(currentEventStage)}
                  >
                    School Voting
                  </TabsTrigger>
                  
                  <TabsTrigger 
                    value="country" 
                    className={`px-5 py-2 rounded-t-lg text-sm font-medium transition-all ${
                      selectedVotingStage === 'country' 
                        ? 'bg-white border-blue-200 border-t border-l border-r text-blue-800' 
                        : (currentEventStage === 'country' || currentEventStage === 'global')
                          ? 'bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!['country', 'global'].includes(currentEventStage)}
                  >
                    Country Voting
                  </TabsTrigger>
                  
                  <TabsTrigger 
                    value="global" 
                    className={`px-5 py-2 rounded-t-lg text-sm font-medium transition-all ${
                      selectedVotingStage === 'global' 
                        ? 'bg-white border-blue-200 border-t border-l border-r text-blue-800' 
                        : currentEventStage === 'global'
                          ? 'bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={currentEventStage !== 'global'}
                  >
                    Global Voting
                  </TabsTrigger>
                </TabsList>
                
                {/* Content area for submissions */}
                <TabsContent value={selectedVotingStage} className="mt-0 px-0">
                  {/* Stage explanation banner */}
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start">
                      <div className="mr-3 mt-0.5">
                        <AlertCircle className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-blue-700 mb-1">
                          {selectedVotingStage === 'class' ? (
                            "Class Voting Stage"
                          ) : selectedVotingStage === 'school' ? (
                            "School Voting Stage"
                          ) : selectedVotingStage === 'country' ? (
                            "Country Voting Stage"
                          ) : (
                            "Global Voting Stage"
                          )}
                        </h3>
                        <p className="text-sm text-blue-600">
                          {selectedVotingStage === 'class' ? (
                            "Vote for submissions from students in your class. The top 3 submissions will advance to the School stage."
                          ) : selectedVotingStage === 'school' ? (
                            "Vote for class winners from students in your grade level and school. The top 3 submissions will advance to the Country stage."
                          ) : selectedVotingStage === 'country' ? (
                            "Vote for school winners from your country. The top 3 submissions will advance to the Global stage."
                          ) : (
                            "Vote for country winners to determine the global champions."
                          )}
                        </p>
                        {selectedVotingStage !== currentEventStage && (
                          <p className="text-xs text-blue-500 mt-1 italic">
                            Note: You are viewing {selectedVotingStage} stage history. The current event stage is {currentEventStage}.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Submission list */}
                  {isLoadingVotableSubmissions ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : !Array.isArray(votableSubmissions) || votableSubmissions.length === 0 ? (
                    <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="inline-block h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-4 mx-auto">
                        <Vote className="h-8 w-8 text-blue-400" />
                      </div>
                      <p className="text-blue-700">
                        {selectedVotingStage === currentEventStage ? (
                          "No submissions available for voting in this stage yet."
                        ) : (
                          `No submissions found in the ${selectedVotingStage} stage history.`
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {votableSubmissions.map((submission: any) => (
                        <div key={submission.id} className="border border-blue-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all group">
                          <div className="p-4 bg-blue-50">
                            <div className="flex justify-between items-start">
                              <h3 className="font-medium text-blue-900">{submission.title}</h3>
                              <span className="text-xs text-blue-600">{submission.userFullName || "Anonymous"}</span>
                            </div>
                            {/* Winner badges if applicable */}
                            {selectedVotingStage !== 'class' && submission.classWinner && (
                              <div className="mt-1">
                                <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700 text-xs">
                                  <Trophy className="mr-1 h-3 w-3" /> Class Winner
                                </Badge>
                              </div>
                            )}
                            {selectedVotingStage !== 'school' && selectedVotingStage !== 'class' && submission.schoolWinner && (
                              <div className="mt-1">
                                <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700 text-xs">
                                  <Trophy className="mr-1 h-3 w-3" /> School Winner
                                </Badge>
                              </div>
                            )}
                            {selectedVotingStage === 'global' && submission.countryWinner && (
                              <div className="mt-1">
                                <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700 text-xs">
                                  <Trophy className="mr-1 h-3 w-3" /> Country Winner
                                </Badge>
                              </div>
                            )}
                          </div>
                          
                          {submission.contentType === "text" ? (
                            <div className="p-4 font-artistic text-blue-800 bg-white">
                              <p className="whitespace-pre-line">{submission.content}</p>
                            </div>
                          ) : (
                            <div className="h-60 bg-blue-50 border-y border-blue-100 flex items-center justify-center p-2">
                              <img 
                                src={submission.content} 
                                alt={submission.title} 
                                className="max-w-full max-h-56 object-contain shadow-sm" 
                              />
                            </div>
                          )}
                          
                          <div className="p-4 flex flex-col gap-3 border-t border-blue-100 bg-gradient-to-b from-white to-blue-50">
                            <div className="flex justify-between items-center">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-blue-700">
                                  {submission.voteCount || 0} votes received
                                </span>
                                <span className="text-xs text-blue-500">
                                  {submission.eventId === eventId 
                                    ? `Current event: ${submission.eventName || activeVotingEvent?.name}` 
                                    : submission.eventName 
                                      ? `Event: ${submission.eventName}` 
                                      : `Event #${submission.eventId}`}
                                </span>
                              </div>
                              
                              {/* Download button */}
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex items-center justify-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                onClick={() => handleDownload(submission)}
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </Button>
                            </div>
                            
                            {/* Only show vote button if viewing current stage */}
                            {selectedVotingStage === currentEventStage ? (
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
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                                Previous Stage
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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