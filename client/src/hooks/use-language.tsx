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
    "home.airobot.title": "AI-Powered Creativity",
    "home.airobot.description": "Experience the fusion of artificial intelligence and human creativity. Create amazing AI-powered artwork, join exciting art challenges, and compete with students from schools around the world.",
    "home.airobot.button": "Start Creating",
    "home.airobot.alt": "AI Robot creating colorful artwork",
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
    "home.cta.description": "Join RASM wa QALAM today and start your journey through AI-powered art and poetry challenges!",
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
    "auth.username_placeholder": "Enter your username",
    "auth.password": "Password",
    "auth.password_placeholder": "Enter your password",
    "auth.forgot_password": "Forgot password?",
    "auth.email": "Email",
    "auth.fullName": "Full Name",
    "auth.school": "School",
    "auth.class": "Class",
    "auth.role": "Role",
    "auth.register_as": "Register as",
    "auth.student": "Student",
    "auth.teacher": "Teacher",
    "auth.school_admin": "School Admin",
    "auth.logging_in": "Logging in...",
    "auth.terms_agreement": "By continuing, you agree to our Terms of Service and Privacy Policy.",
    
    // Events
    "events.title": "Art Events",
    "events.upcoming": "Upcoming Events",
    "events.ongoing": "Ongoing Events",
    "events.past": "Past Events",
    "events.register": "Register",
    "events.details": "Event Details",
    "events.create": "Create Event",
    "events.hero.title": "Creative Challenges",
    "events.hero.description": "Discover, participate, and showcase your talent in our artistic competitions",
    "events.hero.badge1": "Updated Weekly",
    "events.hero.badge2": "Win Recognition",
    "events.hero.badge3": "Global Platform",
    "events.stats.active": "Active Events",
    "events.stats.upcoming": "Upcoming",
    "events.stats.poetry": "Poetry Challenges",
    "events.stats.art": "Art Challenges",
    "events.filters.title": "Filter Events",
    "events.filters.type.label": "Event Type",
    "events.filters.type.all": "All Types",
    "events.filters.type.poetry": "Poetry",
    "events.filters.type.painting": "Painting",
    "events.filters.status.label": "Status",
    "events.filters.status.all": "All Statuses",
    "events.filters.status.upcoming": "Upcoming",
    "events.filters.status.open": "Open",
    "events.filters.status.closed": "Closed",
    "events.filters.stage.label": "Stage",
    "events.filters.stage.all": "All Stages",
    "events.filters.stage.class": "Class",
    "events.filters.stage.school": "School",
    "events.filters.stage.country": "Country",
    "events.filters.stage.global": "Global",
    "events.loading": "Loading amazing competitions for you...",
    "events.no_results": "No events found matching your filters.",
    "events.reset_filters": "Reset All Filters",
    
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
    "message.welcome": "Welcome to RASM wa QALAM",
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
    
    // About page
    "about.hero.title": "About",
    "about.hero.description": "Empowering student creativity through AI-assisted artistic expression and friendly competition",
    
    "about.mission.title": "Our Mission",
    "about.mission.image_alt": "AI-Powered Creativity for Students",
    "about.mission.paragraph1": "RASM wa QALAM was created to empower students to explore their creativity using cutting-edge AI tools while building a competitive and collaborative environment for artistic expression.",
    "about.mission.paragraph2": "We believe that by combining technology with artistic expression, we can help students develop both their creative and technical skills for the future.",
    
    "about.values.title": "Our Values",
    "about.values.creativity.title": "Creativity",
    "about.values.creativity.description": "We foster an environment where creative thinking is celebrated and encouraged, allowing students to express their unique perspectives.",
    "about.values.collaboration.title": "Collaboration",
    "about.values.collaboration.description": "We believe in the power of shared experiences and learning from each other through friendly competition and peer feedback.",
    "about.values.innovation.title": "Innovation",
    "about.values.innovation.description": "We embrace new technologies as tools for expanding artistic possibilities, helping students explore the frontier of AI-assisted creativity.",
    
    "about.story.title": "Our Story",
    "about.story.image_alt": "Artistic inspiration with neural network connections",
    "about.story.badge": "IB CAS Project",
    "about.story.paragraph1": "RASM wa QALAM is an innovative initiative that originated as an International Baccalaureate CAS (Creativity, Activity, Service) project with the goal of creating a vibrant art community.",
    "about.story.paragraph2": "RASM wa QALAM's unique platform leverages the power of artificial intelligence to foster creative competition among its members. By using AI-generated prompts, RASM wa QALAM challenges participants to craft poems and create art pieces based on carefully selected themes.",
    "about.story.paragraph3": "RASM wa QALAM competitions are designed to encourage our community to delve deeper into their creativity, pushing the boundaries of conventional thinking and inspiring participants to think outside the box. Through this process, RASM wa QALAM not only nurtures artistic expression but also promotes the development of thought-provoking, imaginative content.",
    
    "about.competition.title": "Competition Structure",
    "about.competition.stage1.title": "Class Stage",
    "about.competition.stage1.description": "Students compete against classmates, with peer voting determining the top 3 submissions that advance to the next stage.",
    "about.competition.stage2.title": "School Stage",
    "about.competition.stage2.description": "Class winners compete against other classes in their grade level, with the top 3 submissions from each school advancing.",
    "about.competition.stage3.title": "Country Stage",
    "about.competition.stage3.description": "School winners compete nationally, with a panel of educators and artists selecting the top submissions to advance to the global stage.",
    "about.competition.stage4.title": "Global Stage",
    "about.competition.stage4.description": "The best submissions from around the world compete for international recognition, with winners receiving special recognition and prizes.",
    
    // Schools page
    "schools.hero.title": "Participating Schools",
    "schools.hero.description": "Discover the vibrant community of educational institutions taking part in our creative challenges",
    "schools.search.placeholder": "Search schools...",
    "schools.search.clear": "Clear search",
    "schools.stats.active_schools": "Active Schools",
    "schools.stats.students": "Active Students",
    "schools.stats.countries": "Countries",
    "schools.empty.title": "No schools found",
    "schools.empty.description": "We couldn't find any schools matching your search",
    "schools.card.student_count": "Active Students",
    "schools.card.view_details": "View Details",
    
    // Partners page
    "partners.hero.title": "Our Partners",
    "partners.hero.description": "We collaborate with leading organizations to bring the best creative opportunities to our students",
    "partners.search.placeholder": "Search partners...",
    "partners.search.clear": "Clear search",
    "partners.filter.all": "All Partners",
    "partners.stats.active": "Active Partners",
    "partners.stats.tech": "Tech Partners",
    "partners.stats.education": "Education Partners",
    "partners.stats.corporate": "Corporate Partners",
    "partners.empty.title": "No partners found",
    "partners.empty.description": "No partners found matching your search criteria.",
    "partners.empty.reset": "Reset All Filters",
    "partners.card.view_website": "Visit Website",
    
    // Gallery page
    "gallery.hero.title": "Winners Gallery",
    "gallery.hero.description": "Explore the remarkable winning submissions from our creative challenges",
    "gallery.stats.paintings": "Paintings",
    "gallery.stats.poems": "Poems",
    "gallery.stats.global_winners": "Global Winners",
    "gallery.stats.events": "Events",
    "gallery.tabs.paintings": "Paintings",
    "gallery.tabs.poetry": "Poetry",
    "gallery.filters.title": "Refine Your Gallery View",
    "gallery.filters.competition_stage": "Competition Stage",
    "gallery.filters.event": "Event",
    "gallery.filters.all_winners": "All Winners",
    "gallery.filters.class_winners": "Class Winners",
    "gallery.filters.school_winners": "School Winners",
    "gallery.filters.country_winners": "Country Winners",
    "gallery.filters.global_winners": "Global Winners",
    "gallery.filters.all_events": "All Events",
    "gallery.loading": "Loading masterpieces...",
    "gallery.empty.title": "No submissions found",
    "gallery.empty.description": "No winning submissions found matching your filters.",
    "gallery.empty.reset": "Reset All Filters",
    "gallery.item.by": "By",
    "gallery.item.view_details": "View Details",
    "gallery.item.winner": "{category} Winner",
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
    
    // Auth related
    "auth.login": "تسجيل الدخول",
    "auth.register": "التسجيل",
    "auth.username": "اسم المستخدم",
    "auth.username_placeholder": "أدخل اسم المستخدم الخاص بك",
    "auth.password": "كلمة المرور",
    "auth.password_placeholder": "أدخل كلمة المرور الخاصة بك",
    "auth.forgot_password": "نسيت كلمة المرور؟",
    "auth.email": "البريد الإلكتروني",
    "auth.fullName": "الاسم الكامل",
    "auth.school": "المدرسة",
    "auth.class": "الصف",
    "auth.role": "الدور",
    "auth.register_as": "التسجيل باعتبارك",
    "auth.student": "طالب",
    "auth.teacher": "معلم",
    "auth.school_admin": "مدير مدرسة",
    "auth.logging_in": "جاري تسجيل الدخول...",
    "auth.terms_agreement": "بالمتابعة، فإنك توافق على شروط الخدمة وسياسة الخصوصية الخاصة بنا.",
    
    // Home Page
    "home.hero.title": "أطلق العنان لإبداعك",
    "home.hero.description": "قم بإنشاء أعمال فنية رائعة بمساعدة الذكاء الاصطناعي، وشارك في تحديات فنية مثيرة، وتنافس مع طلاب من مدارس حول العالم.",
    "home.hero.cta.explore": "استكشاف الفعاليات",
    "home.hero.cta.create": "ابدأ الإبداع",
    "home.featured.title": "الفعاليات المميزة",
    "home.featured.subtitle": "انضم إلى هذه التحديات المثيرة وأظهر إبداعك",
    "home.featured.viewall": "عرض الكل",
    "home.featured.empty": "لا توجد فعاليات متاحة حاليًا. تحقق مرة أخرى قريبًا!",
    "home.airobot.title": "الإبداع المدعوم بالذكاء الاصطناعي",
    "home.airobot.description": "اختبر الاندماج بين الذكاء الاصطناعي والإبداع البشري. أنشئ أعمالًا فنية مذهلة بمساعدة الذكاء الاصطناعي، وشارك في تحديات فنية مثيرة، وتنافس مع طلاب من مدارس حول العالم.",
    "home.airobot.button": "ابدأ الإبداع",
    "home.airobot.alt": "روبوت الذكاء الاصطناعي ينشئ أعمالا فنية ملونة",
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
    
    // Auth related - Update: Removing duplicate auth keys
    // Note: First set of auth keys appears at line ~294
    // These will be used by the application
    
    // Events
    "events.title": "فعاليات الفن",
    "events.upcoming": "الفعاليات القادمة",
    "events.ongoing": "الفعاليات الجارية",
    "events.past": "الفعاليات السابقة",
    "events.register": "تسجيل",
    "events.details": "تفاصيل الفعالية",
    "events.create": "إنشاء فعالية",
    "events.hero.title": "تحديات إبداعية",
    "events.hero.description": "استكشف وشارك واعرض موهبتك في مسابقاتنا الفنية",
    "events.hero.badge1": "تحديث أسبوعي",
    "events.hero.badge2": "احصل على التقدير",
    "events.hero.badge3": "منصة عالمية",
    "events.stats.active": "الفعاليات النشطة",
    "events.stats.upcoming": "القادمة",
    "events.stats.poetry": "تحديات الشعر",
    "events.stats.art": "تحديات الفن",
    "events.filters.title": "تصفية الفعاليات",
    "events.filters.type.label": "نوع الفعالية",
    "events.filters.type.all": "جميع الأنواع",
    "events.filters.type.poetry": "شعر",
    "events.filters.type.painting": "رسم",
    "events.filters.status.label": "الحالة",
    "events.filters.status.all": "جميع الحالات",
    "events.filters.status.upcoming": "قادمة",
    "events.filters.status.open": "مفتوحة",
    "events.filters.status.closed": "مغلقة",
    "events.filters.stage.label": "المرحلة",
    "events.filters.stage.all": "جميع المراحل",
    "events.filters.stage.class": "الصف",
    "events.filters.stage.school": "المدرسة",
    "events.filters.stage.country": "الدولة",
    "events.filters.stage.global": "عالمي",
    "events.loading": "جاري تحميل المسابقات المذهلة من أجلك...",
    "events.no_results": "لم يتم العثور على فعاليات تطابق المعايير.",
    "events.reset_filters": "إعادة تعيين جميع المرشحات",
    
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
    
    // About page
    "about.hero.title": "نبذة عن",
    "about.hero.description": "تمكين إبداع الطلاب من خلال التعبير الفني بمساعدة الذكاء الاصطناعي والمنافسة الودية",
    
    "about.mission.title": "مهمتنا",
    "about.mission.image_alt": "الإبداع المدعوم بالذكاء الاصطناعي للطلاب",
    "about.mission.paragraph1": "تم إنشاء فزاع-للفنون لتمكين الطلاب من استكشاف إبداعهم باستخدام أدوات الذكاء الاصطناعي المتطورة مع بناء بيئة تنافسية وتعاونية للتعبير الفني.",
    "about.mission.paragraph2": "نؤمن بأنه من خلال الجمع بين التكنولوجيا والتعبير الفني، يمكننا مساعدة الطلاب على تطوير مهاراتهم الإبداعية والتقنية للمستقبل.",
    
    "about.values.title": "قيمنا",
    "about.values.creativity.title": "الإبداع",
    "about.values.creativity.description": "نحن نعزز بيئة يتم فيها الاحتفال بالتفكير الإبداعي وتشجيعه، مما يسمح للطلاب بالتعبير عن وجهات نظرهم الفريدة.",
    "about.values.collaboration.title": "التعاون",
    "about.values.collaboration.description": "نؤمن بقوة التجارب المشتركة والتعلم من بعضنا البعض من خلال المنافسة الودية وملاحظات الأقران.",
    "about.values.innovation.title": "الابتكار",
    "about.values.innovation.description": "نحن نتبنى التقنيات الجديدة كأدوات لتوسيع الإمكانيات الفنية، ومساعدة الطلاب على استكشاف حدود الإبداع بمساعدة الذكاء الاصطناعي.",
    
    "about.story.title": "قصتنا",
    "about.story.image_alt": "إلهام فني مع اتصالات الشبكة العصبية",
    "about.story.badge": "مشروع CAS للبكالوريا الدولية",
    "about.story.paragraph1": "فزاع-للفنون هي مبادرة مبتكرة نشأت كمشروع البكالوريا الدولية CAS (الإبداع، النشاط، الخدمة) بهدف إنشاء مجتمع فني نابض بالحياة.",
    "about.story.paragraph2": "تستفيد منصة فزاع-للفنون الفريدة من قوة الذكاء الاصطناعي لتعزيز المنافسة الإبداعية بين أعضائها. من خلال استخدام الإيحاءات التي يولدها الذكاء الاصطناعي، تتحدى فزاع-للفنون المشاركين لصياغة قصائد وإنشاء أعمال فنية مبنية على مواضيع مختارة بعناية.",
    "about.story.paragraph3": "تم تصميم مسابقات فزاع-للفنون لتشجيع مجتمعنا على التعمق أكثر في إبداعهم، ودفع حدود التفكير التقليدي وإلهام المشاركين للتفكير خارج الصندوق. من خلال هذه العملية، لا تغذي فزاع-للفنون التعبير الفني فحسب، بل تعزز أيضًا تطوير محتوى مثير للتفكير وخيالي.",
    
    "about.competition.title": "هيكل المسابقة",
    "about.competition.stage1.title": "مرحلة الصف",
    "about.competition.stage1.description": "يتنافس الطلاب ضد زملائهم في الصف، حيث يحدد تصويت الأقران أفضل 3 مشاركات التي تتقدم إلى المرحلة التالية.",
    "about.competition.stage2.title": "مرحلة المدرسة",
    "about.competition.stage2.description": "يتنافس الفائزون في الصف ضد الصفوف الأخرى في مستوى صفهم، مع تقدم أفضل 3 مشاركات من كل مدرسة.",
    "about.competition.stage3.title": "مرحلة الدولة",
    "about.competition.stage3.description": "يتنافس الفائزون في المدارس على المستوى الوطني، مع لجنة من المعلمين والفنانين لاختيار أفضل المشاركات للتقدم إلى المرحلة العالمية.",
    "about.competition.stage4.title": "المرحلة العالمية",
    "about.competition.stage4.description": "تتنافس أفضل المشاركات من جميع أنحاء العالم للحصول على اعتراف دولي، مع حصول الفائزين على تقدير خاص وجوائز.",
    
    // Schools page
    "schools.hero.title": "المدارس المشاركة",
    "schools.hero.description": "اكتشف مجتمع المؤسسات التعليمية النابض بالحياة المشاركة في تحدياتنا الإبداعية",
    "schools.search.placeholder": "البحث عن المدارس...",
    "schools.search.clear": "مسح البحث",
    "schools.stats.active_schools": "المدارس النشطة",
    "schools.stats.students": "الطلاب النشطون",
    "schools.stats.countries": "الدول",
    "schools.empty.title": "لم يتم العثور على مدارس",
    "schools.empty.description": "لم نتمكن من العثور على أي مدارس تطابق بحثك",
    "schools.card.student_count": "الطلاب النشطون",
    "schools.card.view_details": "عرض التفاصيل",
    
    // Partners page
    "partners.hero.title": "شركاؤنا",
    "partners.hero.description": "نتعاون مع المنظمات الرائدة لتقديم أفضل الفرص الإبداعية لطلابنا",
    "partners.search.placeholder": "البحث عن الشركاء...",
    "partners.search.clear": "مسح البحث",
    "partners.filter.all": "جميع الشركاء",
    "partners.stats.active": "الشركاء النشطون",
    "partners.stats.tech": "شركاء التكنولوجيا",
    "partners.stats.education": "شركاء التعليم",
    "partners.stats.corporate": "الشركاء المؤسسيون",
    "partners.empty.title": "لم يتم العثور على شركاء",
    "partners.empty.description": "لم يتم العثور على شركاء تطابق معايير البحث.",
    "partners.empty.reset": "إعادة تعيين جميع المرشحات",
    "partners.card.view_website": "زيارة الموقع",
    
    // Gallery page
    "gallery.hero.title": "معرض الفائزين",
    "gallery.hero.description": "استكشف المشاركات الفائزة الرائعة من تحدياتنا الإبداعية",
    "gallery.stats.paintings": "اللوحات",
    "gallery.stats.poems": "القصائد",
    "gallery.stats.global_winners": "الفائزون العالميون",
    "gallery.stats.events": "الفعاليات",
    "gallery.tabs.paintings": "اللوحات",
    "gallery.tabs.poetry": "الشعر",
    "gallery.filters.title": "تنقية عرض المعرض",
    "gallery.filters.competition_stage": "مرحلة المسابقة",
    "gallery.filters.event": "الفعالية",
    "gallery.filters.all_winners": "جميع الفائزين",
    "gallery.filters.class_winners": "الفائزون في الصف",
    "gallery.filters.school_winners": "الفائزون في المدرسة",
    "gallery.filters.country_winners": "الفائزون في الدولة",
    "gallery.filters.global_winners": "الفائزون العالميون",
    "gallery.filters.all_events": "جميع الفعاليات",
    "gallery.loading": "جاري تحميل الأعمال الفنية...",
    "gallery.empty.title": "لم يتم العثور على مشاركات",
    "gallery.empty.description": "لم يتم العثور على مشاركات فائزة تطابق المعايير.",
    "gallery.empty.reset": "إعادة تعيين جميع المرشحات",
    "gallery.item.by": "بواسطة",
    "gallery.item.view_details": "عرض التفاصيل",
    "gallery.item.winner": "الفائز في {category}",
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