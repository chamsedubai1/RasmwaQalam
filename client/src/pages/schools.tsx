import React from "react";
import { useQuery } from "@tanstack/react-query";
import SchoolCard from "@/components/site/school-card";

const Schools: React.FC = () => {
  // Fetch schools
  const { data: schools = [], isLoading } = useQuery({
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
  
  return (
    <div>
      <h1 className="text-3xl font-bold font-heading text-gray-800 mb-6">Participating Schools</h1>
      
      {isLoading ? (
        <div className="py-10 text-center">Loading schools...</div>
      ) : schools.length === 0 ? (
        <div className="py-10 text-center bg-white rounded-lg shadow-md">
          <p className="text-gray-500">No schools found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {schools.map((school: any) => (
            <SchoolCard
              key={school.id}
              id={school.id}
              name={school.name}
              description={school.description}
              imageUrl={school.imageUrl}
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
