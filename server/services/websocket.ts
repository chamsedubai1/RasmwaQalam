import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { monitoring } from '../monitoring';

// Store connected clients
export const connectedClients = new Map<string, WebSocket>();

interface WebSocketMessage {
  type: string;
  data: any;
}

/**
 * Sets up WebSocket server on the provided HTTP server
 * @param server HTTP server instance
 */
export function setupWebSocketServer(server: Server) {
  // Create WebSocket server on a distinct path to avoid conflicts with Vite HMR
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });
  
  console.log('WebSocket server initialized on path /ws');
  
  // Connection event
  wss.on('connection', (ws, req) => {
    const clientId = uuidv4();
    const ipAddress = req.socket.remoteAddress || 'unknown';
    
    console.log(`WebSocket client connected: ${clientId} from ${ipAddress}`);
    connectedClients.set(clientId, ws);
    
    // Update monitoring stats
    monitoring.trackWebSocketConnection();
    
    // Welcome message with clientId
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      data: {
        clientId,
        timestamp: new Date().toISOString(),
        message: 'Connected to RASM wa QALAM WebSocket server'
      }
    }));
    
    // Ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING', data: { timestamp: Date.now() } }));
      }
    }, 30000); // Every 30 seconds
    
    // Close event
    ws.on('close', () => {
      console.log(`WebSocket client disconnected: ${clientId}`);
      connectedClients.delete(clientId);
      clearInterval(pingInterval);
      
      // Update monitoring stats
      monitoring.trackWebSocketDisconnection();
    });
    
    // Message event
    ws.on('message', (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        console.log(`Received message from client ${clientId}:`, parsedMessage);
        
        // Handle client messages if needed
        if (parsedMessage.type === 'PONG') {
          // Client responding to ping
          console.log(`Received PONG from client ${clientId}`);
        } else if (parsedMessage.type === 'SUBSCRIBE') {
          // Allow clients to subscribe to specific channels/events
          console.log(`Client ${clientId} subscribed to: ${parsedMessage.channel}`);
          
          // Store subscription info on the client object for later use
          // @ts-ignore - adding custom property to WebSocket
          ws.subscriptions = ws.subscriptions || [];
          // @ts-ignore
          ws.subscriptions.push(parsedMessage.channel);
        }
      } catch (error) {
        console.error(`Error parsing message from client ${clientId}:`, error);
      }
    });
    
    // Error event
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
    });
  });
  
  return wss;
}

/**
 * Broadcast a message to all connected clients
 * @param type Message type
 * @param data Message data
 */
export function broadcastToAll(type: string, data: any) {
  const message = JSON.stringify({ type, data });
  let sentCount = 0;
  
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  });
  
  console.log(`Broadcasted ${type} message to ${sentCount}/${connectedClients.size} clients`);
}

/**
 * Broadcast a message to clients subscribed to a specific channel
 * @param channel Channel name
 * @param type Message type
 * @param data Message data
 */
export function broadcastToChannel(channel: string, type: string, data: any) {
  const message = JSON.stringify({ type, data, channel });
  let sentCount = 0;
  
  connectedClients.forEach((client) => {
    // @ts-ignore - custom property
    const subscriptions = client.subscriptions || [];
    
    if (client.readyState === WebSocket.OPEN && 
        (subscriptions.includes(channel) || subscriptions.includes('*'))) {
      client.send(message);
      sentCount++;
    }
  });
  
  console.log(`Broadcasted ${type} message to ${sentCount} clients on channel: ${channel}`);
}

/**
 * Send a message to a specific client
 * @param clientId Client ID
 * @param type Message type
 * @param data Message data
 * @returns true if sent successfully, false otherwise
 */
export function sendToClient(clientId: string, type: string, data: any): boolean {
  const client = connectedClients.get(clientId);
  
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ type, data }));
    return true;
  }
  
  return false;
}

// Helper functions for common broadcast events

/**
 * Broadcast event updates to all clients
 * @param events Updated events data
 */
export function broadcastEventUpdate(events: any[]) {
  broadcastToAll('EVENT_UPDATE', { events, timestamp: Date.now() });
}

/**
 * Broadcast submission updates to relevant clients
 * @param eventId Event ID
 * @param submissions Updated submissions
 */
export function broadcastSubmissionUpdate(eventId: number, submissions: any[]) {
  broadcastToChannel(`event:${eventId}`, 'SUBMISSION_UPDATE', { 
    eventId, 
    submissions,
    timestamp: Date.now()
  });
}

/**
 * Broadcast voting results update
 * @param eventId Event ID
 * @param results Voting results data
 */
export function broadcastVotingResults(eventId: number, results: any) {
  broadcastToChannel(`event:${eventId}`, 'VOTING_RESULTS', {
    eventId,
    results,
    timestamp: Date.now()
  });
}