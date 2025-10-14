// servers.js - Servers page functionality
class ServersPage {
    constructor() {
        this.websocket = null;
        this.clientId = null;
        this.currentServerId = null;
        this.autoRefreshInterval = null;
        this.isAutoRefresh = false;
        this.serverList = {};
        this.liveUpdateInterval = null;
        this.pendingServerId = null;
        
        this.init();
    }

    init() {
        console.log('ServersPage initializing...');
        this.connectWebSocket();
        this.setupEventListeners();
        this.loadStateFromURL();
        
        // Initialize navigation if available
        if (window.navigationManager) {
            window.navigationManager.init();
        } else {
            console.warn('Navigation manager not available');
        }
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        console.log('Connecting to WebSocket...');
        console.log('WebSocket URL:', wsUrl);
        
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
            console.log('Connected to Rust+ Provider');
            this.sendMessage({ type: 'get_servers' });
        };
        
        this.websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };
        
        this.websocket.onclose = () => {
            console.log('Disconnected from Rust+ Provider');
            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                this.connectWebSocket();
            }, 3000);
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    sendMessage(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
        } else {
            console.log('WebSocket not connected');
        }
    }

    handleMessage(message) {
        console.log('Received message:', message);
        
        switch (message.type) {
            case 'client_id':
                this.clientId = message.data.clientId;
                console.log('Client ID:', this.clientId);
                break;
                
            case 'servers_list':
                this.serverList = message.data.servers;
                this.updateServerList(message.data.servers);
                if (window.navigationManager) {
                    window.navigationManager.handleMessage(message);
                }
                break;
                
            case 'server_info':
                this.updateServerInfo(message.data);
                break;
                
            case 'map_data':
                this.updateMapData(message.data);
                break;
                
            case 'server_connected':
                this.updateConnectionStatus('connected', message.data.serverName);
                window.navigationManager.refreshServerList();
                break;
                
            case 'server_disconnected':
                this.updateConnectionStatus('disconnected', message.data.serverName);
                window.navigationManager.refreshServerList();
                break;
        }
    }

    setupEventListeners() {
        // Auto-refresh toggle
        document.addEventListener('DOMContentLoaded', () => {
            this.loadServers();
        });
        
        // Tab change events
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (event) => {
                this.onTabChange(event);
            });
        });
    }

    loadServers() {
        this.sendMessage({ type: 'get_servers' });
    }

    updateServerList(servers) {
        const serverSelect = document.getElementById('serverSelect');
        if (!serverSelect) return;
        
        // Store current selection before clearing
        const currentSelection = serverSelect.value;
        
        // Clear existing options
        serverSelect.innerHTML = '<option value="">Choose a server...</option>';
        
        // Add server options
        Object.entries(servers).forEach(([serverId, serverData]) => {
            const option = document.createElement('option');
            option.value = serverId;
            option.textContent = `${serverData.name} (${serverData.ip}:${serverData.port})`;
            serverSelect.appendChild(option);
        });
        
        // Handle pending server ID from URL
        if (this.pendingServerId) {
            console.log('Handling pending server ID from URL:', this.pendingServerId);
            const pendingServer = servers[this.pendingServerId];
            if (pendingServer) {
                console.log('Found pending server:', pendingServer.name);
                // Set the dropdown value
                serverSelect.value = this.pendingServerId;
                console.log('Set dropdown value to:', serverSelect.value);
                // Load the server data
                this.currentServerId = this.pendingServerId;
                this.loadServerData();
                this.pendingServerId = null;
            } else {
                console.log('Pending server not found in servers list');
            }
        } else if (currentSelection && servers[currentSelection]) {
            // Restore previous selection if no pending server
            serverSelect.value = currentSelection;
            console.log('Restored previous selection:', currentSelection);
        }
        
        // Update smart devices if a server is currently selected
        if (this.currentServerId && servers[this.currentServerId]) {
            this.updateSmartDevices(servers[this.currentServerId]);
        }
    }

    loadServerData() {
        const serverSelect = document.getElementById('serverSelect');
        
        // Always respect the dropdown selection (user can change it)
        if (!serverSelect || !serverSelect.value) {
            this.currentServerId = null;
            this.stopLiveUpdates();
            this.clearAllData();
            this.updateURL(null, this.getCurrentTab());
            return;
        }
        
        // Update currentServerId to match dropdown selection
        this.currentServerId = serverSelect.value;
        this.updateConnectionStatus('loading', 'Loading...');
        
        // Update connection status based on server data
        this.updateConnectionStatusFromServerList();
        
        // Update smart devices display
        if (this.serverList[this.currentServerId]) {
            this.updateSmartDevices(this.serverList[this.currentServerId]);
        }
        
        // Update URL with selected server, preserving current tab
        const currentTab = this.getCurrentTab();
        this.updateURL(this.currentServerId, currentTab);
        
        // Start live updates every 10 seconds
        this.startLiveUpdates();
        
        // Load server info and map data
        this.sendMessage({ 
            type: 'get_server_info', 
            data: { serverId: this.currentServerId }
        });
        
        this.sendMessage({ 
            type: 'get_map_data', 
            data: { serverId: this.currentServerId }
        });
    }

    updateServerInfo(data) {
        const output = document.getElementById('serverInfoOutput');
        if (!output) return;
        
        output.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        this.updateLastUpdated('serverInfoLastUpdated');
    }

    updateMapData(data) {
        const output = document.getElementById('mapDataOutput');
        if (!output) return;
        
        output.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        this.updateLastUpdated('mapDataLastUpdated');
    }

    updateConnectionStatus(status, serverName = '') {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;
        
        const statusClasses = {
            'connected': 'status-connected',
            'disconnected': 'status-disconnected',
            'connecting': 'status-connecting',
            'loading': 'status-connecting'
        };
        
        const statusTexts = {
            'connected': `Connected to ${serverName}`,
            'disconnected': 'Disconnected',
            'connecting': 'Connecting...',
            'loading': 'Loading...'
        };
        
        // Update status indicator
        const indicator = statusElement.querySelector('.status-indicator');
        if (indicator) {
            indicator.className = `status-indicator ${statusClasses[status] || 'status-disconnected'}`;
        }
        
        // Update status text
        const textElement = statusElement.querySelector('span:last-child');
        if (textElement) {
            textElement.textContent = statusTexts[status] || 'Unknown';
        }
    }
    
    updateConnectionStatusFromServerList() {
        if (!this.currentServerId || !this.serverList[this.currentServerId]) {
            this.updateConnectionStatus('disconnected');
            return;
        }
        
        const server = this.serverList[this.currentServerId];
        const status = server.status || 'disconnected';
        const serverName = server.name || 'Unknown Server';
        
        this.updateConnectionStatus(status, serverName);
    }
    
    updateSmartDevices(serverData) {
        const output = document.getElementById('smartDevicesOutput');
        if (!output) return;
        
        const smartDevices = {
            switches: serverData.switches || [],
            alarms: serverData.alarms || []
        };
        
        output.innerHTML = `<pre>${JSON.stringify(smartDevices, null, 2)}</pre>`;
        this.updateLastUpdated('smartDevicesLastUpdated');
    }

    clearAllData() {
        const outputs = ['serverInfoOutput', 'mapDataOutput', 'smartDevicesOutput'];
        outputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = '<pre>Select a server to view data...</pre>';
            }
        });
        this.updateConnectionStatus('disconnected');
    }

    refreshAllData() {
        if (this.currentServerId) {
            this.loadServerData();
        } else {
            this.loadServers();
        }
    }
    
    startLiveUpdates() {
        // Clear any existing interval
        if (this.liveUpdateInterval) {
            clearInterval(this.liveUpdateInterval);
        }
        
        // Start new interval for live updates every 10 seconds
        this.liveUpdateInterval = setInterval(() => {
            if (this.currentServerId) {
                console.log('Performing live update for server:', this.currentServerId);
                
                // Update server info
                this.sendMessage({ 
                    type: 'get_server_info', 
                    data: { serverId: this.currentServerId }
                });
                
                // Update map data
                this.sendMessage({ 
                    type: 'get_map_data', 
                    data: { serverId: this.currentServerId }
                });
                
                // Update smart devices from server list
                if (this.serverList[this.currentServerId]) {
                    this.updateSmartDevices(this.serverList[this.currentServerId]);
                }
            }
        }, 10000); // 10 seconds
    }
    
    stopLiveUpdates() {
        if (this.liveUpdateInterval) {
            clearInterval(this.liveUpdateInterval);
            this.liveUpdateInterval = null;
        }
    }
    
    updateLastUpdated(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        element.textContent = `Last updated: ${timeString}`;
    }

    // URL State Management
    loadStateFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const serverId = urlParams.get('server');
        const tab = urlParams.get('tab');
        
        console.log('Loading state from URL - serverId:', serverId, 'tab:', tab);
        
        if (serverId) {
            // Wait for servers to load, then select the server
            this.pendingServerId = serverId;
            console.log('Set pending server ID:', this.pendingServerId);
        }
        
        if (tab) {
            // Activate the specified tab
            console.log('Activating tab:', tab);
            this.activateTab(tab);
        }
    }

    updateURL(serverId = null, tab = null) {
        const url = new URL(window.location);
        
        if (serverId) {
            url.searchParams.set('server', serverId);
        } else {
            url.searchParams.delete('server');
        }
        
        if (tab) {
            url.searchParams.set('tab', tab);
        } else {
            url.searchParams.delete('tab');
        }
        
        // Update URL without page reload
        window.history.pushState({}, '', url);
    }

    activateTab(tabName) {
        // Remove active class from all tabs
        document.querySelectorAll('.nav-link').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active', 'show');
        });
        
        // Activate the specified tab
        const tabButton = document.querySelector(`[data-bs-target="#${tabName}"]`);
        const tabPane = document.getElementById(tabName);
        
        if (tabButton && tabPane) {
            tabButton.classList.add('active');
            tabPane.classList.add('active', 'show');
        }
    }

    onTabChange(event) {
        const tabName = event.target.getAttribute('data-bs-target').replace('#', '');
        this.updateURL(this.currentServerId, tabName);
    }

    getCurrentTab() {
        // Get the currently active tab
        const activeTab = document.querySelector('.nav-link.active[data-bs-toggle="tab"]');
        if (activeTab) {
            return activeTab.getAttribute('data-bs-target').replace('#', '');
        }
        return null;
    }
}

// Initialize the servers page
const serversPage = new ServersPage();

// Make serversPage globally available for navigation
window.serversPage = serversPage;
