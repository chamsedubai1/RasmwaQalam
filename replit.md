# RASM wa QALAM - AI-Powered Art Competition Platform

## Overview

RASM wa QALAM is a comprehensive educational platform that enables students to participate in AI-powered art competitions. The platform supports both poetry and painting challenges where students can create artwork using AI tools and compete with peers across different organizational levels (class, school, country, global). Built with modern web technologies, it features a full-stack architecture with real-time capabilities, multi-language support (English/Arabic), and role-based access control for students, teachers, school administrators, and system administrators.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript for type safety and modern development patterns
- **Styling**: Tailwind CSS with custom design system featuring gradients, animations, and responsive layouts
- **UI Components**: Radix UI component library providing accessible, customizable components
- **State Management**: React Query (TanStack Query) for server state management with optimistic updates and caching
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized production builds
- **Internationalization**: Custom language context supporting English and Arabic with RTL layout support

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript throughout the application for consistency and type safety
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Real-time Communication**: WebSocket server for live updates and notifications
- **Authentication**: Session-based authentication with secure password hashing using scrypt
- **File Upload**: Multer middleware for handling image uploads with validation
- **API Structure**: RESTful API design with consistent error handling and validation

### Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon for scalability and reliability
- **ORM**: Drizzle with code-first schema definition ensuring type safety
- **File Storage**: Local file system for uploaded images with plans for cloud storage integration
- **Session Storage**: Express sessions for user authentication state
- **Caching**: Redis integration prepared for performance optimization

### Authentication and Authorization
- **Password Security**: Scrypt-based password hashing with unique salts and timing-safe comparisons
- **JWT Authentication**: Secure token-based authentication with httpOnly cookies (XSS-safe)
- **Token Rotation**: Automatic refresh token rotation with database-backed revocation support
- **Session Timeout**: 30-minute idle timeout with automatic cleanup for inactive users
- **Rate Limiting**: Tiered rate limiting protecting login, registration, and API endpoints
- **Role-based Access**: Four-tier user system (student, teacher, schoolAdmin, admin) with granular permissions
- **CAPTCHA Protection**: Custom SVG CAPTCHA system preventing automated registrations
- **CSRF Protection**: Double-submit cookie pattern protecting all state-changing requests
- **WebSocket Authentication**: Cookie-based token verification for real-time connections

### AI Integration Architecture
- **Multi-Provider Support**: Flexible AI service architecture supporting Claude (Anthropic), OpenAI, Hugging Face, and Stability AI
- **Fallback System**: Graceful degradation when primary AI services are unavailable
- **Content Generation**: Separate endpoints for poem and image generation with style customization
- **Queue System**: Bull queue implementation for managing AI processing workloads and preventing API quota exhaustion

### Security Architecture (Enterprise-Grade)
- **HTTP-Only Cookies**: JWT tokens stored in httpOnly cookies to prevent XSS attacks
- **CSRF Protection**: Double-submit cookie pattern with timing-safe token validation
- **Content Security Policy**: Strict CSP in production (no unsafe-inline/unsafe-eval)
- **Security Headers**: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- **CORS Lockdown**: Strict origin allowlist with credentials and custom header support
- **Input Validation**: Global Zod validation middleware preventing injection attacks
- **File Upload Security**: Magic byte verification, MIME type validation, strict allowlists
- **Signed URLs**: HMAC-signed URLs for file downloads with expiration and access control
- **Audit Logging**: Tamper-proof audit logs with HMAC integrity hashes for all administrative actions
- **Error Sanitization**: Production error responses sanitized to prevent information disclosure
- **Secrets Management**: HashiCorp Vault integration for FERPA-compliant secrets management with audit trails and automatic rotation

### FERPA Compliance (Secrets Management)
- **HashiCorp Vault Integration**: Production-grade secrets management meeting FERPA 2025 requirements
- **Audit Trail**: Complete tracking of all secret access with timestamp, accessor, and success/failure logging
- **Encryption at Rest**: All secrets encrypted in Vault storage backend
- **Secret Rotation**: Zero-downtime secret rotation capabilities with versioning
- **Access Control**: Fine-grained AppRole-based policies controlling secret access
- **Token Management**: Automatic token renewal with consecutive failure alerting and recovery
- **Hybrid Deployment**: Vault-first architecture with graceful fallback to environment variables for development
- **Operational Monitoring**: Comprehensive runbooks for incident response and routine maintenance

### Monitoring and Performance
- **Request Tracking**: Comprehensive monitoring service tracking API performance, error rates, and system health
- **WebSocket Analytics**: Real-time connection monitoring with message tracking and performance metrics
- **Error Handling**: Centralized error logging with detailed context for debugging
- **Security Monitoring**: Login attempt tracking and rate limit violation logging
- **Audit Trail**: Complete audit log database with tamper-proof integrity verification for compliance

### Competition System Design
- **Multi-stage Voting**: Hierarchical competition structure (class → school → country → global stages)
- **Submission Management**: Students can submit up to 3 entries per event with content validation
- **Voting System**: Peer voting mechanism with restrictions preventing self-voting
- **Stage Progression**: Automated promotion of winning submissions between competition levels
- **Gallery System**: Curated display of winning artworks with categorization and filtering

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Cloud-hosted PostgreSQL database providing serverless scaling and built-in connection pooling
- **Redis**: Planned integration for caching, session storage, and queue management

### AI Service Providers
- **Anthropic Claude**: Primary text generation service for poetry creation with latest Claude-3.7-Sonnet model
- **OpenAI GPT-4**: Secondary text generation option with DALL-E integration for image generation
- **Hugging Face**: Open-source AI models providing fallback text generation capabilities
- **Stability AI**: Professional image generation service using Stable Diffusion models

### Development and Deployment
- **Replit**: Primary development and hosting environment with integrated tooling
- **Vite**: Modern build tool providing fast development server and optimized production builds
- **ESBuild**: High-performance JavaScript bundler for server-side code compilation

### Security and Monitoring
- **HashiCorp Vault**: Enterprise secrets management with AppRole authentication and audit logging
- **Express Rate Limit**: API protection against abuse and automated attacks
- **WebSocket (ws)**: Real-time communication library for live updates and notifications
- **Multer**: File upload middleware with validation and security features

### Third-party Libraries
- **Drizzle Kit**: Database migration and schema management tools
- **Zod**: Runtime type validation ensuring data integrity
- **Papa Parse**: CSV parsing for bulk data import functionality
- **Bull**: Redis-based queue system for background job processing
- **XLSX**: Excel file processing for administrative data management