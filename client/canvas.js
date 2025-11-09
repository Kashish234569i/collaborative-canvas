// canvas.js
// Handles all canvas drawing logic, event listeners, and state.

function initCanvas(canvasEl, uiCanvasEl, socketEmitters) {
  const ctx = canvasEl.getContext('2d');
  const uiCtx = uiCanvasEl.getContext('2d'); // For cursors

  // --- Canvas Setup ---
  function resizeCanvas() {
    const width = 800;
    const height = 600;
    canvasEl.width = uiCanvasEl.width = width;
    canvasEl.height = uiCanvasEl.height = height;
    canvasEl.style.width = uiCanvasEl.style.width = `${width}px`;
    canvasEl.style.height = uiCanvasEl.style.height = `${height}px`;
  }

  resizeCanvas();
  
  // --- State ---
  let isDrawing = false;
  let strokeColor = '#000000';
  let strokeWidth = 5;
  let currentLocalStroke = null; // { color, width, points: [] }

  /**
   * @type {Map<string, Object>}
   * Stores active "remote" strokes being drawn by other users.
   * { userId -> { color, width, currentPath } }
   */
  const remoteStrokes = new Map();
  
  /**
   * @type {Map<string, Object>}
   * Stores current cursor positions of other users.
   * { userId -> { x, y, color } }
   */
  const remoteCursors = new Map();

  // --- Utility Functions ---
  function getMousePos(e) {
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function setStrokeStyle(context, color, width) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }

  // --- Local Drawing Event Handlers ---

  function startDraw(e) {
    isDrawing = true;
    const pos = getMousePos(e);

    // Start path locally
    ctx.beginPath();
    setStrokeStyle(ctx, strokeColor, strokeWidth);
    ctx.moveTo(pos.x, pos.y);

    // Store stroke info
    currentLocalStroke = {
      color: strokeColor,
      width: strokeWidth,
      points: [pos]
    };

    // Emit start event for others
    socketEmitters.onStrokeStart({ color: strokeColor, width: strokeWidth, startPos: pos });
  }

  function draw(e) {
    if (!isDrawing) return;
    
    const pos = getMousePos(e);

    // Draw locally
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    // Store point
    currentLocalStroke.points.push(pos);
    
    // Emit draw event for others
    socketEmitters.onStrokeDraw({ pos: pos });
  }

  function endDraw() {
    if (!isDrawing) return;
    isDrawing = false;
    ctx.closePath(); // This doesn't do much for 'stroke' but is good practice

    // "Commit" the stroke to the server history
    socketEmitters.onStrokeEnd(currentLocalStroke);
    currentLocalStroke = null;
  }
  
  // --- Cursor Movement ---
  
  // Throttling function to limit cursor updates
  let lastCursorEmit = 0;
  function handleCursorMove(e) {
    const now = Date.now();
    // Throttle to ~30fps (1000 / 30 = 33ms)
    if (now - lastCursorEmit > 33) {
      lastCursorEmit = now;
      const pos = getMousePos(e);
      socketEmitters.onCursorMove(pos);
    }
  }

  // --- Register Listeners ---
  canvasEl.addEventListener('mousedown', startDraw);
  canvasEl.addEventListener('mousemove', draw);
  canvasEl.addEventListener('mouseup', endDraw);
  canvasEl.addEventListener('mouseleave', endDraw); // Stop drawing if mouse leaves
  canvasEl.addEventListener('mousemove', handleCursorMove);

  // --- Remote Drawing Handlers (Called by websocket.js) ---

  function startRemoteStroke(user, data) {
    const { color, width, startPos } = data;
    
    // Create a path object to draw on the main canvas
    const path = new Path2D();
    path.moveTo(startPos.x, startPos.y);
    
    remoteStrokes.set(user.id, { color, width, path, lastPos: startPos });
  }

  function drawRemoteStroke(user, data) {
    const stroke = remoteStrokes.get(user.id);
    if (!stroke) return;

    const { pos } = data;
    
    // We draw remote strokes segment by segment
    // This is the "real-time" part
    setStrokeStyle(ctx, stroke.color, stroke.width);
    ctx.beginPath();
    ctx.moveTo(stroke.lastPos.x, stroke.lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    // Update the last position
    stroke.lastPos = pos;
  }

  // --- Main UI Loop (for Cursors) ---
  
  function drawLoop() {
    // Clear only the UI canvas
    uiCtx.clearRect(0, 0, uiCanvasEl.width, uiCanvasEl.height);

    // Draw all remote cursors
    for (const [id, cursor] of remoteCursors.entries()) {
      uiCtx.fillStyle = cursor.color;
      uiCtx.beginPath();
      uiCtx.arc(cursor.x, cursor.y, 5, 0, 2 * Math.PI);
      uiCtx.fill();
      uiCtx.fillStyle = '#000';
      uiCtx.fillText(id.substring(0, 6), cursor.x + 10, cursor.y + 5);
    }

    requestAnimationFrame(drawLoop);
  }

  requestAnimationFrame(drawLoop);

  // --- State Synchronization (The "Hard Part") ---

  /**
   * Replays a single stroke operation onto the canvas.
   */
  function replayStroke(op) {
    const { color, width, points } = op.data;
    if (points.length === 0) return;

    setStrokeStyle(ctx, color, width);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  // --- Public API ---
  // These are the functions that main.js and websocket.js will call.
  return {
    setColor: (color) => { strokeColor = color; },
    setStrokeWidth: (width) => { strokeWidth = width; },

    // Called by websocket.js on 'history:init' or 'history:update'
    clearAndReplay: (history) => {
      console.log('Syncing state... clearing and replaying', history.length, 'operations.');
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      
      // Stop any "in-progress" remote strokes
      remoteStrokes.clear(); 
      
      for (const op of history) {
        if (op.type === 'stroke') {
          replayStroke(op);
        }
        // Add other op types here (e.g., 'clear', 'image')
      }
    },

    // Called by websocket.js
    startRemoteStroke,
    drawRemoteStroke,
    
    updateCursor: (user, pos) => {
      remoteCursors.set(user.id, { ...pos, color: user.color });
    },
    
    removeCursor: (userId) => {
      remoteCursors.delete(userId);
    }
  };
}