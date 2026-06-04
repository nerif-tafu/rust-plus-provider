// jsonManager.js - Handles reading and writing to rustPlus.json
const fs = require('fs');
const path = require('path');

class JsonManager {
  constructor() {
    this.configFile = path.join(process.cwd(), 'rustPlus.json');
  }
  
  // Reads the current configuration from rustPlus.json
  readConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        return JSON.parse(data);
      }
      return this.getDefaultConfig();
    } catch (error) {
      console.error('Error reading config file:', error);
      return this.getDefaultConfig();
    }
  }
  
  // Writes configuration to rustPlus.json
  writeConfig(config) {
    try {
      const json = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configFile, json, 'utf8');
      return true;
    } catch (error) {
      console.error('Error writing config file:', error);
      return false;
    }
  }
  
  // Gets default configuration structure
  getDefaultConfig() {
    return {
      fcm_credentials: null,
      expo_push_token: null,
      rustplus_auth_token: null,
      token_expiry: null,
      last_token_refresh: null,
      last_auto_token_refresh: null,
      servers: {}
    };
  }

  getTokenExpiryDays() {
    const raw = process.env.TOKEN_EXPIRY_DAYS;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 14;
  }
  
  // Updates FCM credentials and tokens
  updateTokens(fcmCredentials, expoPushToken, rustplusAuthToken, { isAutoRefresh = false } = {}) {
    const config = this.readConfig();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + this.getTokenExpiryDays());
    const now = Date.now();
    
    config.fcm_credentials = fcmCredentials;
    config.expo_push_token = expoPushToken;
    config.rustplus_auth_token = rustplusAuthToken;
    config.token_expiry = expiryDate.getTime();
    config.last_token_refresh = now;
    if (isAutoRefresh) {
      config.last_auto_token_refresh = now;
    }
    
    return this.writeConfig(config);
  }

  getLastAutoTokenRefresh() {
    const config = this.readConfig();
    return config.last_auto_token_refresh || null;
  }

  hasStoredTokens() {
    const config = this.readConfig();
    return !!(config.fcm_credentials && config.expo_push_token && config.rustplus_auth_token);
  }

  getLastTokenRefresh() {
    const config = this.readConfig();
    return config.last_token_refresh || null;
  }
  
  // Adds a new server to the configuration
  addServer(serverId, serverData) {
    const config = this.readConfig();
    config.servers[serverId] = serverData;
    return this.writeConfig(config);
  }
  
  // Removes a server from the configuration
  removeServer(serverId) {
    const config = this.readConfig();
    delete config.servers[serverId];
    return this.writeConfig(config);
  }
  
  // Gets all servers
  getServers() {
    const config = this.readConfig();
    return config.servers || {};
  }
  
  // Gets a specific server
  getServer(serverId) {
    const config = this.readConfig();
    return config.servers[serverId] || null;
  }
  
  // Checks if tokens are still valid (not expired)
  areTokensValid() {
    const config = this.readConfig();
    if (!config.token_expiry) return false;
    
    const now = new Date().getTime();
    // token_expiry is now stored in milliseconds (JavaScript format)
    return now < config.token_expiry;
  }
  
  // Gets FCM credentials if valid
  getFcmCredentials() {
    if (!this.areTokensValid()) return null;
    const config = this.readConfig();
    return config.fcm_credentials;
  }
  
  // Gets expo push token if valid
  getExpoPushToken() {
    if (!this.areTokensValid()) return null;
    const config = this.readConfig();
    return config.expo_push_token;
  }
  
  // Gets Rust+ auth token if valid
  getRustplusAuthToken() {
    if (!this.areTokensValid()) return null;
    const config = this.readConfig();
    return config.rustplus_auth_token;
  }
  
  // Clears all FCM tokens and keeps servers
  clearTokens() {
    try {
      const config = this.readConfig();
      
      // Clear token-related fields but keep servers
      config.fcm_credentials = null;
      config.expo_push_token = null;
      config.rustplus_auth_token = null;
      config.token_expiry = null;
      config.last_token_refresh = null;
      config.last_auto_token_refresh = null;
      
      // Keep servers intact
      // config.servers remains unchanged
      
      return this.writeConfig(config);
    } catch (error) {
      console.error('Error clearing tokens:', error);
      return false;
    }
  }
}

module.exports = JsonManager;
