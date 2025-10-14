// rustProvider.js - Wrapper around rustplus.js library
const RustPlus = require('@liamcottle/rustplus.js');
const JsonManager = require('./jsonManager');

class RustProvider {
  constructor(serverInfo) {
    // Store server connection information
    this.serverInfo = serverInfo;
    
    // Rust+ library instance
    this.rustplus = null;
    
    // JSON manager for updating entity availability
    this.jsonManager = new JsonManager();
    
    // Connection state
    this.isConnected = false;
    
    // Event callbacks for application events
    this.eventCallbacks = new Map();
    
    // Monitoring interval for periodic updates
    this.monitoringInterval = null;
    
    // Reconnection settings
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 5000; // 5 seconds
    this.reconnectTimeout = null;
    
    // Cached data from Rust+ server
    this.cache = {
      mapMarkers: null,
      teamInfo: null,
      serverInfo: null,
      lastUpdated: null
    };
    
    // In-memory entity state tracking (not persisted to JSON)
    this.entityStates = new Map(); // entityId -> { isActive: boolean, lastChecked: timestamp }
  }
  
  // Establishes connection to Rust+ server
  async connect() {
    try {
      console.log(`Connecting to Rust+ server: ${this.serverInfo.name} (${this.serverInfo.ip}:${this.serverInfo.port})`);
      console.log(`Rust+ connection details - IP: ${this.serverInfo.ip}, Port: ${this.serverInfo.port}, Player ID: ${this.serverInfo.playerId}, Token: ${this.serverInfo.playerToken}`);
      
      // Create RustPlus instance with server info
      this.rustplus = new RustPlus(
        this.serverInfo.ip,
        this.serverInfo.port,
        this.serverInfo.playerId,
        this.serverInfo.playerToken
      );
      
      // Set up library event handlers
      this.setupRustPlusEvents();
      
      // Connect to the server
      console.log(`Attempting Rust+ library connection...`);
      await this.rustplus.connect();
      
      console.log(`Successfully connected to ${this.serverInfo.name}`);
      
    } catch (error) {
      console.error(`Failed to connect to ${this.serverInfo.name}:`, error);
      console.error(`Connection failed for ${this.serverInfo.ip}:${this.serverInfo.port} with Player ID: ${this.serverInfo.playerId}`);
      this.isConnected = false;
      throw error;
    }
  }
  
  // Disconnects from server
  async disconnect() {
    try {
      console.log(`Disconnecting from ${this.serverInfo.name}...`);
      
      // Stop monitoring if running
      this.stopMonitoring();
      
      // Disconnect from rustplus if connected
      if (this.rustplus) {
        await this.rustplus.disconnect();
        this.rustplus = null;
      }
      
      // Update connection state
      this.isConnected = false;
      
      console.log(`Successfully disconnected from ${this.serverInfo.name}`);
      
    } catch (error) {
      console.error(`Error disconnecting from ${this.serverInfo.name}:`, error);
      // Force update connection state even if disconnect fails
      this.isConnected = false;
    }
  }
  
  // Sets up event handlers for the RustPlus library
  setupRustPlusEvents() {
    if (!this.rustplus) return;
    
    // Handle connecting event
    this.rustplus.on('connecting', () => {
      console.log(`${this.serverInfo.name} is connecting...`);
      this.emit('connecting');
    });
    
    // Handle connected event
    this.rustplus.on('connected', () => {
      console.log(`${this.serverInfo.name} connected successfully`);
      this.isConnected = true;
      this.emit('connected');
      
      // Start monitoring after connection
      this.startMonitoring();
      
      // Initialize entity monitoring for switches and alarms
      this.initializeEntityMonitoring();
    });
    
    // Handle disconnected event
    this.rustplus.on('disconnected', () => {
      console.log(`${this.serverInfo.name} disconnected`);
      this.isConnected = false;
      this.emit('disconnected');
      
      // Stop monitoring when disconnected
      this.stopMonitoring();
      
      // Start automatic reconnection
      this.startReconnection();
    });
    
    // Handle error event
    this.rustplus.on('error', (error) => {
      console.error(`${this.serverInfo.name} error:`, error);
      this.emit('error', error);
    });
    
    // Handle message event
    this.rustplus.on('message', (message) => {
      console.log(`${this.serverInfo.name} message:`, message);
      
      // Handle entity change broadcasts
      if (message.broadcast && message.broadcast.entityChanged) {
        this.handleEntityChanged(message.broadcast.entityChanged);
      }
      
      // Handle team message broadcasts
      if (message.broadcast && message.broadcast.teamMessage) {
        this.handleTeamMessage(message.broadcast.teamMessage);
      }
      
      this.emit('message', message);
    });
  }
  
  // Registers event callbacks for application events
  on(event, callback) {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event).push(callback);
  }
  
  // Emits events to registered callbacks
  emit(event, data) {
    if (this.eventCallbacks.has(event)) {
      this.eventCallbacks.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
  }
  
  // Starts monitoring for updates
  startMonitoring() {
    if (this.monitoringInterval) {
      console.log(`${this.serverInfo.name} monitoring already running`);
      return;
    }
    
    console.log(`Starting monitoring for ${this.serverInfo.name}`);
    
    // Set up interval to periodically fetch data (every 30 seconds)
    this.monitoringInterval = setInterval(async () => {
      if (this.isConnected && this.rustplus) {
        try {
          await this.refreshCache();
        } catch (error) {
          console.error(`Error monitoring ${this.serverInfo.name}:`, error);
        }
      }
    }, 30000); // 30 seconds
    
    // Initial cache refresh
    this.refreshCache();
  }
  
  // Stops monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      console.log(`Stopping monitoring for ${this.serverInfo.name}`);
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // Starts automatic reconnection process
  startReconnection() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectInterval * this.reconnectAttempts, 60000); // Cap at 60 seconds max delay
    
    console.log(`${this.serverInfo.name} attempting reconnection ${this.reconnectAttempts} in ${delay/1000}s...`);
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
        this.reconnectAttempts = 0; // Reset on successful connection
        console.log(`${this.serverInfo.name} reconnected successfully`);
      } catch (error) {
        console.error(`${this.serverInfo.name} reconnection attempt ${this.reconnectAttempts} failed:`, error.message);
        this.startReconnection(); // Try again indefinitely
      }
    }, delay);
  }

  // Stops automatic reconnection
  stopReconnection() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
  }
  
  // Gets map markers from cache (fast response)
  getMapMarkers() {
    return this.cache.mapMarkers;
  }
  
  // Gets team information from cache (fast response)
  getTeamInfo() {
    return this.cache.teamInfo;
  }
  
  // Gets server information from cache (fast response)
  getServerInfo() {
    return this.cache.serverInfo;
  }
  
  // Forces refresh of all cached data from Rust+ server
  async refreshCache() {
    if (!this.isConnected || !this.rustplus) {
      console.log(`${this.serverInfo.name} not connected, skipping cache refresh`);
      return;
    }
    
    try {
      console.log(`Refreshing cache for ${this.serverInfo.name}...`);
      
      // Fetch fresh data from rustplus using sendRequestAsync
      const [mapMarkersResponse, teamInfoResponse, serverInfoResponse] = await Promise.allSettled([
        this.rustplus.sendRequestAsync({ getMapMarkers: {} }, 5000).catch(() => null),
        this.rustplus.sendRequestAsync({ getTeamInfo: {} }, 5000).catch(() => null),
        this.rustplus.sendRequestAsync({ getInfo: {} }, 5000).catch(() => null)
      ]);
      
      // Update cache with new data
      if (mapMarkersResponse.status === 'fulfilled' && mapMarkersResponse.value) {
        this.cache.mapMarkers = mapMarkersResponse.value;
        this.emit('mapMarkers', mapMarkersResponse.value);
      }
      
      if (teamInfoResponse.status === 'fulfilled' && teamInfoResponse.value) {
        this.cache.teamInfo = teamInfoResponse.value;
        this.emit('teamInfo', teamInfoResponse.value);
      }
      
      if (serverInfoResponse.status === 'fulfilled' && serverInfoResponse.value) {
        this.cache.serverInfo = serverInfoResponse.value;
        this.emit('serverInfo', serverInfoResponse.value);
      }
      
      // Update lastUpdated timestamp
      this.cache.lastUpdated = new Date();
      
      console.log(`Cache refreshed for ${this.serverInfo.name} at ${this.cache.lastUpdated.toISOString()}`);
      
    } catch (error) {
      console.error(`Error refreshing cache for ${this.serverInfo.name}:`, error);
      throw error;
    }
  }
  
  // Sends team message to Rust+ server
  async sendTeamMessage(message) {
    if (!this.isConnected || !this.rustplus) {
      throw new Error(`${this.serverInfo.name} not connected`);
    }
    
    try {
      console.log(`Sending team message to ${this.serverInfo.name}: ${message}`);
      await this.rustplus.sendRequestAsync({ sendTeamMessage: { message: message } }, 5000);
      console.log(`Team message sent successfully to ${this.serverInfo.name}`);
    } catch (error) {
      console.error(`Error sending team message to ${this.serverInfo.name}:`, error);
      throw error;
    }
  }
  
  // Initializes entity monitoring by calling getEntityInfo for all stored entities
  async initializeEntityMonitoring() {
    try {
      if (!this.isConnected || !this.rustplus) {
        console.log(`${this.serverInfo.name}: Not connected, skipping entity initialization`);
        return;
      }
      
      console.log(`${this.serverInfo.name}: Initializing entity monitoring...`);
      
      // Get switches and alarms from server info
      const switches = this.serverInfo.switches || [];
      const alarms = this.serverInfo.alarms || [];
      
      console.log(`${this.serverInfo.name}: Found ${switches.length} switches and ${alarms.length} alarms`);
      
      // Call getEntityInfo for all switches
      for (const switchEntity of switches) {
        await this.getEntityInfo(switchEntity.entityId, 'switch', switchEntity.entityName);
      }
      
      // Call getEntityInfo for all alarms
      for (const alarmEntity of alarms) {
        await this.getEntityInfo(alarmEntity.entityId, 'alarm', alarmEntity.entityName);
      }
      
      console.log(`${this.serverInfo.name}: Entity monitoring initialized successfully`);
      
    } catch (error) {
      console.error(`${this.serverInfo.name}: Error initializing entity monitoring:`, error);
    }
  }
  
  // Calls getEntityInfo for a specific entity
  async getEntityInfo(entityId, entityType, entityName) {
    try {
      if (!this.isConnected || !this.rustplus) {
        console.log(`${this.serverInfo.name}: Not connected, cannot get entity info for ${entityName}`);
        return;
      }
      
      console.log(`${this.serverInfo.name}: Getting entity info for ${entityType}: ${entityName} (ID: ${entityId})`);
      
      // Call getEntityInfo to enable broadcasts for this entity
      await this.rustplus.getEntityInfo(parseInt(entityId), (message) => {
        console.log(`${this.serverInfo.name}: getEntityInfo response for ${entityName}:`, JSON.stringify(message));
        
        // Check if entity was found or not
        const isAvailable = !message.response || !message.response.error || message.response.error.error !== 'not_found';
        
        
        if (isAvailable) {
          console.log(`${this.serverInfo.name}: Entity ${entityName} is available`);
          
          // Extract current state from response
          let isActive = false;
          if (message.response && message.response.entityInfo && message.response.entityInfo.payload) {
            isActive = message.response.entityInfo.payload.value || false;
            console.log(`${this.serverInfo.name}: Entity ${entityName} current state: ${isActive ? 'ON' : 'OFF'}`);
          }
          
                  // Store entity state in memory (not persisted to JSON)
                  this.entityStates.set(String(entityId), {
                    isActive: isActive,
                    lastChecked: new Date().toISOString()
                  });
        } else {
          console.log(`${this.serverInfo.name}: Entity ${entityName} not found (destroyed or invalid)`);
          console.log(`${this.serverInfo.name}: Full response:`, JSON.stringify(message, null, 2));
          // Remove entity from memory if not available
          this.entityStates.delete(String(entityId));
        }
        
        return true;
      });
      
      console.log(`${this.serverInfo.name}: Entity monitoring enabled for ${entityName}`);
      
    } catch (error) {
      console.error(`${this.serverInfo.name}: Error getting entity info for ${entityName}:`, error);
    }
  }
  
  // Calls getEntityInfo for a newly paired entity
  async initializeNewEntity(entityId, entityType, entityName) {
    try {
      console.log(`${this.serverInfo.name}: Initializing new ${entityType}: ${entityName} (ID: ${entityId})`);
      await this.getEntityInfo(entityId, entityType, entityName);
    } catch (error) {
      console.error(`${this.serverInfo.name}: Error initializing new entity ${entityName}:`, error);
    }
  }
  
  // Handles entity change broadcasts
  handleEntityChanged(entityChanged) {
    try {
      const entityId = entityChanged.entityId;
      const rawValue = entityChanged.payload.value;
      
      // Convert null/undefined to false for consistency
      const value = rawValue === null || rawValue === undefined ? false : Boolean(rawValue);
      const isActive = value ? 'active' : 'inactive';
      
      console.log(`${this.serverInfo.name}: Entity ${entityId} is now ${isActive}`);
      
          // Update entity state in memory (not persisted to JSON)
          const newState = {
            isActive: value,
            lastChecked: new Date().toISOString()
          };
          // Ensure entityId is always stored as a string to avoid key conflicts
          this.entityStates.set(String(entityId), newState);
          console.log(`${this.serverInfo.name}: Updated entity state in memory for ${entityId}:`, newState);
      
      // Get entity name from JSON
      const servers = this.jsonManager.getServers();
      let entityName = null;
      
      // Search through all servers to find the entity
      for (const [serverId, server] of Object.entries(servers)) {
        // Check switches
        const switchEntity = server.switches?.find(s => String(s.entityId) === String(entityId));
        if (switchEntity) {
          entityName = switchEntity.entityName;
          break;
        }
        
        // Check alarms
        const alarmEntity = server.alarms?.find(a => String(a.entityId) === String(entityId));
        if (alarmEntity) {
          entityName = alarmEntity.entityName;
          break;
        }
      }
      
      // Emit entity change event for external handling
      const eventData = {
        entityId: entityId,
        entityName: entityName,
        isActive: value,
        serverName: this.serverInfo.name
      };
      console.log(`${this.serverInfo.name}: Emitting entityChanged event:`, eventData);
      this.emit('entityChanged', eventData);
      
    } catch (error) {
      console.error(`${this.serverInfo.name}: Error handling entity change:`, error);
    }
  }
  
  // Handles team message broadcasts
  handleTeamMessage(teamMessage) {
    try {
      
      // Handle both array and single message formats
      let messageData = null;
      
      if (Array.isArray(teamMessage.message) && teamMessage.message.length > 0) {
        // Array format
        messageData = teamMessage.message[0];
      } else if (teamMessage.message && teamMessage.message.name) {
        // Single message format
        messageData = teamMessage.message;
      }
      
      if (messageData) {
        // Extract message details
        const playerName = messageData.name || 'Unknown Player';
        const messageText = messageData.message || '';
        const timestamp = messageData.time || Date.now();
        
        // Emit team message event for external handling
        const eventData = {
          playerName: playerName,
          message: messageText,
          timestamp: timestamp,
          serverName: this.serverInfo.name
        };
        
        this.emit('teamMessage', eventData);
      }
    } catch (error) {
      console.error(`${this.serverInfo.name}: Error handling team message:`, error);
    }
  }
  
  // Gets current entity state from memory
  getEntityState(entityId) {
    // Ensure entityId is always treated as a string to match storage
    const state = this.entityStates.get(String(entityId)) || { isActive: false, lastChecked: null };
    return state;
  }
  
}

module.exports = RustProvider;
