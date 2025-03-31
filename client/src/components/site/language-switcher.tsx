import React from "react";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  className?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = "" }) => {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "ar" : "en");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`flex items-center gap-1.5 ${className}`}
      onClick={toggleLanguage}
      aria-label={t("language.switch")}
    >
      <Globe className="h-4 w-4" />
      <span className="font-medium">
        {language === "en" ? t("language.arabic") : t("language.english")}
      </span>
    </Button>
  );
};

export default LanguageSwitcher;