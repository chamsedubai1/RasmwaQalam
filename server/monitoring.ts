// Monitoring service for tracking system performance and API usage stats
// Uses in-memory storage for fast access with periodic database persistence

import { db } from './db';
import { sql } from 'drizzle-orm';

// Error log - stores recent errors
export interface ErrorEntry {
  id?: number;
  timestamp: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  ip: string;
  userAgent?: string;
}

// Request statistics tracking
interface EndpointStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
}

interface RequestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  endpoints: Record<string, EndpointStats>;
}

// WebSocket statistics tracking
interface WebSocketStats {
  currentConnections: number;
  totalConnections: number;
  disconnections: number;
  messagesReceived: number;
  messagesSent: number;
  peakConcurrentConnections: number;
}

// Monitoring snapshot for database persistence
interface MonitoringSnapshot {
  id?: number;
  timestamp: Date;
  requestStats: string; // JSON serialized
  webSocketStats: string; // JSON serialized
  errorCount: number;
  lastErrorTimestamp?: string;
}

// Simple monitoring singleton with database persistence
class MonitoringService {
  private errorLog: ErrorEntry[] = [];
  private requestStats: RequestStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    endpoints: {}
  };

  // WebSocket statistics
  private webSocketStats: WebSocketStats = {
    currentConnections: 0,
    totalConnections: 0,
    disconnections: 0,
    messagesReceived: 0,
    messagesSent: 0,
    peakConcurrentConnections: 0
  };

  // Start time of the service
  private readonly startTime = Date.now();

  // Persistence configuration
  private readonly MAX_ERROR_LOG_SIZE = 100; // Keep more errors in memory
  private readonly PERSIST_INTERVAL_MS = 5 * 60 * 1000; // Persist every 5 minutes
  private persistenceTimer: ReturnType<typeof setInterval> | null = null;
  private isDbInitialized = false;

  constructor() {
    console.log('Monitoring service initialized');
    this.initializeDatabasePersistence();
  }

  // Initialize database persistence
  private async initializeDatabasePersistence(): Promise<void> {
    try {
      // Create monitoring tables if they don't exist
      await this.ensureTablesExist();
      this.isDbInitialized = true;

      // Load previous state from database
      await this.loadFromDatabase();

      // Start periodic persistence
      this.persistenceTimer = setInterval(() => {
        this.persistToDatabase().catch(err => {
          console.error('Failed to persist monitoring data:', err);
        });
      }, this.PERSIST_INTERVAL_MS);

      console.log('Monitoring database persistence initialized');
    } catch (error) {
      console.error('Failed to initialize monitoring persistence:', error);
      // Continue without persistence - the service will still work in-memory
    }
  }

  // Ensure monitoring tables exist
  private async ensureTablesExist(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS monitoring_errors (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
          endpoint TEXT NOT NULL,
          method TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          response_time FLOAT NOT NULL,
          ip TEXT NOT NULL,
          user_agent TEXT
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS monitoring_snapshots (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
          request_stats JSONB NOT NULL,
          websocket_stats JSONB NOT NULL,
          error_count INTEGER NOT NULL DEFAULT 0
        )
      `);

      // Create index for faster queries
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_monitoring_errors_timestamp
        ON monitoring_errors(timestamp DESC)
      `);
    } catch (error) {
      console.error('Failed to create monitoring tables:', error);
      throw error;
    }
  }

  // Load previous state from database on startup
  private async loadFromDatabase(): Promise<void> {
    try {
      // Load recent errors
      const errors = await db.execute<ErrorEntry>(sql`
        SELECT id, timestamp::text, endpoint, method,
               status_code as "statusCode", response_time as "responseTime",
               ip, user_agent as "userAgent"
        FROM monitoring_errors
        ORDER BY timestamp DESC
        LIMIT ${this.MAX_ERROR_LOG_SIZE}
      `);

      if (errors.rows && errors.rows.length > 0) {
        this.errorLog = errors.rows;
        console.log(`Loaded ${this.errorLog.length} errors from database`);
      }

      // Load the most recent snapshot
      const snapshots = await db.execute<{
        request_stats: string;
        websocket_stats: string;
      }>(sql`
        SELECT request_stats, websocket_stats
        FROM monitoring_snapshots
        ORDER BY timestamp DESC
        LIMIT 1
      `);

      if (snapshots.rows && snapshots.rows.length > 0) {
        const snapshot = snapshots.rows[0];
        try {
          const requestStats = typeof snapshot.request_stats === 'string'
            ? JSON.parse(snapshot.request_stats)
            : snapshot.request_stats;
          const wsStats = typeof snapshot.websocket_stats === 'string'
            ? JSON.parse(snapshot.websocket_stats)
            : snapshot.websocket_stats;

          // Merge with current stats, preserving current connections
          this.requestStats = {
            ...this.requestStats,
            ...requestStats,
            endpoints: { ...this.requestStats.endpoints, ...requestStats.endpoints }
          };

          // Don't restore WebSocket current connections (they're gone after restart)
          this.webSocketStats = {
            ...wsStats,
            currentConnections: 0 // Reset current connections
          };

          console.log('Loaded monitoring snapshot from database');
        } catch (parseError) {
          console.error('Failed to parse monitoring snapshot:', parseError);
        }
      }
    } catch (error) {
      console.error('Failed to load monitoring data from database:', error);
    }
  }

  // Persist current state to database
  private async persistToDatabase(): Promise<void> {
    if (!this.isDbInitialized) return;

    try {
      // Save a snapshot of current stats
      await db.execute(sql`
        INSERT INTO monitoring_snapshots (request_stats, websocket_stats, error_count)
        VALUES (
          ${JSON.stringify(this.requestStats)}::jsonb,
          ${JSON.stringify(this.webSocketStats)}::jsonb,
          ${this.errorLog.length}
        )
      `);

      // Clean up old snapshots (keep last 24 hours)
      await db.execute(sql`
        DELETE FROM monitoring_snapshots
        WHERE timestamp < NOW() - INTERVAL '24 hours'
      `);

      // Clean up old errors (keep last 7 days)
      await db.execute(sql`
        DELETE FROM monitoring_errors
        WHERE timestamp < NOW() - INTERVAL '7 days'
      `);

      console.log('Monitoring data persisted to database');
    } catch (error) {
      console.error('Failed to persist monitoring data:', error);
    }
  }

  // Get system information
  getSystemInfo() {
    return {
      uptime: process.uptime(),
      serverUptime: (Date.now() - this.startTime) / 1000,
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        total: process.memoryUsage().heapTotal / 1024 / 1024,
        used: process.memoryUsage().heapUsed / 1024 / 1024,
        rss: process.memoryUsage().rss / 1024 / 1024,
      },
      cpuUsage: process.cpuUsage(),
    };
  }

  // Add a new error entry
  addErrorEntry(entry: ErrorEntry): void {
    this.errorLog.unshift(entry);

    // Keep only the most recent entries in memory
    if (this.errorLog.length > this.MAX_ERROR_LOG_SIZE) {
      this.errorLog.pop();
    }

    // Persist error to database asynchronously
    if (this.isDbInitialized) {
      this.persistErrorToDatabase(entry).catch(err => {
        console.error('Failed to persist error entry:', err);
      });
    }
  }

  // Persist a single error to database
  private async persistErrorToDatabase(entry: ErrorEntry): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO monitoring_errors (timestamp, endpoint, method, status_code, response_time, ip, user_agent)
        VALUES (${entry.timestamp}::timestamp, ${entry.endpoint}, ${entry.method},
                ${entry.statusCode}, ${entry.responseTime}, ${entry.ip}, ${entry.userAgent || null})
      `);
    } catch (error) {
      console.error('Failed to persist error to database:', error);
    }
  }

  // Track request start
  trackRequestStart(path: string): void {
    this.requestStats.totalRequests++;

    // Initialize endpoint stats if needed
    if (!this.requestStats.endpoints[path]) {
      this.requestStats.endpoints[path] = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0
      };
    }

    this.requestStats.endpoints[path].totalRequests++;
  }

  // Track request completion
  trackRequestEnd(path: string, statusCode: number, responseTime: number): void {
    // Update global stats based on status code
    if (statusCode >= 200 && statusCode < 400) {
      this.requestStats.successfulRequests++;
      this.requestStats.endpoints[path].successfulRequests++;
    } else {
      this.requestStats.failedRequests++;
      this.requestStats.endpoints[path].failedRequests++;
    }

    // Update average response times
    const globalTotalResponseTime = this.requestStats.averageResponseTime *
      (this.requestStats.totalRequests - 1) + responseTime;
    this.requestStats.averageResponseTime = globalTotalResponseTime / this.requestStats.totalRequests;

    const endpointTotalResponseTime = this.requestStats.endpoints[path].averageResponseTime *
      (this.requestStats.endpoints[path].totalRequests - 1) + responseTime;
    this.requestStats.endpoints[path].averageResponseTime =
      endpointTotalResponseTime / this.requestStats.endpoints[path].totalRequests;
  }

  // Get error log
  getErrorLog(): ErrorEntry[] {
    return this.errorLog;
  }

  // Get request statistics
  getRequestStats(): RequestStats {
    return this.requestStats;
  }

  // Get WebSocket statistics
  getWebSocketStats(): WebSocketStats {
    return this.webSocketStats;
  }

  // Track WebSocket connection
  trackWebSocketConnection(): void {
    this.webSocketStats.currentConnections++;
    this.webSocketStats.totalConnections++;

    // Update peak concurrent connections if needed
    if (this.webSocketStats.currentConnections > this.webSocketStats.peakConcurrentConnections) {
      this.webSocketStats.peakConcurrentConnections = this.webSocketStats.currentConnections;
    }
  }

  // Track WebSocket disconnection
  trackWebSocketDisconnection(): void {
    this.webSocketStats.currentConnections = Math.max(0, this.webSocketStats.currentConnections - 1);
    this.webSocketStats.disconnections++;
  }

  // Track WebSocket message received
  trackWebSocketMessageReceived(): void {
    this.webSocketStats.messagesReceived++;
  }

  // Track WebSocket message sent
  trackWebSocketMessageSent(): void {
    this.webSocketStats.messagesSent++;
  }

  // Reset statistics (for testing or maintenance)
  resetStats(): void {
    this.errorLog = [];
    this.requestStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      endpoints: {}
    };

    this.webSocketStats = {
      currentConnections: 0,
      totalConnections: 0,
      disconnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      peakConcurrentConnections: 0
    };
  }

  // Graceful shutdown - persist data before exit
  async shutdown(): Promise<void> {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }

    if (this.isDbInitialized) {
      await this.persistToDatabase();
      console.log('Monitoring data persisted on shutdown');
    }
  }
}

// Create and export singleton instance
export const monitoring = new MonitoringService();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await monitoring.shutdown();
});

process.on('SIGINT', async () => {
  await monitoring.shutdown();
});
