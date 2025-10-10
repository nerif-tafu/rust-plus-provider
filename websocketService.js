// websocketService.js - All-in-one WebSocket service for connections, messaging, and routing
const JsonManager = require('./jsonManager');
const FcmRegistrationService = require('./fcmRegistrationService');
const FcmPairingService = require('./fcmPairingService');

class WebSocketService {
  constructor() {
    // Map of client connections: clientId -> { ws, serverId, subscriptions, etc. }
    this.clients = new Map();
    
    // Map of Rust+ connections: serverId -> RustProvider instance
    this.rustProviders = new Map();
    
    // Counter for generating unique client IDs
    this.clientIdCounter = 0;
    
    // Initialize services
    this.jsonManager = new JsonManager();
    this.fcmRegistrationService = new FcmRegistrationService();
    this.fcmPairingService = new FcmPairingService();
  }
  
  // Handles new WebSocket connection
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const serverId = url.searchParams.get('serverId');
    
    // Store client connection info
    this.clients.set(clientId, {
      ws: ws,
      serverId: serverId,
      connectedAt: new Date(),
      subscriptions: new Set()
    });
    
    console.log(`Client ${clientId} connected${serverId ? ` to server ${serverId}` : ''}`);
    
    // Set up message handler
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });
    
    // Set up close handler
    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });
    
    // Set up error handler
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnect(clientId);
    });
    
    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      data: {
        clientId: clientId,
        serverId: serverId,
        message: 'Connected to Rust+ Provider'
      }
    });
  }
  
  // Handles incoming WebSocket messages
  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'fcm_register':
          this.handleFcmRegister(clientId, message.data);
          break;
        case 'fcm_listen':
          this.handleFcmListen(clientId, message.data);
          break;
        case 'fcm_pair_server':
          this.handleFcmPairServer(clientId, message.data);
          break;
        case 'register_server':
          this.handleRegisterServer(clientId, message.data);
          break;
        case 'unregister_server':
          this.handleUnregisterServer(clientId, message.data);
          break;
        case 'get_servers':
          this.handleGetServers(clientId);
          break;
        case 'get_map_markers':
          this.handleGetMapMarkers(clientId, message.data);
          break;
        case 'get_team_info':
          this.handleGetTeamInfo(clientId, message.data);
          break;
        case 'send_team_message':
          this.handleSendTeamMessage(clientId, message.data);
          break;
        case 'ping':
          this.handlePing(clientId);
          break;
        case 'subscribe':
          this.handleSubscribe(clientId, message.data);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.data);
          break;
        default:
          this.sendError(clientId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendError(clientId, 'Invalid message format');
    }
  }
  
  // Handles client disconnection
  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`Client ${clientId} disconnected`);
      this.clients.delete(clientId);
    }
  }
  
  // Handles server registration requests
  async handleRegisterServer(clientId, data) {
    // TODO: Validate server data
    // TODO: Call rustPlusService to register server
    // TODO: Send success/error response to client
  }
  
  // Handles server unregistration requests
  async handleUnregisterServer(clientId, data) {
    // TODO: Validate server ID
    // TODO: Call rustPlusService to unregister server
    // TODO: Send success/error response to client
  }
  
  // Handles get servers requests
  async handleGetServers(clientId) {
    try {
      console.log(`Getting servers for client ${clientId}`);
      
      // Get servers from JSON manager
      const allServers = this.jsonManager.getServers();
      
      // Filter out sensitive information (tokens only)
      const safeServers = {};
      for (const [serverId, serverData] of Object.entries(allServers)) {
        safeServers[serverId] = {
          img: serverData.img,
          port: serverData.port,
          ip: serverData.ip,
          name: serverData.name,
          id: serverData.id,
          type: serverData.type,
          url: serverData.url,
          desc: serverData.desc,
          playerId: serverData.playerId
          // Excluded: playerToken (security sensitive)
        };
      }
      
      this.sendToClient(clientId, {
        type: 'servers_list',
        data: {
          servers: safeServers,
          count: Object.keys(safeServers).length
        }
      });
      
    } catch (error) {
      console.error('Error getting servers:', error);
      this.sendError(clientId, `Failed to get servers: ${error.message}`);
    }
  }
  
  // Handles map markers requests
  async handleGetMapMarkers(clientId, data) {
    // TODO: Validate server ID
    // TODO: Get map markers from rustPlusService
    // TODO: Send markers to client
  }
  
  // Handles team info requests
  async handleGetTeamInfo(clientId, data) {
    // TODO: Validate server ID
    // TODO: Get team info from rustPlusService
    // TODO: Send team info to client
  }
  
  // Handles team message sending
  async handleSendTeamMessage(clientId, data) {
    // TODO: Validate server ID and message
    // TODO: Send team message via rustPlusService
    // TODO: Send success/error response to client
  }
  
  // Handles FCM registration with Steam credentials
  async handleFcmRegister(clientId, data) {
    try {
      // Validate required fields
      if (!data.username || !data.password) {
        this.sendError(clientId, 'Username and password are required');
        return;
      }
      
      console.log(`Starting FCM registration for client ${clientId}`);
      
      // Check if tokens are still valid
      if (this.jsonManager.areTokensValid()) {
        console.log('Valid tokens already exist, skipping registration');
        this.sendToClient(clientId, {
          type: 'fcm_register_success',
          data: {
            message: 'Valid tokens already exist',
            tokens_exist: true
          }
        });
        return;
      }
      
      // Perform FCM registration
      const tokens = await this.fcmRegistrationService.registerWithSteamCredentials(
        data.username,
        data.password,
        data.twoFactor
      );
      
      // Save tokens to JSON file
      const success = this.jsonManager.updateTokens(
        tokens.fcm_credentials,
        tokens.expo_push_token,
        tokens.rustplus_auth_token
      );
      
      if (success) {
        console.log('FCM registration completed successfully');
        this.sendToClient(clientId, {
          type: 'fcm_register_success',
          data: {
            message: 'FCM registration completed successfully',
            tokens_exist: false,
            token_expiry: this.jsonManager.readConfig().token_expiry
          }
        });
      } else {
        this.sendError(clientId, 'Failed to save tokens to configuration file');
      }
      
    } catch (error) {
      console.error('FCM registration error:', error);
      this.sendError(clientId, `FCM registration failed: ${error.message}`);
    }
  }
  
  // Handles FCM listening start/stop
  async handleFcmListen(clientId, data) {
    try {
      // Check if tokens are valid
      if (!this.jsonManager.areTokensValid()) {
        this.sendError(clientId, 'FCM tokens are expired or missing. Please run fcm_register first.');
        return;
      }
      
      const action = data.action || 'start'; // 'start' or 'stop'
      
      if (action === 'start') {
        console.log(`Starting FCM listening for client ${clientId}`);
        
        // Get FCM credentials
        const fcmCredentials = this.jsonManager.getFcmCredentials();
        if (!fcmCredentials) {
          this.sendError(clientId, 'FCM credentials not found. Please run fcm_register first.');
          return;
        }
        
        // Start FCM listener if not already running
        if (!this.fcmPairingService.isRunning()) {
          await this.fcmPairingService.startListening(fcmCredentials);
        }
        
        this.sendToClient(clientId, {
          type: 'fcm_listen_success',
          data: {
            message: 'FCM listening started successfully',
            listening: true
          }
        });
        
      } else if (action === 'stop') {
        console.log(`Stopping FCM listening for client ${clientId}`);
        
        this.fcmPairingService.stopListening();
        
        this.sendToClient(clientId, {
          type: 'fcm_listen_success',
          data: {
            message: 'FCM listening stopped successfully',
            listening: false
          }
        });
      } else {
        this.sendError(clientId, 'Invalid action. Use "start" or "stop".');
      }
      
    } catch (error) {
      console.error('FCM listen error:', error);
      this.sendError(clientId, `FCM listen failed: ${error.message}`);
    }
  }
  
  // Handles FCM server pairing
  async handleFcmPairServer(clientId, data) {
    try {
      // Check if tokens are valid
      if (!this.jsonManager.areTokensValid()) {
        this.sendError(clientId, 'FCM tokens are expired or missing. Please run fcm_register first.');
        return;
      }
      
      console.log(`Starting FCM server pairing for client ${clientId}`);
      
      // Check if FCM listener is running
      if (!this.fcmPairingService.isRunning()) {
        this.sendError(clientId, 'FCM listener is not running. Please start FCM listening first with fcm_listen command.');
        return;
      }
      
      // Wait for server pairing notification
      console.log('Waiting for server pairing notification...');
      this.sendToClient(clientId, {
        type: 'fcm_pair_waiting',
        data: {
          message: 'Waiting for server pairing notification. Please pair your server in the Rust+ app.'
        }
      });
      
       // Wait for pairing with timeout
       const serverData = await this.fcmPairingService.waitForPairing(clientId, 60000);
       
       if (serverData) {
         // Check for duplicate server (same IP, port, and ID)
         const existingServers = this.jsonManager.getServers();
         const duplicateServer = Object.values(existingServers).find(server => 
           server.ip === serverData.ip && 
           server.port === serverData.port && 
           server.id === serverData.id
         );
         
         if (duplicateServer) {
           console.log(`Server already paired: ${serverData.name} (${serverData.ip}:${serverData.port})`);
           this.sendToClient(clientId, {
             type: 'fcm_pair_duplicate',
             data: {
               message: 'Server is already paired',
               server: {
                 ip: serverData.ip,
                 port: serverData.port,
                 name: serverData.name,
                 id: serverData.id
               }
             }
           });
           return;
         }
         
         // Generate server ID if not provided
         const serverId = data.serverId || this.generateServerId();
         
         // Save server to JSON file
         const success = this.jsonManager.addServer(serverId, serverData);
         
         if (success) {
           console.log(`Server paired successfully: ${serverData.name} (${serverData.ip})`);
           this.sendToClient(clientId, {
             type: 'fcm_pair_success',
             data: {
               serverId: serverId,
               server: serverData,
               message: 'Server paired successfully'
             }
           });
         } else {
           this.sendError(clientId, 'Failed to save server to configuration file');
         }
       }
      
    } catch (error) {
      console.error('FCM pairing error:', error);
      this.sendError(clientId, `FCM pairing failed: ${error.message}`);
    }
  }
  
  // Handles ping/pong for connection health
  handlePing(clientId) {
    this.sendToClient(clientId, {
      type: 'pong',
      data: {
        timestamp: new Date().toISOString()
      }
    });
  }
  
  // Handles client subscription requests
  handleSubscribe(clientId, data) {
    // TODO: Validate subscription topic
    // TODO: Subscribe client to topic
    // TODO: Send confirmation to client
  }
  
  // Handles client unsubscription requests
  handleUnsubscribe(clientId, data) {
    // TODO: Validate subscription topic
    // TODO: Unsubscribe client from topic
    // TODO: Send confirmation to client
  }
  
  // Sends message to specific client
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) { // WebSocket.OPEN
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to client ${clientId}:`, error);
        this.handleDisconnect(clientId);
      }
    }
  }
  
  // Broadcasts message to all connected clients
  broadcast(message) {
    // TODO: Iterate through all clients
    // TODO: Send message to each connected client
  }
  
  // Broadcasts message to clients connected to specific server
  broadcastToServer(serverId, message) {
    // TODO: Find clients connected to specific server
    // TODO: Send message only to those clients
  }
  
  // Broadcasts message to clients with specific subscription
  broadcastToSubscribers(subscription, message) {
    // TODO: Find clients subscribed to specific topic
    // TODO: Send message only to subscribed clients
  }
  
  // Sends error message to client
  sendError(clientId, error) {
    this.sendToClient(clientId, {
      type: 'error',
      data: {
        error: error,
        timestamp: new Date().toISOString()
      }
    });
  }
  
  // Generates unique client ID
  generateClientId() {
    return `client_${++this.clientIdCounter}_${Date.now()}`;
  }
  
  // Generates unique server ID
  generateServerId() {
    return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/[x]/g, function() {
      return (Math.random() * 16 | 0).toString(16);
    });
  }
}

module.exports = WebSocketService;
