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
export const auditSeverityEnum = pgEnum('audit_severity', ['INFO', 'WARNING', 'ERROR', 'CRITICAL']);

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
  // SECURITY: Bumped on every password change. JWT access tokens carry the
  // value at the time of issue; tokens whose pwdAt is older than the user's
  // current passwordChangedAt are rejected, so a password reset invalidates
  // outstanding access tokens (not just refresh tokens).
  passwordChangedAt: timestamp("password_changed_at"),
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
// SECURITY: uniqueIndex prevents race condition allowing duplicate votes
export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull(),
  voterId: integer("voter_id").notNull(),
  votedAt: timestamp("voted_at").defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate votes (same voter on same submission)
  uniqueVote: {
    name: "unique_voter_submission",
    columns: [table.submissionId, table.voterId],
    unique: true,
  },
}));

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

// Audit Logs table - SECURITY ENHANCEMENT for compliance and forensics
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  userId: integer("user_id").notNull(), // User who performed the action (0 for system/anonymous)
  username: text("username").notNull(),
  userRole: text("user_role").notNull(),
  action: text("action").notNull(), // AuditAction enum value
  resource: text("resource").notNull(), // Resource type (e.g., 'user', 'school', 'event')
  resourceId: text("resource_id"), // ID of the affected resource
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  changesBefore: text("changes_before"), // JSON string of previous state
  changesAfter: text("changes_after"), // JSON string of new state
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
  severity: auditSeverityEnum("severity").notNull().default('INFO'),
  sessionId: text("session_id"),
  integrityHash: text("integrity_hash").notNull(), // HMAC for tamper detection
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

export const insertCitySchema = createInsertSchema(cities, {
  name: z.string().min(1, "City name is required").max(100, "City name must be less than 100 characters"),
  country: z.string().min(1, "Country is required").max(100, "Country must be less than 100 characters"),
});

export const insertSchoolSchema = createInsertSchema(schools, {
  name: z.string().min(2, "School name must be at least 2 characters").max(200, "School name must be less than 200 characters"),
  description: z.string().max(2000, "Description must be less than 2000 characters").optional(),
  websiteUrl: z.string().url("Please enter a valid URL").max(500, "URL must be less than 500 characters").optional().or(z.literal("")),
});

export const insertClassSchema = createInsertSchema(classes, {
  name: z.string().min(1, "Class name is required").max(100, "Class name must be less than 100 characters"),
  gradeLevel: z.string().min(1, "Grade level is required").max(50, "Grade level must be less than 50 characters"),
});

export const insertPartnerSchema = createInsertSchema(partners, {
  name: z.string().min(2, "Partner name must be at least 2 characters").max(200, "Partner name must be less than 200 characters"),
  description: z.string().max(2000, "Description must be less than 2000 characters").optional(),
  websiteUrl: z.string().url("Please enter a valid URL").max(500, "URL must be less than 500 characters").optional().or(z.literal("")),
  partnerType: z.string().max(100, "Partner type must be less than 100 characters").optional(),
});

export const insertEventSchema = createInsertSchema(events, {
  name: z.string().min(3, "Event name must be at least 3 characters").max(200, "Event name must be less than 200 characters"),
  description: z.string().max(5000, "Description must be less than 5000 characters").optional(),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str))
});

export const insertRegistrationSchema = createInsertSchema(registrations);

export const insertSubmissionSchema = createInsertSchema(submissions, {
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().max(2000, "Description must be less than 2000 characters").optional(),
  content: z.string().max(50000, "Content must be less than 50000 characters"), // Allow for poems/descriptions
});
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

// Refresh Tokens table - for secure token rotation and invalidation
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(), // Hashed version of the token
  userId: integer("user_id").notNull(), // Foreign key to users table
  expiresAt: timestamp("expires_at").notNull(),
  isRevoked: boolean("is_revoked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"), // 'logout', 'security', 'rotation', etc.
});

// Password Reset Tokens table - SECURITY: For secure password reset flow
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(), // Hashed version of the token (never store plaintext)
  userId: integer("user_id").notNull(), // Foreign key to users table
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  usedAt: timestamp("used_at"),
  ipAddress: text("ip_address"), // Track IP for security monitoring
});

// Create insert schema for refresh tokens
export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
});

// Create insert schema for password reset tokens
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

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

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
