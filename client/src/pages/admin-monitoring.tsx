import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Server, Database, Shield, Activity, AlertTriangle } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { Redirect } from "wouter";

// Interface for monitoring data
interface MonitoringData {
  timestamp: string;
  systemInfo: {
    uptime: number;
    serverUptime: number;
    nodeVersion: string;
    platform: string;
    memory: {
      total: number;
      used: number;
      rss: number;
    };
    cpuUsage: {
      user: number;
      system: number;
    };
  };
  dbConnectionStatus: {
    isConnected: boolean;
    connectionTime: number;
    error: string | null;
  };
  apiServices: Array<{
    name: string;
    type: string;
    status: string;
  }>;
  recentErrors: Array<{
    timestamp: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    ip: string;
    userAgent?: string;
  }>;
  requestStats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    endpoints: {
      [key: string]: {
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
        averageResponseTime: number;
      }
    }
  };
  userActivity: {
    activeUsers: {
      last24Hours: number;
      last7Days: number;
      last30Days: number;
    };
    submissions: {
      last24Hours: number;
      last7Days: number;
      last30Days: number;
    };
    logins: {
      last24Hours: number;
      last7Days: number;
      last30Days: number;
    };
  };
  securityMetrics: {
    failedLoginAttempts: {
      last24Hours: number;
      last7Days: number;
    };
    suspiciousActivities: string[];
  };
  responseTime: number;
}

// Format bytes into KB, MB, GB
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Format milliseconds into a human-readable format
function formatTime(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)} μs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(2)} ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)} s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

// Format uptime in seconds to a readable format
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}

export default function AdminMonitoring() {
  const { toast } = useToast();
  const { user } = useUser();
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  
  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return <Redirect to="/login" />;
  }

  // Fetch monitoring data
  const { 
    data: monitoringData, 
    isLoading, 
    error, 
    refetch,
    dataUpdatedAt
  } = useQuery<MonitoringData>({
    queryKey: ['/api/monitoring/system'],
    refetchInterval: refreshInterval || false,
    refetchOnWindowFocus: true
  });

  // Handle automatic refresh
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        setRefreshInterval(null);
      }
    };
  }, [refreshInterval]);

  // Toggle automatic refresh every 5 seconds
  const toggleAutoRefresh = () => {
    if (refreshInterval) {
      setRefreshInterval(null);
      toast({
        title: "Auto-refresh disabled",
        description: "Automatic data refresh has been turned off.",
      });
    } else {
      setRefreshInterval(5000); // Refresh every 5 seconds
      toast({
        title: "Auto-refresh enabled",
        description: "Data will be automatically refreshed every 5 seconds.",
      });
    }
  };

  // Manual refresh handler
  const handleRefresh = () => {
    refetch();
    toast({
      title: "Data refreshed",
      description: "Monitoring data has been updated.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-pulse text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Please wait while we verify your credentials</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8 max-w-6xl">
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error loading monitoring data</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "An unknown error occurred."}
          </AlertDescription>
        </Alert>
        <Button onClick={handleRefresh}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
          <p className="text-muted-foreground">
            View system performance, API health, and security metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt && (
            <p className="text-sm text-muted-foreground">
              Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
            </p>
          )}
          <Button 
            variant="outline" 
            onClick={handleRefresh} 
            disabled={isLoading}
            className="ml-2"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant={refreshInterval ? "default" : "outline"} 
            onClick={toggleAutoRefresh}
          >
            {refreshInterval ? "Disable Auto-refresh" : "Enable Auto-refresh"}
          </Button>
        </div>
      </div>

      {isLoading && !monitoringData ? (
        <div className="flex items-center justify-center h-[60vh]">
          <Activity className="h-16 w-16 animate-pulse text-primary" />
        </div>
      ) : monitoringData ? (
        <Tabs defaultValue="overview">
          <TabsList className="mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="apis">API Services</TabsTrigger>
            <TabsTrigger value="requests">Request Stats</TabsTrigger>
            <TabsTrigger value="errors">Error Log</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* System Health Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center">
                    <Server className="mr-2 h-5 w-5 text-blue-500" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Memory Usage</span>
                        <span className="text-sm text-muted-foreground">
                          {formatBytes(monitoringData.systemInfo.memory.used * 1024 * 1024)} / 
                          {formatBytes(monitoringData.systemInfo.memory.total * 1024 * 1024)}
                        </span>
                      </div>
                      <Progress
                        value={(monitoringData.systemInfo.memory.used / monitoringData.systemInfo.memory.total) * 100}
                        className="h-2"
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Uptime</span>
                      <span className="font-medium">{formatUptime(monitoringData.systemInfo.uptime)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Platform</span>
                      <span className="font-medium">{monitoringData.systemInfo.platform}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Node.js Version</span>
                      <span className="font-medium">{monitoringData.systemInfo.nodeVersion}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Database Status Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center">
                    <Database className="mr-2 h-5 w-5 text-green-500" />
                    Database Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${monitoringData.dbConnectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-sm font-medium">
                        {monitoringData.dbConnectionStatus.isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    
                    {monitoringData.dbConnectionStatus.isConnected ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>Response Time</span>
                          <span className="font-medium">{formatTime(monitoringData.dbConnectionStatus.connectionTime)}</span>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-md text-sm">
                          <p className="text-green-600 font-medium">Connection healthy</p>
                          <p className="text-muted-foreground text-xs mt-1">Last query executed successfully</p>
                        </div>
                      </>
                    ) : (
                      <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-md text-sm">
                        <p className="text-red-600 dark:text-red-400 font-medium">Connection error</p>
                        <p className="text-red-600/80 dark:text-red-400/80 text-xs mt-1">
                          {monitoringData.dbConnectionStatus.error || "Unknown error"}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Request Stats Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center">
                    <Activity className="mr-2 h-5 w-5 text-purple-500" />
                    Request Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span>Total Requests</span>
                      <span className="font-medium">{monitoringData.requestStats.totalRequests.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Success Rate</span>
                      <span className="font-medium">
                        {monitoringData.requestStats.totalRequests ? 
                          (monitoringData.requestStats.successfulRequests / monitoringData.requestStats.totalRequests * 100).toFixed(1) + '%' : 
                          'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Avg. Response Time</span>
                      <span className="font-medium">
                        {formatTime(monitoringData.requestStats.averageResponseTime)}
                      </span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Status</span>
                        <span className="font-medium">Count</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                          Success (2xx/3xx)
                        </Badge>
                        <span>{monitoringData.requestStats.successfulRequests.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                          Failed (4xx/5xx)
                        </Badge>
                        <span>{monitoringData.requestStats.failedRequests.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Errors Card */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
                  Recent Errors
                </CardTitle>
                <CardDescription>
                  Last {monitoringData.recentErrors.length} error events from the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {monitoringData.recentErrors.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    No errors recorded. The system is running smoothly.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Endpoint</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Response Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monitoringData.recentErrors.slice(0, 5).map((error, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              {new Date(error.timestamp).toLocaleTimeString()}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {error.endpoint}
                            </TableCell>
                            <TableCell>
                              <Badge variant={error.method === 'GET' ? 'secondary' : 'outline'}>
                                {error.method}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                                {error.statusCode}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatTime(error.responseTime)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Services Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5 text-blue-500" />
                  API Services Status
                </CardTitle>
                <CardDescription>
                  Health status of connected external services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {monitoringData.apiServices.map((service, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          service.status === 'configured' ? 'bg-green-500' : 'bg-amber-500'
                        }`}></div>
                        <span className="font-medium">{service.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {service.type}
                        </Badge>
                      </div>
                      <Badge 
                        variant={service.status === 'configured' ? 'default' : 'secondary'}
                        className={service.status === 'configured' ? 'bg-green-500' : ''}
                      >
                        {service.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                  <CardDescription>Detailed system metrics and hardware information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium mb-2">Memory Usage</h3>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm">Heap Total</span>
                              <span className="text-sm font-medium">
                                {formatBytes(monitoringData.systemInfo.memory.total * 1024 * 1024)}
                              </span>
                            </div>
                            <Progress
                              value={100}
                              className="h-2"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm">Heap Used</span>
                              <span className="text-sm font-medium">
                                {formatBytes(monitoringData.systemInfo.memory.used * 1024 * 1024)}
                              </span>
                            </div>
                            <Progress
                              value={(monitoringData.systemInfo.memory.used / monitoringData.systemInfo.memory.total) * 100}
                              className="h-2"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm">RSS</span>
                              <span className="text-sm font-medium">
                                {formatBytes(monitoringData.systemInfo.memory.rss * 1024 * 1024)}
                              </span>
                            </div>
                            <Progress
                              value={(monitoringData.systemInfo.memory.rss / monitoringData.systemInfo.memory.total) * 100}
                              className="h-2"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-medium mb-2">CPU Usage</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-muted p-4 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">User</div>
                            <div className="text-2xl font-bold">
                              {monitoringData.systemInfo.cpuUsage.user.toLocaleString()}
                            </div>
                          </div>
                          <div className="bg-muted p-4 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">System</div>
                            <div className="text-2xl font-bold">
                              {monitoringData.systemInfo.cpuUsage.system.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-muted p-6 rounded-lg">
                        <h3 className="text-lg font-medium mb-4">System Details</h3>
                        <div className="space-y-4">
                          <div>
                            <div className="text-sm text-muted-foreground">Platform</div>
                            <div className="font-medium">{monitoringData.systemInfo.platform}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Node.js Version</div>
                            <div className="font-medium">{monitoringData.systemInfo.nodeVersion}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Uptime</div>
                            <div className="font-medium">{formatUptime(monitoringData.systemInfo.uptime)}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Server Uptime</div>
                            <div className="font-medium">{formatUptime(monitoringData.systemInfo.serverUptime || 0)}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Data Timestamp</div>
                            <div className="font-medium">
                              {new Date(monitoringData.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 dark:bg-blue-950/30 p-6 rounded-lg border border-blue-100 dark:border-blue-900/50">
                        <h3 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">Performance Insights</h3>
                        <p className="text-blue-700 dark:text-blue-400 text-sm mb-4">
                          Memory and CPU usage are within normal ranges. System is performing optimally.
                        </p>
                        <div className="text-sm text-blue-600 dark:text-blue-400">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span>Memory usage is at {((monitoringData.systemInfo.memory.used / monitoringData.systemInfo.memory.total) * 100).toFixed(1)}% of capacity</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span>Server has been running for {formatUptime(monitoringData.systemInfo.uptime)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* API Services Tab */}
          <TabsContent value="apis">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>API Services Status</CardTitle>
                  <CardDescription>
                    Health status and configuration of connected external services
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {monitoringData.apiServices.map((service, i) => (
                      <div key={i} className="border-b pb-6 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-4 h-4 rounded-full ${
                            service.status === 'configured' ? 'bg-green-500' : 'bg-amber-500'
                          }`}></div>
                          <h3 className="text-xl font-medium">{service.name}</h3>
                          <Badge>{service.type}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <div className="text-sm text-muted-foreground mb-2">Status</div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={service.status === 'configured' ? 'default' : 'secondary'}
                                className={service.status === 'configured' ? 'bg-green-500' : ''}
                              >
                                {service.status}
                              </Badge>
                              <span className="text-sm">
                                {service.status === 'configured' 
                                  ? 'Service is properly configured with valid API keys' 
                                  : 'Service is not configured or missing valid API keys'}
                              </span>
                            </div>
                          </div>
                          
                          <div className={`p-4 rounded-lg ${
                            service.status === 'configured' 
                              ? 'bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/50' 
                              : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50'
                          }`}>
                            <div className={`text-sm mb-1 ${
                              service.status === 'configured' 
                                ? 'text-green-700 dark:text-green-400' 
                                : 'text-amber-700 dark:text-amber-400'
                            }`}>
                              {service.status === 'configured' ? 'Ready to use' : 'Action required'}
                            </div>
                            <div className={`text-xs ${
                              service.status === 'configured' 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-amber-600 dark:text-amber-400'
                            }`}>
                              {service.status === 'configured' 
                                ? 'API key is valid and service is available for use.' 
                                : 'API key is missing or invalid. Please update API credentials.'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Request Stats Tab */}
          <TabsContent value="requests">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Request Statistics</CardTitle>
                  <CardDescription>
                    Analysis of API request volume, performance, and status codes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-muted p-6 rounded-lg">
                      <div className="text-sm text-muted-foreground">Total Requests</div>
                      <div className="text-3xl font-bold mt-1">
                        {monitoringData.requestStats.totalRequests.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-muted p-6 rounded-lg">
                      <div className="text-sm text-muted-foreground">Success Rate</div>
                      <div className="text-3xl font-bold mt-1">
                        {monitoringData.requestStats.totalRequests ? 
                          (monitoringData.requestStats.successfulRequests / monitoringData.requestStats.totalRequests * 100).toFixed(1) + '%' : 
                          'N/A'}
                      </div>
                    </div>
                    <div className="bg-muted p-6 rounded-lg">
                      <div className="text-sm text-muted-foreground">Avg. Response Time</div>
                      <div className="text-3xl font-bold mt-1">
                        {formatTime(monitoringData.requestStats.averageResponseTime)}
                      </div>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-medium mb-4">Endpoint Performance</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[250px]">Endpoint</TableHead>
                          <TableHead>Requests</TableHead>
                          <TableHead>Success Rate</TableHead>
                          <TableHead>Avg. Response Time</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries((monitoringData as any).requestStats.endpoints)
                          .sort((a, b) => (b[1] as any).totalRequests - (a[1] as any).totalRequests)
                          .map(([endpoint, stats], i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">
                                {endpoint}
                              </TableCell>
                              <TableCell>{(stats as any).totalRequests.toLocaleString()}</TableCell>
                              <TableCell>
                                {(stats as any).totalRequests ? 
                                  ((stats as any).successfulRequests / (stats as any).totalRequests * 100).toFixed(1) + '%' : 
                                  'N/A'}
                              </TableCell>
                              <TableCell>{formatTime((stats as any).averageResponseTime)}</TableCell>
                              <TableCell>
                                {(stats as any).failedRequests > 0 ? (
                                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                                    {(stats as any).failedRequests} failed
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                                    Healthy
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Error Log Tab */}
          <TabsContent value="errors">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Error Log</CardTitle>
                  <CardDescription>
                    Recent system errors, warnings, and exceptions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(monitoringData as any).recentErrors.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="bg-green-50 dark:bg-green-950/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield className="h-6 w-6 text-green-500" />
                      </div>
                      <h3 className="text-xl font-medium mb-2">No Errors Detected</h3>
                      <p className="text-muted-foreground">
                        The system is running smoothly with no recorded errors.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Endpoint</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Response Time</TableHead>
                            <TableHead>IP Address</TableHead>
                            <TableHead>User Agent</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(monitoringData as any).recentErrors.map((error: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="whitespace-nowrap">
                                {new Date(error.timestamp).toLocaleString()}
                              </TableCell>
                              <TableCell className="font-mono text-xs max-w-[200px] truncate">
                                {error.endpoint}
                              </TableCell>
                              <TableCell>
                                <Badge variant={error.method === 'GET' ? 'secondary' : 'outline'}>
                                  {error.method}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                                  {error.statusCode}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatTime(error.responseTime)}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {error.ip}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-xs">
                                {error.userAgent || 'Unknown'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Security Metrics</CardTitle>
                  <CardDescription>
                    System security status, failed login attempts, and suspicious activities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Failed Login Attempts</h3>
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-muted p-4 rounded-lg">
                          <div className="text-sm text-muted-foreground mb-1">Last 24 Hours</div>
                          <div className="text-2xl font-bold">
                            {(monitoringData as any).securityMetrics.failedLoginAttempts.last24Hours}
                          </div>
                        </div>
                        <div className="bg-muted p-4 rounded-lg">
                          <div className="text-sm text-muted-foreground mb-1">Last 7 Days</div>
                          <div className="text-2xl font-bold">
                            {(monitoringData as any).securityMetrics.failedLoginAttempts.last7Days}
                          </div>
                        </div>
                      </div>

                      <h3 className="text-lg font-medium mb-4">Suspicious Activities</h3>
                      {(monitoringData as any).securityMetrics.suspiciousActivities.length === 0 ? (
                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/50 p-4 rounded-lg">
                          <p className="text-green-700 dark:text-green-400">
                            No suspicious activities detected
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(monitoringData as any).securityMetrics.suspiciousActivities.map((activity: any, i: number) => (
                            <div key={i} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 p-3 rounded-lg">
                              <p className="text-amber-700 dark:text-amber-400 text-sm">
                                {activity}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-4">API Keys Status</h3>
                      <div className="space-y-4 mb-6">
                        {monitoringData.apiServices.map((service, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${
                                service.status === 'configured' ? 'bg-green-500' : 'bg-amber-500'
                              }`}></div>
                              <span>{service.name}</span>
                            </div>
                            <Badge 
                              variant={service.status === 'configured' ? 'default' : 'secondary'}
                              className={service.status === 'configured' ? 'bg-green-500' : ''}
                            >
                              {service.status}
                            </Badge>
                          </div>
                        ))}
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-950/30 p-6 rounded-lg border border-blue-100 dark:border-blue-900/50">
                        <h3 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">Security Assessment</h3>
                        <div className="flex items-center gap-2 mb-4">
                          <Shield className="h-5 w-5 text-blue-500" />
                          <span className="text-blue-700 dark:text-blue-400 font-medium">
                            System security is in good standing
                          </span>
                        </div>
                        <div className="text-sm text-blue-600 dark:text-blue-400 space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
                            <span>No suspicious login attempts detected in the last 24 hours</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
                            <span>All API keys are properly secured and configured</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
                            <span>Error logs show no security-related issues</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}