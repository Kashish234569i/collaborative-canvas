// This module manages the authoritative state of the canvas.

/**
 * @type {Array<Object>}
 * The "Single Source of Truth" for the canvas.
 * An array of operations (e.g., {type: 'stroke', data: {...}})
 */
let historyStack = [];

/**
 * @type {Array<Object>}
 * A stack for re-applying "undone" operations.
 */
let redoStack = [];

/**
 * @type {Map<string, Object>}
 * Map of { socket.id -> { id, color } }
 */
let activeUsers = new Map();

// Simple color assignment for new users
const userColors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500'];
let colorIndex = 0;

function initializeDrawingState(io, socket) {
  
  // --- 1. User Management ---
  
  // Assign a color and add user to the list
  const userColor = userColors[colorIndex % userColors.length];
  colorIndex++;
  const user = { id: socket.id, color: userColor };
  activeUsers.set(socket.id, user);

  // Send the entire history to the new user to catch them up
  socket.emit('history:init', historyStack);
  
  // Send the current user list to the new user
  socket.emit('users:list', Array.from(activeUsers.values()));
  
  // Tell everyone else a new user joined
  socket.broadcast.emit('users:joined', user);

  // --- 2. Drawing Event Handling (Real-time part) ---

  socket.on('stroke:start', (data) => {
    // Broadcast to everyone *except* the sender
    socket.broadcast.emit('stroke:start', user, data);
  });

  socket.on('stroke:draw', (data) => {
    // Broadcast to everyone *except* the sender
    socket.broadcast.emit('stroke:draw', user, data);
  });

  // --- 3. State Management (Authoritative part) ---

  socket.on('stroke:end', (strokeData) => {
    // This is the "commit"
    // Create the operation
    const operation = {
      type: 'stroke',
      user: user,
      data: strokeData // { color, width, points: [...] }
    };
    
    // Add to history
    historyStack.push(operation);
    
    // A new operation clears the redo stack
    redoStack = [];
    
    // Note: We DON'T need to broadcast this operation.
    // Why? Because all clients (including the sender) already drew
    // it in real-time. This operation is now just part of the
    // permanent history, used only for 'undo' or 'new joins'.
  });

  // --- 4. Global Undo/Redo Handling ---

  socket.on('history:undo', () => {
    if (historyStack.length === 0) return; // Nothing to undo

    // Move the last operation from history to redo stack
    const op = historyStack.pop();
    redoStack.push(op);

    // Broadcast the *entire updated history* to ALL clients
    io.emit('history:update', historyStack);
  });

  socket.on('history:redo', () => {
    if (redoStack.length === 0) return; // Nothing to redo

    // Move the last operation from redo back to history
    const op = redoStack.pop();
    historyStack.push(op);

    // Broadcast the *entire updated history* to ALL clients
    io.emit('history:update', historyStack);
  });

  // --- 5. Cursor & Disconnect ---

  socket.on('cursor:move', (data) => {
    // Broadcast cursor position with user info
    socket.broadcast.emit('cursor:update', user, data);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    activeUsers.delete(socket.id);
    // Tell everyone this user left
    io.emit('users:left', socket.id);
  });
}

module.exports = { initializeDrawingState };