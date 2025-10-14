// navigation.js - Shared navigation component
class NavigationManager {
    constructor() {
        this.servers = {};
        this.currentServerId = null;
        this.retryCount = 0;
        this.maxRetries = 10;
    }

    init() {
        // Wait for the page to be ready, then load server list
        setTimeout(() => {
            this.loadServerList();
        }, 200);
    }

    setCurrentServer(serverId) {
        this.currentServerId = serverId;
        this.updateActiveStates();
    }

    loadServerList() {
        // This will be called by the parent page to load servers
        if (window.rustProvider && window.rustProvider.sendMessage) {
            window.rustProvider.sendMessage({ type: 'get_servers' });
        } else if (window.serverPage && window.serverPage.sendMessage) {
            window.serverPage.sendMessage({ type: 'get_servers' });
        } else if (window.serversPage && window.serversPage.sendMessage) {
            window.serversPage.sendMessage({ type: 'get_servers' });
        } else if (window.homePage && window.homePage.sendMessage) {
            window.homePage.sendMessage({ type: 'get_servers' });
        } else {
            this.retryCount++;
            if (this.retryCount < this.maxRetries) {
                // Retry after a short delay
                setTimeout(() => {
                    this.loadServerList();
                }, 500);
            }
        }
    }

    sendMessage(message) {
        // Delegate to the appropriate page's sendMessage method
        if (window.rustProvider && window.rustProvider.sendMessage) {
            window.rustProvider.sendMessage(message);
        } else if (window.serverPage && window.serverPage.sendMessage) {
            window.serverPage.sendMessage(message);
        } else if (window.serversPage && window.serversPage.sendMessage) {
            window.serversPage.sendMessage(message);
        } else if (window.homePage && window.homePage.sendMessage) {
            window.homePage.sendMessage(message);
        }
    }

    updateServerSubNav(servers) {
        // Server sub-navigation removed - it was redundant
        // All server navigation is now handled through the main navigation
    }

    updateActiveStates() {
        // Server sub-navigation removed - no longer needed
    }

    handleMessage(message) {
        switch (message.type) {
            case 'servers_list':
                this.updateServerSubNav(message.data.servers);
                break;
        }
    }
    
    // Method to refresh server list
    refreshServerList() {
        this.loadServerList();
    }
}

// Create global navigation manager
window.navigationManager = new NavigationManager();
