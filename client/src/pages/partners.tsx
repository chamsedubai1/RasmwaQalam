import React from "react";
import { useQuery } from "@tanstack/react-query";
import PartnerCard from "@/components/site/partner-card";

const Partners: React.FC = () => {
  // Fetch partners
  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['/api/partners'],
  });
  
  return (
    <div>
      <h1 className="text-3xl font-bold font-heading text-gray-800 mb-6">Our Partners</h1>
      
      {isLoading ? (
        <div className="py-10 text-center">Loading partners...</div>
      ) : partners.length === 0 ? (
        <div className="py-10 text-center bg-white rounded-lg shadow-md">
          <p className="text-gray-500">No partners found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {partners.map((partner: any) => (
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
