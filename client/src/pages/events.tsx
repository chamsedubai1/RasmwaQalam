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

const Events: React.FC = () => {
  const [eventType, setEventType] = useState("all");
  const [eventStatus, setEventStatus] = useState("all");
  const [eventStage, setEventStage] = useState("all");
  const [submitEventId, setSubmitEventId] = useState<number | null>(null);
  
  // Fetch all events
  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['/api/events'],
  });
  
  // Apply filters
  const filteredEvents = allEvents.filter((event: any) => {
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
      <h1 className="text-3xl font-bold font-heading text-gray-800 mb-6">Events</h1>
      
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-8">
        <div className="flex flex-wrap gap-4">
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
        <div className="py-10 text-center">Loading events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-10 text-center bg-white rounded-lg shadow-md">
          <p className="text-gray-500">No events found matching your filters.</p>
          <Button 
            variant="link" 
            className="mt-2"
            onClick={() => {
              setEventType("all");
              setEventStatus("all");
              setEventStage("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredEvents.map((event: any) => (
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
