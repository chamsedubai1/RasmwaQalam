import React from "react";
import aboutStoryImage from "../assets/about-story_1743074317684.jpg";

const About: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold font-heading text-gray-800 mb-6">About FAZAA - Art</h1>
      
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-10">
        <div className="md:flex">
          <div className="md:shrink-0">
            <img className="h-48 w-full object-cover md:h-full md:w-48" src="https://images.unsplash.com/photo-1522661067900-ab829854a57f?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&h=400&q=80" alt="Students creating art" />
          </div>
          <div className="p-8">
            <h2 className="text-2xl font-heading font-semibold mb-4">Our Mission</h2>
            <p className="text-gray-600 mb-4">FAZAA - Art was created to empower students to explore their creativity using cutting-edge AI tools while building a competitive and collaborative environment for artistic expression.</p>
            <p className="text-gray-600">We believe that by combining technology with artistic expression, we can help students develop both their creative and technical skills for the future.</p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold font-heading text-gray-800 mb-6">Our Values</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="rounded-full bg-primary bg-opacity-10 w-12 h-12 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
              <line x1="9" y1="9" x2="9.01" y2="9"></line>
              <line x1="15" y1="9" x2="15.01" y2="9"></line>
            </svg>
          </div>
          <h3 className="font-heading font-semibold mb-2">Creativity</h3>
          <p className="text-gray-600 text-sm">We foster an environment where creative thinking is celebrated and encouraged.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="rounded-full bg-secondary bg-opacity-10 w-12 h-12 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <h3 className="font-heading font-semibold mb-2">Collaboration</h3>
          <p className="text-gray-600 text-sm">We believe in the power of shared experiences and learning from each other.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="rounded-full bg-accent bg-opacity-10 w-12 h-12 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h3 className="font-heading font-semibold mb-2">Innovation</h3>
          <p className="text-gray-600 text-sm">We embrace new technologies as tools for expanding artistic possibilities.</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold font-heading text-gray-800 mb-6">Our Story</h2>
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-10">
        <div className="md:flex">
          <div className="md:shrink-0">
            <img 
              className="h-full w-full object-cover md:w-64 lg:w-80" 
              src={aboutStoryImage} 
              alt="Artistic inspiration with neural network connections" 
            />
          </div>
          <div className="p-8">
            <p className="text-gray-600 mb-4">Fazaa-Art is an innovative initiative that originated as an International Baccalaureate CAS (Creativity, Activity, Service) project with the goal of creating a vibrant art community.</p>
            <p className="text-gray-600 mb-4">Fazaa-Art's unique platform leverages the power of artificial intelligence to foster creative competition among its members. By using AI-generated prompts, Fazaa-AI challenges participants to craft poems and create art pieces based on carefully selected themes.</p>
            <p className="text-gray-600">Fazaa-Art competitions are designed to encourage our community to delve deeper into their creativity, pushing the boundaries of conventional thinking and inspiring participants to think outside the box. Through this process, Fazaa-AI not only nurtures artistic expression but also promotes the development of thought-provoking, imaginative content.</p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold font-heading text-gray-800 mb-6">Competition Structure</h2>
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-10">
        <div className="p-6">
          <div className="flex flex-col space-y-4">
            <div className="flex items-start">
              <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center mr-4 mt-1">
                <span className="font-medium">1</span>
              </div>
              <div>
                <h3 className="font-heading font-semibold mb-1">Class Stage</h3>
                <p className="text-gray-600 text-sm">Students compete against classmates, with the top 3 advancing to the next stage.</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center mr-4 mt-1">
                <span className="font-medium">2</span>
              </div>
              <div>
                <h3 className="font-heading font-semibold mb-1">School Stage</h3>
                <p className="text-gray-600 text-sm">Class winners compete against other classes in their grade, with the top 3 advancing.</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center mr-4 mt-1">
                <span className="font-medium">3</span>
              </div>
              <div>
                <h3 className="font-heading font-semibold mb-1">Country Stage</h3>
                <p className="text-gray-600 text-sm">School winners compete nationally, with the top submissions advancing to the global stage.</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center mr-4 mt-1">
                <span className="font-medium">4</span>
              </div>
              <div>
                <h3 className="font-heading font-semibold mb-1">Global Stage</h3>
                <p className="text-gray-600 text-sm">The best submissions from around the world compete for international recognition.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
