import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import GalleryItem from "@/components/site/gallery-item";
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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const Gallery: React.FC = () => {
  const [activeTab, setActiveTab] = useState("paintings");
  const [winnerCategory, setWinnerCategory] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  
  // Fetch winning submissions
  const { data: allSubmissions = [], isLoading } = useQuery({
    queryKey: ['/api/submissions', winnerCategory !== 'all' ? `?winnerCategory=${winnerCategory}` : ''],
  });
  
  // Fetch events for the filter dropdown
  const { data: events = [] } = useQuery({
    queryKey: ['/api/events'],
  });
  
  // Filter submissions by type and event
  const filteredSubmissions = allSubmissions.filter((submission: any) => {
    const matchesType = activeTab === "paintings" 
      ? submission.contentType === "image"
      : submission.contentType === "text";
    
    const matchesEvent = eventFilter === "all" || submission.eventId.toString() === eventFilter;
    
    return matchesType && matchesEvent;
  });
  
  // Get event name by ID for display
  const getEventName = (eventId: number) => {
    const event = events.find((e: any) => e.id === eventId);
    return event ? event.name : "Unknown Event";
  };
  
  return (
    <div>
      <h1 className="text-3xl font-bold font-heading text-gray-800 mb-6">Gallery</h1>
      
      {/* Gallery Tabs */}
      <div className="mb-8">
        <Tabs defaultValue="paintings" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full border-b border-gray-200">
            <TabsTrigger value="paintings" className="flex-1">Paintings</TabsTrigger>
            <TabsTrigger value="poetry" className="flex-1">Poetry</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Gallery Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-8">
        <div className="flex flex-wrap gap-4">
          <div>
            <Label htmlFor="gallery-stage" className="block text-sm font-medium text-gray-700 mb-1">Competition Stage</Label>
            <Select value={winnerCategory} onValueChange={setWinnerCategory}>
              <SelectTrigger id="gallery-stage" className="w-[180px]">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Winners</SelectItem>
                <SelectItem value="class">Class Winners</SelectItem>
                <SelectItem value="school">School Winners</SelectItem>
                <SelectItem value="country">Country Winners</SelectItem>
                <SelectItem value="global">Global Winners</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="gallery-event" className="block text-sm font-medium text-gray-700 mb-1">Event</Label>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger id="gallery-event" className="w-[180px]">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {events.map((event: any) => (
                  <SelectItem key={event.id} value={event.id.toString()}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Gallery Grid */}
      {isLoading ? (
        <div className="py-10 text-center">Loading gallery items...</div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="py-10 text-center bg-white rounded-lg shadow-md">
          <p className="text-gray-500">No winning submissions found matching your filters.</p>
          <Button 
            variant="link" 
            className="mt-2"
            onClick={() => {
              setWinnerCategory("all");
              setEventFilter("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredSubmissions.map((submission: any) => {
            // Find the winner category
            let winnerLevel = "class";
            if (submission.globalWinner) winnerLevel = "global";
            else if (submission.countryWinner) winnerLevel = "country";
            else if (submission.schoolWinner) winnerLevel = "school";
            
            // Find the user who created this submission
            const creatorName = submission.userFullName || "Anonymous";
            const grade = submission.userGradeLevel || "";
            
            return (
              <GalleryItem
                key={submission.id}
                id={submission.id}
                title={submission.title}
                creator={creatorName}
                grade={grade}
                description={submission.description || ""}
                imageUrl={submission.contentType === "image" ? submission.content : "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"}
                winnerCategory={winnerLevel}
                eventName={getEventName(submission.eventId)}
                contentType={submission.contentType}
                content={submission.contentType === "text" ? submission.content : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Gallery;
