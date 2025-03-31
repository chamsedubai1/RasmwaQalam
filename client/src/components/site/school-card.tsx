import React from "react";
import { ExternalLink } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

interface SchoolCardProps {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
  activeStudents: number;
}

const SchoolCard: React.FC<SchoolCardProps> = ({
  id,
  name,
  description,
  imageUrl,
  websiteUrl,
  activeStudents
}) => {
  const { t } = useLanguage();
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="h-48 bg-gray-200 relative">
        <img 
          src={imageUrl} 
          alt={name} 
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-5">
        <h3 className="font-heading font-semibold text-lg mb-2">{name}</h3>
        <p className="text-gray-600 text-sm mb-3">{description}</p>
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium bg-gray-100 text-gray-800 px-2 py-1 rounded">
            {activeStudents} {t("schools.card.student_count")}
          </span>
          <a 
            href={websiteUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-primary hover:text-indigo-700 text-sm font-medium flex items-center gap-1"
          >
            {t("schools.card.view_details")} <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default SchoolCard;
