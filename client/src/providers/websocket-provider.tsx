import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface WebSocketMessage {
  type: string;
  data: any;
  channel?: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (type: string, data: any) => boolean;
  subscribe: (channel: string) => boolean;
  unsubscribe: (channel: string) => boolean;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  
  // Handle incoming WebSocket messages
  const handleMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'EVENT_UPDATE':
        // Handle event updates - can be used to refresh event data when changes are made
        // This replaces the polling mechanism
        break;
        
      case 'SUBMISSION_UPDATE':
        // Handle new submissions or updates to submissions
        toast({
          title: 'New Submission',
          description: `Event ${message.data.eventId} has new submissions`,
          variant: 'default',
        });
        setNotificationCount(prev => prev + 1);
        break;
        
      case 'VOTING_RESULTS':
        // Handle voting results updates
        toast({
          title: 'Voting Results Updated',
          description: `Voting results for event ${message.data.eventId} have been updated`,
          variant: 'default',
        });
        break;
        
      // Add more message type handlers as needed
    }
  };

  // Initialize WebSocket connection
  const {
    status,
    isConnected,
    lastMessage,
    clientId,
    sendMessage,
    subscribe,
    unsubscribe,
  } = useWebSocket({ 
    onMessage: handleMessage,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10
  });
  
  // Display toast notifications for connection changes
  useEffect(() => {
    if (status === 'open') {
      toast({
        title: 'Real-time Connection Established',
        description: 'You will receive live updates from the platform.',
        variant: 'default',
      });
    } else if (status === 'error') {
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to the real-time service. Some features may be unavailable.',
        variant: 'destructive',
      });
    }
  }, [status, toast]);
  
  // Subscribe to user-specific channels when user data and connection are available
  useEffect(() => {
    if (isConnected && user) {
      // Subscribe to user-specific channel
      subscribe(`user:${user.id}`);
      
      // If user is a teacher or admin, subscribe to additional channels
      if (user.role === 'teacher' && user.classId) {
        subscribe(`class:${user.classId}`);
      } else if (user.role === 'admin') {
        subscribe('admin');
      } else if (user.role === 'schoolAdmin' && user.schoolId) {
        subscribe(`school:${user.schoolId}`);
      }
      
      // Return cleanup function
      return () => {
        if (user.id) unsubscribe(`user:${user.id}`);
        if (user.role === 'teacher' && user.classId) unsubscribe(`class:${user.classId}`);
        if (user.role === 'admin') unsubscribe('admin');
        if (user.role === 'schoolAdmin' && user.schoolId) unsubscribe(`school:${user.schoolId}`);
      };
    }
  }, [isConnected, user, subscribe, unsubscribe]);

  return (
    <WebSocketContext.Provider value={{ 
      isConnected, 
      lastMessage, 
      sendMessage, 
      subscribe, 
      unsubscribe 
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  
  return context;
}