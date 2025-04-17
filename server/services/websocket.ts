import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket, RawData, ServerOptions } from 'ws';
import { monitoring } from '../monitoring';

interface WebSocketClient extends WebSocket {
  id: string;
  isAlive: boolean;
  channels: Set<string>;
  lastActivity: number;
}

interface WebSocketMessage {
  type: string;
  data: any;
  channel?: string;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private channels: Map<string, Set<string>> = new Map(); // Map of channel name to set of client IDs
  private pingInterval: NodeJS.Timeout | null = null;
  
  constructor(server: HttpServer, options: ServerOptions = { path: '/ws' }) {
    // Initialize WebSocket server
    this.wss = new WebSocketServer({ 
      server, 
      ...options 
    });
    
    // Set up WebSocket event handlers
    this.setupEventHandlers();
    
    // Start ping interval for connection health check
    this.startPingInterval();
    
    console.log('WebSocket service initialized');
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    // Handle new connections
    this.wss.on('connection', (ws: WebSocket) => {
      // Create client ID
      const clientId = this.generateClientId();
      
      // Extend WebSocket object with custom properties
      const client = ws as WebSocketClient;
      client.id = clientId;
      client.isAlive = true;
      client.channels = new Set();
      client.lastActivity = Date.now();
      
      // Add client to clients map
      this.clients.set(clientId, client);
      
      // Track connection in monitoring
      monitoring.trackWebSocketConnection();
      
      console.log(`WebSocket client connected: ${clientId}`);
      
      // Send welcome message with client ID
      this.sendToClient(clientId, {
        type: 'CONNECTED',
        data: { clientId, timestamp: Date.now() }
      });
      
      // Handle pong messages (response to ping)
      client.on('pong', () => {
        client.isAlive = true;
        client.lastActivity = Date.now();
      });
      
      // Handle incoming messages
      client.on('message', (data: RawData) => {
        try {
          // Update last activity timestamp
          client.lastActivity = Date.now();
          
          // Track message in monitoring
          monitoring.trackWebSocketMessageReceived();
          
          // Parse message
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          
          // Handle message based on type
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      });
      
      // Handle client disconnection
      client.on('close', () => {
        this.handleClientDisconnection(clientId);
      });
      
      // Handle errors
      client.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
    });
  }
  
  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Handle client messages
   */
  private handleClientMessage(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    console.log(`Received message from client ${clientId}:`, message.type);
    
    switch (message.type) {
      case 'PING':
        // Respond to ping with pong
        this.sendToClient(clientId, {
          type: 'PONG',
          data: { timestamp: Date.now() }
        });
        break;
        
      case 'SUBSCRIBE':
        // Handle channel subscription
        if (message.data && message.data.channel) {
          this.subscribeClientToChannel(clientId, message.data.channel);
          
          this.sendToClient(clientId, {
            type: 'SUBSCRIBED',
            data: { channel: message.data.channel }
          });
        }
        break;
        
      case 'UNSUBSCRIBE':
        // Handle channel unsubscription
        if (message.data && message.data.channel) {
          this.unsubscribeClientFromChannel(clientId, message.data.channel);
          
          this.sendToClient(clientId, {
            type: 'UNSUBSCRIBED',
            data: { channel: message.data.channel }
          });
        }
        break;
        
      default:
        // Handle unknown message type
        console.log(`Unknown message type: ${message.type}`);
        break;
    }
  }
  
  /**
   * Handle client disconnection
   */
  private handleClientDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    console.log(`WebSocket client disconnected: ${clientId}`);
    
    // Unsubscribe from all channels
    for (const channel of client.channels) {
      this.unsubscribeClientFromChannel(clientId, channel);
    }
    
    // Remove client from clients map
    this.clients.delete(clientId);
    
    // Track disconnection in monitoring
    monitoring.trackWebSocketDisconnection();
  }
  
  /**
   * Subscribe a client to a channel
   */
  private subscribeClientToChannel(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Add channel to client's set of channels
    client.channels.add(channel);
    
    // Add client to channel's set of clients
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)?.add(clientId);
    
    console.log(`Client ${clientId} subscribed to channel: ${channel}`);
  }
  
  /**
   * Unsubscribe a client from a channel
   */
  private unsubscribeClientFromChannel(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Remove channel from client's set of channels
    client.channels.delete(channel);
    
    // Remove client from channel's set of clients
    const clientsInChannel = this.channels.get(channel);
    if (clientsInChannel) {
      clientsInChannel.delete(clientId);
      
      // If channel is empty, remove it
      if (clientsInChannel.size === 0) {
        this.channels.delete(channel);
      }
    }
    
    console.log(`Client ${clientId} unsubscribed from channel: ${channel}`);
  }
  
  /**
   * Send a message to a specific client
   */
  private sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.readyState !== WebSocket.OPEN) return false;
    
    try {
      client.send(JSON.stringify(message));
      monitoring.trackWebSocketMessageSent();
      return true;
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      return false;
    }
  }
  
  /**
   * Broadcast a message to all connected clients
   */
  public broadcast(message: WebSocketMessage): number {
    let successCount = 0;
    
    for (const clientId of this.clients.keys()) {
      if (this.sendToClient(clientId, message)) {
        successCount++;
      }
    }
    
    return successCount;
  }
  
  /**
   * Send a message to all clients subscribed to a specific channel
   */
  public sendToChannel(channel: string, message: WebSocketMessage): number {
    const clientsInChannel = this.channels.get(channel);
    if (!clientsInChannel) return 0;
    
    let successCount = 0;
    message.channel = channel; // Add channel to message
    
    for (const clientId of clientsInChannel) {
      if (this.sendToClient(clientId, message)) {
        successCount++;
      }
    }
    
    return successCount;
  }
  
  /**
   * Start ping interval for connection health check
   */
  private startPingInterval(): void {
    // Check client connections every 30 seconds
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      
      this.clients.forEach((client, clientId) => {
        // If client hasn't responded to ping, terminate connection
        if (!client.isAlive) {
          console.log(`Terminating inactive client: ${clientId}`);
          client.terminate();
          this.handleClientDisconnection(clientId);
          return;
        }
        
        // Mark client as inactive until it responds to ping
        client.isAlive = false;
        
        // Send ping
        try {
          client.ping();
        } catch (error) {
          console.error(`Error pinging client ${clientId}:`, error);
        }
      });
    }, 30000);
  }
  
  /**
   * Stop the WebSocket service
   */
  public stop(): void {
    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Close all connections
    this.wss.close();
    
    console.log('WebSocket service stopped');
  }
  
  /**
   * Get number of connected clients
   */
  public getClientCount(): number {
    return this.clients.size;
  }
  
  /**
   * Get number of active channels
   */
  public getChannelCount(): number {
    return this.channels.size;
  }
}

// Create a singleton instance
let websocketService: WebSocketService | null = null;

/**
 * Initialize the WebSocket server
 * @param server HTTP server to attach WebSocket server to
 * @param options WebSocket server options
 * @returns WebSocketService instance
 */
export function setupWebSocketServer(server: HttpServer, options: ServerOptions = { path: '/ws' }): WebSocketService {
  if (!websocketService) {
    websocketService = new WebSocketService(server, options);
  }
  return websocketService;
}

/**
 * Get the WebSocket service instance
 * @returns WebSocketService instance or null if not initialized
 */
export function getWebSocketService(): WebSocketService | null {
  return websocketService;
}

/**
 * Send a message to a specific channel
 * @param channel Channel name
 * @param type Message type
 * @param data Message data
 * @returns Number of clients the message was sent to
 */
export function sendToChannel(channel: string, type: string, data: any): number {
  if (!websocketService) {
    console.warn('WebSocket service not initialized');
    return 0;
  }
  
  return websocketService.sendToChannel(channel, { type, data });
}

/**
 * Broadcast a message to all connected clients
 * @param type Message type
 * @param data Message data
 * @returns Number of clients the message was sent to
 */
export function broadcast(type: string, data: any): number {
  if (!websocketService) {
    console.warn('WebSocket service not initialized');
    return 0;
  }
  
  return websocketService.broadcast({ type, data });
}