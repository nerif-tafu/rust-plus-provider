// index.js - Home page functionality
class HomePage {
    constructor() {
        this.websocket = null;
        this.clientId = null;
        
        this.init();
    }

    init() {
        console.log('HomePage initializing...');
        this.connectWebSocket();
        
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
                this.updateQuickStats(message.data.servers);
                if (window.navigationManager) {
                    window.navigationManager.handleMessage(message);
                }
                break;
        }
    }

    updateQuickStats(servers) {
        if (!servers) return;
        
        const serverList = Object.values(servers);
        const totalServers = serverList.length;
        const connectedServers = serverList.filter(server => server.status === 'connected').length;
        
        let totalSwitches = 0;
        let totalAlarms = 0;
        
        serverList.forEach(server => {
            totalSwitches += (server.switches || []).length;
            totalAlarms += (server.alarms || []).length;
        });
        
        // Update the stats display
        document.getElementById('totalServers').textContent = totalServers;
        document.getElementById('connectedServers').textContent = connectedServers;
        document.getElementById('totalSwitches').textContent = totalSwitches;
        document.getElementById('totalAlarms').textContent = totalAlarms;
    }
}

// Initialize the home page
const homePage = new HomePage();

// Make homePage globally available for navigation
window.homePage = homePage;
