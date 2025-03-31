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
import { useLanguage } from "@/hooks/use-language";
import SubmissionModal from "@/components/site/submission-modal";
import type { Event } from "@shared/schema";
import aiRobotImage from "../assets/ai-robot-art.png";

const Home: React.FC = () => {
  const { userRole } = useUserRole();
  const { t } = useLanguage();
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
      {/* AI Robot Art Section */}
      <div className="w-full mt-10 mb-20 px-4 md:px-8">
        <div className="bg-gradient-to-br from-blue-600 via-indigo-500 to-blue-700 rounded-2xl overflow-hidden shadow-2xl">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-2/3 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/30 to-transparent z-10"></div>
                <img 
                  src={aiRobotImage} 
                  alt={t("home.airobot.alt")} 
                  className="w-full h-full object-cover transform hover:scale-[1.03] transition-transform duration-700" 
                />
              </div>
              <div className="w-full md:w-1/3 p-8 md:p-12 flex flex-col justify-center backdrop-blur-sm bg-white/[0.03]">
                <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6 text-white">
                  {t("home.airobot.title")}
                </h1>
                <p className="text-white/90 mb-8 leading-relaxed text-lg">
                  {t("home.airobot.description")}
                </p>
                <Link href="/creart">
                  <Button size="lg" className="w-full md:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium rounded-full shadow-lg transition-all border-0 px-8 py-6 text-lg">
                    {t("home.airobot.button")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Events Section */}
      <div className="mt-20 mb-16 py-12 px-4 sm:px-8 rounded-2xl bg-gradient-to-b from-blue-50 to-white">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold font-heading text-gray-800">{t("home.featured.title")}</h2>
            <p className="text-gray-600 mt-2">{t("home.featured.subtitle")}</p>
          </div>
          <Link 
            href="/events" 
            className="text-primary hover:text-indigo-700 flex items-center gap-1 bg-white px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all font-medium"
          >
            {t("home.featured.viewall")} <ChevronRight size={16} />
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
            <p className="text-gray-500">{t("home.featured.empty")}</p>
          </div>
        )}
      </div>
      
      {/* Testimonials Section */}
      <div className="mt-20 mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold font-heading text-gray-800 mb-3">{t("home.testimonials.title")}</h2>
          <div className="w-24 h-1.5 bg-gradient-to-r from-primary to-blue-400 rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto">{t("home.testimonials.subtitle")}</p>
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
          <h2 className="text-3xl font-bold font-heading text-gray-800 mb-3">{t("home.how.title")}</h2>
          <div className="w-24 h-1.5 bg-gradient-to-r from-primary to-blue-400 rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto">{t("home.how.subtitle")}</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="rounded-xl bg-gradient-to-b from-white to-blue-50 shadow-md hover:shadow-xl transition-all p-6 group hover:-translate-y-1 border border-blue-100">
            <div className="w-24 h-24 mx-auto mb-5 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full opacity-20 group-hover:opacity-30 transition-all"></div>
              <div className="absolute inset-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center group-hover:scale-110 transition-all shadow-inner">
                  <UserPlus className="text-indigo-600 h-8 w-8" />
                </div>
              </div>
              <div className="absolute -top-2 -right-2 bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg">
                1
              </div>
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3 text-center">{t("home.how.step1.title")}</h3>
            <p className="text-gray-600 text-center">{t("home.how.step1.description")}</p>
          </div>
          
          <div className="rounded-xl bg-gradient-to-b from-white to-blue-50 shadow-md hover:shadow-xl transition-all p-6 group hover:-translate-y-1 border border-blue-100">
            <div className="w-24 h-24 mx-auto mb-5 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full opacity-20 group-hover:opacity-30 transition-all"></div>
              <div className="absolute inset-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center group-hover:scale-110 transition-all shadow-inner">
                  <Sparkles className="text-blue-600 h-8 w-8" />
                </div>
              </div>
              <div className="absolute -top-2 -right-2 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg">
                2
              </div>
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3 text-center">{t("home.how.step2.title")}</h3>
            <p className="text-gray-600 text-center">{t("home.how.step2.description")}</p>
          </div>
          
          <div className="rounded-xl bg-gradient-to-b from-white to-blue-50 shadow-md hover:shadow-xl transition-all p-6 group hover:-translate-y-1 border border-blue-100">
            <div className="w-24 h-24 mx-auto mb-5 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full opacity-20 group-hover:opacity-30 transition-all"></div>
              <div className="absolute inset-2 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center group-hover:scale-110 transition-all shadow-inner">
                  <Palette className="text-purple-600 h-8 w-8" />
                </div>
              </div>
              <div className="absolute -top-2 -right-2 bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg">
                3
              </div>
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3 text-center">{t("home.how.step3.title")}</h3>
            <p className="text-gray-600 text-center">{t("home.how.step3.description")}</p>
          </div>
          
          <div className="rounded-xl bg-gradient-to-b from-white to-blue-50 shadow-md hover:shadow-xl transition-all p-6 group hover:-translate-y-1 border border-blue-100">
            <div className="w-24 h-24 mx-auto mb-5 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full opacity-20 group-hover:opacity-30 transition-all"></div>
              <div className="absolute inset-2 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-full"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center group-hover:scale-110 transition-all shadow-inner">
                  <Award className="text-amber-600 h-8 w-8" />
                </div>
              </div>
              <div className="absolute -top-2 -right-2 bg-amber-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg">
                4
              </div>
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3 text-center">{t("home.how.step4.title")}</h3>
            <p className="text-gray-600 text-center">{t("home.how.step4.description")}</p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="mt-20 mb-16 py-12 px-4 sm:px-8 rounded-2xl bg-gradient-to-r from-blue-50 via-white to-blue-50">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold font-heading text-gray-800 mb-3">{t("home.features.title")}</h2>
          <div className="w-24 h-1.5 bg-gradient-to-r from-primary to-blue-400 rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto">{t("home.features.subtitle")}</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
          <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all border border-blue-100 flex flex-col items-center text-center group">
            <div className="h-20 w-20 relative mb-4">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full opacity-10 group-hover:opacity-20 transition-all"></div>
              <div className="absolute inset-0 bg-white rounded-full shadow-inner"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Palette className="text-amber-600 h-8 w-8 z-10 group-hover:scale-110 transition-all duration-300" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-40">
                <svg className="w-16 h-16 text-amber-200" viewBox="0 0 40 40" fill="currentColor">
                  <path d="M35,10 C33,6 30,4 26.5,4 C23,4 20,6 18,9 C16,6 13,4 9.5,4 C6,4 3,6 1,10 C-1,14 1,19 4,22 C7,25 18,34 18,34 C18,34 29,25 32,22 C35,19 37,14 35,10 Z" />
                </svg>
              </div>
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3">{t("home.features.card1.title")}</h3>
            <p className="text-gray-600">{t("home.features.card1.description")}</p>
          </div>
          
          <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all border border-blue-100 flex flex-col items-center text-center group">
            <div className="h-20 w-20 relative mb-4">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-full opacity-10 group-hover:opacity-20 transition-all"></div>
              <div className="absolute inset-0 bg-white rounded-full shadow-inner"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <PenTool className="text-indigo-600 h-8 w-8 z-10 group-hover:scale-110 transition-all duration-300" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-40">
                <svg className="w-16 h-16 text-indigo-200" viewBox="0 0 40 40" fill="currentColor">
                  <path d="M10,10 L30,10 L30,12 L10,12 Z M10,16 L25,16 L25,18 L10,18 Z M10,22 L30,22 L30,24 L10,24 Z M10,28 L20,28 L20,30 L10,30 Z" />
                </svg>
              </div>
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3">{t("home.features.card2.title")}</h3>
            <p className="text-gray-600">{t("home.features.card2.description")}</p>
          </div>
          
          <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all border border-blue-100 flex flex-col items-center text-center group">
            <div className="h-20 w-20 relative mb-4">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full opacity-10 group-hover:opacity-20 transition-all"></div>
              <div className="absolute inset-0 bg-white rounded-full shadow-inner"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Users className="text-blue-600 h-8 w-8 z-10 group-hover:scale-110 transition-all duration-300" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-40">
                <svg className="w-16 h-16 text-blue-200" viewBox="0 0 40 40" fill="currentColor">
                  <path d="M20,4 L24,12 L33,13 L26.5,19 L28,28 L20,24 L12,28 L13.5,19 L7,13 L16,12 Z" />
                </svg>
              </div>
            </div>
            <h3 className="font-heading font-semibold text-lg mb-3">{t("home.features.card3.title")}</h3>
            <p className="text-gray-600">{t("home.features.card3.description")}</p>
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
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t("home.cta.title")}</h2>
              <p className="text-white/80 text-lg mb-0 md:pr-8">{t("home.cta.description")}</p>
            </div>
            <div className="shrink-0">
              <Link href={userRole ? "/events" : "/login"}>
                <Button size="lg" className="bg-white hover:bg-gray-100 text-primary font-semibold rounded-full shadow-lg transition-all px-8 py-6 text-lg">
                  {userRole ? t("home.cta.button.loggedIn") : t("home.cta.button.default")}
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
