// websocket.js
// Manages the Socket.io client connection and events.

function initSocket(handlers) {
  const socket = io();

  // --- Listen for Server Events ---

  socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
  });

  // State Sync
  socket.on('history:init', (history) => {
    handlers.handleHistoryInit(history);
  });

  socket.on('history:update', (history) => {
    handlers.handleHistoryUpdate(history);
  });

  // Real-time Drawing
  socket.on('stroke:start', (user, data) => {
    handlers.handleRemoteStrokeStart(user, data);
  });

  socket.on('stroke:draw', (user, data) => {
    handlers.handleRemoteStrokeDraw(user, data);
  });

  // Cursors
  socket.on('cursor:update', (user, data) => {
    handlers.handleRemoteCursor(user, data);
  });
  
  // User Management
  socket.on('users:list', (users) => {
    handlers.handleUserList(users);
  });

  socket.on('users:joined', (user) => {
    handlers.handleUserJoined(user);
  });
  
  socket.on('users:left', (userId) => {
    handlers.handleUserLeft(userId);
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  // Return the socket instance so main.js can use it to emit
  return socket;
}