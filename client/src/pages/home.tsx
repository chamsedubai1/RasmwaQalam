import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronRight, UserPlus, Laptop, Upload, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import EventCard from "@/components/site/event-card";
import { useUserRole } from "@/hooks/use-user-role";
import SubmissionModal from "@/components/site/submission-modal";

const Home: React.FC = () => {
  const { userRole } = useUserRole();
  const [submitEventId, setSubmitEventId] = React.useState<number | null>(null);

  // Fetch featured events
  const { data: events, isLoading } = useQuery({
    queryKey: ['/api/events?status=open'],
    enabled: true,
  });

  const featuredEvents = events?.slice(0, 3) || [];

  const handleSubmit = (eventId: number) => {
    setSubmitEventId(eventId);
  };

  const handleCloseModal = () => {
    setSubmitEventId(null);
  };

  return (
    <div>
      {/* Hero Section */}
      <div className="relative">
        <div className="bg-gradient-to-r from-primary to-indigo-800 rounded-xl overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="w-full h-full">
              <iframe 
                src="https://www.youtube.com/embed/M4jtGvdMvA4?autoplay=1&mute=1&loop=1&playlist=M4jtGvdMvA4&controls=0&rel=0"
                title="Art in schools video"
                className="w-full h-full object-cover"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
          <div className="relative px-8 py-16 sm:px-16 sm:py-20 text-white">
            <h1 className="text-4xl sm:text-5xl font-bold font-heading mb-4">Unleash Your Creativity</h1>
            <p className="text-xl mb-8 max-w-2xl">Join art challenges, create with AI, and compete with students around the world.</p>
            <div className="flex flex-wrap gap-4">
              <Link href="/events">
                <Button size="lg" className="bg-accent hover:bg-amber-600 text-white font-medium rounded-full shadow-lg transition-all">
                  Explore Events
                </Button>
              </Link>
              {userRole === "student" && (
                <Link href="/creart">
                  <Button size="lg" variant="outline" className="bg-white hover:bg-gray-100 text-primary font-medium rounded-full shadow-lg transition-all">
                    Start Creating
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Featured Events Section */}
      <div className="mt-16">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold font-heading text-gray-800">Featured Events</h2>
          <Link 
            href="/events" 
            className="text-primary hover:text-indigo-700 flex items-center gap-1"
          >
            View all <ChevronRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <p>Loading featured events...</p>
          ) : (
            featuredEvents.map((event) => (
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
            ))
          )}
        </div>
      </div>

      {/* How It Works Section */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold font-heading text-gray-800 mb-8">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center p-6">
            <div className="rounded-full bg-primary bg-opacity-10 w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="text-primary text-xl" />
            </div>
            <h3 className="font-heading font-semibold mb-2">Register</h3>
            <p className="text-gray-600 text-sm">Sign up and join your school's creative community.</p>
          </div>
          <div className="text-center p-6">
            <div className="rounded-full bg-primary bg-opacity-10 w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Laptop className="text-primary text-xl" />
            </div>
            <h3 className="font-heading font-semibold mb-2">Create</h3>
            <p className="text-gray-600 text-sm">Use AI tools to create artwork or poetry.</p>
          </div>
          <div className="text-center p-6">
            <div className="rounded-full bg-primary bg-opacity-10 w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Upload className="text-primary text-xl" />
            </div>
            <h3 className="font-heading font-semibold mb-2">Submit</h3>
            <p className="text-gray-600 text-sm">Submit your creations to open challenges.</p>
          </div>
          <div className="text-center p-6">
            <div className="rounded-full bg-primary bg-opacity-10 w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Award className="text-primary text-xl" />
            </div>
            <h3 className="font-heading font-semibold mb-2">Win</h3>
            <p className="text-gray-600 text-sm">Receive votes and advance through competition stages.</p>
          </div>
        </div>
      </div>

      {/* Submission Modal */}
      <SubmissionModal
        eventId={submitEventId}
        isOpen={submitEventId !== null}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default Home;
