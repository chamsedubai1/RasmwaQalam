import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PartnerCard from "@/components/site/partner-card";
import { 
  Building2, 
  HandshakeIcon, 
  Globe, 
  Search,
  Briefcase,
  School2,
  Award,
  Handshake,
  Building,
  BookOpen,
  Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";

const Partners: React.FC = () => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [partnerTypeFilter, setPartnerTypeFilter] = useState("all");
  
  // Fetch partners (active only for public page)
  const { data: partnersRaw = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/partners'],
    // Don't set showInactive=true here as we only want to show active partners on the public page
  });
  // Defensive: treat non-array responses (error bodies, null, etc.) as empty.
  const partners = Array.isArray(partnersRaw) ? partnersRaw : [];

  // Filter partners by search query, type, and active status
  const filteredPartners = partners.filter((partner: any) => {
    // Always filter out inactive partners on public page
    if (!partner.isActive) return false;
    
    const matchesSearch = partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (partner.description && partner.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = partnerTypeFilter === "all" || partner.partnerType === partnerTypeFilter;
    
    return matchesSearch && matchesType;
  });
  
  // Get unique partner types for filter
  const partnerTypes = Array.from(new Set(partners.map((p: any) => p.partnerType))).filter(Boolean);
  
  // Get icon for partner type
  const getPartnerTypeIcon = (type: string) => {
    switch(type) {
      case 'corporate': return <Briefcase className="h-5 w-5" />;
      case 'education': return <School2 className="h-5 w-5" />;
      case 'technology': return <Globe className="h-5 w-5" />;
      case 'community': return <Handshake className="h-5 w-5" />;
      default: return <Building className="h-5 w-5" />;
    }
  };
  
  return (
    <div>
      {/* Hero Section */}
      <div className="relative rounded-xl overflow-hidden mb-12">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-90"></div>
        <div className="absolute inset-0 overflow-hidden opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJ3aGl0ZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMiIvPjwvZz48L3N2Zz4=')]"></div>
        </div>
        <div className="absolute bottom-0 right-0 w-64 h-64 opacity-20">
          <Building2 className="w-full h-full text-white" />
        </div>
        <div className="relative z-10 py-12 px-6 sm:px-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full">
              <Handshake className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-heading text-white mb-4">
            {t("partners.hero.title")}
          </h1>
          <p className="text-lg text-purple-100 max-w-2xl mx-auto mb-8">
            {t("partners.hero.description")}
          </p>
          
          {/* Search bar */}
          <div className="max-w-md mx-auto relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder={t("partners.search.placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 py-6 pr-4 bg-white/90 backdrop-blur-sm border-0 rounded-full shadow-lg focus:ring-2 focus:ring-purple-300 focus:ring-offset-2 focus:ring-offset-purple-500"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearchQuery("")}
                >
                  <span className="sr-only">{t("partners.search.clear")}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Partner Type Filters */}
      <div className="mb-8 flex flex-wrap gap-2 justify-center">
        <Button 
          variant={partnerTypeFilter === "all" ? "default" : "outline"}
          className={partnerTypeFilter === "all" 
            ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white" 
            : "border-purple-200 text-purple-700 hover:bg-purple-50"}
          onClick={() => setPartnerTypeFilter("all")}
        >
          <Building2 className="h-4 w-4 mr-2" />
          {t("partners.filter.all")}
        </Button>
        
        {partnerTypes.map(type => (
          <Button 
            key={type} 
            variant={partnerTypeFilter === type ? "default" : "outline"}
            className={partnerTypeFilter === type 
              ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white" 
              : "border-purple-200 text-purple-700 hover:bg-purple-50"}
            onClick={() => setPartnerTypeFilter(type)}
          >
            {getPartnerTypeIcon(type)}
            <span className="ml-2 capitalize">{type}</span>
          </Button>
        ))}
      </div>
      
      {/* Partners Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-purple-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Building2 className="h-5 w-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{partners.filter((p: any) => p.isActive).length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">{t("partners.stats.active")}</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-purple-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Globe className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{partners.filter((p: any) => p.isActive && p.partnerType === 'technology').length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">{t("partners.stats.tech")}</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-purple-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <School2 className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{partners.filter((p: any) => p.isActive && p.partnerType === 'education').length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">{t("partners.stats.education")}</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-purple-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Briefcase className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{partners.filter((p: any) => p.isActive && p.partnerType === 'corporate').length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">{t("partners.stats.corporate")}</div>
        </div>
      </div>
      
      {/* Partners Grid */}
      {isLoading ? (
        <div className="py-16 text-center bg-white rounded-xl shadow-md border border-purple-50">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-purple-700 mb-4"></div>
          <p className="text-gray-600">{t("message.loading")}</p>
        </div>
      ) : filteredPartners.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl shadow-md border border-purple-50">
          <div className="inline-block h-16 w-16 rounded-full bg-purple-50 flex items-center justify-center mb-4 mx-auto">
            <Search className="h-8 w-8 text-purple-300" />
          </div>
          <p className="text-gray-600 mb-3">{t("partners.empty.description")}</p>
          <Button 
            variant="outline" 
            className="mt-2 border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={() => {
              setSearchQuery("");
              setPartnerTypeFilter("all");
            }}
          >
            {t("partners.empty.reset")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredPartners.map((partner: any) => (
            <PartnerCard
              key={partner.id}
              id={partner.id}
              name={partner.name}
              description={partner.description}
              imageUrl={partner.imageUrl}
              websiteUrl={partner.websiteUrl}
              partnerType={partner.partnerType}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Partners;
