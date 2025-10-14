// fcmPairingService.js - Handles FCM server pairing
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');
const JsonManager = require('./jsonManager');

class FcmPairingService {
  constructor() {
    this.client = null;
    this.isListening = false;
    this.pairingCallbacks = new Map(); // clientId -> resolve function
    this.jsonManager = new JsonManager();
    this.onEntityPaired = null; // Callback for when entities are paired
  }
  
  // Starts listening for FCM pairing notifications
  async startListening(fcmCredentials) {
    if (this.isListening) {
      console.log('FCM listener already running');
      return;
    }
    
    try {
      console.log('Starting FCM listener for server pairing...');
      
      // Extract credentials exactly like in index.js
      const androidId = fcmCredentials.gcm.androidId;
      const securityToken = fcmCredentials.gcm.securityToken;
      
      // Create client exactly like in index.js
      this.client = new PushReceiverClient(androidId, securityToken, []);
      
      // Set up event handler for incoming notifications
      this.client.on('ON_DATA_RECEIVED', (data) => {
        console.log('🔔 FCM notification received:', JSON.stringify(data, null, 2));
        this.handlePairingNotification(data);
      });
      
      // Connect exactly like in index.js
      await this.client.connect();
      this.isListening = true;
      console.log('FCM listener started successfully');
      
      // Add connection event listeners for debugging
      this.client.on('connected', () => {
        console.log('🔗 FCM client connected to Google servers');
      });
      
      this.client.on('disconnected', () => {
        console.log('❌ FCM client disconnected from Google servers');
      });
      
      this.client.on('error', (error) => {
        console.error('💥 FCM client error:', error);
      });
      
    } catch (error) {
      console.error('Error starting FCM listener:', error);
      throw error;
    }
  }
  
  // Stops the FCM listener
  async stopListening() {
    if (this.client && this.isListening) {
      try {
        // Use destroy() method exactly like in index.js
        this.client.destroy();
        this.client = null;
        this.isListening = false;
        console.log('FCM listener stopped');
      } catch (error) {
        console.error('Error stopping FCM listener:', error);
        // Force cleanup even if stop fails
        this.client = null;
        this.isListening = false;
      }
    }
  }
  
  // Handles incoming pairing notifications
  handlePairingNotification(data) {
    try {
      console.log('🔍 Processing FCM notification for server pairing...');
      
      // Parse the notification data to extract server information
      const serverData = this.parsePairingNotification(data);
      
      if (serverData) {
        console.log('✅ Server pairing notification received:', serverData);
        
        // Automatically save server to JSON file
        this.autoSaveServer(serverData);
        
        // Notify all waiting clients
        this.pairingCallbacks.forEach((resolve, clientId) => {
          console.log(`📤 Notifying client ${clientId} of server pairing`);
          resolve(serverData);
        });
        
        // Clear all callbacks
        this.pairingCallbacks.clear();
      } else {
        console.log('❌ No server data extracted from FCM notification');
      }
      
    } catch (error) {
      console.error('💥 Error handling pairing notification:', error);
    }
  }

  // Automatically saves server to JSON file when FCM notification is received
  autoSaveServer(serverData) {
    try {
      console.log('💾 Auto-saving server to JSON file...');
      
      // Check if this is a server, alarm, or switch entity
      if (serverData.type === 'server') {
        this.handleServerEntity(serverData);
      } else if (serverData.type === 'entity') {
        this.handleEntityPairing(serverData);
      } else {
        console.log(`ℹ️  Unknown entity type: ${serverData.type}, skipping...`);
      }
      
    } catch (error) {
      console.error('💥 Error auto-saving server:', error);
    }
  }

  // Handles server entity pairing
  handleServerEntity(serverData) {
    // Check if server already exists by ID
    const existingServers = this.jsonManager.getServers();
    const existingServerEntry = Object.entries(existingServers).find(([serverId, server]) => 
      server.id === serverData.id
    );
    
    if (existingServerEntry) {
      const [existingServerId, existingServer] = existingServerEntry;
      
      // Check if player credentials have changed
      const playerIdChanged = existingServer.playerId !== serverData.playerId;
      const playerTokenChanged = existingServer.playerToken !== serverData.playerToken;
      
      if (playerIdChanged || playerTokenChanged) {
        console.log(`🔄 Server already exists but credentials changed, updating...`);
        console.log(`   Player ID changed: ${playerIdChanged}`);
        console.log(`   Player Token changed: ${playerTokenChanged}`);
        
        // Update the existing server with new data
        const success = this.jsonManager.addServer(existingServerId, serverData);
        
        if (success) {
          console.log(`✅ Server updated successfully: ${serverData.name} (${serverData.ip}:${serverData.port})`);
          console.log(`   Server ID: ${existingServerId}`);
        } else {
          console.error('❌ Failed to update server in JSON file');
        }
      } else {
        console.log(`ℹ️  Server already exists with same credentials, skipping: ${serverData.name} (${serverData.ip}:${serverData.port})`);
      }
    } else {
      // Server doesn't exist, create new entry
      const serverId = this.generateServerId();
      const success = this.jsonManager.addServer(serverId, serverData);
      
      if (success) {
        console.log(`✅ New server auto-saved successfully: ${serverData.name} (${serverData.ip}:${serverData.port})`);
        console.log(`   Server ID: ${serverId}`);
      } else {
        console.error('❌ Failed to auto-save new server to JSON file');
      }
    }
  }

  // Handles entity (alarm/switch) pairing
  handleEntityPairing(entityData) {
    try {
      // Find the server this entity belongs to
      const existingServers = this.jsonManager.getServers();
      const serverEntry = Object.entries(existingServers).find(([serverId, server]) => 
        server.id === entityData.id
      );
      
      if (!serverEntry) {
        console.log(`❌ Server not found for entity: ${entityData.entityName} (${entityData.id})`);
        return;
      }
      
      const [serverId, server] = serverEntry;
      
      // Determine entity type based on entityType field
      let entityType = 'unknown';
      if (entityData.entityType === '1') {
        entityType = 'switch';
      } else if (entityData.entityType === '2') {
        entityType = 'alarm';
      }
      
      console.log(`🔗 Pairing ${entityType}: ${entityData.entityName} to server: ${server.name}`);
      
      // Create entity object
      const entity = {
        entityId: entityData.entityId,
        entityName: entityData.entityName,
        entityType: entityData.entityType,
        pairedAt: new Date().toISOString()
      };
      
      // Initialize arrays if they don't exist
      if (!server.switches) server.switches = [];
      if (!server.alarms) server.alarms = [];
      
      // Add entity to appropriate array
      if (entityType === 'switch') {
        // Check if switch already exists
        const existingSwitch = server.switches.find(s => s.entityId === entityData.entityId);
        if (!existingSwitch) {
          server.switches.push(entity);
          console.log(`✅ Smart Switch added: ${entityData.entityName} (${entityData.entityId})`);
        } else {
          console.log(`ℹ️  Smart Switch already exists: ${entityData.entityName} (${entityData.entityId})`);
        }
      } else if (entityType === 'alarm') {
        // Check if alarm already exists
        const existingAlarm = server.alarms.find(a => a.entityId === entityData.entityId);
        if (!existingAlarm) {
          server.alarms.push(entity);
          console.log(`✅ Smart Alarm added: ${entityData.entityName} (${entityData.entityId})`);
        } else {
          console.log(`ℹ️  Smart Alarm already exists: ${entityData.entityName} (${entityData.entityId})`);
        }
      }
      
      // Save updated server data
      const success = this.jsonManager.addServer(serverId, server);
      if (success) {
        console.log(`💾 Server updated with new ${entityType}: ${server.name}`);
        
        // Notify callback about the new entity
        if (this.onEntityPaired) {
          this.onEntityPaired(serverId, entityData.entityId, entityType, entityData.entityName);
        }
      } else {
        console.error('❌ Failed to save server with new entity');
      }
      
    } catch (error) {
      console.error('💥 Error handling entity pairing:', error);
    }
  }

  // Sets callback for when entities are paired
  setEntityPairedCallback(callback) {
    this.onEntityPaired = callback;
  }
  
  // Generates a unique server ID
  generateServerId() {
    return 'server_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  // Parses FCM notification to extract server pairing data
  parsePairingNotification(data) {
    try {
      // The notification structure may vary, so we need to handle different formats
      let serverData = null;
      
      // Try to parse as JSON if it's a string
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          serverData = this.extractServerInfo(parsed);
        } catch (e) {
          // If not JSON, try to extract from text
          serverData = this.extractServerInfoFromText(data);
        }
      } else if (typeof data === 'object') {
        serverData = this.extractServerInfo(data);
      }
      
      return serverData;
      
    } catch (error) {
      console.error('Error parsing pairing notification:', error);
      return null;
    }
  }
  
  // Extracts server information from FCM notification data
  extractServerInfo(data) {
    try {
      // FCM notifications always have appData array
      if (!data.appData || !Array.isArray(data.appData)) {
        console.error('Invalid FCM notification format - missing appData array');
        return null;
      }
      
      // Look for the body field in appData that contains the server JSON
      const bodyData = data.appData.find(item => item.key === 'body');
      if (!bodyData || !bodyData.value) {
        console.error('Invalid FCM notification format - missing body field');
        return null;
      }
      
      // Parse the server JSON from the body field
      const serverInfo = JSON.parse(bodyData.value);
      console.log('Parsed server info from FCM notification:', serverInfo);
      
      const serverData = {
        img: serverInfo.img || '',
        port: serverInfo.port || '28015',
        ip: serverInfo.ip || '',
        name: serverInfo.name || '',
        id: serverInfo.id || '',
        type: serverInfo.type || 'server',
        url: serverInfo.url || '',
        desc: serverInfo.desc || '',
        playerId: serverInfo.playerId || '',
        playerToken: serverInfo.playerToken || '',
        // Entity-specific fields
        entityId: serverInfo.entityId || '',
        entityType: serverInfo.entityType || '',
        entityName: serverInfo.entityName || ''
      };
      
      // Check if this is a server pairing notification (has playerId and playerToken)
      if (serverData.type === 'server' && serverData.ip && serverData.name && serverData.playerId && serverData.playerToken) {
        return serverData;
      }
      
      // Check if this is an entity notification (alarm/switch) - these don't need playerId/playerToken
      if (serverData.type === 'entity' && serverData.ip && serverData.name && serverData.entityId && serverData.entityName) {
        return serverData;
      }
      
      // Check if this is an alarm/switch notification by type field
      if (serverData.type === 'alarm' || serverData.type === 'switch') {
        console.log(`ℹ️  Ignoring ${serverData.type} notification - not a server pairing event`);
        return null;
      }
      
      console.error('Invalid server data - missing essential fields:', serverData);
      return null;
      
    } catch (error) {
      console.error('Error extracting server info from FCM notification:', error);
      return null;
    }
  }
  
  // Extracts server information from text notification
  extractServerInfoFromText(text) {
    // Try to extract server information using regex patterns
    const patterns = {
      ip: /(?:ip|server_ip)[:\s=]+([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/i,
      port: /(?:port)[:\s=]+(\d+)/i,
      name: /(?:name|server_name)[:\s=]+([^\n\r]+)/i,
      playerId: /(?:player_id|playerId)[:\s=]+([^\n\r]+)/i,
      playerToken: /(?:player_token|playerToken)[:\s=]+([^\n\r]+)/i
    };
    
    const serverData = {};
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        serverData[key] = match[1].trim();
      }
    }
    
    // Set defaults
    serverData.img = '';
    serverData.port = serverData.port || '28015';
    serverData.type = 'server';
    serverData.url = '';
    serverData.desc = '';
    serverData.id = serverData.id || this.generateServerId();
    
    // Validate essential fields
    if (serverData.ip && serverData.name && serverData.playerId && serverData.playerToken) {
      return serverData;
    }
    
    return null;
  }
  
  // Generates a unique server ID
  generateServerId() {
    return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/[x]/g, function() {
      return (Math.random() * 16 | 0).toString(16);
    });
  }
  
  // Waits for a server pairing notification
  async waitForPairing(clientId, timeout = 60000) {
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pairingCallbacks.delete(clientId);
        reject(new Error('Pairing timeout - no server notification received'));
      }, timeout);
      
      // Store callback with timeout cleanup
      this.pairingCallbacks.set(clientId, (serverData) => {
        clearTimeout(timeoutId);
        this.pairingCallbacks.delete(clientId);
        resolve(serverData);
      });
    });
  }
  
  // Checks if FCM listener is running
  isRunning() {
    return this.isListening && this.client !== null;
  }
}

module.exports = FcmPairingService;
