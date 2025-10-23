import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from './db';
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
  refreshTokens, RefreshToken, InsertRefreshToken,
  auditLogs,
} from "@shared/schema";
import { IStorage } from './storage';

/**
 * CRITICAL FIX: Database-backed storage using Drizzle ORM
 * Replaces in-memory storage to ensure data persistence
 */
export class DatabaseStorage implements IStorage {
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUsersBySchool(schoolId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.schoolId, schoolId));
  }

  async getUsersByClass(classId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.classId, classId));
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role as any));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // City methods
  async getCity(id: number): Promise<City | undefined> {
    const result = await db.select().from(cities).where(eq(cities.id, id)).limit(1);
    return result[0];
  }

  async getCityByName(name: string): Promise<City | undefined> {
    const result = await db.select().from(cities).where(eq(cities.name, name)).limit(1);
    return result[0];
  }

  async getAllCities(): Promise<City[]> {
    return await db.select().from(cities);
  }

  async getActiveCities(): Promise<City[]> {
    return await db.select().from(cities).where(eq(cities.isActive, true));
  }

  async createCity(city: InsertCity): Promise<City> {
    const result = await db.insert(cities).values(city).returning();
    return result[0];
  }

  async updateCity(id: number, cityData: Partial<City>): Promise<City | undefined> {
    const result = await db.update(cities)
      .set(cityData)
      .where(eq(cities.id, id))
      .returning();
    return result[0];
  }

  async deleteCity(id: number): Promise<boolean> {
    const result = await db.delete(cities).where(eq(cities.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // School methods
  async getSchool(id: number): Promise<School | undefined> {
    const result = await db.select().from(schools).where(eq(schools.id, id)).limit(1);
    return result[0];
  }

  async getAllSchools(): Promise<School[]> {
    return await db.select().from(schools);
  }

  async getSchoolsByCity(cityId: number): Promise<School[]> {
    return await db.select().from(schools).where(eq(schools.cityId, cityId));
  }

  async createSchool(school: InsertSchool): Promise<School> {
    const result = await db.insert(schools).values(school).returning();
    return result[0];
  }

  async updateSchool(id: number, schoolData: Partial<School>): Promise<School | undefined> {
    const result = await db.update(schools)
      .set(schoolData)
      .where(eq(schools.id, id))
      .returning();
    return result[0];
  }

  async deleteSchool(id: number): Promise<boolean> {
    const result = await db.delete(schools).where(eq(schools.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Class methods
  async getClass(id: number): Promise<Class | undefined> {
    const result = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
    return result[0];
  }

  async getClassesBySchool(schoolId: number): Promise<Class[]> {
    return await db.select().from(classes).where(eq(classes.schoolId, schoolId));
  }

  async getClassesByTeacher(teacherId: number): Promise<Class[]> {
    return await db.select().from(classes).where(eq(classes.teacherId, teacherId));
  }

  async getAllClasses(): Promise<Class[]> {
    return await db.select().from(classes);
  }

  async createClass(classData: InsertClass): Promise<Class> {
    const result = await db.insert(classes).values(classData).returning();
    return result[0];
  }

  async updateClass(id: number, classData: Partial<Class>): Promise<Class | undefined> {
    const result = await db.update(classes)
      .set(classData)
      .where(eq(classes.id, id))
      .returning();
    return result[0];
  }

  async deleteClass(id: number): Promise<boolean> {
    const result = await db.delete(classes).where(eq(classes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Partner methods
  async getPartner(id: number): Promise<Partner | undefined> {
    const result = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
    return result[0];
  }

  async getAllPartners(): Promise<Partner[]> {
    return await db.select().from(partners);
  }

  async createPartner(partner: InsertPartner): Promise<Partner> {
    const result = await db.insert(partners).values(partner).returning();
    return result[0];
  }

  async updatePartner(id: number, partnerData: Partial<Partner>): Promise<Partner | undefined> {
    const result = await db.update(partners)
      .set(partnerData)
      .where(eq(partners.id, id))
      .returning();
    return result[0];
  }

  async deletePartner(id: number): Promise<boolean> {
    const result = await db.delete(partners).where(eq(partners.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Event methods
  async getEvent(id: number): Promise<Event | undefined> {
    const result = await db.select().from(events).where(eq(events.id, id)).limit(1);
    return result[0];
  }

  async getAllEvents(): Promise<Event[]> {
    return await db.select().from(events);
  }

  async getEventsByStatus(status: string): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.status, status as any));
  }

  async getEventsByType(type: string): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.type, type as any));
  }

  async getEventsByStage(stage: string): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.stage, stage as any));
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const result = await db.insert(events).values(event).returning();
    return result[0];
  }

  async updateEvent(id: number, eventData: Partial<Event>): Promise<Event | undefined> {
    const result = await db.update(events)
      .set(eventData)
      .where(eq(events.id, id))
      .returning();
    return result[0];
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Registration methods
  async getRegistration(id: number): Promise<Registration | undefined> {
    const result = await db.select().from(registrations).where(eq(registrations.id, id)).limit(1);
    return result[0];
  }

  async getRegistrationsByUser(userId: number): Promise<Registration[]> {
    return await db.select().from(registrations).where(eq(registrations.userId, userId));
  }

  async getRegistrationsByEvent(eventId: number): Promise<Registration[]> {
    return await db.select().from(registrations).where(eq(registrations.eventId, eventId));
  }

  async createRegistration(registration: InsertRegistration): Promise<Registration> {
    const result = await db.insert(registrations).values(registration).returning();
    return result[0];
  }

  async deleteRegistration(id: number): Promise<boolean> {
    const result = await db.delete(registrations).where(eq(registrations.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Submission methods
  async getSubmission(id: number): Promise<Submission | undefined> {
    const result = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
    return result[0];
  }

  async getSubmissionsByUser(userId: number): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.userId, userId));
  }

  async getSubmissionsByEvent(eventId: number): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.eventId, eventId));
  }

  async getSubmissionsByUserAndEvent(userId: number, eventId: number): Promise<Submission[]> {
    return await db.select().from(submissions)
      .where(and(
        eq(submissions.userId, userId),
        eq(submissions.eventId, eventId)
      ));
  }

  async getSubmissionsByClass(classId: number): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.classId, classId));
  }

  async getAllSubmissions(): Promise<Submission[]> {
    return await db.select().from(submissions);
  }

  async getSubmissionsPendingValidation(classId: number): Promise<Submission[]> {
    return await db.select().from(submissions)
      .where(and(
        eq(submissions.classId, classId),
        sql`${submissions.validated} IS NULL`
      ));
  }

  async getValidatedSubmissions(classId: number): Promise<Submission[]> {
    return await db.select().from(submissions)
      .where(and(
        eq(submissions.classId, classId),
        eq(submissions.validated, true)
      ));
  }

  async getRejectedSubmissions(classId: number): Promise<Submission[]> {
    return await db.select().from(submissions)
      .where(and(
        eq(submissions.classId, classId),
        eq(submissions.validated, false)
      ));
  }

  async getWinningSubmissions(winnerCategory: string): Promise<Submission[]> {
    const column = winnerCategory === 'class' ? submissions.classWinner :
                   winnerCategory === 'school' ? submissions.schoolWinner :
                   winnerCategory === 'country' ? submissions.countryWinner :
                   submissions.globalWinner;
    return await db.select().from(submissions).where(eq(column, true));
  }

  async createSubmission(submission: InsertSubmission): Promise<Submission> {
    const result = await db.insert(submissions).values(submission).returning();
    return result[0];
  }

  async updateSubmission(id: number, submissionData: Partial<Submission>): Promise<Submission | undefined> {
    const result = await db.update(submissions)
      .set(submissionData)
      .where(eq(submissions.id, id))
      .returning();
    return result[0];
  }

  async validateSubmission(id: number, validated: boolean): Promise<Submission | undefined> {
    const result = await db.update(submissions)
      .set({ validated })
      .where(eq(submissions.id, id))
      .returning();
    return result[0];
  }

  async deleteSubmission(id: number): Promise<boolean> {
    const result = await db.delete(submissions).where(eq(submissions.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Vote methods
  async getVote(id: number): Promise<Vote | undefined> {
    const result = await db.select().from(votes).where(eq(votes.id, id)).limit(1);
    return result[0];
  }

  async getVotesBySubmission(submissionId: number): Promise<Vote[]> {
    return await db.select().from(votes).where(eq(votes.submissionId, submissionId));
  }

  async getVotesByVoter(voterId: number): Promise<Vote[]> {
    return await db.select().from(votes).where(eq(votes.voterId, voterId));
  }

  async hasUserVotedForSubmission(voterId: number, submissionId: number): Promise<boolean> {
    const result = await db.select().from(votes)
      .where(and(
        eq(votes.voterId, voterId),
        eq(votes.submissionId, submissionId)
      ))
      .limit(1);
    return result.length > 0;
  }

  async createVote(vote: InsertVote): Promise<Vote> {
    const result = await db.insert(votes).values(vote).returning();
    return result[0];
  }

  async deleteVote(id: number): Promise<boolean> {
    const result = await db.delete(votes).where(eq(votes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getVoteCountForSubmission(submissionId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(votes)
      .where(eq(votes.submissionId, submissionId));
    return Number(result[0]?.count || 0);
  }

  // Secondary Teacher Assignment methods
  async getSecondaryTeacherAssignment(id: number): Promise<SecondaryTeacherAssignment | undefined> {
    const result = await db.select().from(secondaryTeacherAssignments)
      .where(eq(secondaryTeacherAssignments.id, id))
      .limit(1);
    return result[0];
  }

  async getSecondaryTeacherAssignmentsByTeacher(teacherId: number): Promise<SecondaryTeacherAssignment[]> {
    return await db.select().from(secondaryTeacherAssignments)
      .where(eq(secondaryTeacherAssignments.teacherId, teacherId));
  }

  async getSecondaryTeacherAssignmentsBySecondaryTeacher(secondaryTeacherId: number): Promise<SecondaryTeacherAssignment[]> {
    return await db.select().from(secondaryTeacherAssignments)
      .where(eq(secondaryTeacherAssignments.secondaryTeacherId, secondaryTeacherId));
  }

  async getSecondaryTeacherAssignmentsByClass(classId: number): Promise<SecondaryTeacherAssignment[]> {
    return await db.select().from(secondaryTeacherAssignments)
      .where(eq(secondaryTeacherAssignments.classId, classId));
  }

  async getClassesBySecondaryTeacher(secondaryTeacherId: number): Promise<Class[]> {
    const assignments = await this.getSecondaryTeacherAssignmentsBySecondaryTeacher(secondaryTeacherId);
    const classIds = assignments.map(a => a.classId);
    
    if (classIds.length === 0) return [];
    
    return await db.select().from(classes)
      .where(sql`${classes.id} IN (${sql.join(classIds.map(id => sql`${id}`), sql`, `)})`);
  }

  async createSecondaryTeacherAssignment(assignment: InsertSecondaryTeacherAssignment): Promise<SecondaryTeacherAssignment> {
    const result = await db.insert(secondaryTeacherAssignments).values(assignment).returning();
    return result[0];
  }

  async deleteSecondaryTeacherAssignment(id: number): Promise<boolean> {
    const result = await db.delete(secondaryTeacherAssignments)
      .where(eq(secondaryTeacherAssignments.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Gallery Item methods
  async getGalleryItem(id: number): Promise<GalleryItem | undefined> {
    const result = await db.select().from(galleryItems).where(eq(galleryItems.id, id)).limit(1);
    return result[0];
  }

  async getAllGalleryItems(): Promise<GalleryItem[]> {
    return await db.select().from(galleryItems).orderBy(desc(galleryItems.orderIndex));
  }

  async getGalleryItemsByType(type: 'poem' | 'image'): Promise<GalleryItem[]> {
    return await db.select().from(galleryItems)
      .where(eq(galleryItems.type, type))
      .orderBy(desc(galleryItems.orderIndex));
  }

  async getGalleryItemsByCreator(createdBy: number): Promise<GalleryItem[]> {
    return await db.select().from(galleryItems).where(eq(galleryItems.createdBy, createdBy));
  }

  async getFeaturedGalleryItems(): Promise<GalleryItem[]> {
    return await db.select().from(galleryItems)
      .where(eq(galleryItems.featured, true))
      .orderBy(desc(galleryItems.orderIndex));
  }

  async createGalleryItem(galleryItem: InsertGalleryItem): Promise<GalleryItem> {
    const result = await db.insert(galleryItems).values(galleryItem).returning();
    return result[0];
  }

  async updateGalleryItem(id: number, galleryItemData: Partial<GalleryItem>): Promise<GalleryItem | undefined> {
    const result = await db.update(galleryItems)
      .set({ ...galleryItemData, updatedAt: new Date() })
      .where(eq(galleryItems.id, id))
      .returning();
    return result[0];
  }

  async deleteGalleryItem(id: number): Promise<boolean> {
    const result = await db.delete(galleryItems).where(eq(galleryItems.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Refresh Token methods
  async getRefreshToken(id: number): Promise<RefreshToken | undefined> {
    const result = await db.select().from(refreshTokens).where(eq(refreshTokens.id, id)).limit(1);
    return result[0];
  }

  async getRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    const result = await db.select().from(refreshTokens)
      .where(and(
        eq(refreshTokens.tokenHash, tokenHash),
        eq(refreshTokens.isRevoked, false),
        sql`${refreshTokens.expiresAt} > NOW()`
      ))
      .limit(1);
    return result[0];
  }

  async getActiveRefreshTokensByUser(userId: number): Promise<RefreshToken[]> {
    return await db.select().from(refreshTokens)
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isRevoked, false),
        sql`${refreshTokens.expiresAt} > NOW()`
      ));
  }

  async createRefreshToken(refreshToken: InsertRefreshToken): Promise<RefreshToken> {
    const result = await db.insert(refreshTokens).values(refreshToken).returning();
    return result[0];
  }

  async revokeRefreshToken(id: number, reason?: string): Promise<boolean> {
    const result = await db.update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason || 'manual_revocation'
      })
      .where(eq(refreshTokens.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async revokeAllUserRefreshTokens(userId: number, reason?: string): Promise<number> {
    const result = await db.update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason || 'user_logout'
      })
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isRevoked, false)
      ));
    return result.rowCount || 0;
  }

  async cleanupExpiredRefreshTokens(): Promise<number> {
    const result = await db.delete(refreshTokens)
      .where(sql`${refreshTokens.expiresAt} < NOW()`);
    return result.rowCount || 0;
  }

  // Audit Log methods - CRITICAL FIX for compliance
  async createAuditLog(auditLog: any): Promise<void> {
    await db.insert(auditLogs).values({
      timestamp: auditLog.timestamp,
      userId: auditLog.userId,
      username: auditLog.username,
      userRole: auditLog.userRole,
      action: auditLog.action,
      resource: auditLog.resource,
      resourceId: auditLog.resourceId,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
      changesBefore: auditLog.changes?.before ? JSON.stringify(auditLog.changes.before) : null,
      changesAfter: auditLog.changes?.after ? JSON.stringify(auditLog.changes.after) : null,
      success: auditLog.success,
      errorMessage: auditLog.errorMessage,
      severity: auditLog.severity,
      sessionId: auditLog.sessionId,
      integrityHash: auditLog.integrityHash,
    });
  }
}
