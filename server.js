// server.js - Main application entry point
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Import WebSocket service
const WebSocketService = require('./websocketService');

// Create HTTP server with static file serving
const server = http.createServer((req, res) => {
  // Serve static files from public directory
  const publicPath = path.join(__dirname, 'public');
  // Remove query parameters from URL for file path resolution
  const urlPath = req.url.split('?')[0];
  let filePath;
  
  // Handle specific routes
  if (urlPath === '/') {
    filePath = path.join(publicPath, 'index.html');
  } else if (urlPath === '/pairing') {
    filePath = path.join(publicPath, 'pairing.html');
  } else if (urlPath === '/servers') {
    filePath = path.join(publicPath, 'servers.html');
  } else if (urlPath === '/api-docs') {
    filePath = path.join(publicPath, 'api-docs.html');
  } else if (urlPath.startsWith('/servers?id=')) {
    filePath = path.join(publicPath, 'server.html');
  } else {
    filePath = path.join(publicPath, urlPath);
  }
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(publicPath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // File not found, serve pairing.html for SPA routing
      filePath = path.join(publicPath, 'pairing.html');
    }
    
    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.woff': 'application/font-woff',
      '.ttf': 'application/font-ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'application/font-otf',
      '.wasm': 'application/wasm'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Read and serve file
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Initialize WebSocket service
const wsService = new WebSocketService();

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  wsService.handleConnection(ws, req);
});

// Start the server
const PORT = process.env.PORT || 9443;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});