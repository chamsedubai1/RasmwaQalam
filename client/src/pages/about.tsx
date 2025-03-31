import React from "react";
import aboutStoryImage from "../assets/about-story_1743074317684.jpg";
import missionImage from "../assets/mission-image.svg";
import { useLanguage } from "@/hooks/use-language";
import { 
  Sparkles, 
  Users, 
  Rocket, 
  LucideHeart, 
  Trophy, 
  ArrowRight, 
  Zap, 
  Medal, 
  Star, 
  Palette,
  Lightbulb
} from "lucide-react";

const About: React.FC = () => {
  const { t } = useLanguage();
  
  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="relative rounded-xl overflow-hidden mb-12">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 opacity-90"></div>
        <div className="absolute inset-0 overflow-hidden opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJ3aGl0ZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMiIvPjwvZz48L3N2Zz4=')]"></div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 opacity-20">
          <Sparkles className="w-full h-full text-white" />
        </div>
        <div className="relative z-10 py-16 px-6 sm:px-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold font-heading text-white mb-4">
            {t("about.hero.title")} <span className="bg-gradient-to-r from-amber-200 to-yellow-400 bg-clip-text text-transparent">FAZAA</span> - Art
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            {t("about.hero.description")}
          </p>
        </div>
      </div>
      
      {/* Mission Statement Card */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-12 transform hover:scale-[1.01] transition-all">
        <div className="md:flex">
          <div className="md:shrink-0 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20"></div>
            <img className="h-60 w-full object-cover md:h-full md:w-80" 
                src={missionImage} 
                alt={t("about.mission.image_alt")} />
          </div>
          <div className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 flex items-center justify-center">
                <Lightbulb className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-heading font-semibold bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">{t("about.mission.title")}</h2>
            </div>
            <p className="text-gray-600 mb-4 leading-relaxed">{t("about.mission.paragraph1")}</p>
            <p className="text-gray-600 leading-relaxed">{t("about.mission.paragraph2")}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-center">
          <LucideHeart className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-2xl font-bold font-heading bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">{t("about.values.title")}</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-xl shadow-md border border-blue-50 hover:shadow-lg transition-all group">
          <div className="h-16 w-16 relative mx-auto mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full opacity-10 group-hover:opacity-20 transition-all"></div>
            <div className="absolute inset-0 bg-white rounded-full shadow-inner"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Palette className="text-amber-600 h-8 w-8 z-10 group-hover:scale-110 transition-all duration-300" />
            </div>
          </div>
          <h3 className="font-heading font-semibold text-center mb-2 text-gray-800">{t("about.values.creativity.title")}</h3>
          <p className="text-gray-600 text-center">{t("about.values.creativity.description")}</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-md border border-blue-50 hover:shadow-lg transition-all group">
          <div className="h-16 w-16 relative mx-auto mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full opacity-10 group-hover:opacity-20 transition-all"></div>
            <div className="absolute inset-0 bg-white rounded-full shadow-inner"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Users className="text-blue-600 h-8 w-8 z-10 group-hover:scale-110 transition-all duration-300" />
            </div>
          </div>
          <h3 className="font-heading font-semibold text-center mb-2 text-gray-800">{t("about.values.collaboration.title")}</h3>
          <p className="text-gray-600 text-center">{t("about.values.collaboration.description")}</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-md border border-blue-50 hover:shadow-lg transition-all group">
          <div className="h-16 w-16 relative mx-auto mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-full opacity-10 group-hover:opacity-20 transition-all"></div>
            <div className="absolute inset-0 bg-white rounded-full shadow-inner"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Rocket className="text-indigo-600 h-8 w-8 z-10 group-hover:scale-110 transition-all duration-300" />
            </div>
          </div>
          <h3 className="font-heading font-semibold text-center mb-2 text-gray-800">{t("about.values.innovation.title")}</h3>
          <p className="text-gray-600 text-center">{t("about.values.innovation.description")}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-center">
          <Star className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-2xl font-bold font-heading bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">{t("about.story.title")}</h2>
      </div>
      
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-12 transform hover:scale-[1.01] transition-all border border-blue-50">
        <div className="md:flex">
          <div className="md:shrink-0 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 mix-blend-overlay"></div>
            <img 
              className="h-full w-full object-cover md:w-64 lg:w-80" 
              src={aboutStoryImage} 
              alt={t("about.story.image_alt")} 
            />
            <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-blue-700/70 to-transparent md:hidden"></div>
          </div>
          <div className="p-8 relative">
            <div className="absolute -top-6 -right-6 w-32 h-32 opacity-5 md:opacity-10">
              <Sparkles className="w-full h-full text-indigo-600" />
            </div>
            <div className="relative">
              <div className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mb-4">
                {t("about.story.badge")}
              </div>
              <p className="text-gray-700 mb-4 leading-relaxed">{t("about.story.paragraph1")}</p>
              <p className="text-gray-700 mb-4 leading-relaxed">{t("about.story.paragraph2")}</p>
              <p className="text-gray-700 leading-relaxed">{t("about.story.paragraph3")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-center">
          <Trophy className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-2xl font-bold font-heading bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">{t("about.competition.title")}</h2>
      </div>
      
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-12 border border-blue-50">
        <div className="p-8 relative">
          <div className="absolute -bottom-10 -right-10 w-48 h-48 opacity-5">
            <Trophy className="w-full h-full text-blue-600" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
              <div className="relative p-6 flex items-start space-x-4 z-10">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-full w-12 h-12 flex items-center justify-center shrink-0 shadow-md">
                  <span className="font-bold text-white">1</span>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg mb-2 text-blue-800">{t("about.competition.stage1.title")}</h3>
                  <p className="text-gray-600">{t("about.competition.stage1.description")}</p>
                </div>
              </div>
            </div>
            
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
              <div className="relative p-6 flex items-start space-x-4 z-10">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full w-12 h-12 flex items-center justify-center shrink-0 shadow-md">
                  <span className="font-bold text-white">2</span>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg mb-2 text-indigo-800">{t("about.competition.stage2.title")}</h3>
                  <p className="text-gray-600">{t("about.competition.stage2.description")}</p>
                </div>
              </div>
            </div>
            
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
              <div className="relative p-6 flex items-start space-x-4 z-10">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-full w-12 h-12 flex items-center justify-center shrink-0 shadow-md">
                  <span className="font-bold text-white">3</span>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg mb-2 text-purple-800">{t("about.competition.stage3.title")}</h3>
                  <p className="text-gray-600">{t("about.competition.stage3.description")}</p>
                </div>
              </div>
            </div>
            
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
              <div className="relative p-6 flex items-start space-x-4 z-10">
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-full w-12 h-12 flex items-center justify-center shrink-0 shadow-md">
                  <span className="font-bold text-white">4</span>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg mb-2 text-amber-800">{t("about.competition.stage4.title")}</h3>
                  <p className="text-gray-600">{t("about.competition.stage4.description")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
