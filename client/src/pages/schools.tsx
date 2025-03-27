import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SchoolCard from "@/components/site/school-card";
import { 
  School, 
  Search, 
  Globe2, 
  Users,
  MapPin,
  Loader2,
  BookOpen
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Schools: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch schools
  const { data: schools = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/schools'],
  });
  
  // Get mock student counts (in a real app, this would come from the API)
  const getActiveStudentCount = (schoolId: number) => {
    // This is mock data for demonstration
    const studentCounts: Record<number, number> = {
      1: 24,
      2: 18,
      3: 32
    };
    
    return studentCounts[schoolId] || Math.floor(Math.random() * 30) + 10;
  };
  
  // Filter schools by search query
  const filteredSchools = schools.filter((school: any) => 
    school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (school.description && school.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  return (
    <div>
      {/* Hero Section */}
      <div className="relative rounded-xl overflow-hidden mb-12">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-800 opacity-90"></div>
        <div className="absolute inset-0 overflow-hidden opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJ3aGl0ZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMiIvPjwvZz48L3N2Zz4=')]"></div>
        </div>
        <div className="absolute bottom-0 right-0 w-64 h-64 opacity-20">
          <School className="w-full h-full text-white" />
        </div>
        <div className="relative z-10 py-12 px-6 sm:px-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full">
              <BookOpen className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-heading text-white mb-4">
            Participating Schools
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-8">
            Discover the vibrant community of educational institutions taking part in our creative challenges
          </p>
          
          {/* Search bar */}
          <div className="max-w-md mx-auto relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Search schools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 py-6 pr-4 bg-white/90 backdrop-blur-sm border-0 rounded-full shadow-lg focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-blue-500"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearchQuery("")}
                >
                  <span className="sr-only">Clear search</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* School Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-blue-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <School className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{schools ? schools.length : 0}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Total Schools</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-blue-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Users className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {schools.reduce((total: number, school: any) => total + getActiveStudentCount(school.id), 0)}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Active Students</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center border border-blue-100 hover:shadow-lg transition-all">
          <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <MapPin className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">Dubai</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Main Region</div>
        </div>
      </div>
      
      {/* Schools Grid */}
      {isLoading ? (
        <div className="py-16 text-center bg-white rounded-xl shadow-md border border-blue-50">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700 mb-4"></div>
          <p className="text-gray-600">Loading schools...</p>
        </div>
      ) : filteredSchools.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl shadow-md border border-blue-50">
          <div className="inline-block h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mb-4 mx-auto">
            <Search className="h-8 w-8 text-blue-300" />
          </div>
          <p className="text-gray-600 mb-3">No schools found matching your search criteria.</p>
          <Button 
            variant="outline" 
            className="mt-2 border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => setSearchQuery("")}
          >
            Clear Search
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredSchools.map((school: any) => (
            <SchoolCard
              key={school.id}
              id={school.id}
              name={school.name}
              description={school.description}
              imageUrl={school.imageUrl || "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&h=200&q=80"}
              websiteUrl={school.websiteUrl}
              activeStudents={getActiveStudentCount(school.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Schools;
