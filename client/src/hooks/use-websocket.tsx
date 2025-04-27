import { useState, useEffect, useCallback, useRef } from 'react';

type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

interface WebSocketMessage {
  type: string;
  data: any;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

// Create a global instance that can be shared across components
let globalSocket: WebSocket | null = null;
let globalHasConnected = false;

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [status, setStatus] = useState<WebSocketStatus>('closed');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = options.maxReconnectAttempts || 5;
  const reconnectInterval = options.reconnectInterval || 3000;
  const connectionAttemptedRef = useRef(false);

  // Connect to the WebSocket server
  const connect = useCallback(() => {
    // Use the global socket if it already exists
    if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
      setStatus('open');
      return globalSocket;
    }
    
    // Close existing connection if any
    if (globalSocket && globalSocket.readyState !== WebSocket.CLOSED) {
      globalSocket.close();
    }
    
    try {
      // Determine the WebSocket URL based on current protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Connecting to WebSocket server at ${wsUrl}`);
      setStatus('connecting');
      
      // Create new WebSocket connection
      const socket = new WebSocket(wsUrl);
      globalSocket = socket;
      
      // Connection opened
      socket.addEventListener('open', () => {
        console.log('WebSocket connection established');
        setStatus('open');
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
        globalHasConnected = true;
      });
      
      // Connection closed
      socket.addEventListener('close', (event) => {
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
        setStatus('closed');
        
        // Attempt to reconnect if not closed cleanly and not exceeding max attempts
        if (!event.wasClean && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      });
      
      // Connection error
      socket.addEventListener('error', (error) => {
        console.error('WebSocket connection error:', error);
        setStatus('error');
      });
      
      // Listen for messages
      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          
          // Handle CONNECTED message to store the client ID
          if (message.type === 'CONNECTED' && message.data?.clientId) {
            setClientId(message.data.clientId);
          }
          
          // Set the last message received
          setLastMessage(message);
          
          // Call the onMessage callback if provided
          if (options.onMessage) {
            options.onMessage(message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      // Return the socket instance
      return socket;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setStatus('error');
      return null;
    }
  }, [options.onMessage, reconnectInterval, maxReconnectAttempts]);
  
  // Send a message to the WebSocket server
  const sendMessage = useCallback((type: string, data: any = {}) => {
    if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, data });
      globalSocket.send(message);
      return true;
    }
    console.warn('Cannot send message: WebSocket is not connected');
    return false;
  }, []);
  
  // Subscribe to a specific channel
  const subscribe = useCallback((channel: string) => {
    return sendMessage('SUBSCRIBE', { channel });
  }, [sendMessage]);
  
  // Unsubscribe from a specific channel
  const unsubscribe = useCallback((channel: string) => {
    return sendMessage('UNSUBSCRIBE', { channel });
  }, [sendMessage]);
  
  // Connect on component mount, but use global state to prevent multiple connections
  useEffect(() => {
    // Only connect if we haven't already connected globally
    if (!globalHasConnected && !connectionAttemptedRef.current) {
      connectionAttemptedRef.current = true;
      connect();
    } else if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
      // If we already have a connection, update the status
      setStatus('open');
    }
    
    // We don't need to clean up on unmount because the connection is global
    // This prevents disconnecting when navigating between pages
  }, [connect]);
  
  // Response to PING messages with PONG
  useEffect(() => {
    if (lastMessage?.type === 'PING') {
      sendMessage('PONG', { timestamp: Date.now() });
    }
  }, [lastMessage, sendMessage]);
  
  return {
    status,
    isConnected: status === 'open',
    lastMessage,
    clientId,
    sendMessage,
    subscribe,
    unsubscribe,
    connect,
    reconnectAttempts: reconnectAttemptsRef.current
  };
}