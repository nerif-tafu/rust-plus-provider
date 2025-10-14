// websocketService.js - All-in-one WebSocket service for connections, messaging, and routing
const JsonManager = require('./jsonManager');
const FcmRegistrationService = require('./fcmRegistrationService');
const FcmPairingService = require('./fcmPairingService');
const RustProvider = require('./rustProvider');

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
    
    // Set up entity pairing callback
    this.fcmPairingService.setEntityPairedCallback((serverId, entityId, entityType, entityName) => {
      this.handleNewEntityPaired(serverId, entityId, entityType, entityName);
    });

    // Set up server pairing callback
    this.fcmPairingService.setServerPairedCallback((serverId, serverData) => {
      this.handleNewServerPaired(serverId, serverData);
    });
    
    // Initialize connections to existing servers
    this.initializeConnections();
    
    // Initialize FCM listening if we have valid tokens
    this.initializeFcmListening();
   }
   
  // Initializes connections to existing servers on startup
  async initializeConnections() {
    try {
      // Wait a moment for services to be ready
      setTimeout(async () => {
        console.log('Initializing Rust+ server connections...');
        await this.connectToAllServers();
      }, 2000);
    } catch (error) {
      console.error('Error initializing connections:', error);
    }
  }

  // Initializes FCM listening if we have valid tokens
  async initializeFcmListening() {
    try {
      // Wait a moment for services to be ready
      setTimeout(async () => {
        console.log('Checking for valid FCM tokens...');
        
        // Check if we have valid FCM credentials
        if (this.jsonManager.areTokensValid()) {
          const fcmCredentials = this.jsonManager.getFcmCredentials();
          console.log('Valid FCM tokens found, starting FCM listener...');
          
          try {
            await this.fcmPairingService.startListening(fcmCredentials);
            console.log('FCM listener started successfully - ready to receive server pairing notifications');
          } catch (error) {
            console.error('Failed to start FCM listener:', error);
          }
        } else {
          console.log('No valid FCM tokens found - FCM listener not started');
          console.log('Use FCM registration to obtain tokens first');
        }
      }, 3000); // Wait 3 seconds for services to be ready
    } catch (error) {
      console.error('Error initializing FCM listening:', error);
    }
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
    ws.on('message', async (data) => {
      await this.handleMessage(clientId, data);
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
  async handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'fcm_register':
          this.handleFcmRegister(clientId, message.data);
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
        case 'get_server_data':
          this.handleGetServerData(clientId, message.data);
          break;
        case 'get_server_info':
          this.handleGetServerInfo(clientId, message.data);
          break;
        case 'get_map_data':
          this.handleGetMapData(clientId, message.data);
          break;
        case 'get_connection_status':
          this.handleGetConnectionStatus(clientId);
          break;
        case 'delete_tokens':
          this.handleDeleteTokens(clientId);
          break;
        case 'toggle_switch':
          this.handleToggleSwitch(clientId, message.data);
          break;
        case 'refresh_entity':
          this.handleRefreshEntity(clientId, message.data);
          break;
        case 'delete_entity':
          this.handleDeleteEntity(clientId, message.data);
          break;
        case 'rename_entity':
          this.handleRenameEntity(clientId, message.data);
          break;
        case 'get_team_info':
          this.handleGetTeamInfo(clientId, message.data);
          break;
        case 'get_entity_info':
          this.handleGetEntityInfo(clientId, message.data);
          break;
        case 'refresh_all_connections':
          await this.handleRefreshAllConnections(clientId);
          break;
        case 'send_team_message':
          this.handleSendTeamMessage(clientId, message.data);
          break;
        case 'ping':
          this.handlePing(clientId);
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
     try {
       const serverId = data.serverId;
       
       if (!serverId) {
         this.sendError(clientId, 'Server ID is required');
         return;
       }
       
       // Check if server exists
       const servers = this.jsonManager.getServers();
       if (!servers[serverId]) {
         this.sendError(clientId, 'Server not found');
         return;
       }
       
       // Disconnect from the server if connected
       if (this.rustProviders.has(serverId)) {
         await this.disconnectFromServer(serverId);
       }
       
       // Remove server from JSON file
       const success = this.jsonManager.removeServer(serverId);
       
       if (success) {
         console.log(`Server ${serverId} unregistered successfully`);
         this.sendToClient(clientId, {
           type: 'unregister_server_success',
           data: {
             serverId: serverId,
             message: 'Server unregistered successfully'
           }
         });
       } else {
         this.sendError(clientId, 'Failed to remove server from configuration file');
       }
       
     } catch (error) {
       console.error('Server unregistration error:', error);
       this.sendError(clientId, `Server unregistration failed: ${error.message}`);
     }
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
                // Get RustProvider instance for this server to get live entity states
                const rustProvider = this.rustProviders.get(serverId);
                
                // Get real-time connection status
                const isConnected = rustProvider ? rustProvider.isConnected : false;
                const connectionStatus = isConnected ? 'connected' : 'disconnected';
                
                // Process switches with live state from memory
                const processedSwitches = (serverData.switches || []).map(switchEntity => {
                  const entityState = rustProvider ? rustProvider.getEntityState(switchEntity.entityId) : { isActive: false, lastChecked: null };
          return {
            entityId: switchEntity.entityId,
            entityName: switchEntity.entityName,
            entityType: switchEntity.entityType,
            pairedAt: switchEntity.pairedAt,
            isActive: entityState.isActive,
            lastChecked: entityState.lastChecked
          };
        });
        
        // Process alarms with live state from memory
        const processedAlarms = (serverData.alarms || []).map(alarmEntity => {
          const entityState = rustProvider ? rustProvider.getEntityState(alarmEntity.entityId) : { isActive: false, lastChecked: null };
          return {
            entityId: alarmEntity.entityId,
            entityName: alarmEntity.entityName,
            entityType: alarmEntity.entityType,
            pairedAt: alarmEntity.pairedAt,
            isActive: entityState.isActive,
            lastChecked: entityState.lastChecked
          };
        });
        
        safeServers[serverId] = {
          img: serverData.img,
          port: serverData.port,
          ip: serverData.ip,
          name: serverData.name,
          id: serverData.id,
          type: serverData.type,
          url: serverData.url,
          desc: serverData.desc,
          playerId: serverData.playerId,
          status: connectionStatus, // Use real-time connection status
          // Include switches and alarms with availability status
          switches: processedSwitches,
          alarms: processedAlarms
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

  // Handles get server data requests for detailed debugging
  async handleGetServerData(clientId, data) {
    try {
      const serverId = data.serverId;
      console.log(`Getting detailed server data for ${serverId} for client ${clientId}`);
      
      // Get server from JSON manager
      const allServers = this.jsonManager.getServers();
      const serverData = allServers[serverId];
      
      if (!serverData) {
        this.sendError(clientId, 'Server not found');
        return;
      }
      
      // Get RustProvider instance for live data
      const rustProvider = this.rustProviders.get(serverId);
      
      // Prepare server info data
      const serverInfo = {
        name: serverData.name,
        ip: serverData.ip,
        port: serverData.port,
        status: serverData.status || 'unknown',
        connected: rustProvider ? rustProvider.isConnected : false,
        lastConnected: serverData.lastConnected,
        playerId: serverData.playerId,
        // Add any other server info from rustProvider if available
        ...(rustProvider && rustProvider.serverInfo ? rustProvider.serverInfo : {})
      };
      
      // Prepare smart devices data with live states
      const smartDevices = {
        switches: (serverData.switches || []).map(switchEntity => {
          const entityState = rustProvider ? rustProvider.getEntityState(switchEntity.entityId) : { isActive: false, lastChecked: null };
          return {
            entityId: switchEntity.entityId,
            entityName: switchEntity.entityName,
            entityType: switchEntity.entityType,
            pairedAt: switchEntity.pairedAt,
            isActive: entityState.isActive,
            lastChecked: entityState.lastChecked,
            available: entityState.lastChecked !== null
          };
        }),
        alarms: (serverData.alarms || []).map(alarmEntity => {
          const entityState = rustProvider ? rustProvider.getEntityState(alarmEntity.entityId) : { isActive: false, lastChecked: null };
          return {
            entityId: alarmEntity.entityId,
            entityName: alarmEntity.entityName,
            entityType: alarmEntity.entityType,
            pairedAt: alarmEntity.pairedAt,
            isActive: entityState.isActive,
            lastChecked: entityState.lastChecked,
            available: entityState.lastChecked !== null
          };
        })
      };
      
      // Prepare map data (if available from rustProvider)
      const mapData = {
        mapImage: null,
        markers: [],
        lastUpdated: null
      };
      
      if (rustProvider && rustProvider.lastMapData) {
        mapData.mapImage = rustProvider.lastMapData.image;
        mapData.markers = rustProvider.lastMapData.markers || [];
        mapData.lastUpdated = rustProvider.lastMapData.timestamp;
      }
      
      this.sendToClient(clientId, {
        type: 'server_data',
        data: {
          serverId: serverId,
          serverInfo: serverInfo,
          smartDevices: smartDevices,
          mapData: mapData
        }
      });
      
    } catch (error) {
      console.error('Error getting server data:', error);
      this.sendError(clientId, `Failed to get server data: ${error.message}`);
    }
  }

  // Handles get server info requests - fetches live data from Rust+ API
  async handleGetServerInfo(clientId, data) {
    try {
      const serverId = data.serverId;
      console.log(`Getting live server info for ${serverId} for client ${clientId}`);
      
      // Get RustProvider instance
      const rustProvider = this.rustProviders.get(serverId);
      
      if (!rustProvider) {
        this.sendError(clientId, 'Server not connected');
        return;
      }
      
      if (!rustProvider.isConnected) {
        this.sendError(clientId, 'Server not connected');
        return;
      }
      
      // Fetch live server info and time using getInfo() and getTime() with callbacks
      const [serverInfo, timeInfo] = await Promise.all([
        new Promise((resolve, reject) => {
          rustProvider.rustplus.getInfo((message) => {
            if (message.response && message.response.info) {
              resolve(message.response.info);
            } else {
              reject(new Error('Failed to get server info'));
            }
          });
        }),
        new Promise((resolve, reject) => {
          rustProvider.rustplus.getTime((message) => {
            if (message.response && message.response.time) {
              resolve(message.response.time);
            } else {
              reject(new Error('Failed to get server time'));
            }
          });
        })
      ]);
      
      // Combine server info with time info
      const combinedServerInfo = {
        ...serverInfo,
        time: timeInfo
      };
      
      this.sendToClient(clientId, {
        type: 'server_info',
        data: {
          serverId: serverId,
          serverInfo: combinedServerInfo
        }
      });
      
    } catch (error) {
      console.error('Error getting server info:', error);
      this.sendError(clientId, `Failed to get server info: ${error.message}`);
    }
  }

  // Handles get map data requests - fetches live map and markers
  async handleGetMapData(clientId, data) {
    try {
      const serverId = data.serverId;
      console.log(`Getting live map data for ${serverId} for client ${clientId}`);
      
      // Get RustProvider instance
      const rustProvider = this.rustProviders.get(serverId);
      
      if (!rustProvider) {
        this.sendError(clientId, 'Server not connected');
        return;
      }
      
      if (!rustProvider.isConnected) {
        this.sendError(clientId, 'Server not connected');
        return;
      }
      
      // Fetch live map data using getMap() and getMapMarkers() with callbacks
      const [mapData, mapMarkers] = await Promise.all([
        new Promise((resolve, reject) => {
          rustProvider.rustplus.getMap((message) => {
            if (message.response && message.response.map) {
              resolve(message.response.map);
            } else {
              reject(new Error('Failed to get map data'));
            }
          });
        }),
        new Promise((resolve, reject) => {
          rustProvider.rustplus.getMapMarkers((message) => {
            if (message.response && message.response.mapMarkers) {
              resolve(message.response.mapMarkers);
            } else {
              reject(new Error('Failed to get map markers'));
            }
          });
        })
      ]);
      
      const combinedMapData = {
        map: mapData,
        markers: mapMarkers,
        timestamp: Date.now()
      };
      
      this.sendToClient(clientId, {
        type: 'map_data',
        data: {
          serverId: serverId,
          mapData: combinedMapData
        }
      });
      
    } catch (error) {
      console.error('Error getting map data:', error);
      this.sendError(clientId, `Failed to get map data: ${error.message}`);
    }
  }

  // Handles connection status requests - shows live connection state
  async handleGetConnectionStatus(clientId) {
    try {
      console.log(`Getting connection status for client ${clientId}`);
      
      const connectionStatus = {};
      
      // Check each RustProvider instance for live connection status
      for (const [serverId, rustProvider] of this.rustProviders) {
        connectionStatus[serverId] = {
          serverName: rustProvider.serverInfo.name,
          isConnected: rustProvider.isConnected,
          lastUpdated: rustProvider.cache.lastUpdated,
          hasMapMarkers: rustProvider.cache.mapMarkers !== null,
          hasTeamInfo: rustProvider.cache.teamInfo !== null,
          hasServerInfo: rustProvider.cache.serverInfo !== null
        };
      }
      
      this.sendToClient(clientId, {
        type: 'connection_status',
        data: {
          connections: connectionStatus,
          totalConnected: Object.values(connectionStatus).filter(status => status.isConnected).length,
          totalServers: Object.keys(connectionStatus).length,
          fcmListener: {
            isRunning: this.fcmPairingService.isRunning(),
            hasValidTokens: this.jsonManager.areTokensValid(),
            tokenExpiry: this.getTokenExpiryInfo()
          }
        }
      });
      
    } catch (error) {
      console.error('Error getting connection status:', error);
      this.sendError(clientId, `Failed to get connection status: ${error.message}`);
    }
  }
  
  // Handles delete tokens requests
  async handleDeleteTokens(clientId) {
    try {
      console.log(`Deleting FCM tokens for client ${clientId}`);
      
      // Stop FCM listener if running
      if (this.fcmPairingService.isRunning()) {
        console.log('Stopping FCM listener...');
        this.fcmPairingService.stopListening();
      }
      
      // Disconnect from all Rust+ servers
      console.log('Disconnecting from all Rust+ servers...');
      await this.disconnectFromAllServers();
      
      // Clear tokens from JSON file
      console.log('Clearing FCM tokens from configuration...');
      const success = this.jsonManager.clearTokens();
      
      if (success) {
        console.log('FCM tokens deleted successfully');
        this.sendToClient(clientId, {
          type: 'tokens_deleted',
          data: {
            message: 'FCM tokens deleted successfully',
            servers_disconnected: Object.keys(this.rustProviders).length
          }
        });
        
        // Broadcast to all clients that tokens were deleted
        this.broadcastToAllClients({
          type: 'tokens_deleted',
          data: {
            message: 'FCM tokens have been deleted',
            timestamp: new Date().toISOString()
          }
        });
      } else {
        this.sendError(clientId, 'Failed to delete FCM tokens from configuration file');
      }
      
    } catch (error) {
      console.error('Error deleting tokens:', error);
      this.sendError(clientId, `Failed to delete tokens: ${error.message}`);
    }
  }
  
  // Handles smart switch toggle requests
  async handleToggleSwitch(clientId, data) {
    try {
      console.log(`Toggling switch ${data.entityId} for client ${clientId}`);
      
      // Find the server and entity
      const servers = this.jsonManager.getServers();
      let targetServer = null;
      let targetEntity = null;
      let targetServerId = null;
      
      for (const [serverId, server] of Object.entries(servers)) {
        if (server.switches) {
          const switchEntity = server.switches.find(s => s.entityId === data.entityId);
          if (switchEntity) {
            targetServer = server;
            targetEntity = switchEntity;
            targetServerId = serverId; // Use the JSON server ID, not server.id
            break;
          }
        }
      }
      
      if (!targetServer || !targetEntity) {
        this.sendError(clientId, 'Switch not found');
        return;
      }
      
      // Find the RustProvider for this server using the JSON server ID
      const rustProvider = this.rustProviders.get(targetServerId);
      if (!rustProvider || !rustProvider.isConnected) {
        this.sendError(clientId, 'Server not connected');
        return;
      }
      
      // Get current state from RustProvider memory
      const entityState = rustProvider.getEntityState(data.entityId);
      const currentState = entityState.isActive || false;
      const newState = !currentState;
      
      
      console.log(`Switch ${data.entityId} current state: ${currentState}, toggling to: ${newState}`);
      
      // Send toggle command to Rust+ server
      if (newState) {
        console.log(`Calling turnSmartSwitchOn for entity ${data.entityId}`);
        await rustProvider.rustplus.turnSmartSwitchOn(parseInt(data.entityId), (message) => {
          console.log('turnSmartSwitchOn response:', JSON.stringify(message));
          return true;
        });
      } else {
        console.log(`Calling turnSmartSwitchOff for entity ${data.entityId}`);
        await rustProvider.rustplus.turnSmartSwitchOff(parseInt(data.entityId), (message) => {
          console.log('turnSmartSwitchOff response:', JSON.stringify(message));
          return true;
        });
      }
      
      this.sendToClient(clientId, {
        type: 'switch_toggled',
        data: {
          entityId: data.entityId,
          newState: newState,
          message: `Switch ${newState ? 'turned on' : 'turned off'} successfully`
        }
      });
      
    } catch (error) {
      console.error('Error toggling switch:', error);
      this.sendError(clientId, `Failed to toggle switch: ${error.message}`);
    }
  }
  
  // Handles entity refresh requests
  async handleRefreshEntity(clientId, data) {
    try {
      console.log(`Refreshing ${data.entityType} ${data.entityId} for client ${clientId}`);
      
      // Find the server and entity
      const servers = this.jsonManager.getServers();
      let targetServer = null;
      let targetEntity = null;
      let targetServerId = null;
      
      for (const [serverId, server] of Object.entries(servers)) {
        const entityArray = data.entityType === 'switch' ? server.switches : server.alarms;
        if (entityArray) {
          const entity = entityArray.find(e => e.entityId === data.entityId);
          if (entity) {
            targetServer = server;
            targetEntity = entity;
            targetServerId = serverId; // Use the JSON server ID, not server.id
            break;
          }
        }
      }
      
      if (!targetServer || !targetEntity) {
        this.sendError(clientId, `${data.entityType} not found`);
        return;
      }
      
      // Find the RustProvider for this server using the JSON server ID
      const rustProvider = this.rustProviders.get(targetServerId);
      if (!rustProvider || !rustProvider.isConnected) {
        this.sendError(clientId, 'Server not connected');
        return;
      }
      
      // Refresh entity info
      await rustProvider.getEntityInfo(data.entityId, data.entityType, targetEntity.entityName);
      
      this.sendToClient(clientId, {
        type: 'entity_refreshed',
        data: {
          entityId: data.entityId,
          entityType: data.entityType,
          message: `${data.entityType} refreshed successfully`
        }
      });
      
    } catch (error) {
      console.error('Error refreshing entity:', error);
      this.sendError(clientId, `Failed to refresh ${data.entityType}: ${error.message}`);
    }
  }
  
  // Handles entity deletion requests
  async handleDeleteEntity(clientId, data) {
    try {
      console.log(`Deleting ${data.entityType} ${data.entityId} for client ${clientId}`);
      
      // Find and remove the entity from JSON
      const servers = this.jsonManager.getServers();
      let removed = false;
      
      for (const [serverId, server] of Object.entries(servers)) {
        const entityArray = data.entityType === 'switch' ? server.switches : server.alarms;
        if (entityArray) {
          const entityIndex = entityArray.findIndex(e => e.entityId === data.entityId);
          if (entityIndex !== -1) {
            entityArray.splice(entityIndex, 1);
            removed = true;
            
            // Update the server in JSON
            this.jsonManager.addServer(serverId, server);
            break;
          }
        }
      }
      
      if (!removed) {
        this.sendError(clientId, `${data.entityType} not found`);
        return;
      }
      
      this.sendToClient(clientId, {
        type: 'entity_deleted',
        data: {
          entityId: data.entityId,
          entityType: data.entityType,
          message: `${data.entityType} deleted successfully`
        }
      });
      
      // Refresh servers list
      this.handleGetServers(clientId);
      
    } catch (error) {
      console.error('Error deleting entity:', error);
      this.sendError(clientId, `Failed to delete ${data.entityType}: ${error.message}`);
    }
  }

  // Handles entity rename requests
  async handleRenameEntity(clientId, data) {
    try {
      console.log(`Renaming ${data.entityType} ${data.entityId} to "${data.newName}" for client ${clientId}`);
      
      // Find and update the entity name in JSON
      const servers = this.jsonManager.getServers();
      let renamed = false;
      
      for (const [serverId, server] of Object.entries(servers)) {
        const entityArray = data.entityType === 'switch' ? server.switches : server.alarms;
        if (entityArray) {
          const entity = entityArray.find(e => e.entityId === data.entityId);
          if (entity) {
            entity.entityName = data.newName;
            renamed = true;
            
            // Update the server in JSON
            this.jsonManager.addServer(serverId, server);
            break;
          }
        }
      }
      
      if (!renamed) {
        this.sendError(clientId, `${data.entityType} not found`);
        return;
      }
      
      this.sendToClient(clientId, {
        type: 'entity_renamed',
        data: {
          entityId: data.entityId,
          entityType: data.entityType,
          newName: data.newName,
          message: `${data.entityType} renamed to "${data.newName}" successfully`
        }
      });
      
      // Refresh servers list to show updated name
      this.handleGetServers(clientId);
      
    } catch (error) {
      console.error('Error renaming entity:', error);
      this.sendError(clientId, `Failed to rename ${data.entityType}: ${error.message}`);
    }
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
        
        // Ensure FCM listening is started if not already running
        if (!this.fcmPairingService.isRunning()) {
          try {
            const fcmCredentials = this.jsonManager.getFcmCredentials();
            await this.fcmPairingService.startListening(fcmCredentials);
            console.log('FCM listener started with existing tokens');
          } catch (fcmError) {
            console.error('Error starting FCM listener with existing tokens:', fcmError);
          }
        }
        
        this.sendToClient(clientId, {
          type: 'fcm_register_success',
          data: {
            message: 'Valid tokens already exist',
            tokens_exist: true
          }
        });
        return;
      }
      
      // Set up progress callback for real-time updates
      this.fcmRegistrationService.setProgressCallback((progress) => {
        this.sendToClient(clientId, {
          type: 'fcm_registration_progress',
          data: progress
        });
      });
      
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
         
         // Save entity states before reconnecting
         const savedEntityStates = new Map();
         for (const [serverId, rustProvider] of this.rustProviders) {
           if (rustProvider.entityStates) {
             savedEntityStates.set(serverId, new Map(rustProvider.entityStates));
           }
         }
         
         // Reconnect to all servers with new tokens
         try {
           await this.disconnectFromAllServers();
           await this.connectToAllServers();
           
           // Restore entity states to new instances
           for (const [serverId, entityStates] of savedEntityStates) {
             const rustProvider = this.rustProviders.get(serverId);
             if (rustProvider && entityStates) {
               rustProvider.entityStates = new Map(entityStates);
               console.log(`Restored entity states for server ${serverId}:`, Array.from(entityStates.entries()));
             }
           }
         } catch (reconnectError) {
           console.error('Error reconnecting servers after token refresh:', reconnectError);
           // Continue with success response even if reconnection fails
         }
         
         // Start FCM listening with new tokens
         try {
           const fcmCredentials = this.jsonManager.getFcmCredentials();
           await this.fcmPairingService.startListening(fcmCredentials);
           console.log('FCM listener started with new tokens');
         } catch (fcmError) {
           console.error('Error starting FCM listener with new tokens:', fcmError);
           // Continue with success response even if FCM listener fails
         }
         
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
  
  
  
  // Handles ping/pong for connection health
  handlePing(clientId) {
    this.sendToClient(clientId, {
      type: 'pong',
      data: {
        timestamp: new Date().toISOString()
      }
    });
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
  
  // Broadcasts message to all connected clients
  broadcastToAllClients(message) {
    for (const [clientId, client] of this.clients) {
      if (client.ws && client.ws.readyState === 1) { // WebSocket.OPEN
        try {
          client.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Error broadcasting to client ${clientId}:`, error);
        }
      }
    }
  }
  
  // Broadcasts message to clients connected to specific server
  broadcastToServer(serverId, message) {
    for (const [clientId, client] of this.clients) {
      if (client.ws && client.ws.readyState === 1) { // WebSocket.OPEN
        try {
          client.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Error broadcasting to client ${clientId}:`, error);
        }
      }
    }
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
  
  // Handles when a new entity is paired via FCM
  async handleNewEntityPaired(serverId, entityId, entityType, entityName) {
    try {
      console.log(`🔗 New entity paired: ${entityName} (${entityType}) to server ${serverId}`);
      
      // Find the RustProvider for this server
      const rustProvider = this.rustProviders.get(serverId);
      if (rustProvider && rustProvider.isConnected) {
        // Initialize the new entity for monitoring
        await rustProvider.initializeNewEntity(entityId, entityType, entityName);
        console.log(`✅ Entity monitoring initialized for ${entityName}`);
      } else {
        console.log(`⚠️  Server ${serverId} not connected, entity ${entityName} will be initialized on next connection`);
      }
      
      // Broadcast to all clients that a new entity was paired
      this.broadcastToAllClients({
        type: 'entity_paired',
        data: {
          serverId: serverId,
          entityId: entityId,
          entityType: entityType,
          entityName: entityName,
          message: `New ${entityType} "${entityName}" paired successfully`
        }
      });
      
    } catch (error) {
      console.error(`Error handling new entity pairing:`, error);
    }
  }

  // Handles when a new server is paired via FCM
  async handleNewServerPaired(serverId, serverData) {
    try {
      console.log(`🔗 New server paired: ${serverData.name} (${serverData.ip}:${serverData.port})`);
      
      // Automatically connect to the new server
      await this.connectToServer(serverId, serverData);
      
      // Broadcast to all clients that a new server was paired
      this.broadcastToAllClients({
        type: 'server_paired',
        data: {
          serverId: serverId,
          serverName: serverData.name,
          serverIp: serverData.ip,
          serverPort: serverData.port,
          message: `Server "${serverData.name}" paired successfully`
        }
      });
      
    } catch (error) {
      console.error(`Error handling new server pairing:`, error);
    }
  }
  
  // Gets detailed token expiry information
  getTokenExpiryInfo() {
    const config = this.jsonManager.readConfig();
    if (!config.token_expiry) {
      return {
        hasTokens: false,
        isExpired: true,
        expiryDate: null,
        timeUntilExpiry: null,
        expiryStatus: 'No tokens found'
      };
    }
    
    const now = new Date().getTime();
    // token_expiry is now stored in milliseconds (JavaScript format)
    const expiryTime = config.token_expiry;
    const isExpired = now >= expiryTime;
    const timeUntilExpiry = expiryTime - now;
    
    let expiryStatus;
    if (isExpired) {
      expiryStatus = 'Expired';
    } else if (timeUntilExpiry < 24 * 60 * 60 * 1000) { // Less than 24 hours
      expiryStatus = 'Expires soon';
    } else {
      expiryStatus = 'Valid';
    }
    
    return {
      hasTokens: true,
      isExpired: isExpired,
      expiryDate: new Date(expiryTime).toISOString(),
      timeUntilExpiry: timeUntilExpiry,
      expiryStatus: expiryStatus
    };
  }
  
  // Generates unique server ID
  generateServerId() {
    return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/[x]/g, function() {
      return (Math.random() * 16 | 0).toString(16);
    });
  }
   
   // Connects to a Rust+ server
   async connectToServer(serverId, serverData) {
     try {
       console.log(`Connecting to Rust+ server: ${serverData.name} (${serverData.ip}:${serverData.port})`);
       console.log(`Using credentials - Player ID: ${serverData.playerId}, Token: [REDACTED]`);
       
       // Create RustProvider instance
       const rustProvider = new RustProvider(serverData);
       
       // Set up event handlers
       this.setupRustProviderEvents(serverId, rustProvider);
       
       // Store the provider
       this.rustProviders.set(serverId, rustProvider);
       
       // Connect to the server
       console.log(`Attempting connection to ${serverData.ip}:${serverData.port}...`);
       await rustProvider.connect();
       
       console.log(`Successfully connected to server ${serverId}`);
       
     } catch (error) {
       console.error(`Failed to connect to server ${serverId}:`, error);
       console.error(`Connection details - IP: ${serverData.ip}, Port: ${serverData.port}, Player ID: ${serverData.playerId}`);
       // Clean up failed connection
       this.rustProviders.delete(serverId);
       throw error;
     }
   }
   
   // Disconnects from a Rust+ server
   async disconnectFromServer(serverId) {
     try {
       const rustProvider = this.rustProviders.get(serverId);
       if (rustProvider) {
         console.log(`Disconnecting from server ${serverId}`);
         await rustProvider.disconnect();
         this.rustProviders.delete(serverId);
         console.log(`Successfully disconnected from server ${serverId}`);
       }
     } catch (error) {
       console.error(`Error disconnecting from server ${serverId}:`, error);
     }
   }
   
   // Sets up event handlers for RustProvider
   setupRustProviderEvents(serverId, rustProvider) {
     rustProvider.on('connecting', () => {
       console.log(`Server ${serverId} is connecting...`);
       this.broadcastToServer(serverId, {
         type: 'server_connecting',
         data: { serverId: serverId }
       });
     });
     
     rustProvider.on('connected', () => {
       console.log(`Server ${serverId} connected successfully`);
       this.broadcastToServer(serverId, {
         type: 'server_connected',
         data: { serverId: serverId }
       });
     });
     
     rustProvider.on('disconnected', () => {
       console.log(`Server ${serverId} disconnected`);
       this.broadcastToServer(serverId, {
         type: 'server_disconnected',
         data: { serverId: serverId }
       });
     });
     
     rustProvider.on('error', (error) => {
       console.error(`Server ${serverId} error:`, error);
       this.broadcastToServer(serverId, {
         type: 'server_error',
         data: { 
           serverId: serverId,
           error: error.message || error
         }
       });
     });
     
    rustProvider.on('message', (message) => {
      console.log(`Server ${serverId} message:`, message);
      this.broadcastToServer(serverId, {
        type: 'server_message',
        data: { 
          serverId: serverId,
          message: message
        }
      });
    });
    
    rustProvider.on('entityChanged', (entityData) => {
      console.log(`Server ${serverId} entity changed:`, entityData);
      const message = {
        type: 'entity_changed',
        data: {
          serverId: serverId,
          entityId: entityData.entityId,
          entityName: entityData.entityName,
          isActive: entityData.isActive,
          serverName: entityData.serverName
        }
      };
      console.log(`Broadcasting entity_changed message:`, message);
      this.broadcastToServer(serverId, message);
    });
    
    rustProvider.on('teamMessage', (teamData) => {
      console.log(`Server ${serverId} team message:`, teamData);
      const message = {
        type: 'team_message',
        data: {
          serverId: serverId,
          playerName: teamData.playerName,
          message: teamData.message,
          timestamp: teamData.timestamp,
          serverName: teamData.serverName
        }
      };
      console.log(`Broadcasting team_message:`, message);
      this.broadcastToServer(serverId, message);
    });
    
  }
   
   // Connects to all available servers
   async connectToAllServers() {
     try {
       const servers = this.jsonManager.getServers();
       
       for (const [serverId, serverData] of Object.entries(servers)) {
         // Only connect if not already connected
         if (!this.rustProviders.has(serverId)) {
           try {
             await this.connectToServer(serverId, serverData);
           } catch (error) {
             console.error(`Failed to connect to server ${serverId}:`, error);
             // Continue with other servers
           }
         }
       }
     } catch (error) {
       console.error('Error connecting to all servers:', error);
     }
   }
   
   // Disconnects from all servers
   async disconnectFromAllServers() {
     try {
       const serverIds = Array.from(this.rustProviders.keys());
       
       for (const serverId of serverIds) {
         await this.disconnectFromServer(serverId);
       }
     } catch (error) {
       console.error('Error disconnecting from all servers:', error);
     }
   }
   
   // Gets connection status for all servers
   getConnectionStatus() {
     const status = {};
     
     for (const [serverId, rustProvider] of this.rustProviders) {
       status[serverId] = {
         connected: rustProvider.isConnected,
         serverInfo: rustProvider.serverInfo
       };
     }
     
     return status;
   }

  // Handles get_team_info command
  async handleGetTeamInfo(clientId, data) {
    try {
      const { serverId } = data;
      
      if (!serverId) {
        this.sendError(clientId, 'Server ID is required');
        return;
      }
      
      const rustProvider = this.rustProviders.get(serverId);
      if (!rustProvider) {
        this.sendError(clientId, 'Server not found or not connected');
        return;
      }
      
      if (!rustProvider.isConnected) {
        this.sendError(clientId, 'Server not connected');
        return;
      }
      
      // Get team info from cache first
      const cachedTeamInfo = rustProvider.getTeamInfo();
      if (cachedTeamInfo) {
        const message = {
          type: 'team_info',
          data: {
            serverId: serverId,
            teamInfo: cachedTeamInfo
          }
        };
        this.sendToClient(clientId, message);
        return;
      }
      
      // If no cached data, try to get fresh data using the rustplus.js library
      rustProvider.rustplus.getTeamInfo((err, teamInfo) => {
        if (err) {
          console.error(`Error getting team info for server ${serverId}:`, err);
          this.sendError(clientId, 'Failed to get team info');
          return;
        }
        
        const message = {
          type: 'team_info',
          data: {
            serverId: serverId,
            teamInfo: teamInfo
          }
        };
        
        this.sendToClient(clientId, message);
      });
      
    } catch (error) {
      console.error('Error handling get_team_info:', error);
      this.sendError(clientId, 'Internal server error');
    }
  }

  // Handles send_team_message command
  async handleSendTeamMessage(clientId, data) {
    try {
      const { serverId, message } = data;
      
      if (!serverId) {
        this.sendError(clientId, 'Server ID is required');
        return;
      }
      
      if (!message) {
        this.sendError(clientId, 'Message is required');
        return;
      }
      
      const rustProvider = this.rustProviders.get(serverId);
      if (!rustProvider) {
        this.sendError(clientId, 'Server not found or not connected');
        return;
      }
      
      if (!rustProvider.isConnected) {
        this.sendError(clientId, 'Server not connected');
        return;
      }
      
      // Send team message using the rustplus.js library
      try {
        rustProvider.rustplus.sendTeamMessage(message);
        
        const response = {
          type: 'team_message_sent',
          data: {
            serverId: serverId,
            message: message,
            success: true
          }
        };
        
        this.sendToClient(clientId, response);
      } catch (error) {
        console.error(`Error sending team message for server ${serverId}:`, error);
        this.sendError(clientId, 'Failed to send team message');
      }
      
    } catch (error) {
      console.error('Error handling send_team_message:', error);
      this.sendError(clientId, 'Internal server error');
    }
  }

  // Handles get_entity_info command
  async handleGetEntityInfo(clientId, data) {
    try {
      const { serverId, entityId } = data;
      
      if (!serverId) {
        this.sendError(clientId, 'Server ID is required');
        return;
      }
      
      if (!entityId) {
        this.sendError(clientId, 'Entity ID is required');
        return;
      }
      
      const rustProvider = this.rustProviders.get(serverId);
      if (!rustProvider) {
        this.sendError(clientId, 'Server not found or not connected');
        return;
      }
      
      if (!rustProvider.isConnected) {
        this.sendError(clientId, 'Server not connected');
        return;
      }
      
      // Get entity info from cache first
      const cachedEntityState = rustProvider.entityStates.get(String(entityId));
      if (cachedEntityState) {
        const message = {
          type: 'entity_info',
          data: {
            entityId: entityId,
            isActive: cachedEntityState.isActive,
            available: true,
            lastChecked: cachedEntityState.lastChecked
          }
        };
        this.sendToClient(clientId, message);
        return;
      }
      
      // If no cached data, try to get fresh data using the rustplus.js library
      rustProvider.rustplus.getEntityInfo(entityId, (err, entityInfo) => {
        if (err) {
          console.error(`Error getting entity info for server ${serverId}, entity ${entityId}:`, err);
          
          // Check if it's a "not_found" error - entity doesn't exist on this server
          if (err.response && err.response.error && err.response.error.error === 'not_found') {
            const message = {
              type: 'entity_info',
              data: {
                entityId: entityId,
                isActive: false,
                available: false,
                lastChecked: null
              }
            };
            this.sendToClient(clientId, message);
            return;
          }
          
          this.sendError(clientId, 'Failed to get entity info');
          return;
        }
        
        const message = {
          type: 'entity_info',
          data: {
            entityId: entityId,
            isActive: entityInfo.isActive || false,
            available: true,
            lastChecked: new Date().toISOString()
          }
        };
        
        this.sendToClient(clientId, message);
      });
      
    } catch (error) {
      console.error('Error handling get_entity_info:', error);
      this.sendError(clientId, 'Internal server error');
    }
  }

  // Handles refresh_all_connections command - disconnects all servers, waits, then reconnects
  async handleRefreshAllConnections(clientId) {
    try {
      console.log('🔄 Refreshing all server connections...');
      
      // Disconnect all servers
      await this.disconnectFromAllServers();
      
      // Wait 1000ms
      console.log('⏳ Waiting 1000ms before reconnecting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reconnect all servers
      console.log('🔗 Reconnecting to all servers...');
      await this.initializeConnections();
      
      // Send success response
      this.sendToClient(clientId, {
        type: 'refresh_all_connections_success',
        data: {
          message: 'All server connections refreshed successfully',
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Error refreshing all connections:', error);
      this.sendError(clientId, 'Failed to refresh connections');
    }
  }
}
 
 module.exports = WebSocketService;
