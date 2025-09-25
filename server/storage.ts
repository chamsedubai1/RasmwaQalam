import { 
  users, User, InsertUser, 
  cities, City, InsertCity,
  schools, School, InsertSchool,
  classes, Class, InsertClass,
  partners, Partner, InsertPartner,
  events, Event, InsertEvent,
  registrations, Registration, InsertRegistration,
  submissions, Submission, InsertSubmission,
  votes, Vote, InsertVote,
  secondaryTeacherAssignments, SecondaryTeacherAssignment, InsertSecondaryTeacherAssignment,
  galleryItems, GalleryItem, InsertGalleryItem,
  refreshTokens, RefreshToken, InsertRefreshToken
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersBySchool(schoolId: number): Promise<User[]>;
  getUsersByClass(classId: number): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // City methods
  getCity(id: number): Promise<City | undefined>;
  getCityByName(name: string): Promise<City | undefined>;
  getAllCities(): Promise<City[]>;
  getActiveCities(): Promise<City[]>; 
  createCity(city: InsertCity): Promise<City>;
  updateCity(id: number, cityData: Partial<City>): Promise<City | undefined>;
  deleteCity(id: number): Promise<boolean>;

  // School methods
  getSchool(id: number): Promise<School | undefined>;
  getAllSchools(): Promise<School[]>;
  getSchoolsByCity(cityId: number): Promise<School[]>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: number, schoolData: Partial<School>): Promise<School | undefined>;
  deleteSchool(id: number): Promise<boolean>;

  // Class methods
  getClass(id: number): Promise<Class | undefined>;
  getClassesBySchool(schoolId: number): Promise<Class[]>;
  getClassesByTeacher(teacherId: number): Promise<Class[]>;
  getAllClasses(): Promise<Class[]>;
  createClass(classData: InsertClass): Promise<Class>;
  updateClass(id: number, classData: Partial<Class>): Promise<Class | undefined>;
  deleteClass(id: number): Promise<boolean>;

  // Partner methods
  getPartner(id: number): Promise<Partner | undefined>;
  getAllPartners(): Promise<Partner[]>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  updatePartner(id: number, partnerData: Partial<Partner>): Promise<Partner | undefined>;
  deletePartner(id: number): Promise<boolean>;

  // Event methods
  getEvent(id: number): Promise<Event | undefined>;
  getAllEvents(): Promise<Event[]>;
  getEventsByStatus(status: string): Promise<Event[]>;
  getEventsByType(type: string): Promise<Event[]>;
  getEventsByStage(stage: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, eventData: Partial<Event>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;

  // Registration methods
  getRegistration(id: number): Promise<Registration | undefined>;
  getRegistrationsByUser(userId: number): Promise<Registration[]>;
  getRegistrationsByEvent(eventId: number): Promise<Registration[]>;
  createRegistration(registration: InsertRegistration): Promise<Registration>;
  deleteRegistration(id: number): Promise<boolean>;

  // Submission methods
  getSubmission(id: number): Promise<Submission | undefined>;
  getSubmissionsByUser(userId: number): Promise<Submission[]>;
  getSubmissionsByEvent(eventId: number): Promise<Submission[]>;
  getSubmissionsByUserAndEvent(userId: number, eventId: number): Promise<Submission[]>;
  getSubmissionsByClass(classId: number): Promise<Submission[]>;
  getAllSubmissions(): Promise<Submission[]>;
  getSubmissionsPendingValidation(classId: number): Promise<Submission[]>;
  getValidatedSubmissions(classId: number): Promise<Submission[]>;
  getRejectedSubmissions(classId: number): Promise<Submission[]>;
  getWinningSubmissions(winnerCategory: string): Promise<Submission[]>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  updateSubmission(id: number, submissionData: Partial<Submission>): Promise<Submission | undefined>;
  validateSubmission(id: number, validated: boolean): Promise<Submission | undefined>;
  deleteSubmission(id: number): Promise<boolean>;

  // Vote methods
  getVote(id: number): Promise<Vote | undefined>;
  getVotesBySubmission(submissionId: number): Promise<Vote[]>;
  getVotesByVoter(voterId: number): Promise<Vote[]>;
  hasUserVotedForSubmission(voterId: number, submissionId: number): Promise<boolean>;
  createVote(vote: InsertVote): Promise<Vote>;
  deleteVote(id: number): Promise<boolean>;
  getVoteCountForSubmission(submissionId: number): Promise<number>;
  
  // Secondary Teacher Assignment methods
  getSecondaryTeacherAssignment(id: number): Promise<SecondaryTeacherAssignment | undefined>;
  getSecondaryTeacherAssignmentsByTeacher(teacherId: number): Promise<SecondaryTeacherAssignment[]>;
  getSecondaryTeacherAssignmentsBySecondaryTeacher(secondaryTeacherId: number): Promise<SecondaryTeacherAssignment[]>;
  getSecondaryTeacherAssignmentsByClass(classId: number): Promise<SecondaryTeacherAssignment[]>;
  getClassesBySecondaryTeacher(secondaryTeacherId: number): Promise<Class[]>;
  createSecondaryTeacherAssignment(assignment: InsertSecondaryTeacherAssignment): Promise<SecondaryTeacherAssignment>;
  deleteSecondaryTeacherAssignment(id: number): Promise<boolean>;
  
  // Gallery Item methods
  getGalleryItem(id: number): Promise<GalleryItem | undefined>;
  getAllGalleryItems(): Promise<GalleryItem[]>;
  getGalleryItemsByType(type: 'poem' | 'image'): Promise<GalleryItem[]>;
  getGalleryItemsByCreator(createdBy: number): Promise<GalleryItem[]>;
  getFeaturedGalleryItems(): Promise<GalleryItem[]>;
  createGalleryItem(galleryItem: InsertGalleryItem): Promise<GalleryItem>;
  updateGalleryItem(id: number, galleryItemData: Partial<GalleryItem>): Promise<GalleryItem | undefined>;
  deleteGalleryItem(id: number): Promise<boolean>;

  // Refresh Token methods - for secure token rotation and invalidation
  getRefreshToken(id: number): Promise<RefreshToken | undefined>;
  getRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined>;
  getActiveRefreshTokensByUser(userId: number): Promise<RefreshToken[]>;
  createRefreshToken(refreshToken: InsertRefreshToken): Promise<RefreshToken>;
  revokeRefreshToken(id: number, reason?: string): Promise<boolean>;
  revokeAllUserRefreshTokens(userId: number, reason?: string): Promise<number>;
  cleanupExpiredRefreshTokens(): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private cities: Map<number, City>;
  private schools: Map<number, School>;
  private classes: Map<number, Class>;
  private partners: Map<number, Partner>;
  private events: Map<number, Event>;
  private registrations: Map<number, Registration>;
  private submissions: Map<number, Submission>;
  private votes: Map<number, Vote>;
  private secondaryTeacherAssignments: Map<number, SecondaryTeacherAssignment>;
  private galleryItems: Map<number, GalleryItem>;
  private refreshTokens: Map<number, RefreshToken>;
  
  private userCounter: number;
  private cityCounter: number;
  private schoolCounter: number;
  private classCounter: number;
  private partnerCounter: number;
  private eventCounter: number;
  private registrationCounter: number;
  private submissionCounter: number;
  private voteCounter: number;
  private secondaryTeacherAssignmentCounter: number;
  private galleryItemCounter: number;
  private refreshTokenCounter: number;

  constructor() {
    this.users = new Map();
    this.cities = new Map();
    this.schools = new Map();
    this.classes = new Map();
    this.partners = new Map();
    this.events = new Map();
    this.registrations = new Map();
    this.submissions = new Map();
    this.votes = new Map();
    this.secondaryTeacherAssignments = new Map();
    this.galleryItems = new Map();
    this.refreshTokens = new Map();
    
    this.userCounter = 1;
    this.cityCounter = 1;
    this.schoolCounter = 1;
    this.classCounter = 1;
    this.partnerCounter = 1;
    this.eventCounter = 1;
    this.registrationCounter = 1;
    this.submissionCounter = 1;
    this.voteCounter = 1;
    this.secondaryTeacherAssignmentCounter = 1;
    this.galleryItemCounter = 1;
    this.refreshTokenCounter = 1;
    
    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Add GCC cities
    const dubai = this.createCity({
      name: "Dubai",
      country: "UAE",
      isActive: true
    });
    
    const abuDhabi = this.createCity({
      name: "Abu Dhabi",
      country: "UAE",
      isActive: true
    });
    
    const sharjah = this.createCity({
      name: "Sharjah",
      country: "UAE",
      isActive: true
    });
    
    const ajman = this.createCity({
      name: "Ajman",
      country: "UAE",
      isActive: true
    });
    
    const riyadh = this.createCity({
      name: "Riyadh",
      country: "Saudi Arabia",
      isActive: true
    });
    
    const jeddah = this.createCity({
      name: "Jeddah",
      country: "Saudi Arabia",
      isActive: true
    });
    
    const doha = this.createCity({
      name: "Doha",
      country: "Qatar",
      isActive: true
    });
    
    // Add Dubai schools
    const schoolsList = [
      "Al Khaleej National School",
      "Al Mawakeb School",
      "Al Sadiq Islamic English School",
      "Alba School",
      "Ambassador School",
      "American International School Dubai",
      "American School of Creative Science",
      "American School of Dubai",
      "Amity School Dubai",
      "Arbor School (Eco-focused)",
      "Arcadia School",
      "Australian International School Dubai",
      "Bloom World Academy",
      "Brighton College Dubai",
      "Cedar School",
      "Citizens School",
      "Collegiate International School",
      "Credence High School",
      "Curriculum Institute School",
      "Deira International School",
      "Delhi Private School Dubai",
      "Dovecote Green Primary School",
      "Dubai American Academy",
      "Dubai British School",
      "Dubai Center for Special Needs",
      "Dubai College",
      "Dubai English Speaking College (DESC)",
      "Dubai Heights Academy",
      "Dubai International School",
      "Dubai Modern High School",
      "Dunecrest American School",
      "Durham School Dubai",
      "Dwight School Dubai",
      "Emirates International School Jumeirah",
      "Emirates International School Meadows",
      "Fairgreen International School (Sustainability-focused)",
      "Far Eastern Private School",
      "FirstPoint School The Villa",
      "Foremarke School Dubai",
      "French International School of Dubai",
      "GEMS Dubai American Academy",
      "GEMS FirstPoint School",
      "GEMS Founders School",
      "GEMS German School Dubai",
      "GEMS International School Al Khail",
      "GEMS Jumeirah Primary School",
      "GEMS Legacy School",
      "GEMS Modern Academy",
      "GEMS Nations Academy",
      "GEMS New Millennium School",
      "GEMS Our Own English High School",
      "GEMS Royal Dubai School Al Mizhar",
      "GEMS Wellington International School",
      "GEMS World Academy",
      "German International School Dubai (Deutsche Internationale Schule Dubai)",
      "Global Indian International School",
      "Greenfield Community School",
      "Greenwood International School",
      "Gulf Indian High School",
      "Hartland International School",
      "Horizon International School",
      "Innoventures Education (Dubai International Academy)",
      "Inspire Children's Learning Center",
      "International School of Arts and Sciences",
      "Japanese School Dubai",
      "JSS International School",
      "JSS Private School",
      "Jumeirah College",
      "Jumeirah English Speaking School (JESS)",
      "Kent College Dubai",
      "Kings' School Dubai",
      "Lycée Français International Georges Pompidou",
      "Lycée Français Jean Mermoz",
      "Nord Anglia International School Dubai",
      "North American International School",
      "Our Own High School Al Warqa'a",
      "Pakistan Education Academy",
      "Pearl Wisdom School",
      "Raffles International School",
      "Ranches Primary School",
      "Rashid Centre for People of Determination",
      "Regent International School",
      "Repton School Dubai",
      "RIS Meydan",
      "Royal Grammar School Guildford Dubai",
      "Russian International School",
      "Safa British School",
      "Safa Community School",
      "School of Modern Skills",
      "Sharjah Indian School Dubai Branch",
      "Sheikh Rashid Al Maktoum Pakistani School Dubai",
      "SNF Development Center",
      "South View School",
      "Springdales School Dubai",
      "Stepping Stones Center",
      "Sunmarke School",
      "The Developing Child Centre",
      "The English College Dubai",
      "The Indian Academy Dubai",
      "The Indian High School",
      "The Millennium School",
      "The New Filipino Private School",
      "The Philippine School Dubai",
      "The Winchester School Jebel Ali",
      "United International Private School",
      "Universal American School",
      "Uptown School",
      "Victory Heights Primary School",
      "Woodlem Park School Dubai"
    ];
    
    // Create all schools with basic information and assign them to Dubai city
    const createdSchools: School[] = [];
    for (const schoolName of schoolsList) {
      const school = this.createSchool({
        name: schoolName,
        description: `${schoolName} is a respected educational institution in Dubai offering quality education.`,
        websiteUrl: `https://example.com/${schoolName.toLowerCase().replace(/\s+/g, '-')}`,
        imageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1",
        isActive: true,
        cityId: 1 // Dubai has id 1 as it's the first city created
      });
      createdSchools.push(school);
    }
    
    // Keep reference to first school for sample data
    const school1 = createdSchools[0];
    
    // Add sample partners
    this.createPartner({
      name: "CreativeTech Solutions",
      description: "Providing AI tools and technical support for creative student projects.",
      websiteUrl: "https://example.com/partner",
      imageUrl: "https://images.unsplash.com/photo-1560179707-f14e90ef3623",
      partnerType: "Technical Partner"
    });
    
    this.createPartner({
      name: "ArtsForward Foundation",
      description: "Sponsoring events and providing resources to encourage arts in education.",
      websiteUrl: "https://example.com/partner",
      imageUrl: "https://images.unsplash.com/photo-1622675363311-3e1904dc1885",
      partnerType: "Funding Partner"
    });
    
    // Add sample users
    const admin = this.createUser({
      username: "Nedjma",
      password: "Aboudi@2802!",
      fullName: "Admin User",
      email: "admin@artchallenge.com",
      role: "admin",
      isActive: true
    });
    
    const teacher1 = this.createUser({
      username: "teacher1",
      password: "teacher123",
      fullName: "Michael Brown",
      email: "m.brown@school.edu",
      role: "teacher",
      schoolId: school1.id,
      isActive: true
    });
    
    const secondaryTeacher1 = this.createUser({
      username: "secondary1",
      password: "secondary123",
      fullName: "Sarah Johnson",
      email: "s.johnson@school.edu",
      role: "secondaryTeacher",
      schoolId: school1.id,
      isActive: true
    });
    
    const student1 = this.createUser({
      username: "student1",
      password: "student123",
      fullName: "Emma Smith",
      email: "emma.s@school.edu",
      role: "student",
      schoolId: school1.id,
      gradeLevel: "9th Grade",
      isActive: true
    });
    
    // Add two student users in the same class for voting testing
    const studa1 = this.createUser({
      username: "studa1",
      password: "password123",
      fullName: "Studa One",
      email: "testa1@gmail.com",
      role: "student",
      schoolId: school1.id,
      gradeLevel: "Grade 2",
      isActive: true
    });
    
    const studa2 = this.createUser({
      username: "studa2",
      password: "password123",
      fullName: "Studa Two",
      email: "testa2@gmail.com",
      role: "student",
      schoolId: school1.id,
      gradeLevel: "Grade 2",
      isActive: true
    });
    
    // Add sample classes
    const class1 = this.createClass({
      name: "Creative Writing 101",
      gradeLevel: "9th Grade",
      schoolId: school1.id,
      teacherId: teacher1.id,
      isLocked: false
    });
    
    const class2 = this.createClass({
      name: "Class 2B",
      gradeLevel: "Grade 2",
      schoolId: school1.id,
      teacherId: teacher1.id,
      isLocked: false
    });
    
    // Update students with class
    this.updateUser(student1.id, { classId: class1.id });
    this.updateUser(studa1.id, { classId: class2.id });
    this.updateUser(studa2.id, { classId: class2.id });
    
    // Add sample events
    const poetryEvent = this.createEvent({
      name: "Spring Poetry Challenge",
      description: "Create poems inspired by spring using AI assistance. Express the renewal, growth, and beauty of the season in your own words.",
      type: "poetry",
      status: "open",
      stage: "class",
      imageUrl: "https://images.unsplash.com/photo-1579762593175-20226054cad0",
      startDate: new Date(),
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    });
    
    const paintingEvent = this.createEvent({
      name: "Future Cities Art Challenge",
      description: "Imagine and create the cities of tomorrow with AI tools. How will technology, sustainability, and human needs shape our urban environments?",
      type: "painting",
      status: "open",
      stage: "school",
      imageUrl: "https://images.unsplash.com/photo-1560421683-6856ea585c78",
      startDate: new Date(),
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
    });
    
    // Add sample registrations
    this.createRegistration({
      userId: student1.id,
      eventId: poetryEvent.id
    });
    
    this.createRegistration({
      userId: student1.id,
      eventId: paintingEvent.id
    });
    
    // Register studa1 and studa2 for poetry event
    this.createRegistration({
      userId: studa1.id,
      eventId: poetryEvent.id
    });
    
    this.createRegistration({
      userId: studa2.id,
      eventId: poetryEvent.id
    });
    
    // Add sample submissions
    this.createSubmission({
      title: "Morning Bloom",
      description: "A poem about the awakening of nature in spring.",
      contentType: "text",
      content: "Dewdrops glisten on petals wide,\nSunbeams dance as shadows hide.\nSpring awakens with gentle might,\nNature's canvas bathed in light.",
      userId: student1.id,
      eventId: poetryEvent.id
    });
    
    // Add submissions for studa1 and studa2 for class voting testing
    const sub1 = this.createSubmission({
      title: "Spring Blossoms",
      description: "A poem about spring flowers",
      contentType: "text",
      content: "Spring blossoms dance in the wind,\nColors burst through winter's end,\nNature awakens once again,\nA beautiful sight for all to behold.",
      userId: studa2.id,
      eventId: poetryEvent.id
    });
    
    const sub2 = this.createSubmission({
      title: "The Spring Awakening",
      description: "A poem about new beginnings",
      contentType: "text",
      content: "As winter fades away,\nSpring brings life to a new day,\nBirds sing their cheerful tune,\nNature's beauty will be here soon.",
      userId: studa1.id,
      eventId: poetryEvent.id
    });
    
    // Set some submissions as validated for testing
    this.validateSubmission(sub1.id, true);
    
    // Create a sample secondary teacher assignment
    this.createSecondaryTeacherAssignment({
      classId: class1.id,
      teacherId: teacher1.id,
      secondaryTeacherId: secondaryTeacher1.id,
      isActive: true
    });
    
    // Add sample gallery items
    this.createGalleryItem({
      title: "Desert Sunset",
      description: "A beautiful painting of a desert sunset showcasing vivid colors",
      content: "https://images.unsplash.com/photo-1682686581264-c47345a271d6",
      type: "image",
      createdBy: admin.id,
      featured: true
    });
    
    this.createGalleryItem({
      title: "The Ocean's Whisper",
      description: "A poem about the calming sounds of the ocean",
      content: "Waves crash upon the shore,\nWhispering secrets to the sand,\nEternal dance of water and earth,\nNature's rhythm at its most grand.",
      type: "poem",
      createdBy: admin.id,
      featured: true
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return undefined;
  }

  async getUsersBySchool(schoolId: number): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.schoolId === schoolId);
  }

  async getUsersByClass(classId: number): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.classId === classId);
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === role);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userCounter++;
    const user: User = { ...userData, id };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // City methods
  async getCity(id: number): Promise<City | undefined> {
    return this.cities.get(id);
  }

  async getCityByName(name: string): Promise<City | undefined> {
    for (const city of this.cities.values()) {
      if (city.name === name) {
        return city;
      }
    }
    return undefined;
  }

  async getAllCities(): Promise<City[]> {
    return Array.from(this.cities.values());
  }

  async getActiveCities(): Promise<City[]> {
    return Array.from(this.cities.values()).filter(city => city.isActive);
  }

  async createCity(cityData: InsertCity): Promise<City> {
    const id = this.cityCounter++;
    const city: City = { ...cityData, id };
    this.cities.set(id, city);
    return city;
  }

  async updateCity(id: number, cityData: Partial<City>): Promise<City | undefined> {
    const city = this.cities.get(id);
    if (!city) return undefined;
    
    const updatedCity = { ...city, ...cityData };
    this.cities.set(id, updatedCity);
    return updatedCity;
  }

  async deleteCity(id: number): Promise<boolean> {
    return this.cities.delete(id);
  }

  // School methods
  async getSchool(id: number): Promise<School | undefined> {
    return this.schools.get(id);
  }

  async getAllSchools(): Promise<School[]> {
    return Array.from(this.schools.values());
  }
  
  async getSchoolsByCity(cityId: number): Promise<School[]> {
    return Array.from(this.schools.values()).filter(school => school.cityId === cityId);
  }

  async createSchool(schoolData: InsertSchool): Promise<School> {
    const id = this.schoolCounter++;
    const school: School = { ...schoolData, id };
    this.schools.set(id, school);
    return school;
  }

  async updateSchool(id: number, schoolData: Partial<School>): Promise<School | undefined> {
    const school = this.schools.get(id);
    if (!school) return undefined;
    
    const updatedSchool = { ...school, ...schoolData };
    this.schools.set(id, updatedSchool);
    return updatedSchool;
  }

  async deleteSchool(id: number): Promise<boolean> {
    return this.schools.delete(id);
  }

  // Class methods
  async getClass(id: number): Promise<Class | undefined> {
    return this.classes.get(id);
  }

  async getClassesBySchool(schoolId: number): Promise<Class[]> {
    return Array.from(this.classes.values()).filter(cls => cls.schoolId === schoolId);
  }

  async getClassesByTeacher(teacherId: number): Promise<Class[]> {
    return Array.from(this.classes.values()).filter(cls => cls.teacherId === teacherId);
  }

  async getAllClasses(): Promise<Class[]> {
    return Array.from(this.classes.values());
  }

  async createClass(classData: InsertClass): Promise<Class> {
    const id = this.classCounter++;
    const newClass: Class = { ...classData, id };
    this.classes.set(id, newClass);
    return newClass;
  }

  async updateClass(id: number, classData: Partial<Class>): Promise<Class | undefined> {
    const cls = this.classes.get(id);
    if (!cls) return undefined;
    
    const updatedClass = { ...cls, ...classData };
    this.classes.set(id, updatedClass);
    return updatedClass;
  }

  async deleteClass(id: number): Promise<boolean> {
    return this.classes.delete(id);
  }

  // Partner methods
  async getPartner(id: number): Promise<Partner | undefined> {
    return this.partners.get(id);
  }

  async getAllPartners(): Promise<Partner[]> {
    return Array.from(this.partners.values());
  }

  async createPartner(partnerData: InsertPartner): Promise<Partner> {
    const id = this.partnerCounter++;
    const partner: Partner = { ...partnerData, id };
    this.partners.set(id, partner);
    return partner;
  }

  async updatePartner(id: number, partnerData: Partial<Partner>): Promise<Partner | undefined> {
    const partner = this.partners.get(id);
    if (!partner) return undefined;
    
    const updatedPartner = { ...partner, ...partnerData };
    this.partners.set(id, updatedPartner);
    return updatedPartner;
  }

  async deletePartner(id: number): Promise<boolean> {
    return this.partners.delete(id);
  }

  // Event methods
  async getEvent(id: number): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getAllEvents(): Promise<Event[]> {
    return Array.from(this.events.values());
  }

  async getEventsByStatus(status: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter(event => event.status === status);
  }

  async getEventsByType(type: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter(event => event.type === type);
  }

  async getEventsByStage(stage: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter(event => event.stage === stage);
  }

  async createEvent(eventData: InsertEvent): Promise<Event> {
    const id = this.eventCounter++;
    const event: Event = { ...eventData, id };
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: number, eventData: Partial<Event>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;
    
    // Ensure isEnabled is treated as a boolean
    const normalizedData = {
      ...eventData,
      isEnabled: eventData.isEnabled === true || eventData.isEnabled === 'true',
    };
    
    console.log(`Storage: Updating event ${id} with isEnabled=${normalizedData.isEnabled}`, normalizedData);
    
    const updatedEvent = { ...event, ...normalizedData };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: number): Promise<boolean> {
    return this.events.delete(id);
  }

  // Registration methods
  async getRegistration(id: number): Promise<Registration | undefined> {
    return this.registrations.get(id);
  }

  async getRegistrationsByUser(userId: number): Promise<Registration[]> {
    return Array.from(this.registrations.values()).filter(reg => reg.userId === userId);
  }

  async getRegistrationsByEvent(eventId: number): Promise<Registration[]> {
    return Array.from(this.registrations.values()).filter(reg => reg.eventId === eventId);
  }

  async createRegistration(registrationData: InsertRegistration): Promise<Registration> {
    const id = this.registrationCounter++;
    const registration: Registration = { ...registrationData, id };
    this.registrations.set(id, registration);
    return registration;
  }

  async deleteRegistration(id: number): Promise<boolean> {
    return this.registrations.delete(id);
  }

  // Submission methods
  async getSubmission(id: number): Promise<Submission | undefined> {
    return this.submissions.get(id);
  }

  async getSubmissionsByUser(userId: number): Promise<Submission[]> {
    return Array.from(this.submissions.values()).filter(sub => sub.userId === userId);
  }

  async getSubmissionsByEvent(eventId: number): Promise<Submission[]> {
    return Array.from(this.submissions.values()).filter(sub => sub.eventId === eventId);
  }

  async getSubmissionsByUserAndEvent(userId: number, eventId: number): Promise<Submission[]> {
    return Array.from(this.submissions.values()).filter(
      sub => sub.userId === userId && sub.eventId === eventId
    );
  }
  
  async getSubmissionsByClass(classId: number): Promise<Submission[]> {
    // First, try to get submissions directly by classId
    const submissionsByClassId = Array.from(this.submissions.values()).filter(
      sub => sub.classId === classId
    );
    
    // If we found submissions with classId, return them
    if (submissionsByClassId.length > 0) {
      return submissionsByClassId;
    }
    
    // Fallback to the old method: get submissions via student IDs
    // This is for backward compatibility with existing submissions
    const students = await this.getUsersByClass(classId);
    const studentIds = students.map(student => student.id);
    
    // Get all submissions from those students
    return Array.from(this.submissions.values()).filter(
      sub => studentIds.includes(sub.userId)
    );
  }
  
  async getAllSubmissions(): Promise<Submission[]> {
    return Array.from(this.submissions.values());
  }
  
  async getSubmissionsPendingValidation(classId: number): Promise<Submission[]> {
    const submissions = await this.getSubmissionsByClass(classId);
    return submissions.filter(sub => sub.validated === null);
  }
  
  async getValidatedSubmissions(classId: number): Promise<Submission[]> {
    const submissions = await this.getSubmissionsByClass(classId);
    return submissions.filter(sub => sub.validated === true);
  }
  
  async getRejectedSubmissions(classId: number): Promise<Submission[]> {
    const submissions = await this.getSubmissionsByClass(classId);
    return submissions.filter(sub => sub.validated === false);
  }

  async getWinningSubmissions(winnerCategory: string): Promise<Submission[]> {
    return Array.from(this.submissions.values()).filter(sub => {
      if (winnerCategory === 'class') return sub.classWinner;
      if (winnerCategory === 'school') return sub.schoolWinner;
      if (winnerCategory === 'country') return sub.countryWinner;
      if (winnerCategory === 'global') return sub.globalWinner;
      return false;
    });
  }

  async createSubmission(submissionData: InsertSubmission): Promise<Submission> {
    const id = this.submissionCounter++;
    const submission: Submission = { 
      ...submissionData, 
      id, 
      validated: null, // Ensure new submissions start as unvalidated (pending)
      classWinner: submissionData.classWinner || false,
      schoolWinner: submissionData.schoolWinner || false,
      countryWinner: submissionData.countryWinner || false,
      globalWinner: submissionData.globalWinner || false
    };
    this.submissions.set(id, submission);
    return submission;
  }

  async updateSubmission(id: number, submissionData: Partial<Submission>): Promise<Submission | undefined> {
    const submission = this.submissions.get(id);
    if (!submission) return undefined;
    
    const updatedSubmission = { ...submission, ...submissionData };
    this.submissions.set(id, updatedSubmission);
    return updatedSubmission;
  }
  
  async validateSubmission(id: number, validated: boolean): Promise<Submission | undefined> {
    const submission = this.submissions.get(id);
    if (!submission) return undefined;
    
    // Process validation value:
    // - true = approved
    // - false = rejected
    // Both are explicit statuses different from null (pending)
    const validationValue = validated === true ? true : false;
    
    const updatedSubmission = { ...submission, validated: validationValue };
    this.submissions.set(id, updatedSubmission);
    return updatedSubmission;
  }

  async deleteSubmission(id: number): Promise<boolean> {
    return this.submissions.delete(id);
  }

  // Vote methods
  async getVote(id: number): Promise<Vote | undefined> {
    return this.votes.get(id);
  }

  async getVotesBySubmission(submissionId: number): Promise<Vote[]> {
    return Array.from(this.votes.values()).filter(vote => vote.submissionId === submissionId);
  }

  async getVotesByVoter(voterId: number): Promise<Vote[]> {
    return Array.from(this.votes.values()).filter(vote => vote.voterId === voterId);
  }

  async hasUserVotedForSubmission(voterId: number, submissionId: number): Promise<boolean> {
    return Array.from(this.votes.values()).some(
      vote => vote.voterId === voterId && vote.submissionId === submissionId
    );
  }

  async createVote(voteData: InsertVote): Promise<Vote> {
    const id = this.voteCounter++;
    const vote: Vote = { ...voteData, id };
    this.votes.set(id, vote);
    return vote;
  }

  async deleteVote(id: number): Promise<boolean> {
    return this.votes.delete(id);
  }

  async getVoteCountForSubmission(submissionId: number): Promise<number> {
    return (await this.getVotesBySubmission(submissionId)).length;
  }
  
  // Secondary Teacher Assignment methods
  async getSecondaryTeacherAssignment(id: number): Promise<SecondaryTeacherAssignment | undefined> {
    return this.secondaryTeacherAssignments.get(id);
  }
  
  async getSecondaryTeacherAssignmentsByTeacher(teacherId: number): Promise<SecondaryTeacherAssignment[]> {
    return Array.from(this.secondaryTeacherAssignments.values())
      .filter(assignment => assignment.teacherId === teacherId);
  }
  
  async getSecondaryTeacherAssignmentsBySecondaryTeacher(secondaryTeacherId: number): Promise<SecondaryTeacherAssignment[]> {
    return Array.from(this.secondaryTeacherAssignments.values())
      .filter(assignment => assignment.secondaryTeacherId === secondaryTeacherId);
  }
  
  async getSecondaryTeacherAssignmentsByClass(classId: number): Promise<SecondaryTeacherAssignment[]> {
    return Array.from(this.secondaryTeacherAssignments.values())
      .filter(assignment => assignment.classId === classId);
  }
  
  async getClassesBySecondaryTeacher(secondaryTeacherId: number): Promise<Class[]> {
    // Get assignments where the user is a secondary teacher
    const assignments = Array.from(this.secondaryTeacherAssignments.values())
      .filter(assignment => assignment.secondaryTeacherId === secondaryTeacherId);
    
    // Extract class IDs from these assignments
    const classIds = assignments.map(assignment => assignment.classId);
    
    // Return all classes that match these IDs
    return Array.from(this.classes.values())
      .filter(cls => classIds.includes(cls.id));
  }
  
  async createSecondaryTeacherAssignment(assignmentData: InsertSecondaryTeacherAssignment): Promise<SecondaryTeacherAssignment> {
    const id = this.secondaryTeacherAssignmentCounter++;
    const assignment: SecondaryTeacherAssignment = { ...assignmentData, id };
    this.secondaryTeacherAssignments.set(id, assignment);
    return assignment;
  }
  
  async deleteSecondaryTeacherAssignment(id: number): Promise<boolean> {
    return this.secondaryTeacherAssignments.delete(id);
  }

  // Gallery Item methods
  async getGalleryItem(id: number): Promise<GalleryItem | undefined> {
    return this.galleryItems.get(id);
  }

  async getAllGalleryItems(): Promise<GalleryItem[]> {
    return Array.from(this.galleryItems.values());
  }

  async getGalleryItemsByType(type: 'poem' | 'image'): Promise<GalleryItem[]> {
    return Array.from(this.galleryItems.values()).filter(item => item.type === type);
  }

  async getGalleryItemsByCreator(createdBy: number): Promise<GalleryItem[]> {
    return Array.from(this.galleryItems.values()).filter(item => item.createdBy === createdBy);
  }

  async getFeaturedGalleryItems(): Promise<GalleryItem[]> {
    return Array.from(this.galleryItems.values()).filter(item => item.featured);
  }

  async createGalleryItem(galleryItemData: InsertGalleryItem): Promise<GalleryItem> {
    const id = this.galleryItemCounter++;
    const now = new Date();
    const galleryItem: GalleryItem = { 
      ...galleryItemData, 
      id,
      createdAt: galleryItemData.createdAt || now,
      updatedAt: galleryItemData.updatedAt || now
    };
    this.galleryItems.set(id, galleryItem);
    return galleryItem;
  }

  async updateGalleryItem(id: number, galleryItemData: Partial<GalleryItem>): Promise<GalleryItem | undefined> {
    const galleryItem = this.galleryItems.get(id);
    if (!galleryItem) return undefined;
    
    const updatedGalleryItem = { 
      ...galleryItem, 
      ...galleryItemData,
      updatedAt: new Date()
    };
    this.galleryItems.set(id, updatedGalleryItem);
    return updatedGalleryItem;
  }

  async deleteGalleryItem(id: number): Promise<boolean> {
    return this.galleryItems.delete(id);
  }

  // Refresh Token methods implementation
  async getRefreshToken(id: number): Promise<RefreshToken | undefined> {
    return this.refreshTokens.get(id);
  }

  async getRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    for (const token of this.refreshTokens.values()) {
      if (token.tokenHash === tokenHash && !token.isRevoked && new Date() < new Date(token.expiresAt)) {
        return token;
      }
    }
    return undefined;
  }

  async getActiveRefreshTokensByUser(userId: number): Promise<RefreshToken[]> {
    const tokens: RefreshToken[] = [];
    for (const token of this.refreshTokens.values()) {
      if (token.userId === userId && !token.isRevoked && new Date() < new Date(token.expiresAt)) {
        tokens.push(token);
      }
    }
    return tokens;
  }

  async createRefreshToken(refreshTokenData: InsertRefreshToken): Promise<RefreshToken> {
    const id = this.refreshTokenCounter++;
    const refreshToken: RefreshToken = {
      id,
      ...refreshTokenData,
      createdAt: new Date(),
      revokedAt: null,
    };
    this.refreshTokens.set(id, refreshToken);
    return refreshToken;
  }

  async revokeRefreshToken(id: number, reason?: string): Promise<boolean> {
    const token = this.refreshTokens.get(id);
    if (!token) return false;
    
    token.isRevoked = true;
    token.revokedAt = new Date();
    token.revokedReason = reason || 'manual_revocation';
    this.refreshTokens.set(id, token);
    return true;
  }

  async revokeAllUserRefreshTokens(userId: number, reason?: string): Promise<number> {
    let revokedCount = 0;
    for (const [id, token] of this.refreshTokens.entries()) {
      if (token.userId === userId && !token.isRevoked) {
        token.isRevoked = true;
        token.revokedAt = new Date();
        token.revokedReason = reason || 'user_logout';
        this.refreshTokens.set(id, token);
        revokedCount++;
      }
    }
    return revokedCount;
  }

  async cleanupExpiredRefreshTokens(): Promise<number> {
    let cleanedCount = 0;
    const now = new Date();
    for (const [id, token] of this.refreshTokens.entries()) {
      if (new Date(token.expiresAt) < now) {
        this.refreshTokens.delete(id);
        cleanedCount++;
      }
    }
    return cleanedCount;
  }
}

export const storage = new MemStorage();
