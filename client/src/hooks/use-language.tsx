import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Define available languages
export type Language = "en" | "ar";

// Define the type for our language context
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

// Create the context with default values
const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key: string) => key,
});

// Translation data
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.about": "About Us",
    "nav.events": "Events",
    "nav.gallery": "Gallery",
    "nav.schools": "Schools",
    "nav.partners": "Partners",
    "nav.creart": "CreArt",
    "nav.teacher_dashboard": "Teacher Dashboard",
    "nav.admin_dashboard": "Admin Dashboard",
    "nav.login_register": "Login / Register",
    "nav.logout": "Logout",
    
    // Home Page
    "home.hero.title": "Unleash Your Creativity",
    "home.hero.description": "Create amazing AI-powered artwork, join exciting art challenges, and compete with students from schools around the world.",
    "home.hero.cta.explore": "Explore Events",
    "home.hero.cta.create": "Start Creating",
    "home.featured.title": "Featured Events",
    "home.featured.subtitle": "Join these exciting challenges and showcase your creativity",
    "home.featured.viewall": "View all",
    "home.featured.empty": "No events available at the moment. Check back soon!",
    "home.testimonials.title": "What Students Say",
    "home.testimonials.subtitle": "Hear from students who have participated in our art challenges",
    "home.how.title": "How It Works",
    "home.how.subtitle": "Our platform makes it easy for students to unleash their creativity and compete in exciting challenges",
    "home.how.step1.title": "Register",
    "home.how.step1.description": "Join your school's creative community and get ready to showcase your talent.",
    "home.how.step2.title": "Create",
    "home.how.step2.description": "Use our powerful AI tools to create stunning artwork or inspiring poetry.",
    "home.how.step3.title": "Submit",
    "home.how.step3.description": "Submit your best creations to open challenges and share with your peers.",
    "home.how.step4.title": "Win",
    "home.how.step4.description": "Receive votes from your peers and advance through competition stages to win recognition.",
    "home.features.title": "Platform Features",
    "home.features.subtitle": "Discover the amazing tools and features available for students",
    "home.features.card1.title": "AI Art Generation",
    "home.features.card1.description": "Create beautiful artwork using cutting-edge AI models with just a simple text prompt.",
    "home.features.card2.title": "Poetry Generation",
    "home.features.card2.description": "Express yourself through AI-assisted poetry creation in various styles and formats.",
    "home.features.card3.title": "Peer Voting",
    "home.features.card3.description": "Vote for your favorite submissions and receive feedback from your classmates.",
    "home.cta.title": "Ready to showcase your creativity?",
    "home.cta.description": "Join FAZAA-Art today and start your journey through AI-powered art and poetry challenges!",
    "home.cta.button.default": "Get Started",
    "home.cta.button.loggedIn": "Browse Events",
    
    // Common buttons and labels
    "button.submit": "Submit",
    "button.cancel": "Cancel",
    "button.save": "Save",
    "button.edit": "Edit",
    "button.delete": "Delete",
    "button.create": "Create",
    "button.view": "View",
    "button.vote": "Vote",
    
    // Auth related
    "auth.login": "Login",
    "auth.register": "Register",
    "auth.username": "Username",
    "auth.password": "Password",
    "auth.email": "Email",
    "auth.fullName": "Full Name",
    "auth.school": "School",
    "auth.class": "Class",
    "auth.role": "Role",
    
    // Events
    "events.title": "Art Events",
    "events.upcoming": "Upcoming Events",
    "events.ongoing": "Ongoing Events",
    "events.past": "Past Events",
    "events.register": "Register",
    "events.details": "Event Details",
    "events.create": "Create Event",
    
    // Submissions
    "submissions.title": "Submissions",
    "submissions.create": "Create Submission",
    "submissions.view": "View Submission",
    "submissions.no_submissions": "No submissions found",
    
    // CreArt
    "creart.title": "Create AI Art",
    "creart.prompt": "Your Inspiration",
    "creart.generate": "Generate",
    "creart.poetry": "Poetry",
    "creart.painting": "Painting",
    
    // Dashboard
    "dashboard.users": "Users",
    "dashboard.schools": "Schools",
    "dashboard.classes": "Classes",
    "dashboard.events": "Events",
    "dashboard.reports": "Reports",
    "dashboard.participants": "Participants",
    "dashboard.partners": "Partners",
    
    // Form labels
    "form.name": "Name",
    "form.description": "Description",
    "form.date": "Date",
    "form.type": "Type",
    "form.status": "Status",
    "form.image": "Image",
    "form.logo": "Logo",
    "form.active": "Active",
    "form.grade": "Grade",
    "form.teacher": "Teacher",
    
    // Messages
    "message.success": "Success!",
    "message.error": "Error!",
    "message.welcome": "Welcome to FAZAA - Art",
    "message.loading": "Loading...",
    
    // Language
    "language.english": "English",
    "language.arabic": "العربية",
    "language.switch": "Switch Language",
    
    // Footer
    "footer.description": "Empowering students to explore creativity through AI-assisted art and poetry competitions.",
    "footer.quickLinks": "Quick Links",
    "footer.resources": "Resources",
    "footer.helpCenter": "Help Center",
    "footer.aiToolsGuide": "AI Tools Guide",
    "footer.privacyPolicy": "Privacy Policy",
    "footer.termsOfService": "Terms of Service",
    "footer.connectWithUs": "Connect With Us",
    "footer.subscribeNewsletter": "Subscribe to our newsletter",
    "footer.yourEmail": "Your email",
    "footer.subscribe": "Subscribe",
    "footer.allRightsReserved": "All rights reserved.",
  },
  ar: {
    // Navigation
    "nav.home": "الرئيسية",
    "nav.about": "نبذة عنا",
    "nav.events": "الفعاليات",
    "nav.gallery": "المعرض",
    "nav.schools": "المدارس",
    "nav.partners": "الشركاء",
    "nav.creart": "إبداع الفن",
    "nav.teacher_dashboard": "لوحة تحكم المعلم",
    "nav.admin_dashboard": "لوحة تحكم المدير",
    "nav.login_register": "تسجيل الدخول / التسجيل",
    "nav.logout": "تسجيل الخروج",
    
    // Home Page
    "home.hero.title": "أطلق العنان لإبداعك",
    "home.hero.description": "قم بإنشاء أعمال فنية رائعة بمساعدة الذكاء الاصطناعي، وشارك في تحديات فنية مثيرة، وتنافس مع طلاب من مدارس حول العالم.",
    "home.hero.cta.explore": "استكشاف الفعاليات",
    "home.hero.cta.create": "ابدأ الإبداع",
    "home.featured.title": "الفعاليات المميزة",
    "home.featured.subtitle": "انضم إلى هذه التحديات المثيرة وأظهر إبداعك",
    "home.featured.viewall": "عرض الكل",
    "home.featured.empty": "لا توجد فعاليات متاحة حاليًا. تحقق مرة أخرى قريبًا!",
    "home.testimonials.title": "ماذا يقول الطلاب",
    "home.testimonials.subtitle": "استمع إلى الطلاب الذين شاركوا في تحديات الفن لدينا",
    "home.how.title": "كيف تعمل المنصة",
    "home.how.subtitle": "منصتنا تجعل من السهل على الطلاب إطلاق إبداعهم والمنافسة في تحديات مثيرة",
    "home.how.step1.title": "التسجيل",
    "home.how.step1.description": "انضم إلى مجتمع الإبداع في مدرستك واستعد لإظهار موهبتك.",
    "home.how.step2.title": "الإبداع",
    "home.how.step2.description": "استخدم أدوات الذكاء الاصطناعي القوية لإنشاء أعمال فنية مذهلة أو شعر ملهم.",
    "home.how.step3.title": "المشاركة",
    "home.how.step3.description": "قدم أفضل إبداعاتك للتحديات المفتوحة وشاركها مع زملائك.",
    "home.how.step4.title": "الفوز",
    "home.how.step4.description": "احصل على أصوات من زملائك وتقدم عبر مراحل المسابقة للحصول على التقدير.",
    "home.features.title": "ميزات المنصة",
    "home.features.subtitle": "اكتشف الأدوات والميزات المذهلة المتاحة للطلاب",
    "home.features.card1.title": "إنشاء الفن بالذكاء الاصطناعي",
    "home.features.card1.description": "قم بإنشاء أعمال فنية جميلة باستخدام نماذج الذكاء الاصطناعي المتطورة بمجرد كتابة وصف بسيط.",
    "home.features.card2.title": "إنشاء الشعر",
    "home.features.card2.description": "عبر عن نفسك من خلال إنشاء الشعر بمساعدة الذكاء الاصطناعي بأنماط وأشكال متنوعة.",
    "home.features.card3.title": "تصويت الأقران",
    "home.features.card3.description": "صوت لمشاركاتك المفضلة واحصل على تعليقات من زملائك في الصف.",
    "home.cta.title": "هل أنت مستعد لإظهار إبداعك؟",
    "home.cta.description": "انضم إلى فزاع-للفنون اليوم وابدأ رحلتك في تحديات الفن والشعر المدعومة بالذكاء الاصطناعي!",
    "home.cta.button.default": "ابدأ الآن",
    "home.cta.button.loggedIn": "استعرض الفعاليات",
    
    // Common buttons and labels
    "button.submit": "إرسال",
    "button.cancel": "إلغاء",
    "button.save": "حفظ",
    "button.edit": "تعديل",
    "button.delete": "حذف",
    "button.create": "إنشاء",
    "button.view": "عرض",
    "button.vote": "تصويت",
    
    // Auth related
    "auth.login": "تسجيل الدخول",
    "auth.register": "تسجيل",
    "auth.username": "اسم المستخدم",
    "auth.password": "كلمة المرور",
    "auth.email": "البريد الإلكتروني",
    "auth.fullName": "الاسم الكامل",
    "auth.school": "المدرسة",
    "auth.class": "الصف",
    "auth.role": "الدور",
    
    // Events
    "events.title": "فعاليات الفن",
    "events.upcoming": "الفعاليات القادمة",
    "events.ongoing": "الفعاليات الجارية",
    "events.past": "الفعاليات السابقة",
    "events.register": "تسجيل",
    "events.details": "تفاصيل الفعالية",
    "events.create": "إنشاء فعالية",
    
    // Submissions
    "submissions.title": "المشاركات",
    "submissions.create": "إنشاء مشاركة",
    "submissions.view": "عرض المشاركة",
    "submissions.no_submissions": "لا توجد مشاركات",
    
    // CreArt
    "creart.title": "إنشاء فن بالذكاء الاصطناعي",
    "creart.prompt": "إلهامك",
    "creart.generate": "إنشاء",
    "creart.poetry": "شعر",
    "creart.painting": "رسم",
    
    // Dashboard
    "dashboard.users": "المستخدمون",
    "dashboard.schools": "المدارس",
    "dashboard.classes": "الصفوف",
    "dashboard.events": "الفعاليات",
    "dashboard.reports": "التقارير",
    "dashboard.participants": "المشاركون",
    "dashboard.partners": "الشركاء",
    
    // Form labels
    "form.name": "الاسم",
    "form.description": "الوصف",
    "form.date": "التاريخ",
    "form.type": "النوع",
    "form.status": "الحالة",
    "form.image": "الصورة",
    "form.logo": "الشعار",
    "form.active": "نشط",
    "form.grade": "الصف",
    "form.teacher": "المعلم",
    
    // Messages
    "message.success": "تم بنجاح!",
    "message.error": "خطأ!",
    "message.welcome": "مرحبًا بك في فزاع - للفنون",
    "message.loading": "جاري التحميل...",
    
    // Language
    "language.english": "English",
    "language.arabic": "العربية",
    "language.switch": "تغيير اللغة",
    
    // Footer
    "footer.description": "تمكين الطلاب من استكشاف الإبداع من خلال مسابقات الفن والشعر بمساعدة الذكاء الاصطناعي.",
    "footer.quickLinks": "روابط سريعة",
    "footer.resources": "الموارد",
    "footer.helpCenter": "مركز المساعدة",
    "footer.aiToolsGuide": "دليل أدوات الذكاء الاصطناعي",
    "footer.privacyPolicy": "سياسة الخصوصية",
    "footer.termsOfService": "شروط الخدمة",
    "footer.connectWithUs": "تواصل معنا",
    "footer.subscribeNewsletter": "اشترك في نشرتنا الإخبارية",
    "footer.yourEmail": "بريدك الإلكتروني",
    "footer.subscribe": "اشترك",
    "footer.allRightsReserved": "جميع الحقوق محفوظة.",
  }
};

export const LanguageProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  // Get saved language from localStorage or default to English
  const getSavedLanguage = (): Language => {
    const savedLang = localStorage.getItem("fazaa-language");
    return (savedLang === "ar" ? "ar" : "en");
  };

  const [language, setLanguageState] = useState<Language>(getSavedLanguage());

  // Translate function
  const translate = (key: string): string => {
    return translations[language][key] || key;
  };

  // Set language and save to localStorage
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("fazaa-language", lang);
    
    // Set the dir attribute on the html element for RTL support
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    
    // Add language class to body for additional CSS targeting
    document.body.classList.remove("lang-en", "lang-ar");
    document.body.classList.add(`lang-${lang}`);
  };

  // Set up document direction on initial load
  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.body.classList.add(`lang-${language}`);
    
    return () => {
      document.body.classList.remove(`lang-${language}`);
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translate }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

export default useLanguage;