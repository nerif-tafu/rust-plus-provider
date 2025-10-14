// server.js - Individual server page logic
class ServerPage {
    constructor() {
        this.ws = null;
        this.clientId = null;
        this.serverId = null;
        this.isConnected = false;
        this.autoRefresh = false;
        this.autoRefreshInterval = null;
        this.events = [];
        
        this.init();
    }

    init() {
        console.log('ServerPage initializing...');
        console.log('Current URL:', window.location.href);
        
        // Get server ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.serverId = urlParams.get('id');
        
        console.log('Server ID from URL:', this.serverId);
        
        if (!this.serverId) {
            console.error('No server ID provided in URL');
            this.showError('No server ID provided');
            return;
        }
        
        console.log('Connecting to WebSocket...');
        this.connectWebSocket();
        this.setupEventListeners();
        
        // Set current server for navigation
        window.navigationManager.setCurrentServer(this.serverId);
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        console.log('WebSocket URL:', wsUrl);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to Rust+ Provider');
            this.isConnected = true;
            this.hideConnectionError();
            this.loadServerData();
            
            // Initialize navigation after connection is established
            window.navigationManager.init();
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from Rust+ Provider');
            this.isConnected = false;
            this.showConnectionError();
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.showConnectionError();
        };
    }

    setupEventListeners() {
        // Auto-refresh toggle
        document.addEventListener('DOMContentLoaded', () => {
            this.loadServerData();
            this.loadLiveServerInfo();
            this.loadLiveMapData();
        });
        
        // Auto-fetch live data when switching tabs
        document.addEventListener('shown.bs.tab', (e) => {
            const targetTab = e.target.getAttribute('data-bs-target');
            if (targetTab === '#server-info') {
                this.loadLiveServerInfo();
            } else if (targetTab === '#map-data') {
                this.loadLiveMapData();
            }
        });
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected');
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'connected':
                this.clientId = message.data.clientId;
                console.log('Client ID:', this.clientId);
                this.hideConnectionError();
                break;
                
            case 'server_data':
                this.updateServerData(message.data);
                break;
                
            case 'server_info':
                this.updateServerInfo(message.data);
                break;
                
            case 'map_data':
                this.updateMapData(message.data);
                break;
                
            case 'servers_list':
                window.navigationManager.handleMessage(message);
                break;
                
            case 'server_connected':
                if (message.data.serverId === this.serverId) {
                    this.addLiveEvent('Server Connected', `Connected to ${message.data.serverName}`);
                    this.updateServerStatus('connected');
                    // Update navigation with new status
                    window.navigationManager.refreshServerList();
                }
                break;
                
            case 'server_disconnected':
                if (message.data.serverId === this.serverId) {
                    this.addLiveEvent('Server Disconnected', `Disconnected from ${message.data.serverName}`);
                    this.updateServerStatus('disconnected');
                    // Update navigation with new status
                    window.navigationManager.refreshServerList();
                }
                break;
                
            case 'entity_changed':
                if (message.data.serverId === this.serverId) {
                    this.addLiveEvent('Entity Change', `Entity ${message.data.entityId} is now ${message.data.isActive ? 'ACTIVE' : 'INACTIVE'}`);
                }
                break;
                
            case 'entity_paired':
                if (message.data.serverId === this.serverId) {
                    this.addLiveEvent('Entity Paired', message.data.message);
                }
                break;
                
            case 'entity_renamed':
                if (message.data.serverId === this.serverId) {
                    this.addLiveEvent('Entity Renamed', message.data.message);
                }
                break;
                
            case 'team_message':
                if (message.data.serverId === this.serverId) {
                    this.addLiveEvent('Team Chat', `${message.data.playerName}: ${message.data.message}`);
                }
                break;
                
            case 'server_connected':
                if (message.data.serverId === this.serverId) {
                    this.addLiveEvent('Server Connected', `Connected to ${message.data.serverName}`);
                    this.updateServerStatus('connected');
                }
                break;
                
            case 'server_disconnected':
                if (message.data.serverId === this.serverId) {
                    this.addLiveEvent('Server Disconnected', `Disconnected from ${message.data.serverName}`);
                    this.updateServerStatus('disconnected');
                }
                break;
                
            case 'server_connecting':
                if (message.data.serverId === this.serverId) {
                    this.addLiveEvent('Server Connecting', `Connecting to ${message.data.serverName}...`);
                    this.updateServerStatus('connecting');
                }
                break;
                
            case 'server_error':
                if (message.data.serverId === this.serverId) {
                    this.addLiveEvent('Server Error', message.data.error);
                    this.updateServerStatus('error');
                }
                break;
                
            case 'error':
                this.showError(message.data.error);
                break;
        }
    }

    loadServerData() {
        this.sendMessage({
            type: 'get_server_data',
            data: { serverId: this.serverId }
        });
    }

    loadLiveServerInfo() {
        this.sendMessage({
            type: 'get_server_info',
            data: { serverId: this.serverId }
        });
    }

    loadLiveMapData() {
        this.sendMessage({
            type: 'get_map_data',
            data: { serverId: this.serverId }
        });
    }


    updateServerData(data) {
        // Update server header
        document.getElementById('serverName').textContent = data.serverInfo.name || 'Unknown Server';
        document.getElementById('serverIp').textContent = data.serverInfo.ip || 'Unknown';
        document.getElementById('serverPort').textContent = data.serverInfo.port || 'Unknown';
        document.getElementById('serverPlayerId').textContent = data.serverInfo.playerId || 'Unknown';
        
        // Update smart device counts
        document.getElementById('switchCount').textContent = data.smartDevices.switches.length;
        document.getElementById('alarmCount').textContent = data.smartDevices.alarms.length;
        
        // Update server status
        this.updateServerStatus(data.serverInfo.status || 'unknown');
        
        // Update data tabs
        document.getElementById('serverInfoData').innerHTML = `<pre>${JSON.stringify(data.serverInfo, null, 2)}</pre>`;
        document.getElementById('smartDevicesData').innerHTML = `<pre>${JSON.stringify(data.smartDevices, null, 2)}</pre>`;
        document.getElementById('mapDataData').innerHTML = `<pre>${JSON.stringify(data.mapData, null, 2)}</pre>`;
    }

    updateServerInfo(data) {
        console.log('Updating live server info:', data.serverInfo);
        
        // Update server info tab with live data
        document.getElementById('serverInfoData').innerHTML = `<pre>${JSON.stringify(data.serverInfo, null, 2)}</pre>`;
        
        // Update server header with live data if available
        if (data.serverInfo.name) {
            document.getElementById('serverName').textContent = data.serverInfo.name;
        }
        if (data.serverInfo.ip) {
            document.getElementById('serverIp').textContent = data.serverInfo.ip;
        }
        if (data.serverInfo.port) {
            document.getElementById('serverPort').textContent = data.serverInfo.port;
        }
        
        // Add live event
        this.addLiveEvent('Server Info', 'Live server info updated');
    }

    updateMapData(data) {
        console.log('Updating live map data:', data.mapData);
        
        // Update map data tab with live data
        document.getElementById('mapDataData').innerHTML = `<pre>${JSON.stringify(data.mapData, null, 2)}</pre>`;
        
        // Add live event
        this.addLiveEvent('Map Data', 'Live map and markers updated');
    }


    updateServerStatus(status) {
        const statusElement = document.getElementById('serverStatus');
        const statusClass = status === 'connected' ? 'success' : 
                           status === 'connecting' ? 'warning' : 
                           status === 'error' ? 'danger' : 'secondary';
        const statusIcon = status === 'connected' ? 'check-circle' : 
                          status === 'connecting' ? 'arrow-clockwise' : 
                          status === 'error' ? 'x-circle' : 'question-circle';
        
        statusElement.className = `badge bg-${statusClass} ms-2`;
        statusElement.innerHTML = `<i class="bi bi-${statusIcon}"></i> ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    }

    addLiveEvent(type, message) {
        const eventsContainer = document.getElementById('liveEvents');
        const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const eventHtml = `
            <div class="live-event ${this.getEventClass(type)}" id="${eventId}">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong><i class="bi bi-${this.getEventIcon(type)}"></i> ${type}</strong>
                        <div class="text-muted small">${message}</div>
                    </div>
                    <small class="text-muted">${new Date().toLocaleTimeString()}</small>
                </div>
            </div>
        `;
        
        // Add to top of events
        if (eventsContainer.children.length === 1 && eventsContainer.children[0].textContent.includes('Waiting for events')) {
            eventsContainer.innerHTML = eventHtml;
        } else {
            eventsContainer.insertAdjacentHTML('afterbegin', eventHtml);
        }
        
        // Keep only last 50 events
        const events = eventsContainer.children;
        if (events.length > 50) {
            eventsContainer.removeChild(events[events.length - 1]);
        }
        
        // Store event
        this.events.unshift({
            id: eventId,
            type: type,
            message: message,
            timestamp: Date.now()
        });
        
        // Keep only last 50 events in memory
        if (this.events.length > 50) {
            this.events = this.events.slice(0, 50);
        }
    }

    getEventClass(type) {
        const classes = {
            'Entity Change': 'entity-change',
            'Entity Paired': 'entity-paired',
            'Entity Renamed': 'entity-renamed',
            'Team Chat': 'team-chat',
            'Server Connected': 'server-connected',
            'Server Disconnected': 'server-disconnected',
            'Server Connecting': 'server-connecting',
            'Server Error': 'server-error',
            'Map Markers': 'map-markers',
            'Team Info': 'team-info',
            'Server Info': 'server-info'
        };
        return classes[type] || '';
    }

    getEventIcon(type) {
        const icons = {
            'Entity Change': 'toggle-on',
            'Entity Paired': 'plus-circle',
            'Entity Renamed': 'pencil',
            'Team Chat': 'chat-dots',
            'Server Connected': 'check-circle',
            'Server Disconnected': 'x-circle',
            'Server Connecting': 'arrow-clockwise',
            'Server Error': 'exclamation-triangle',
            'Map Markers': 'geo-alt',
            'Team Info': 'people',
            'Server Info': 'info-circle'
        };
        return icons[type] || 'bell';
    }

    refreshData() {
        this.loadServerData();
        this.loadLiveServerInfo();
        this.loadLiveMapData();
    }

    toggleAutoRefresh() {
        this.autoRefresh = !this.autoRefresh;
        const button = document.querySelector('button[onclick="serverPage.toggleAutoRefresh()"]');
        
        if (this.autoRefresh) {
            button.innerHTML = '<i class="bi bi-pause-circle"></i> Stop Auto Refresh';
            button.className = 'btn btn-sm btn-outline-warning';
            this.autoRefreshInterval = setInterval(() => {
                this.loadServerData();
                this.loadLiveServerInfo();
                this.loadLiveMapData();
            }, 10000); // Refresh every 10 seconds
        } else {
            button.innerHTML = '<i class="bi bi-play-circle"></i> Auto Refresh';
            button.className = 'btn btn-sm btn-outline-secondary';
            if (this.autoRefreshInterval) {
                clearInterval(this.autoRefreshInterval);
                this.autoRefreshInterval = null;
            }
        }
    }

    clearEvents() {
        document.getElementById('liveEvents').innerHTML = '<p class="text-muted">Waiting for events...</p>';
        this.events = [];
    }

    showError(message) {
        // Create or update error alert
        let errorAlert = document.getElementById('errorAlert');
        if (!errorAlert) {
            errorAlert = document.createElement('div');
            errorAlert.id = 'errorAlert';
            errorAlert.className = 'alert alert-danger alert-dismissible fade show';
            errorAlert.innerHTML = `
                <span id="errorMessage"></span>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            document.querySelector('.container-fluid').insertBefore(errorAlert, document.querySelector('.row'));
        }
        
        document.getElementById('errorMessage').textContent = message;
        errorAlert.style.display = 'block';
    }

    hideConnectionError() {
        const errorAlert = document.getElementById('errorAlert');
        if (errorAlert) {
            errorAlert.style.display = 'none';
        }
    }

    showConnectionError() {
        this.showError('Connection lost. Attempting to reconnect...');
    }
}

// Initialize the server page
const serverPage = new ServerPage();

// Make serverPage globally available for navigation
window.serverPage = serverPage;
