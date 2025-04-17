import React, { useState, useEffect } from "react";
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
import { useLanguage } from "@/hooks/use-language";

const Events: React.FC = () => {
  const { t } = useLanguage();
  const [eventType, setEventType] = useState("all");
  const [eventStatus, setEventStatus] = useState("all");
  const [eventStage, setEventStage] = useState("all");
  const [submitEventId, setSubmitEventId] = useState<number | null>(null);
  
  // Fetch all events (always get fresh data)
  const { data: allEvents = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/events'],
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0, // Always fetch fresh data
    refetchInterval: 3000, // Refetch every 3 seconds to catch updates
    gcTime: 1000, // Short cache time (previously cacheTime in v4)
  });
  
  // Force refetch on initial render
  useEffect(() => {
    refetch();
  }, [refetch]);
  
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
            {t("events.hero.title")}
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-6">
            {t("events.hero.description")}
          </p>
          <div className="flex items-center justify-center mt-2 space-x-2">
            <div className="flex items-center bg-white bg-opacity-20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{t("events.hero.badge1")}</span>
            </div>
            <div className="flex items-center bg-white bg-opacity-20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
              <Award className="w-4 h-4 mr-2" />
              <span>{t("events.hero.badge2")}</span>
            </div>
            <div className="flex items-center bg-white bg-opacity-20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
              <Globe2 className="w-4 h-4 mr-2" />
              <span>{t("events.hero.badge3")}</span>
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
          <div className="text-xs text-gray-500 uppercase tracking-wider">{t("events.stats.active")}</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-blue-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{filteredEvents.filter((e) => e.status === 'upcoming').length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">{t("events.stats.upcoming")}</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-blue-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{filteredEvents.filter((e) => e.type === 'poetry').length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">{t("events.stats.poetry")}</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-blue-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Award className="h-5 w-5 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{filteredEvents.filter((e) => e.type === 'painting').length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">{t("events.stats.art")}</div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-blue-50 p-6 mb-8">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="font-semibold text-gray-800">{t("events.filters.title")}</h2>
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <Label htmlFor="event-type" className="block text-sm font-medium text-gray-700 mb-1">{t("events.filters.type.label")}</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger id="event-type" className="w-[180px]">
                <SelectValue placeholder={t("events.filters.type.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("events.filters.type.all")}</SelectItem>
                <SelectItem value="poetry">{t("events.filters.type.poetry")}</SelectItem>
                <SelectItem value="painting">{t("events.filters.type.painting")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="event-status" className="block text-sm font-medium text-gray-700 mb-1">{t("events.filters.status.label")}</Label>
            <Select value={eventStatus} onValueChange={setEventStatus}>
              <SelectTrigger id="event-status" className="w-[180px]">
                <SelectValue placeholder={t("events.filters.status.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("events.filters.status.all")}</SelectItem>
                <SelectItem value="upcoming">{t("events.filters.status.upcoming")}</SelectItem>
                <SelectItem value="open">{t("events.filters.status.open")}</SelectItem>
                <SelectItem value="closed">{t("events.filters.status.closed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="event-stage" className="block text-sm font-medium text-gray-700 mb-1">{t("events.filters.stage.label")}</Label>
            <Select value={eventStage} onValueChange={setEventStage}>
              <SelectTrigger id="event-stage" className="w-[180px]">
                <SelectValue placeholder={t("events.filters.stage.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("events.filters.stage.all")}</SelectItem>
                <SelectItem value="class">{t("events.filters.stage.class")}</SelectItem>
                <SelectItem value="school">{t("events.filters.stage.school")}</SelectItem>
                <SelectItem value="country">{t("events.filters.stage.country")}</SelectItem>
                <SelectItem value="global">{t("events.filters.stage.global")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Events List */}
      {isLoading ? (
        <div className="py-12 text-center bg-white rounded-xl shadow-md border border-blue-50">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mb-4"></div>
          <p className="text-gray-600">{t("events.loading")}</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl shadow-md border border-blue-50">
          <div className="inline-block h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mb-4 mx-auto">
            <Filter className="h-8 w-8 text-blue-300" />
          </div>
          <p className="text-gray-600 mb-3">{t("events.no_results")}</p>
          <Button 
            variant="outline" 
            className="mt-2 border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => {
              setEventType("all");
              setEventStatus("all");
              setEventStage("all");
            }}
          >
            {t("events.reset_filters")}
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
