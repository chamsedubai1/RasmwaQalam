import React from "react";
import { Button } from "@/components/ui/button";

interface GalleryItemProps {
  id: number;
  title: string;
  creator: string;
  grade: string;
  description: string;
  imageUrl: string;
  winnerCategory: string;
  eventName: string;
  contentType: 'text' | 'image';
  content?: string;
}

const GalleryItem: React.FC<GalleryItemProps> = ({
  id,
  title,
  creator,
  grade,
  description,
  imageUrl,
  winnerCategory,
  eventName,
  contentType,
  content
}) => {
  const winnerBadgeText = `${winnerCategory.charAt(0).toUpperCase() + winnerCategory.slice(1)} Winner`;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative">
        {contentType === 'image' ? (
          <img 
            src={imageUrl} 
            alt={title} 
            className="w-full object-cover" 
            style={{height: "250px"}}
          />
        ) : (
          <div className="p-6 bg-gray-50 font-artistic text-gray-800 h-[250px] overflow-y-auto border-b">
            <p className="whitespace-pre-line">{content}</p>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className="bg-success text-white text-xs font-semibold px-2 py-1 rounded-full">
            {winnerBadgeText}
          </span>
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-heading font-semibold text-lg mb-1">{title}</h3>
        <p className="text-gray-500 text-sm mb-3">By {creator} • {grade}</p>
        <p className="text-gray-600 text-sm mb-3">{description}</p>
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium bg-gray-100 text-gray-800 px-2 py-1 rounded">{eventName}</span>
          <Button variant="link" className="text-primary hover:text-indigo-700 p-0 h-auto">
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GalleryItem;
