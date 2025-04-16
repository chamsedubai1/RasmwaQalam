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
import {
  Palette,
  PenTool,
  Trophy,
  Filter,
  ImageIcon,
  Sparkles,
  Medal,
  FileText,
  Search,
  Loader2
} from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

const Gallery: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("paintings");
  const [winnerCategory, setWinnerCategory] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all"); // 'all', 'competition', 'gallery'
  
  // Fetch winning submissions
  const { data: allSubmissions = [], isLoading: submissionsLoading } = useQuery<any[]>({
    queryKey: ['/api/submissions', winnerCategory !== 'all' ? `?winnerCategory=${winnerCategory}` : ''],
  });
  
  // Fetch gallery items
  const { data: galleryItems = [], isLoading: galleryLoading } = useQuery<any[]>({
    queryKey: ['/api/gallery-items'],
  });
  
  // Fetch events for the filter dropdown
  const { data: events = [] } = useQuery<any[]>({
    queryKey: ['/api/events'],
  });
  
  // Combined and processed items for display
  const processedItems = [
    // Process competition submissions
    ...allSubmissions.map((submission) => ({
      id: `submission-${submission.id}`,
      title: submission.title,
      description: submission.description || "",
      content: submission.content,
      contentType: submission.contentType,
      creator: submission.userFullName || "Anonymous",
      grade: submission.userGradeLevel || "",
      eventId: submission.eventId,
      eventName: getEventName(submission.eventId),
      winnerLevel: submission.globalWinner ? "global" 
                  : submission.countryWinner ? "country"
                  : submission.schoolWinner ? "school"
                  : "class",
      source: "competition"
    })),
    
    // Process admin-added gallery items
    ...galleryItems.map((item) => ({
      id: `gallery-${item.id}`,
      title: item.title,
      description: item.description || "",
      content: item.content,
      contentType: item.type === "poem" ? "text" : "image",
      creator: "Admin Curator",
      grade: "",
      eventId: null,
      eventName: "Gallery Item",
      winnerLevel: item.featured ? "featured" : "regular",
      source: "gallery"
    }))
  ];
  
  // Filter items by type, event, and source
  const filteredItems = processedItems.filter((item) => {
    const matchesType = activeTab === "paintings" 
      ? item.contentType === "image"
      : item.contentType === "text";
    
    const matchesEvent = eventFilter === "all" || 
      (item.eventId && item.eventId.toString() === eventFilter);
    
    const matchesSource = sourceFilter === "all" || 
      item.source === sourceFilter;
    
    return matchesType && matchesEvent && matchesSource;
  });
  
  // Get event name by ID for display
  const getEventName = (eventId: number) => {
    const event = events.find((e) => e.id === eventId);
    return event ? event.name : "Unknown Event";
  };
  
  return (
    <div>
      {/* Hero Section */}
      <div className="relative rounded-xl overflow-hidden mb-12">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-amber-800 opacity-90"></div>
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJ3aGl0ZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMiIvPjwvZz48L3N2Zz4=')]"></div>
        </div>
        <div className="absolute bottom-0 right-0 w-64 h-64 opacity-20">
          <Trophy className="w-full h-full text-white" />
        </div>
        <div className="relative z-10 py-16 px-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full">
              <Medal className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-heading text-white mb-4">
            {t('gallery.hero.title')}
          </h1>
          <p className="text-lg text-amber-100 max-w-2xl mx-auto">
            {t('gallery.hero.description')}
          </p>
        </div>
      </div>
      
      {/* Gallery Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-amber-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <ImageIcon className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{processedItems.filter((item: any) => item.contentType === 'image').length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">{t('gallery.stats.paintings')}</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-amber-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{processedItems.filter((item: any) => item.contentType === 'text').length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">{t('gallery.stats.poems')}</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-amber-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Trophy className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{allSubmissions.filter((s: any) => s.globalWinner).length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">{t('gallery.stats.global_winners')}</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-amber-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Sparkles className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{events ? events.length : 0}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">{t('gallery.stats.events')}</div>
        </div>
      </div>
      
      {/* Gallery Tabs */}
      <div className="mb-8">
        <Tabs defaultValue="paintings" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 bg-white rounded-xl p-1 shadow-sm border border-amber-100">
            <TabsTrigger value="paintings" className="flex items-center justify-center gap-2 rounded-lg py-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white">
              <Palette className="h-4 w-4" />
              <span>{t('gallery.tabs.paintings')}</span>
            </TabsTrigger>
            <TabsTrigger value="poetry" className="flex items-center justify-center gap-2 rounded-lg py-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <PenTool className="h-4 w-4" />
              <span>{t('gallery.tabs.poetry')}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Gallery Filters */}
      <div className="bg-white rounded-xl shadow-md border border-amber-50 p-6 mb-8">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-amber-600 mr-2" />
          <h2 className="font-semibold text-gray-800">{t('gallery.filters.title')}</h2>
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <Label htmlFor="gallery-stage" className="block text-sm font-medium text-gray-700 mb-1">{t('gallery.filters.competition_stage')}</Label>
            <Select value={winnerCategory} onValueChange={setWinnerCategory}>
              <SelectTrigger id="gallery-stage" className="w-[200px] border-amber-200">
                <SelectValue placeholder={t('gallery.filters.all_winners')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('gallery.filters.all_winners')}</SelectItem>
                <SelectItem value="class">{t('gallery.filters.class_winners')}</SelectItem>
                <SelectItem value="school">{t('gallery.filters.school_winners')}</SelectItem>
                <SelectItem value="country">{t('gallery.filters.country_winners')}</SelectItem>
                <SelectItem value="global">{t('gallery.filters.global_winners')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="gallery-event" className="block text-sm font-medium text-gray-700 mb-1">{t('gallery.filters.event')}</Label>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger id="gallery-event" className="w-[200px] border-amber-200">
                <SelectValue placeholder={t('gallery.filters.all_events')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('gallery.filters.all_events')}</SelectItem>
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
      
      {/* Source Filter */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex rounded-lg border border-amber-100 bg-white p-1 shadow-sm">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              sourceFilter === 'all' 
                ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white' 
                : 'text-gray-600 hover:bg-amber-50'
            }`}
            onClick={() => setSourceFilter('all')}
          >
            All Items
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              sourceFilter === 'competition' 
                ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white' 
                : 'text-gray-600 hover:bg-amber-50'
            }`}
            onClick={() => setSourceFilter('competition')}
          >
            Competition Winners
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              sourceFilter === 'gallery' 
                ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white' 
                : 'text-gray-600 hover:bg-amber-50'
            }`}
            onClick={() => setSourceFilter('gallery')}
          >
            Featured Gallery
          </button>
        </div>
      </div>
      
      {/* Gallery Grid */}
      {submissionsLoading && galleryLoading ? (
        <div className="py-16 text-center bg-white rounded-xl shadow-md border border-amber-50">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-amber-700 mb-4"></div>
          <p className="text-gray-600">{t('gallery.loading')}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl shadow-md border border-amber-50">
          <div className="inline-block h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center mb-4 mx-auto">
            <Search className="h-8 w-8 text-amber-300" />
          </div>
          <p className="text-gray-600 mb-3">{t('gallery.empty.description')}</p>
          <Button 
            variant="outline" 
            className="mt-2 border-amber-200 text-amber-700 hover:bg-amber-50"
            onClick={() => {
              setWinnerCategory("all");
              setEventFilter("all");
              setSourceFilter("all");
            }}
          >
            {t('gallery.empty.reset')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredItems.map((item: any) => (
            <GalleryItem
              key={item.id}
              id={item.id}
              title={item.title}
              creator={item.creator}
              grade={item.grade}
              description={item.description}
              imageUrl={item.contentType === "image" ? item.content : "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"}
              winnerCategory={item.winnerLevel}
              eventName={item.eventName}
              contentType={item.contentType}
              content={item.contentType === "text" ? item.content : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Gallery;
