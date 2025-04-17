import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['student', 'teacher', 'secondaryTeacher', 'admin', 'schoolAdmin']);
export const eventTypeEnum = pgEnum('event_type', ['poetry', 'painting']);
export const eventStatusEnum = pgEnum('event_status', ['upcoming', 'open', 'closed']);
export const eventStageEnum = pgEnum('event_stage', ['class', 'school', 'country', 'global']);
export const eventModeEnum = pgEnum('event_mode', ['allowAI', 'noAI']);
export const galleryItemTypeEnum = pgEnum('gallery_item_type', ['poem', 'image']);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default('student'),
  schoolId: integer("school_id"),
  classId: integer("class_id"),
  gradeLevel: text("grade_level"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginDate: timestamp("last_login_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cities table
export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  country: text("country").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schools table
export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  cityId: integer("city_id").notNull(), // Reference to the cities table
  websiteUrl: text("website_url"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
});

// Classes table
export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  gradeLevel: text("grade_level").notNull(),
  schoolId: integer("school_id").notNull(),
  teacherId: integer("teacher_id").notNull(),
  isLocked: boolean("is_locked").notNull().default(false),
});

// Partners table
export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  websiteUrl: text("website_url"),
  imageUrl: text("image_url"),
  partnerType: text("partner_type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// Events table
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: eventTypeEnum("type").notNull(),
  status: eventStatusEnum("status").notNull().default('upcoming'),
  stage: eventStageEnum("stage").notNull().default('class'),
  mode: eventModeEnum("mode").notNull().default('allowAI'), // Default to allowing AI creation
  imageUrl: text("image_url"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Registrations table (for students registering to events)
export const registrations = pgTable("registrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventId: integer("event_id").notNull(),
  registeredAt: timestamp("registered_at").defaultNow(),
});

// Submissions table
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  contentType: text("content_type").notNull(), // 'text' or 'image'
  content: text("content").notNull(), // poem text or image URL
  userId: integer("user_id").notNull(),
  eventId: integer("event_id").notNull(),
  classId: integer("class_id"), // The class of the student making the submission
  submittedAt: timestamp("submitted_at").defaultNow(),
  validated: boolean("validated"), // Teacher validation for submissions (null means pending)
  classWinner: boolean("class_winner").default(false),
  schoolWinner: boolean("school_winner").default(false),
  countryWinner: boolean("country_winner").default(false),
  globalWinner: boolean("global_winner").default(false),
});

// Votes table
export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull(),
  voterId: integer("voter_id").notNull(),
  votedAt: timestamp("voted_at").defaultNow(),
});

// Secondary Teacher Assignments table
export const secondaryTeacherAssignments = pgTable("secondary_teacher_assignments", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull(), // Primary teacher who approved the assignment
  secondaryTeacherId: integer("secondary_teacher_id").notNull(), // Secondary teacher being assigned
  classId: integer("class_id").notNull(), // The class being assigned to the secondary teacher
  assignedAt: timestamp("assigned_at").defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
});

// Gallery Items table
export const galleryItems = pgTable("gallery_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: galleryItemTypeEnum("type").notNull(),
  content: text("content").notNull(), // For poems: text content, for images: base64 or URL
  createdBy: integer("created_by").notNull(), // Admin who created the gallery item
  featured: boolean("featured").default(false), // Whether to feature this item prominently
  orderIndex: integer("order_index").default(0), // For controlling display order
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  isActive: boolean("is_active").notNull().default(true),
});

// Insert schemas
// Validate password: min 8 chars, at least 1 uppercase, 1 number, 2 special chars
const passwordValidator = z.string()
  .min(8, "Password must be at least 8 characters")
  .refine(
    (password) => /[A-Z]/.test(password),
    "Password must contain at least one uppercase letter"
  )
  .refine(
    (password) => /[0-9]/.test(password),
    "Password must contain at least one number"
  )
  .refine(
    (password) => {
      const specialChars = password.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g);
      return specialChars !== null && specialChars.join('').length >= 2;
    },
    "Password must contain at least two special characters"
  );

export const insertUserSchema = createInsertSchema(users, {
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100, "Full name must be less than 100 characters"),
  email: z.string().email("Please enter a valid email address"),
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be less than 50 characters"),
  password: passwordValidator,
});

export const insertCitySchema = createInsertSchema(cities);
export const insertSchoolSchema = createInsertSchema(schools);
export const insertClassSchema = createInsertSchema(classes);
export const insertPartnerSchema = createInsertSchema(partners);
export const insertEventSchema = createInsertSchema(events, {
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str))
});
export const insertRegistrationSchema = createInsertSchema(registrations);
export const insertSubmissionSchema = createInsertSchema(submissions);
export const insertVoteSchema = createInsertSchema(votes);
export const insertSecondaryTeacherAssignmentSchema = createInsertSchema(secondaryTeacherAssignments);
export const insertGalleryItemSchema = createInsertSchema(galleryItems)
  .omit({ id: true }) // Remove the auto-incrementing ID
  .extend({
    updatedAt: z.date().optional(),
    createdBy: z.number(), // Required in database schema
    createdAt: z.date().optional().default(() => new Date())
  });

// Define relations
export const schoolsRelations = relations(schools, ({ one }) => ({
  city: one(cities, {
    fields: [schools.cityId],
    references: [cities.id]
  })
}));

export const citiesRelations = relations(cities, ({ many }) => ({
  schools: many(schools)
}));

export const galleryItemsRelations = relations(galleryItems, ({ one }) => ({
  creator: one(users, {
    fields: [galleryItems.createdBy],
    references: [users.id]
  })
}));

export const usersRelations = relations(users, ({ many }) => ({
  galleryItems: many(galleryItems)
}));

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type City = typeof cities.$inferSelect;
export type InsertCity = z.infer<typeof insertCitySchema>;

export type School = typeof schools.$inferSelect;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;

export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Registration = typeof registrations.$inferSelect;
export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;

export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;

export type SecondaryTeacherAssignment = typeof secondaryTeacherAssignments.$inferSelect;
export type InsertSecondaryTeacherAssignment = z.infer<typeof insertSecondaryTeacherAssignmentSchema>;

export type GalleryItem = typeof galleryItems.$inferSelect;
export type InsertGalleryItem = z.infer<typeof insertGalleryItemSchema>;
