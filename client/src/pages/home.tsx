import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ChevronRight, 
  UserPlus, 
  Laptop, 
  Upload, 
  Award, 
  Sparkles, 
  PenTool, 
  Users, 
  School,
  Palette 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import EventCard from "@/components/site/event-card";
import { useUserRole } from "@/hooks/use-user-role";
import SubmissionModal from "@/components/site/submission-modal";
import type { Event } from "@shared/schema";

const Home: React.FC = () => {
  const { userRole } = useUserRole();
  const [submitEventId, setSubmitEventId] = React.useState<number | null>(null);

  // Fetch featured events
  const { data: events, isLoading } = useQuery<Event[]>({
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
      <div className="relative mb-16">
        <div className="bg-gradient-to-br from-primary via-blue-700 to-indigo-900 rounded-xl overflow-hidden shadow-2xl transform hover:scale-[1.01] transition-all duration-300">
          <div className="absolute inset-0 opacity-25 mix-blend-overlay">
            <img 
              src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&h=400&q=80" 
              alt="Art background" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/50 to-transparent"></div>
          <div className="relative px-8 py-20 sm:px-16 sm:py-24 text-white">
            <div className="animate-fadeIn">
              <h1 className="text-4xl sm:text-6xl font-bold font-heading mb-4 tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">FAZAA</span>
                <span> - Art</span>
              </h1>
              <h2 className="text-3xl sm:text-4xl font-bold font-heading mb-6 text-white/90">Unleash Your Creativity</h2>
              <p className="text-xl mb-8 max-w-2xl text-white/80 leading-relaxed">Create amazing AI-powered artwork, join exciting art challenges, and compete with students from schools around the world.</p>
              <div className="flex flex-wrap gap-4">
                <Link href="/events">
                  <Button size="lg" className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium rounded-full shadow-lg transition-all border-0 px-8 py-6 text-lg">
                    Explore Events
                  </Button>
                </Link>
                {userRole === "student" && (
                  <Link href="/creart">
                    <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border-white/30 font-medium rounded-full shadow-lg transition-all px-8 py-6 text-lg">
                      Start Creating
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Events Section */}
      <div className="mt-20 mb-16 py-12 px-4 sm:px-8 rounded-2xl bg-gradient-to-b from-blue-50 to-white">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold font-heading text-gray-800">Featured Events</h2>
            <p className="text-gray-600 mt-2">Join these exciting challenges and showcase your creativity</p>
          </div>
          <Link 
            href="/events" 
            className="text-primary hover:text-indigo-700 flex items-center gap-1 bg-white px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all font-medium"
          >
            View all <ChevronRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {isLoading ? (
            <div className="col-span-3 py-20 flex justify-center">
              <div className="animate-pulse flex space-x-4">
                <div className="flex-1 space-y-6 py-1">
                  <div className="h-8 bg-blue-200 rounded w-3/4"></div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="h-32 bg-blue-200 rounded col-span-1"></div>
                      <div className="h-32 bg-blue-200 rounded col-span-1"></div>
                      <div className="h-32 bg-blue-200 rounded col-span-1"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            featuredEvents.map((event: Event) => (
              <EventCard
                key={event.id}
                id={event.id}
                name={event.name}
                description={event.description}
                imageUrl={event.imageUrl || ''}
                type={event.type}
                status={event.status}
                stage={event.stage}
                endDate={event.endDate ? event.endDate.toString() : ''}
                onSubmit={handleSubmit}
              />
            ))
          )}
        </div>
        
        {!isLoading && featuredEvents.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500">No events available at the moment. Check back soon!</p>
          </div>
        )}
      </div>
      
      {/* Testimonials Section */}
      <div className="mt-20 mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold font-heading text-gray-800 mb-3">What Students Say</h2>
          <div className="w-24 h-1.5 bg-gradient-to-r from-primary to-blue-400 rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto">Hear from students who have participated in our art challenges</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all">
            <div className="flex items-center mb-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                SA
              </div>
              <div className="ml-4">
                <h4 className="font-semibold">Sara Ahmed</h4>
                <p className="text-sm text-gray-500">Grade 10 Student</p>
              </div>
            </div>
            <p className="text-gray-600">"FAZAA-Art opened up a new world of creativity for me. I never thought I could create such amazing artwork with AI!"</p>
            <div className="mt-4 flex">
              <span className="text-amber-400">★★★★★</span>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all">
            <div className="flex items-center mb-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                MK
              </div>
              <div className="ml-4">
                <h4 className="font-semibold">Mohammed Khalid</h4>
                <p className="text-sm text-gray-500">Grade 9 Student</p>
              </div>
            </div>
            <p className="text-gray-600">"I love how easy it is to create poetry with the AI tools. I've won two school competitions already!"</p>
            <div className="mt-4 flex">
              <span className="text-amber-400">★★★★★</span>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all">
            <div className="flex items-center mb-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                LN
              </div>
              <div className="ml-4">
                <h4 className="font-semibold">Layla Nasser</h4>
                <p className="text-sm text-gray-500">Grade 11 Student</p>
              </div>
            </div>
            <p className="text-gray-600">"The competitions are so much fun! I enjoy seeing what other students create and getting inspired by their work."</p>
            <div className="mt-4 flex">
              <span className="text-amber-400">★★★★★</span>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="mt-20 mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold font-heading text-gray-800 mb-3">How It Works</h2>
          <div className="w-24 h-1.5 bg-gradient-to-r from-primary to-blue-400 rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto">Our platform makes it easy for students to unleash their creativity and compete in exciting challenges</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="rounded-xl bg-gradient-to-b from-white to-blue-50 shadow-md hover:shadow-xl transition-all p-6 group hover:-translate-y-1 border border-blue-100">
            <div className="rounded-full bg-primary bg-opacity-10 w-20 h-20 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary group-hover:bg-opacity-20 transition-all">
              <UserPlus className="text-primary text-2xl" />
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3">1. Register</h3>
            <p className="text-gray-600">Join your school's creative community and get ready to showcase your talent.</p>
          </div>
          
          <div className="rounded-xl bg-gradient-to-b from-white to-blue-50 shadow-md hover:shadow-xl transition-all p-6 group hover:-translate-y-1 border border-blue-100">
            <div className="rounded-full bg-primary bg-opacity-10 w-20 h-20 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary group-hover:bg-opacity-20 transition-all">
              <Laptop className="text-primary text-2xl" />
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3">2. Create</h3>
            <p className="text-gray-600">Use our powerful AI tools to create stunning artwork or inspiring poetry.</p>
          </div>
          
          <div className="rounded-xl bg-gradient-to-b from-white to-blue-50 shadow-md hover:shadow-xl transition-all p-6 group hover:-translate-y-1 border border-blue-100">
            <div className="rounded-full bg-primary bg-opacity-10 w-20 h-20 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary group-hover:bg-opacity-20 transition-all">
              <Upload className="text-primary text-2xl" />
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3">3. Submit</h3>
            <p className="text-gray-600">Submit your best creations to open challenges and share with your peers.</p>
          </div>
          
          <div className="rounded-xl bg-gradient-to-b from-white to-blue-50 shadow-md hover:shadow-xl transition-all p-6 group hover:-translate-y-1 border border-blue-100">
            <div className="rounded-full bg-primary bg-opacity-10 w-20 h-20 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary group-hover:bg-opacity-20 transition-all">
              <Award className="text-primary text-2xl" />
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3">4. Win</h3>
            <p className="text-gray-600">Receive votes from your peers and advance through competition stages to win recognition.</p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="mt-20 mb-16 py-12 px-4 sm:px-8 rounded-2xl bg-gradient-to-r from-blue-50 via-white to-blue-50">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold font-heading text-gray-800 mb-3">Platform Features</h2>
          <div className="w-24 h-1.5 bg-gradient-to-r from-primary to-blue-400 rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto">Discover the amazing tools and features available for students</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
          <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all border border-blue-100 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <Palette className="text-amber-600 h-8 w-8" />
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3">AI Art Generation</h3>
            <p className="text-gray-600">Create beautiful artwork using cutting-edge AI models with just a simple text prompt.</p>
          </div>
          
          <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all border border-blue-100 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mb-4">
              <PenTool className="text-primary h-8 w-8" />
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3">Poetry Generation</h3>
            <p className="text-gray-600">Express yourself through AI-assisted poetry creation in various styles and formats.</p>
          </div>
          
          <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all border border-blue-100 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
              <Users className="text-indigo-600 h-8 w-8" />
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3">Peer Voting</h3>
            <p className="text-gray-600">Vote for your favorite submissions and receive feedback from your classmates.</p>
          </div>
        </div>
      </div>

      {/* Call to Action Section */}
      <div className="mt-20 mb-16">
        <div className="rounded-xl overflow-hidden bg-gradient-to-r from-primary to-indigo-700 relative">
          <div className="absolute inset-0 bg-blue-900/20 mix-blend-multiply"></div>
          <div className="absolute right-0 bottom-0 opacity-20">
            <Sparkles className="h-64 w-64 text-white" />
          </div>
          <div className="relative z-10 px-8 py-16 md:p-16 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to showcase your creativity?</h2>
              <p className="text-white/80 text-lg mb-0 md:pr-8">Join FAZAA-Art today and start your journey through AI-powered art and poetry challenges!</p>
            </div>
            <div className="shrink-0">
              <Link href={userRole ? "/events" : "/login"}>
                <Button size="lg" className="bg-white hover:bg-gray-100 text-primary font-semibold rounded-full shadow-lg transition-all px-8 py-6 text-lg">
                  {userRole ? "Browse Events" : "Get Started"}
                </Button>
              </Link>
            </div>
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
