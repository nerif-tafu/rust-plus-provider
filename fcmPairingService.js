// fcmPairingService.js - Handles FCM server pairing
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');

class FcmPairingService {
  constructor() {
    this.client = null;
    this.isListening = false;
    this.pairingCallbacks = new Map(); // clientId -> resolve function
  }
  
  // Starts listening for FCM pairing notifications
  async startListening(fcmCredentials) {
    if (this.isListening) {
      console.log('FCM listener already running');
      return;
    }
    
    try {
      console.log('Starting FCM listener for server pairing...');
      
      const androidId = fcmCredentials.gcm.androidId;
      const securityToken = fcmCredentials.gcm.securityToken;
      
      this.client = new PushReceiverClient(androidId, securityToken, []);
      
      // Set up event handler for incoming notifications
      this.client.on('ON_DATA_RECEIVED', (data) => {
        console.log('FCM notification received:', data);
        this.handlePairingNotification(data);
      });
      
      await this.client.connect();
      this.isListening = true;
      console.log('FCM listener started successfully');
      
    } catch (error) {
      console.error('Error starting FCM listener:', error);
      throw error;
    }
  }
  
  // Stops the FCM listener
  async stopListening() {
    if (this.client && this.isListening) {
      try {
        await this.client.disconnect();
        this.client = null;
        this.isListening = false;
        console.log('FCM listener stopped');
      } catch (error) {
        console.error('Error stopping FCM listener:', error);
      }
    }
  }
  
  // Handles incoming pairing notifications
  handlePairingNotification(data) {
    try {
      // Parse the notification data to extract server information
      const serverData = this.parsePairingNotification(data);
      
      if (serverData) {
        console.log('Server pairing notification received:', serverData);
        
        // Notify all waiting clients
        this.pairingCallbacks.forEach((resolve, clientId) => {
          resolve(serverData);
        });
        
        // Clear all callbacks
        this.pairingCallbacks.clear();
      }
      
    } catch (error) {
      console.error('Error handling pairing notification:', error);
    }
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
        playerToken: serverInfo.playerToken || ''
      };
      
      // Validate that we have essential fields
      if (serverData.ip && serverData.name && serverData.playerId && serverData.playerToken) {
        return serverData;
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
