// main.js
// This file initializes the application and connects the components.

document.addEventListener('DOMContentLoaded', () => {
  const canvasEl = document.getElementById('drawing-canvas');
  const uiCanvasEl = document.getElementById('ui-canvas');
  const colorPicker = document.getElementById('colorPicker');
  const strokeSlider = document.getElementById('strokeWidth');
  const strokeValueEl = document.getElementById('strokeValue');
  const undoButton = document.getElementById('undoButton');
  const redoButton = document.getElementById('redoButton');
  const userListEl = document.getElementById('users');

  // --- 1. Initialize WebSocket Connection ---
  // Pass in the handlers object that websocket.js will use
  // to call functions in canvas.js and this (main.js) file.
  const socket = initSocket({
    handleHistoryInit: (history) => canvas.clearAndReplay(history),
    handleHistoryUpdate: (history) => canvas.clearAndReplay(history),
    handleRemoteStrokeStart: (user, data) => canvas.startRemoteStroke(user, data),
    handleRemoteStrokeDraw: (user, data) => canvas.drawRemoteStroke(user, data),
    handleRemoteCursor: (user, data) => canvas.updateCursor(user, data),
    handleUserList: (users) => updateUsers(users),
    handleUserJoined: (user) => addUser(user),
    handleUserLeft: (userId) => removeUser(userId),
  });

  // --- 2. Initialize Canvas ---
  const canvas = initCanvas(canvasEl, uiCanvasEl, {
    onStrokeStart: (data) => socket.emit('stroke:start', data),
    onStrokeDraw: (data) => socket.emit('stroke:draw', data),
    onStrokeEnd: (data) => socket.emit('stroke:end', data),
    onCursorMove: (data) => socket.emit('cursor:move', data),
  });

  // --- 3. Wire up UI Event Listeners ---
  colorPicker.addEventListener('change', (e) => {
    canvas.setColor(e.target.value);
  });

  strokeSlider.addEventListener('input', (e) => {
    const width = e.target.value;
    canvas.setStrokeWidth(width);
    strokeValueEl.textContent = width;
  });

  undoButton.addEventListener('click', () => {
    socket.emit('history:undo');
  });

  redoButton.addEventListener('click', () => {
    socket.emit('history:redo');
  });
  
  // --- 4. User List Management ---
  function updateUsers(users) {
    userListEl.innerHTML = '';
    users.forEach(addUser);
  }

  function addUser(user) {
    const li = document.createElement('li');
    li.id = `user-${user.id}`;
    li.innerHTML = `
      <span class="user-color-swatch" style="background-color: ${user.color}"></span>
      ${user.id === socket.id ? 'You' : user.id.substring(0, 6)}
    `;
    userListEl.appendChild(li);
  }

  function removeUser(userId) {
    const li = document.getElementById(`user-${userId}`);
    if (li) {
      li.remove();
    }
    canvas.removeCursor(userId); // Also remove their cursor from the canvas
  }
});