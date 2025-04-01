import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/hooks/use-language";
import { Printer } from "lucide-react";
import { useEffect } from "react";

const DocumentationPage = () => {
  const { t } = useLanguage();

  useEffect(() => {
    // Set page title
    document.title = "FAZAA Art - Documentation";
  }, []);

  // Function to handle print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container mx-auto py-10 max-w-5xl print:py-2">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-3xl font-bold text-primary">{t("Documentation")}</h1>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          {t("Print")}
        </Button>
      </div>
      
      <Tabs defaultValue="overview" className="print:hidden">
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="overview">{t("Overview")}</TabsTrigger>
          <TabsTrigger value="features">{t("Features")}</TabsTrigger>
          <TabsTrigger value="competition">{t("Competition")}</TabsTrigger>
          <TabsTrigger value="technical">{t("Technical")}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <ExecutiveSummary />
          <GoalsObjectives />
          <HistoryBackground />
          <CoreValues />
        </TabsContent>
        
        <TabsContent value="features" className="space-y-6">
          <PlatformFeatures />
        </TabsContent>
        
        <TabsContent value="competition" className="space-y-6">
          <CompetitionStructure />
          <UserRolesDashboards />
        </TabsContent>
        
        <TabsContent value="technical" className="space-y-6">
          <TechnicalImplementation />
          <FutureDevelopment />
        </TabsContent>
      </Tabs>
      
      {/* Print version shows all content */}
      <div className="hidden print:block space-y-6">
        <ExecutiveSummary />
        <GoalsObjectives />
        <HistoryBackground />
        <CoreValues />
        <PlatformFeatures />
        <CompetitionStructure />
        <UserRolesDashboards />
        <TechnicalImplementation />
        <FutureDevelopment />
        <div className="text-center text-sm text-muted-foreground mt-8">
          <p>Generated on {new Date().toLocaleDateString()}</p>
          <p>FAZAA - Art: Empowering student creativity through AI-assisted artistic expression and friendly competition.</p>
        </div>
      </div>
    </div>
  );
};

// Individual sections as components
const ExecutiveSummary = () => (
  <Card>
    <CardHeader>
      <CardTitle>Executive Summary</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p>
        FAZAA - Art is an innovative AI-powered art competition platform designed to empower students in exploring digital creativity through interactive challenges and community-driven engagement. The platform provides students with access to advanced AI tools for generating artwork and poetry, allowing them to participate in structured competitions across multiple levels from classroom to global stages.
      </p>
      <p>
        The application combines artistic expression with cutting-edge technology, creating an educational environment that fosters both creative and technical skills development. FAZAA - Art serves as a vibrant community where students can showcase their talent, receive peer feedback, and gain recognition for their artistic achievements.
      </p>
    </CardContent>
  </Card>
);

const GoalsObjectives = () => (
  <Card>
    <CardHeader>
      <CardTitle>Goals and Objectives</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="mb-4">The primary goals of FAZAA - Art are:</p>
      <ol className="list-decimal pl-6 space-y-2">
        <li>
          <strong>Empower Student Creativity</strong>: Provide students with powerful AI tools to explore and express their creativity in new and innovative ways.
        </li>
        <li>
          <strong>Foster Artistic Community</strong>: Create a platform where students can share their work, appreciate others' creations, and engage in constructive feedback.
        </li>
        <li>
          <strong>Structure Creative Competitions</strong>: Implement a multi-tiered competition system from classroom to global levels that motivates participation and excellence.
        </li>
        <li>
          <strong>Introduce AI Technology in Education</strong>: Help students become familiar with AI capabilities in artistic contexts, preparing them for future technological landscapes.
        </li>
        <li>
          <strong>Promote Cross-Cultural Exchange</strong>: Connect students from different schools, countries, and backgrounds through shared creative experiences.
        </li>
        <li>
          <strong>Develop Technical Skills</strong>: Enable students to learn digital tools, prompt engineering, and AI collaboration while creating art.
        </li>
      </ol>
    </CardContent>
  </Card>
);

const HistoryBackground = () => (
  <Card>
    <CardHeader>
      <CardTitle>History and Background</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p>
        FAZAA - Art originated as an International Baccalaureate CAS (Creativity, Activity, Service) project with the ambitious goal of creating a vibrant art community. The platform evolved to leverage artificial intelligence to foster creative competition among students.
      </p>
      <p>
        The initiative was designed to encourage students to explore their creativity beyond conventional boundaries. By using AI-generated prompts, FAZAA - Art challenges participants to craft poems and create art pieces based on carefully selected themes, pushing the boundaries of conventional thinking and inspiring participants to think outside the box.
      </p>
      <p>
        Through this process, the platform not only nurtures artistic expression but also promotes the development of thought-provoking, imaginative content that combines traditional artistic sensibilities with modern technological capabilities.
      </p>
    </CardContent>
  </Card>
);

const CoreValues = () => (
  <Card>
    <CardHeader>
      <CardTitle>Core Values</CardTitle>
      <CardDescription>FAZAA - Art is built upon three fundamental values:</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Creativity</h3>
        <p>
          We foster an environment where creative thinking is celebrated and encouraged, allowing students to express their unique perspectives and artistic visions.
        </p>
      </div>
      <div>
        <h3 className="text-lg font-medium mb-2">Collaboration</h3>
        <p>
          We believe in the power of shared experiences and learning from each other through friendly competition and peer feedback. The platform creates opportunities for students to inspire one another and grow through community engagement.
        </p>
      </div>
      <div>
        <h3 className="text-lg font-medium mb-2">Innovation</h3>
        <p>
          We embrace new technologies as tools for expanding artistic possibilities, helping students explore the frontier of AI-assisted creativity. The platform introduces students to cutting-edge AI models for both visual art and poetry generation.
        </p>
      </div>
    </CardContent>
  </Card>
);

const PlatformFeatures = () => (
  <Card>
    <CardHeader>
      <CardTitle>Platform Features</CardTitle>
      <CardDescription>FAZAA - Art offers a comprehensive set of features designed to support student creativity and artistic competition:</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">1. AI Art Generation</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Integration with state-of-the-art image generation models (OpenAI DALL-E and Hugging Face Stable Diffusion)</li>
          <li>User-friendly interface for creating AI-generated artwork from text prompts</li>
          <li>Support for various artistic styles and themes</li>
          <li>Ability to save and submit generated artwork to competitions</li>
        </ul>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">2. AI Poetry Generation</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Advanced language models for poetry creation (OpenAI GPT and Hugging Face Mistral)</li>
          <li>Options for different poetic styles (haiku, sonnet, free verse, etc.)</li>
          <li>Customizable parameters for tone, theme, and structure</li>
          <li>Editing capabilities for refining AI-generated content</li>
        </ul>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">3. Comprehensive Competition System</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Multi-stage competition structure (class, school, country, global)</li>
          <li>Peer voting system for democratic selection of winners</li>
          <li>Teacher validation of student submissions</li>
          <li>Winner recognition at each stage of the competition</li>
        </ul>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">4. User Management</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Role-based access control (students, teachers, administrators)</li>
          <li>School and class organization system</li>
          <li>Student portfolio management</li>
          <li>Secure authentication with password recovery</li>
        </ul>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">5. Admin Dashboard</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Comprehensive management of users, schools, classes, and events</li>
          <li>Submission validation and moderation tools</li>
          <li>Competition management and scheduling</li>
          <li>Partner and sponsor integration</li>
        </ul>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">6. Multilingual Support</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Full translation support for English and Arabic</li>
          <li>Easily expandable language framework</li>
          <li>Culturally responsive interface elements</li>
        </ul>
      </div>
    </CardContent>
  </Card>
);

const CompetitionStructure = () => (
  <Card>
    <CardHeader>
      <CardTitle>Competition Structure</CardTitle>
      <CardDescription>FAZAA - Art implements a progressive four-tier competition structure:</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">1. Class Stage</h3>
        <p>
          Students compete against classmates, with peer voting determining the top 3 submissions that advance to the next stage. This initial stage encourages participation and builds confidence in a familiar environment.
        </p>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">2. School Stage</h3>
        <p>
          Class winners compete against other classes in their grade level, with the top 3 submissions from each school advancing to the national competition. This stage broadens students' exposure to diverse artistic approaches within their school.
        </p>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">3. Country Stage</h3>
        <p>
          School winners compete nationally, with a panel of educators and artists selecting the top submissions to advance to the global stage. This level provides visibility and recognition beyond the immediate school community.
        </p>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">4. Global Stage</h3>
        <p>
          The best submissions from around the world compete for international recognition, with winners receiving special recognition and prizes. This prestigious level connects students to a global community of peers and potential opportunities.
        </p>
      </div>
    </CardContent>
  </Card>
);

const UserRolesDashboards = () => (
  <Card>
    <CardHeader>
      <CardTitle>User Roles and Dashboards</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Student Role</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Access to AI creation tools for art and poetry</li>
          <li>Ability to submit work to open competitions</li>
          <li>Participation in peer voting processes</li>
          <li>Personal portfolio of submissions and achievements</li>
        </ul>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">Teacher Role</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Management of class groups and student accounts</li>
          <li>Validation of student submissions</li>
          <li>Monitoring of class participation and results</li>
          <li>Facilitation of school-level competitions</li>
        </ul>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">Administrator Role</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Complete system management</li>
          <li>Creation and scheduling of competitions</li>
          <li>User management across all schools</li>
          <li>Report generation and platform oversight</li>
          <li>Partner and sponsor relationship management</li>
        </ul>
      </div>
    </CardContent>
  </Card>
);

const TechnicalImplementation = () => (
  <Card>
    <CardHeader>
      <CardTitle>Technical Implementation</CardTitle>
      <CardDescription>FAZAA - Art is built using a modern, scalable technology stack:</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Frontend</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>React.js with TypeScript for a robust, type-safe UI</li>
          <li>Tailwind CSS for responsive design</li>
          <li>Shadcn/ui component library for consistent interface elements</li>
          <li>TanStack Query for efficient data fetching and state management</li>
        </ul>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">Backend</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Express.js server for API endpoints</li>
          <li>PostgreSQL database for data persistence</li>
          <li>Drizzle ORM for database operations and migrations</li>
          <li>RESTful API design for client-server communication</li>
        </ul>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">AI Integration</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>OpenAI API integration for high-quality art and poetry generation</li>
          <li>Hugging Face API as an alternative open-source AI solution</li>
          <li>Fallback mechanisms for service continuity during API outages</li>
        </ul>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2">Security</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>JWT-based authentication system</li>
          <li>Secure password management with hashing</li>
          <li>CAPTCHA protection against automated attacks</li>
          <li>Role-based access control for protected resources</li>
        </ul>
      </div>
    </CardContent>
  </Card>
);

const FutureDevelopment = () => (
  <Card>
    <CardHeader>
      <CardTitle>Future Development</CardTitle>
      <CardDescription>FAZAA - Art has a roadmap for continued enhancement:</CardDescription>
    </CardHeader>
    <CardContent>
      <ol className="list-decimal pl-6 space-y-2">
        <li><strong>Enhanced AI Tools</strong>: Integration of more specialized AI models for different artistic styles</li>
        <li><strong>Mobile Application</strong>: Development of native mobile apps for iOS and Android</li>
        <li><strong>Advanced Analytics</strong>: Implementation of insights and statistics for students and educators</li>
        <li><strong>Expanded Language Support</strong>: Addition of more languages beyond English and Arabic</li>
        <li><strong>Virtual Exhibitions</strong>: Creation of virtual galleries for showcasing student work</li>
        <li><strong>Integration with Educational Platforms</strong>: Connecting with learning management systems used in schools</li>
        <li><strong>Mentorship Program</strong>: Connecting students with professional artists and writers for guidance</li>
      </ol>
    </CardContent>
  </Card>
);

export default DocumentationPage;