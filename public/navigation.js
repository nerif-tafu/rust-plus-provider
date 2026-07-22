// navigation.js - Shared navigation component

// --- Safe DOM helpers -------------------------------------------------------
// Values coming back from a Rust server (server names, player names, map
// markers, error text) are controlled by server owners and other players, not
// by us, so they must never reach innerHTML. Note that JSON.stringify does not
// escape HTML either: a server name of `</pre><img src=x onerror=...>` inside a
// stringified blob would execute. These helpers assign text and build nodes, so
// the browser never parses the value as markup.

/** Replace an element's contents with a <pre> block of pretty-printed JSON. */
function renderJsonBlock(target, value) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(value, null, 2);
    el.replaceChildren(pre);
}

/** Create an element, assigning text via textContent rather than markup. */
function createEl(tag, { className, id, text, children } = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (id) el.id = id;
    if (text !== undefined && text !== null) el.textContent = String(text);
    if (children) el.append(...children.filter(Boolean));
    return el;
}

/** Bootstrap icon element: <i class="bi bi-<name>"></i> */
function createIcon(name) {
    return createEl('i', { className: `bi bi-${name}` });
}

window.renderJsonBlock = renderJsonBlock;
window.createEl = createEl;
window.createIcon = createIcon;

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
