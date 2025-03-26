import React from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Twitter, 
  Facebook, 
  Instagram, 
  Linkedin 
} from "lucide-react";

const Footer: React.FC = () => {
  return (
    <footer className="bg-indigo-900 text-white py-8 shadow-lg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-4 font-heading text-blue-200">ArtChallenge</h3>
            <p className="text-blue-200 text-sm">
              Empowering students to explore creativity through AI-assisted art and poetry competitions.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 font-heading">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-blue-300 hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-blue-300 hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/events" className="text-blue-300 hover:text-white transition-colors">
                  Events
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="text-blue-300 hover:text-white transition-colors">
                  Gallery
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 font-heading">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-blue-300 hover:text-white transition-colors">Help Center</a>
              </li>
              <li>
                <a href="#" className="text-blue-300 hover:text-white transition-colors">AI Tools Guide</a>
              </li>
              <li>
                <a href="#" className="text-blue-300 hover:text-white transition-colors">Privacy Policy</a>
              </li>
              <li>
                <a href="#" className="text-blue-300 hover:text-white transition-colors">Terms of Service</a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 font-heading">Connect With Us</h3>
            <div className="flex space-x-4 mb-4">
              <a href="#" className="text-blue-300 hover:text-white transition-colors">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-blue-300 hover:text-white transition-colors">
                <Facebook size={20} />
              </a>
              <a href="#" className="text-blue-300 hover:text-white transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#" className="text-blue-300 hover:text-white transition-colors">
                <Linkedin size={20} />
              </a>
            </div>
            <p className="text-blue-200 text-sm">Subscribe to our newsletter</p>
            <div className="mt-2 flex">
              <Input 
                type="email" 
                placeholder="Your email" 
                className="px-3 py-2 text-sm bg-gray-700 text-white rounded-r-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button 
                className="bg-primary hover:bg-indigo-700 text-white px-3 py-2 rounded-l-none text-sm"
              >
                Subscribe
              </Button>
            </div>
          </div>
        </div>
        <div className="border-t border-blue-800 mt-8 pt-6 text-sm text-blue-200 text-center">
          &copy; 2023 ArtChallenge Platform. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
