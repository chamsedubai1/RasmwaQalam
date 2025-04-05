// Monitoring service for tracking system performance and API usage stats

// Error log - stores recent errors
interface ErrorEntry {
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

// Simple monitoring singleton
class MonitoringService {
  private errorLog: ErrorEntry[] = [];
  private requestStats: RequestStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    endpoints: {}
  };

  // Start time of the service
  private readonly startTime = Date.now();

  constructor() {
    console.log('Monitoring service initialized');
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
    
    // Keep only the most recent 20 errors
    if (this.errorLog.length > 20) {
      this.errorLog.pop();
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
  }
}

// Create and export singleton instance
export const monitoring = new MonitoringService();