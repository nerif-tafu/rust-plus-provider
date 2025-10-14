// pairing.js - Frontend logic for Rust+ Provider pairing page
class RustPlusProvider {
    constructor() {
        this.ws = null;
        this.clientId = null;
        this.isConnected = false;
        this.servers = {};
        this.init();
        this.setupTabHandlers();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to Rust+ Provider');
            this.isConnected = true;
            this.loadInitialData();
        };
        
        this.ws.onmessage = (event) => {
            this.handleMessage(JSON.parse(event.data));
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
        // Token form submission
        document.getElementById('tokenForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateTokens();
        });

        // Delete tokens button
        document.getElementById('deleteTokens').addEventListener('click', () => {
            this.deleteTokens();
        });

        // Refresh servers button
        document.getElementById('refreshServers').addEventListener('click', () => {
            this.refreshAllConnections();
        });
    }

    setupTabHandlers() {
        // Handle tab switching - no server data tab anymore
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
                
            case 'servers_list':
                this.displayServers(message.data.servers);
                this.updateTokenStatus(message.data.servers);
                window.navigationManager.handleMessage(message);
                
                // Update border colors after a short delay to ensure rustProvider is ready
                setTimeout(() => {
                    this.updateAllEntityBorderColors();
                }, 100);
                
                // Server data is now handled on the dedicated /server-data page
                break;

            case 'connection_status':
                // Update token status with detailed expiry information
                this.updateTokenStatusFromConnectionStatus(message.data);
                break;
                
                
                
                    case 'entity_changed':
                        console.log('Received entity_changed message:', message);
                        this.addLiveEvent('Entity Change', `Entity ${message.data.entityId} is now ${message.data.isActive ? 'ACTIVE' : 'INACTIVE'} on ${message.data.serverName}`);
                        // Update just the button for this specific entity
                        this.updateEntityButton(message.data.entityId, message.data.isActive);
                        break;
                        
                    case 'entity_paired':
                        console.log('Received entity_paired message:', message);
                        this.addLiveEvent('Entity Paired', message.data.message);
                        // Refresh servers to show the new entity
                        this.loadServers();
                        break;

                    case 'server_paired':
                        console.log('Received server_paired message:', message);
                        this.addLiveEvent('Server Paired', message.data.message);
                        // Refresh servers to show the new server
                        this.loadServers();
                        break;

            case 'refresh_all_connections_success':
                console.log('Received refresh_all_connections_success message:', message);
                this.addLiveEvent('Connections Refreshed', message.data.message);
                // Refresh servers to show updated connection status
                this.loadServers();
                break;
                
            case 'fcm_registration_success':
                console.log('Received fcm_registration_success message:', message);
                this.addLiveEvent('FCM Registration', 'FCM tokens registered successfully');
                // Clear any error messages and refresh token status
                this.clearFCMErrors();
                this.loadTokenStatus();
                break;
                
                
            case 'server_connected':
                this.addLiveEvent('Server Connected', `Server ${message.data.serverId} connected successfully`);
                // Refresh servers and connection status
                this.loadServers();
                // Also refresh navigation
                window.navigationManager.refreshServerList();
                break;
                
            case 'server_disconnected':
                this.addLiveEvent('Server Disconnected', `Server ${message.data.serverId} disconnected`);
                // Refresh servers and connection status
                this.loadServers();
                // Also refresh navigation
                window.navigationManager.refreshServerList();
                break;
                
            case 'server_connecting':
                this.addLiveEvent('Server Connecting', `Server ${message.data.serverId} is connecting...`);
                break;
                
            case 'server_error':
                this.addLiveEvent('Server Error', `Server ${message.data.serverId}: ${message.data.error}`);
                break;
                
            case 'mapMarkers':
                this.addLiveEvent('Map Markers', `Map markers updated for server`);
                break;
                
            case 'teamInfo':
                this.addLiveEvent('Team Info', `Team information updated for server`);
                break;
                
            case 'serverInfo':
                this.addLiveEvent('Server Info', `Server information updated for server`);
                break;
                
            case 'fcm_registration_progress':
                this.updateRegistrationProgress(message.data);
                break;
                
            case 'fcm_register_success':
                this.addLiveEvent('FCM Registration', message.data.message);
                this.hideRegistrationProgress();
                // Refresh all data to show updated state
                this.loadServers();
                break;
                
            case 'unregister_server_success':
                this.addLiveEvent('Server Removed', message.data.message);
                // Refresh servers to show updated list
                this.loadServers();
                break;
                
            case 'pong':
                // Handle ping response (no UI update needed)
                break;
                
            case 'tokens_deleted':
                this.addLiveEvent('Tokens Deleted', message.data.message);
                // Refresh all data to show updated state
                this.loadServers();
                break;
                
            case 'switch_toggled':
                console.log('Received switch_toggled message:', message);
                this.addLiveEvent('Switch Toggled', message.data.message);
                // Update just the button for this specific entity
                this.updateEntityButton(message.data.entityId, message.data.newState);
                break;
                
                    case 'entity_refreshed':
                        this.addLiveEvent('Entity Refreshed', message.data.message);
                        // Refresh servers to show updated entity status
                        this.loadServers();
                        break;
                        
                    case 'entity_info':
                        // Handle entity info response to update border colors
                        console.log('Received entity_info:', message.data);
                        if (message.data.entityId && message.data.isActive !== undefined) {
                            this.updateEntityButton(message.data.entityId, message.data.isActive);
                        }
                        break;
                
                    case 'entity_deleted':
                        this.addLiveEvent('Entity Deleted', message.data.message);
                        // Refresh servers to show updated list
                        this.loadServers();
                        break;
                        
                    case 'entity_renamed':
                        this.addLiveEvent('Entity Renamed', message.data.message);
                        // Refresh servers to show updated name
                        this.loadServers();
                        break;
                        
                    case 'team_message':
                        console.log('Received team_message:', message);
                        this.addLiveEvent('Team Chat', `${message.data.playerName}: ${message.data.message}`);
                        break;
                        
                    case 'server_message':
                        // Handle general server messages (map updates, team info, etc.)
                        console.log('Received server_message:', message);
                        // Don't show these in live events as they're usually internal updates
                        break;
                
            case 'error':
                // Handle different types of errors with appropriate user feedback
                const errorMessage = message.data.error;
                
                if (errorMessage === 'Server not connected' || 
                    errorMessage === 'Server not found or not connected') {
                    console.warn('Server connection issue:', errorMessage);
                    this.showServerNotConnectedNotification();
                } else if (errorMessage.includes('Incorrect 2FA code')) {
                    this.showFCMError('2FA Code Error', 'The 2FA code you entered is incorrect. Please check your authenticator app and try again.');
                } else if (errorMessage.includes('Invalid username or password')) {
                    this.showFCMError('Login Error', 'Invalid Steam username or password. Please check your credentials and try again.');
                } else if (errorMessage.includes('Too Many Retries')) {
                    this.showFCMError('Rate Limited', 'Too many login attempts. Please wait a few minutes before trying again.');
                } else if (errorMessage.includes('Chrome session could not be created')) {
                    this.showFCMError('Browser Error', 'Failed to start browser automation. Please ensure Chrome is installed and try again.');
                } else if (errorMessage.includes('FCM registration failed')) {
                    this.showFCMError('Registration Failed', errorMessage);
                } else {
                    // For any other error, check if it might be FCM-related and hide progress
                    if (this.isFCMRelatedError(errorMessage)) {
                        this.hideRegistrationProgress();
                    }
                    this.showError(errorMessage);
                }
                break;
                
            default:
                console.log('Unhandled message type:', message.type);
        }
    }

    loadInitialData() {
        this.loadTokenStatus();
        this.loadServers();
        this.getConnectionStatus();
        this.startPeriodicUpdates();
    }

    loadTokenStatus() {
        // Check if we have valid tokens by looking at the servers response
        // This is a simplified approach - in a real app you'd have a dedicated endpoint
        this.sendMessage({ type: 'get_servers' });
    }

    getConnectionStatus() {
        // Request detailed connection status including FCM token expiry information
        this.sendMessage({ type: 'get_connection_status' });
    }

    loadServers() {
        this.sendMessage({ type: 'get_servers' });
    }


    updateTokens() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const twoFactor = document.getElementById('twoFactor').value;

        if (!username || !password) {
            this.showError('Username and password are required');
            return;
        }

        // Clear any existing error messages before starting new registration
        this.clearFCMErrors();
        
        this.showLoading('Updating FCM tokens...');
        
        this.sendMessage({
            type: 'fcm_register',
            data: {
                username: username,
                password: password,
                twoFactor: twoFactor || null
            }
        });
    }

    deleteTokens() {
        if (confirm('Are you sure you want to delete all FCM tokens? This will disconnect all servers and stop FCM listening.')) {
            this.sendMessage({ type: 'delete_tokens' });
        }
    }

    displayServers(servers) {
        // Store servers data for status checking
        this.servers = servers;
        
        const container = document.getElementById('serversList');
        
        if (!servers || Object.keys(servers).length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-server text-muted" style="font-size: 3rem;"></i>
                    <p class="mt-2 text-muted">No servers paired yet</p>
                    <p class="text-muted">Use the FCM token form above to start pairing servers</p>
                </div>
            `;
            return;
        }

        let html = '';
        Object.entries(servers).forEach(([serverId, server]) => {
            html += this.createServerCard(serverId, server);
        });
        
        container.innerHTML = html;
        
        // Update border colors after displaying servers
        setTimeout(() => {
            this.updateAllEntityBorderColors();
        }, 200);
    }


    createEntitiesHtml(entities, type) {
        if (!entities || entities.length === 0) {
            return '';
        }

        const title = type === 'switch' ? 'Smart Switches' : 'Smart Alarms';
        const className = type === 'switch' ? 'switch' : 'alarm';
        
        let html = `
            <div class="mb-3">
                <h6>${title} (${entities.length})</h6>
        `;
        
        entities.forEach(entity => {
            const isAvailable = entity.lastChecked !== null;
            const statusClass = isAvailable ? 'status-online' : 'status-offline';
            const lastChecked = entity.lastChecked ? new Date(entity.lastChecked).toLocaleTimeString() : 'Never';
            
            // Don't set border color during initial rendering
            // Let updateAllEntityBorderColors() handle it after page loads
            let statusBorderClass = '';
            
            html += `
                <div class="entity-card ${className} ${statusBorderClass} p-2" data-entity-id="${entity.entityId}">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <strong class="text-dark">${entity.entityName}</strong>
                            <br>
                            <small class="text-dark">ID: ${entity.entityId} | Checked: ${lastChecked}</small>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        ${this.createEntityButtons(entity, type, className)}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }
    
    createEntityButtons(entity, type, className) {
        const entityId = entity.entityId;
        const isActive = entity.isActive || false;
        const isAvailable = entity.lastChecked !== null; // Available if we have a lastChecked timestamp
        
        
        if (type === 'switch') {
            const buttonText = isActive ? 'Turn Off' : 'Turn On';
            return `
                <button class="btn btn-sm btn-warning" 
                        onclick="rustProvider.toggleSwitch('${entityId}')" 
                        ${!isAvailable ? 'disabled' : ''}>
                    <i class="bi bi-power"></i> ${buttonText}
                </button>
                <button class="btn btn-sm btn-info" 
                        onclick="rustProvider.refreshEntity('${entityId}', 'switch')">
                    <i class="bi bi-arrow-clockwise"></i> Refresh
                </button>
                <button class="btn btn-sm btn-secondary" 
                        onclick="rustProvider.renameEntity('${entityId}', '${entity.entityName}', 'switch')">
                    <i class="bi bi-pencil"></i> Rename
                </button>
                <button class="btn btn-sm btn-danger" 
                        onclick="rustProvider.deleteEntity('${entityId}', 'switch')">
                    <i class="bi bi-trash"></i> Delete
                </button>
            `;
        } else if (type === 'alarm') {
            return `
                <button class="btn btn-sm btn-info" 
                        onclick="rustProvider.refreshEntity('${entityId}', 'alarm')"
                        ${!isAvailable ? 'disabled' : ''}>
                    <i class="bi bi-arrow-clockwise"></i> Refresh
                </button>
                <button class="btn btn-sm btn-secondary" 
                        onclick="rustProvider.renameEntity('${entityId}', '${entity.entityName}', 'alarm')">
                    <i class="bi bi-pencil"></i> Rename
                </button>
                <button class="btn btn-sm btn-danger" 
                        onclick="rustProvider.deleteEntity('${entityId}', 'alarm')">
                    <i class="bi bi-trash"></i> Delete
                </button>
            `;
        }
        
        return '';
    }


    addLiveEvent(type, message) {
        const container = document.getElementById('liveEvents');
        
        // Check if container exists (it might not exist on all pages)
        if (!container) {
            console.log(`Live event: ${type} - ${message}`);
            return;
        }
        
        const timestamp = new Date().toLocaleTimeString();
        
        // Get appropriate icon for event type
        const icon = this.getEventIcon(type);
        const color = this.getEventColor(type);
        
        const eventHtml = `
            <div class="border-bottom pb-2 mb-2 fade-in" style="border-left: 3px solid ${color}; padding-left: 10px;">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <i class="bi ${icon} me-2" style="color: ${color};"></i>
                        <strong>${type}</strong>
                    </div>
                    <small class="text-muted">${timestamp}</small>
                </div>
                <div class="mt-1">${message}</div>
            </div>
        `;
        
        container.insertAdjacentHTML('afterbegin', eventHtml);
        
        // Keep only last 50 events
        const events = container.children;
        if (events.length > 50) {
            container.removeChild(events[events.length - 1]);
        }
        
        // Auto-scroll to top for new events
        container.scrollTop = 0;
    }

    // Updates border colors for all entity cards based on current states
    updateAllEntityBorderColors() {
        const rustProvider = window.rustProvider;
        if (!rustProvider) {
            console.log('RustProvider not ready, skipping border color update');
            return;
        }

        // Find all switch entity cards
        const switchCards = document.querySelectorAll('.entity-card.switch');
        switchCards.forEach(card => {
            const entityId = card.getAttribute('data-entity-id');
            if (entityId) {
                // Check if we have the state in memory
                let isActive = false;
                if (rustProvider.entityStates && rustProvider.entityStates.has(String(entityId))) {
                    const entityState = rustProvider.entityStates.get(String(entityId));
                    isActive = entityState.isActive;
                } else {
                    // If no state in memory, fetch it from the server
                    this.fetchEntityState(entityId);
                    return; // Skip this card for now, will be updated when state is fetched
                }

                // Remove existing status classes
                card.classList.remove('switch-on', 'switch-off');
                // Add new status class
                card.classList.add(isActive ? 'switch-on' : 'switch-off');
            }
        });

        // Find all alarm entity cards
        const alarmCards = document.querySelectorAll('.entity-card.alarm');
        alarmCards.forEach(card => {
            const entityId = card.getAttribute('data-entity-id');
            if (entityId) {
                // Check if we have the state in memory
                let isActive = false;
                if (rustProvider.entityStates && rustProvider.entityStates.has(String(entityId))) {
                    const entityState = rustProvider.entityStates.get(String(entityId));
                    isActive = entityState.isActive;
                } else {
                    // If no state in memory, fetch it from the server
                    this.fetchEntityState(entityId);
                    return; // Skip this card for now, will be updated when state is fetched
                }

                // Remove existing status classes
                card.classList.remove('alarm-on', 'alarm-off');
                // Add new status class
                card.classList.add(isActive ? 'alarm-on' : 'alarm-off');
            }
        });
    }

    // Fetches the current state of an entity from the server
    fetchEntityState(entityId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('WebSocket not connected, cannot fetch entity state');
            return;
        }

        // Find which server this entity belongs to
        const serverId = this.findServerForEntity(entityId);
        if (!serverId) {
            console.log(`No server found for entity ${entityId}`);
            return;
        }

        this.sendMessage({
            type: 'get_entity_info',
            data: {
                serverId: serverId,
                entityId: entityId
            }
        });
    }

    // Finds which server an entity belongs to
    findServerForEntity(entityId) {
        if (!this.servers) return null;
        
        for (const [serverId, server] of Object.entries(this.servers)) {
            // Check switches
            if (server.switches && server.switches.some(switch_ => String(switch_.entityId) === String(entityId))) {
                return serverId;
            }
            // Check alarms
            if (server.alarms && server.alarms.some(alarm => String(alarm.entityId) === String(entityId))) {
                return serverId;
            }
        }
        return null;
    }

    // Updates just the button for a specific entity
    updateEntityButton(entityId, isActive) {
        // Find the button container for this entity
        const buttonContainer = document.querySelector(`[data-entity-id="${entityId}"]`);
        if (!buttonContainer) {
            console.log(`Button container not found for entity ${entityId}`);
            return;
        }

        // Update the border color based on entity type
        const entityCard = buttonContainer.closest('.entity-card');
        if (entityCard) {
            if (entityCard.classList.contains('switch')) {
                // Remove existing status classes
                entityCard.classList.remove('switch-on', 'switch-off');
                // Add new status class
                entityCard.classList.add(isActive ? 'switch-on' : 'switch-off');
            } else if (entityCard.classList.contains('alarm')) {
                // Remove existing status classes
                entityCard.classList.remove('alarm-on', 'alarm-off');
                // Add new status class
                entityCard.classList.add(isActive ? 'alarm-on' : 'alarm-off');
            }
        }

        // Update the toggle button (for switches) - always yellow
        const toggleButton = buttonContainer.querySelector('.btn[onclick*="toggleSwitch"]');
        if (toggleButton) {
            const buttonText = isActive ? 'Turn Off' : 'Turn On';
            
            // Always use yellow/warning class
            toggleButton.className = `btn btn-warning btn-sm`;
            toggleButton.innerHTML = `<i class="bi bi-power"></i> ${buttonText}`;
            
            console.log(`Updated switch button for entity ${entityId}: ${buttonText}`);
        }

        // Alarm status buttons are removed - no status button updates needed
    }

    getEventIcon(type) {
        const icons = {
            'Entity Change': 'bi-toggle-on',
            'Entity Paired': 'bi-plus-circle',
            'Entity Renamed': 'bi-pencil',
            'Team Chat': 'bi-chat-dots',
            'Server Connected': 'bi-check-circle',
            'Server Disconnected': 'bi-x-circle',
            'Server Connecting': 'bi-arrow-clockwise',
            'Server Error': 'bi-exclamation-triangle',
            'Map Markers': 'bi-geo-alt',
            'Team Info': 'bi-people',
            'Server Info': 'bi-info-circle',
            'Server Paired': 'bi-server',
            'Connections Refreshed': 'bi-arrow-clockwise'
        };
        return icons[type] || 'bi-bell';
    }

    getEventColor(type) {
        const colors = {
            'Entity Change': '#28a745',
            'Entity Paired': '#17a2b8',
            'Entity Renamed': '#6c757d',
            'Team Chat': '#6f42c1',
            'Server Connected': '#28a745',
            'Server Disconnected': '#dc3545',
            'Server Connecting': '#ffc107',
            'Server Error': '#dc3545',
            'Map Markers': '#17a2b8',
            'Team Info': '#6f42c1',
            'Server Info': '#007bff',
            'Server Paired': '#28a745',
            'Connections Refreshed': '#17a2b8'
        };
        return colors[type] || '#6c757d';
    }

    deleteServer(serverId) {
        if (confirm('Are you sure you want to remove this server?')) {
            this.sendMessage({ type: 'unregister_server', data: { serverId: serverId } });
            this.loadServers(); // Refresh the list
        }
    }

    showLoading(message) {
        // You could implement a loading overlay here
        console.log('Loading:', message);
    }

    hideLoading() {
        // Hide any loading states
        console.log('Loading completed');
    }

    showError(message) {
        console.error('Error: ' + message);
    }

    showFCMError(title, message) {
        // Hide any existing loading states
        this.hideLoading();
        
        // Show error in progress bar first, then hide it after 3 seconds
        this.showRegistrationError(title, message);
        
        // Create a user-friendly error notification
        const errorHtml = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <h6 class="alert-heading">
                    <i class="bi bi-exclamation-triangle-fill"></i> ${title}
                </h6>
                <p class="mb-0">${message}</p>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        // Insert the error message at the top of the FCM token section (after progress bar hides)
        setTimeout(() => {
            const tokenSection = document.getElementById('fcmTokenSection');
            if (tokenSection) {
                // Remove any existing error alerts
                const existingAlerts = tokenSection.querySelectorAll('.alert-danger');
                existingAlerts.forEach(alert => alert.remove());
                
                // Insert new error alert
                tokenSection.insertAdjacentHTML('afterbegin', errorHtml);
            }
        }, 3500); // Show alert after progress bar hides
        
        console.error(`FCM Error [${title}]: ${message}`);
    }

    showServerNotConnectedNotification() {
        // Show a subtle notification instead of an alert
        // This could be a toast notification or a small status indicator
        console.warn('Server connection lost - some features may be unavailable');
        
        // Optionally show a non-intrusive notification
        // You could implement a toast notification here if desired
    }

    clearFCMErrors() {
        // Clear any existing error alerts in the FCM token section
        const tokenSection = document.getElementById('fcmTokenSection');
        if (tokenSection) {
            const existingAlerts = tokenSection.querySelectorAll('.alert-danger');
            existingAlerts.forEach(alert => alert.remove());
        }
        
        // Also hide any progress bars when clearing errors
        this.hideRegistrationProgress();
    }

    isFCMRelatedError(errorMessage) {
        // Check if the error is related to FCM registration process
        const fcmKeywords = [
            'FCM', 'registration', 'Steam', 'login', '2FA', 'authenticator',
            'Chrome', 'browser', 'selenium', 'automation', 'token',
            'username', 'password', 'credentials', 'session'
        ];
        
        return fcmKeywords.some(keyword => 
            errorMessage.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    refreshAllConnections() {
        console.log('🔄 Refreshing all server connections...');
        this.sendMessage({ type: 'refresh_all_connections' });
    }

    showConnectionError() {
        const container = document.getElementById('serversList');
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i>
                <strong>Connection Error</strong><br>
                Unable to connect to Rust+ Provider. Please check if the server is running.
            </div>
        `;
    }

    hideConnectionError() {
        // Remove any connection error messages
        const alerts = document.querySelectorAll('.alert-danger');
        alerts.forEach(alert => alert.remove());
    }

    // Helper function to format time adaptively (days, hours, minutes)
    formatTimeUntilExpiry(milliseconds) {
        const totalMinutes = Math.floor(milliseconds / (1000 * 60));
        const totalHours = Math.floor(milliseconds / (1000 * 60 * 60));
        const totalDays = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
        
        if (totalDays > 0) {
            return `${totalDays} day${totalDays !== 1 ? 's' : ''}`;
        } else if (totalHours > 0) {
            return `${totalHours} hour${totalHours !== 1 ? 's' : ''}`;
        } else {
            return `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
        }
    }

    updateTokenStatus(servers) {
        const tokenStatus = document.getElementById('tokenStatus');
        const hasServers = servers && Object.keys(servers).length > 0;
        
        if (!hasServers) {
            tokenStatus.className = 'token-status token-invalid';
            tokenStatus.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                    <div>
                        <strong>No FCM Tokens or Servers</strong><br>
                        <small class="text-muted">Use the form below to set up FCM tokens</small>
                    </div>
                </div>
            `;
            return;
        }

        // Show basic valid status with server count
        // Note: Detailed token expiry info requires connection status data
        tokenStatus.className = 'token-status token-valid';
        tokenStatus.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="bi bi-check-circle-fill text-success me-2"></i>
                <div>
                    <strong>FCM Token Valid</strong><br>
                    <small class="text-muted">Connected to ${Object.keys(servers).length} server(s) - token expiry info not available</small>
                </div>
            </div>
        `;
    }

    updateTokenStatusFromConnectionStatus(connectionStatus) {
        const tokenStatus = document.getElementById('tokenStatus');
        const fcmListener = connectionStatus.fcmListener;
        
        if (!fcmListener.hasValidTokens) {
            tokenStatus.className = 'token-status token-invalid';
            tokenStatus.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                    <div>
                        <strong>FCM Tokens Invalid or Expired</strong><br>
                        <small class="text-muted">Use the form below to update FCM tokens</small>
                    </div>
                </div>
            `;
            return;
        }
        
        const tokenExpiry = fcmListener.tokenExpiry;
        let statusClass, statusIcon, statusText, statusSubtext;
        
        if (tokenExpiry.isExpired) {
            statusClass = 'token-invalid';
            statusIcon = 'bi-exclamation-triangle-fill text-danger';
            statusText = 'FCM Tokens Expired';
            statusSubtext = `Expired on ${new Date(tokenExpiry.expiryDate).toLocaleString()}`;
        } else if (tokenExpiry.expiryStatus === 'Expires soon') {
            statusClass = 'token-status token-warning';
            statusIcon = 'bi-exclamation-triangle-fill text-warning';
            statusText = 'FCM Tokens Expire Soon';
            const hoursLeft = Math.floor(tokenExpiry.timeUntilExpiry / (1000 * 60 * 60));
            statusSubtext = `Expires in ${hoursLeft} hours`;
        } else {
            statusClass = 'token-valid';
            statusIcon = 'bi-check-circle-fill text-success';
            statusText = 'FCM Token Valid';
            const timeLeft = this.formatTimeUntilExpiry(tokenExpiry.timeUntilExpiry);
            const serverCount = connectionStatus.totalServers || 0;
            statusSubtext = `Connected to ${serverCount} server(s) - token expiry in ${timeLeft}`;
        }
        
        tokenStatus.className = `token-status ${statusClass}`;
        tokenStatus.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="bi ${statusIcon} me-2"></i>
                <div>
                    <strong>${statusText}</strong><br>
                    <small class="text-muted">${statusSubtext}</small>
                </div>
            </div>
        `;
    }

    startPeriodicUpdates() {
        // Refresh connection status every 30 seconds
        setInterval(() => {
            if (this.isConnected) {
                this.loadServers();
            }
        }, 30000);
        
        // Refresh servers every 60 seconds to catch any missed updates
        setInterval(() => {
            if (this.isConnected) {
                this.loadServers();
            }
        }, 60000);
    }

    // Enhanced server card with real-time status updates
    createServerCard(serverId, server) {
        const switchesHtml = this.createEntitiesHtml(server.switches || [], 'switch');
        const alarmsHtml = this.createEntitiesHtml(server.alarms || [], 'alarm');
        
        // Determine connection status (this would be enhanced with real connection data)
        const connectionStatus = this.getServerConnectionStatus(serverId);
        
        return `
            <div class="server-card p-3 fade-in">
                <div class="d-flex align-items-start mb-3">
                    <div>
                        <h6 class="mb-1 text-dark d-flex align-items-center">
                            <span class="status-indicator ${connectionStatus.class} me-2"></span>
                            ${server.name}
                        </h6>
                        <small class="text-dark">${server.ip}:${server.port}</small>
                    </div>
                </div>
                
                ${switchesHtml}
                ${alarmsHtml}
                
                <div class="mt-3">
                    <button class="btn btn-outline-danger btn-sm" onclick="rustProvider.deleteServer('${serverId}')">
                        <i class="bi bi-trash"></i> Remove Server
                    </button>
                </div>
            </div>
        `;
    }

    getServerConnectionStatus(serverId) {
        // Check if we have connection status data
        if (this.connectionStatus && this.connectionStatus.connections) {
            const serverStatus = this.connectionStatus.connections[serverId];
            if (serverStatus) {
                return {
                    class: serverStatus.isConnected ? 'status-online' : 'status-offline',
                    text: serverStatus.isConnected ? 'Connected' : 'Disconnected'
                };
            }
        }
        
        // Try to get status from server list if available
        if (this.servers && this.servers[serverId]) {
            const server = this.servers[serverId];
            const status = server.status || 'unknown';
            
            if (status === 'connected') {
                return { class: 'status-online', text: 'Connected' };
            } else if (status === 'disconnected') {
                return { class: 'status-offline', text: 'Disconnected' };
            } else if (status === 'connecting') {
                return { class: 'status-unknown', text: 'Connecting' };
            }
        }
        
        // Default to unknown if no data available
        return {
            class: 'status-unknown',
            text: 'Unknown'
        };
    }
    
    updateRegistrationProgress(progress) {
        // Show progress indicator if not already visible
        if (!document.getElementById('registrationProgress')) {
            this.showRegistrationProgress();
        }
        
        const progressContainer = document.getElementById('registrationProgress');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const progressPercentage = document.getElementById('progressPercentage');
        
        if (progressBar && progress.percentage !== null) {
            progressBar.style.width = `${progress.percentage}%`;
            progressBar.setAttribute('aria-valuenow', progress.percentage);
        }
        
        if (progressText) {
            progressText.textContent = progress.message;
        }
        
        if (progressPercentage && progress.percentage !== null) {
            progressPercentage.textContent = `${Math.round(progress.percentage)}%`;
        }
        
        // Add live event for major progress updates
        if (progress.percentage && progress.percentage % 25 === 0) {
            this.addLiveEvent('Registration Progress', `${progress.message} (${Math.round(progress.percentage)}%)`);
        }
    }
    
    showRegistrationProgress() {
        const form = document.getElementById('tokenForm');
        const progressHtml = `
            <div id="registrationProgress" class="mt-3 p-3 bg-light rounded">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0">FCM Registration Progress</h6>
                    <span id="progressPercentage" class="badge bg-primary">0%</span>
                </div>
                <div class="progress mb-2" style="height: 20px;">
                    <div id="progressBar" class="progress-bar progress-bar-striped progress-bar-animated" 
                         role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                    </div>
                </div>
                <div id="progressText" class="text-muted small">Starting registration process...</div>
            </div>
        `;
        form.insertAdjacentHTML('afterend', progressHtml);
    }
    
    showRegistrationError(errorTitle, errorMessage) {
        const progressContainer = document.getElementById('registrationProgress');
        if (progressContainer) {
            // Update the progress bar to show error state
            const progressBar = document.getElementById('progressBar');
            const progressPercentage = document.getElementById('progressPercentage');
            const progressText = document.getElementById('progressText');
            
            if (progressBar) {
                progressBar.className = 'progress-bar bg-danger';
                progressBar.style.width = '100%';
                progressBar.setAttribute('aria-valuenow', '100');
            }
            
            if (progressPercentage) {
                progressPercentage.className = 'badge bg-danger';
                progressPercentage.textContent = 'Error';
            }
            
            if (progressText) {
                progressText.className = 'text-danger small';
                progressText.innerHTML = `<strong>${errorTitle}:</strong> ${errorMessage}`;
            }
            
            // Hide the progress bar after 3 seconds
            setTimeout(() => {
                this.hideRegistrationProgress();
            }, 3000);
        }
    }

    hideRegistrationProgress() {
        const progressContainer = document.getElementById('registrationProgress');
        if (progressContainer) {
            progressContainer.remove();
        }
    }
    
    // Smart Switch Actions
    toggleSwitch(entityId) {
        this.sendMessage({
            type: 'toggle_switch',
            data: { entityId: entityId }
        });
    }
    
    // Entity Actions
    refreshEntity(entityId, entityType) {
        this.sendMessage({
            type: 'refresh_entity',
            data: { 
                entityId: entityId,
                entityType: entityType
            }
        });
    }

    renameEntity(entityId, currentName, entityType) {
        const newName = prompt(`Enter new name for ${entityType}:`, currentName);
        if (newName && newName.trim() !== '' && newName !== currentName) {
            this.sendMessage({
                type: 'rename_entity',
                data: { 
                    entityId: entityId, 
                    entityType: entityType,
                    newName: newName.trim()
                }
            });
        }
    }
    
    deleteEntity(entityId, entityType) {
        if (confirm(`Are you sure you want to delete this ${entityType}? This will remove the pairing.`)) {
            this.sendMessage({
                type: 'delete_entity',
                data: { 
                    entityId: entityId,
                    entityType: entityType
                }
            });
        }
    }

    // Server Data Tab Methods
    loadServerData() {
        // First get the server list to display the cards
        this.sendMessage({
            type: 'get_servers'
        });
    }


}

// Initialize the application
const rustProvider = new RustPlusProvider();

// Make rustProvider globally available for navigation
window.rustProvider = rustProvider;
