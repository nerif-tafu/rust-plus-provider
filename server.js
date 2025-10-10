// server.js - Main application entry point
const WebSocket = require('ws');
const http = require('http');

// Import WebSocket service
const WebSocketService = require('./websocketService');

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Initialize WebSocket service
const wsService = new WebSocketService();

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  wsService.handleConnection(ws, req);
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});