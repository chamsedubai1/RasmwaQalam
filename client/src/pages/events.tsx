import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import EventCard from "@/components/site/event-card";
import SubmissionModal from "@/components/site/submission-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Filter, 
  Sparkles, 
  TrendingUp,
  Award, 
  Globe2
} from "lucide-react";

const Events: React.FC = () => {
  const [eventType, setEventType] = useState("all");
  const [eventStatus, setEventStatus] = useState("all");
  const [eventStage, setEventStage] = useState("all");
  const [submitEventId, setSubmitEventId] = useState<number | null>(null);
  
  // Fetch all events
  const { data: allEvents = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/events'],
  });
  
  // Apply filters
  const filteredEvents = allEvents.filter((event) => {
    const matchesType = eventType === "all" || event.type === eventType;
    const matchesStatus = eventStatus === "all" || event.status === eventStatus;
    const matchesStage = eventStage === "all" || event.stage === eventStage;
    
    return matchesType && matchesStatus && matchesStage;
  });
  
  const handleSubmit = (eventId: number) => {
    setSubmitEventId(eventId);
  };
  
  const handleCloseModal = () => {
    setSubmitEventId(null);
  };
  
  return (
    <div>
      {/* Hero Section */}
      <div className="relative mb-12 rounded-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 opacity-90"></div>
        <div className="absolute inset-0 overflow-hidden opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJ3aGl0ZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMiIvPjwvZz48L3N2Zz4=')]"></div>
        </div>
        <div className="relative z-10 py-12 px-6 sm:px-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold font-heading text-white mb-4">
            Creative Challenges
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-6">
            Discover, participate, and showcase your talent in our artistic competitions
          </p>
          <div className="flex items-center justify-center mt-2 space-x-2">
            <div className="flex items-center bg-white bg-opacity-20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
              <Calendar className="w-4 h-4 mr-2" />
              <span>Updated Weekly</span>
            </div>
            <div className="flex items-center bg-white bg-opacity-20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
              <Award className="w-4 h-4 mr-2" />
              <span>Win Recognition</span>
            </div>
            <div className="flex items-center bg-white bg-opacity-20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
              <Globe2 className="w-4 h-4 mr-2" />
              <span>Global Platform</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Events Count */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-blue-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Sparkles className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{filteredEvents.filter((e) => e.status === 'open').length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Active Events</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-blue-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{filteredEvents.filter((e) => e.status === 'upcoming').length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Upcoming</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-blue-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{filteredEvents.filter((e) => e.type === 'poetry').length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Poetry Challenges</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-blue-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Award className="h-5 w-5 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{filteredEvents.filter((e) => e.type === 'painting').length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Art Challenges</div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-blue-50 p-6 mb-8">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="font-semibold text-gray-800">Filter Events</h2>
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <Label htmlFor="event-type" className="block text-sm font-medium text-gray-700 mb-1">Event Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger id="event-type" className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="poetry">Poetry</SelectItem>
                <SelectItem value="painting">Painting</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="event-status" className="block text-sm font-medium text-gray-700 mb-1">Status</Label>
            <Select value={eventStatus} onValueChange={setEventStatus}>
              <SelectTrigger id="event-status" className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="event-stage" className="block text-sm font-medium text-gray-700 mb-1">Stage</Label>
            <Select value={eventStage} onValueChange={setEventStage}>
              <SelectTrigger id="event-stage" className="w-[180px]">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="class">Class</SelectItem>
                <SelectItem value="school">School</SelectItem>
                <SelectItem value="country">Country</SelectItem>
                <SelectItem value="global">Global</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Events List */}
      {isLoading ? (
        <div className="py-12 text-center bg-white rounded-xl shadow-md border border-blue-50">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mb-4"></div>
          <p className="text-gray-600">Loading amazing competitions for you...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl shadow-md border border-blue-50">
          <div className="inline-block h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mb-4 mx-auto">
            <Filter className="h-8 w-8 text-blue-300" />
          </div>
          <p className="text-gray-600 mb-3">No events found matching your filters.</p>
          <Button 
            variant="outline" 
            className="mt-2 border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => {
              setEventType("all");
              setEventStatus("all");
              setEventStage("all");
            }}
          >
            Reset All Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              id={event.id}
              name={event.name}
              description={event.description}
              imageUrl={event.imageUrl}
              type={event.type}
              status={event.status}
              stage={event.stage}
              endDate={event.endDate}
              onSubmit={handleSubmit}
            />
          ))}
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

export default Events;
