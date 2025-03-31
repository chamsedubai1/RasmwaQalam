import React from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { 
  Twitter, 
  Facebook, 
  Instagram, 
  Linkedin 
} from "lucide-react";

const Footer: React.FC = () => {
  const { t } = useLanguage();
  
  return (
    <footer className="bg-indigo-900 text-white py-8 shadow-lg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-4 font-heading text-blue-200">FAZAA</h3>
            <p className="text-blue-200 text-sm">
              {t("footer.description")}
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 font-heading">{t("footer.quickLinks")}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-blue-300 hover:text-white transition-colors">
                  {t("nav.home")}
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-blue-300 hover:text-white transition-colors">
                  {t("nav.about")}
                </Link>
              </li>
              <li>
                <Link href="/events" className="text-blue-300 hover:text-white transition-colors">
                  {t("nav.events")}
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="text-blue-300 hover:text-white transition-colors">
                  {t("nav.gallery")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 font-heading">{t("footer.resources")}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-blue-300 hover:text-white transition-colors">{t("footer.helpCenter")}</a>
              </li>
              <li>
                <a href="#" className="text-blue-300 hover:text-white transition-colors">{t("footer.aiToolsGuide")}</a>
              </li>
              <li>
                <a href="#" className="text-blue-300 hover:text-white transition-colors">{t("footer.privacyPolicy")}</a>
              </li>
              <li>
                <a href="#" className="text-blue-300 hover:text-white transition-colors">{t("footer.termsOfService")}</a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 font-heading">{t("footer.connectWithUs")}</h3>
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
            <p className="text-blue-200 text-sm">{t("footer.subscribeNewsletter")}</p>
            <div className="mt-2 flex">
              <Input 
                type="email" 
                placeholder={t("footer.yourEmail")}
                className="px-3 py-2 text-sm bg-gray-700 text-white rounded-r-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button 
                className="bg-primary hover:bg-indigo-700 text-white px-3 py-2 rounded-l-none text-sm"
              >
                {t("footer.subscribe")}
              </Button>
            </div>
          </div>
        </div>
        <div className="border-t border-blue-800 mt-8 pt-6 text-sm text-blue-200 text-center">
          &copy; {new Date().getFullYear()} FAZAA Art. {t("footer.allRightsReserved")}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
