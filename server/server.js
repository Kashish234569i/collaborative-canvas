const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { initializeDrawingState } = require('./drawing-state');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve the client-side files
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// Handle socket connections
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Delegate all socket event handling to the state manager
  initializeDrawingState(io, socket);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});