import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Trophy, TrendingUp, BarChart, Award } from "lucide-react";

interface EventVotingHistoryProps {
  classId: number;
}

const EventVotingHistory: React.FC<EventVotingHistoryProps> = ({ classId }) => {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [votingHistoryData, setVotingHistoryData] = useState<any>(null);
  const [isLoadingVotingHistory, setIsLoadingVotingHistory] = useState(false);

  // Fetch active events for this class
  const {
    data: events = [],
    isLoading: isLoadingEvents,
  } = useQuery<any[]>({
    queryKey: ["/api/events", { classId }],
    queryFn: async () => {
      const response = await fetch(`/api/events?classId=${classId}`);
      if (!response.ok) throw new Error('Failed to fetch events for this class');
      return response.json();
    },
    enabled: classId > 0,
  });

  // Set first event as default when events load
  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  // Fetch voting history when an event is selected
  useEffect(() => {
    const fetchVotingHistory = async () => {
      if (!selectedEventId) return;

      setIsLoadingVotingHistory(true);
      setVotingHistoryData(null);

      try {
        // Use class-specific endpoint for teacher view
        const response = await fetch(`/api/events/${selectedEventId}/voting-history?classId=${classId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch voting history: ${response.statusText}`);
        }
        
        const data = await response.json();
        setVotingHistoryData(data);
      } catch (error) {
        console.error("Error fetching voting history:", error);
      } finally {
        setIsLoadingVotingHistory(false);
      }
    };

    fetchVotingHistory();
  }, [selectedEventId, classId]);

  if (isLoadingEvents) {
    return (
      <div className="py-10 flex justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 bg-muted/30 rounded-lg">
        <BarChart className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">No active events for this class</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div>
          <h3 className="text-lg font-medium mb-1">Event Voting Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Track participation and voting progress through competition stages
          </p>
        </div>
        <div className="w-full md:w-72">
          <Select
            value={selectedEventId?.toString()}
            onValueChange={(value) => setSelectedEventId(parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an event" />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id.toString()}>
                  {event.name} ({event.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoadingVotingHistory ? (
        <div className="py-10 flex justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">Loading voting history...</p>
          </div>
        </div>
      ) : votingHistoryData ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-md flex items-center gap-2">
                  <Badge className="bg-blue-500">{votingHistoryData.eventName}</Badge>
                  <span className="capitalize">{votingHistoryData.eventType}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <p className="capitalize">{votingHistoryData.eventStatus}</p>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Current Stage</div>
                    <p className="capitalize">{votingHistoryData.eventStage}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-md flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Overall Participation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Submissions</div>
                    <p className="text-xl font-bold">
                      {votingHistoryData.overall?.totalSubmissions || 0}
                    </p>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Votes</div>
                    <p className="text-xl font-bold">
                      {votingHistoryData.overall?.totalVotes || 0}
                    </p>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Approval Rate</div>
                    <p className="text-xl font-bold">
                      {votingHistoryData.overall?.approvalRate || 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="class">
            <TabsList className="mb-4">
              <TabsTrigger value="class">Class Stage</TabsTrigger>
              <TabsTrigger value="school">School Stage</TabsTrigger>
            </TabsList>

            <TabsContent value="class">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md">Class Stage Voting</CardTitle>
                    <CardDescription>
                      Voting within your class ({votingHistoryData.className})
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div>
                        <div className="text-sm text-muted-foreground">Submissions</div>
                        <p className="text-xl font-bold">{votingHistoryData.classStage?.totalSubmissions || 0}</p>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Votes</div>
                        <p className="text-xl font-bold">{votingHistoryData.classStage?.totalVotes || 0}</p>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Winners</div>
                        <p className="text-xl font-bold">{votingHistoryData.classStage?.winnersCount || 0}</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        Class Winners
                      </h3>
                      
                      {votingHistoryData.classStage?.winners && votingHistoryData.classStage.winners.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {votingHistoryData.classStage.winners.map((winner: any, index: number) => (
                            <div 
                              key={winner.id} 
                              className="bg-muted/30 p-4 rounded-lg flex items-start gap-3"
                            >
                              <div className="rounded-full bg-amber-100 text-amber-700 w-8 h-8 flex items-center justify-center">
                                <Trophy className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="font-medium">{winner.title}</div>
                                <div className="text-sm text-muted-foreground">
                                  By {winner.userFullName}
                                </div>
                                <div className="text-sm mt-1">
                                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 mt-1">
                                    {winner.voteCount} votes
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-muted/20 rounded-lg">
                          <p className="text-sm text-muted-foreground">No winners declared yet for class stage</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="school">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md">School Stage Voting</CardTitle>
                    <CardDescription>
                      Voting across your school ({votingHistoryData.schoolName})
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div>
                        <div className="text-sm text-muted-foreground">Submissions</div>
                        <p className="text-xl font-bold">{votingHistoryData.schoolStage?.totalSubmissions || 0}</p>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Votes</div>
                        <p className="text-xl font-bold">{votingHistoryData.schoolStage?.totalVotes || 0}</p>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Winners</div>
                        <p className="text-xl font-bold">{votingHistoryData.schoolStage?.winnersCount || 0}</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <Award className="h-4 w-4 text-blue-500" />
                        School Winners (Same Grade)
                      </h3>

                      {votingHistoryData.schoolStage?.winners && votingHistoryData.schoolStage.winners.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {votingHistoryData.schoolStage.winners.map((winner: any, index: number) => (
                            <div 
                              key={winner.id} 
                              className="bg-muted/30 p-4 rounded-lg flex items-start gap-3"
                            >
                              <div className="rounded-full bg-blue-100 text-blue-700 w-8 h-8 flex items-center justify-center">
                                <Award className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="font-medium">{winner.title}</div>
                                <div className="text-sm text-muted-foreground">
                                  {winner.className || "Unknown Class"}
                                </div>
                                <div className="text-sm mt-1">
                                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 mt-1">
                                    {winner.voteCount} votes
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-muted/20 rounded-lg">
                          <p className="text-sm text-muted-foreground">No school stage winners from your grade yet</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="text-center py-8 bg-muted/30 rounded-lg">
          <BarChart className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Select an event to view voting history</p>
        </div>
      )}
    </div>
  );
};

export default EventVotingHistory;