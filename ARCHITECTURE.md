# Architecture Document

This document explains the technical decisions made for the Collaborative Canvas application.

## 1. Data Flow Diagram

The application uses a hybrid data flow model to balance low latency with state consistency.

## 2. WebSocket Protocol

### Client-to-Server

* `stroke:start (data)`: Sent on `mousedown`. `data = { color, width, startPos }`.
* `stroke:draw (data)`: Sent on `mousemove`. `data = { pos }`.
* `stroke:end (data)`: Sent on `mouseup`. This is the "commit" message. `data = { color, width, points: [...] }`.
* `history:undo`: Sent on Undo button click.
* `history:redo`: Sent on Redo button click.
* `cursor:move (data)`: Sent on `mousemove` (throttled). `data = { x, y }`.

### Server-to-Client

* `history:init (historyStack)`: Sent to a new user on connect. Provides the *entire* history.
* `history:update (historyStack)`: Sent to **all users** when `undo` or `redo` is processed.
* `stroke:start (user, data)`: Broadcast to *other* users.
* `stroke:draw (user, data)`: Broadcast to *other* users.
* `cursor:update (user, data)`: Broadcast to *other* users.
* `users:list (users)`: Sent to a new user on connect.
* `users:joined (user)`: Broadcast when a user joins.
* `users:left (userId)`: Broadcast when a user disconnects.

## 3. Undo/Redo Strategy

This is the most critical part of the architecture.

* **Server-Authoritative:** The server maintains a `historyStack` and a `redoStack` in memory. These stacks are the **single source of truth** for the canvas state.
* **Operation-Based:** The `historyStack` is an array of "operation" objects (e.g., `{type: 'stroke', ...}`).
* **Undo:** When the server receives `history:undo`, it `pop()`s the last operation from `historyStack` and `push()`es it onto `redoStack`.
* **Redo:** When the server receives `history:redo`, it `pop()`s from `redoStack` and `push()`es it onto `historyStack`.
* **Synchronization:** After any `undo` or `redo`, the server **broadcasts the entire, updated `historyStack`** to *all* clients via `history:update`.
* **Client Replay:** Upon receiving `history:init` or `history:update`, the client **immediately clears its canvas** and iterates through the received `historyStack`, re-drawing every single operation from beginning to end.

This "clear and replay" method is computationally expensive but guarantees that all clients are 100% in sync, as they are all rebuilding their state from the exact same set of instructions.

## 4. Performance Decisions

* **Hybrid Real-time Model:** We broadcast `stroke:start` and `stroke:draw` for low-latency visual feedback. This "ghost" drawing is *not* authoritative. The *real* state is only confirmed by the `historyStack`. This gives the *feel* of real-time drawing while relying on the robustness of the "replay" model.
* **Dual Canvas Layer:** We use two `<canvas>` elements.
    1.  `#drawing-canvas`: For the persistent drawing. It is only redrawn completely during a history replay.
    2.  `#ui-canvas`: A transparent canvas layered on top. It is cleared and redrawn in a `requestAnimationFrame` loop. This is where non-persistent UI (like remote cursors) is drawn. This prevents us from having to redraw the *entire* complex drawing just to move a cursor 1px.
* **Cursor Throttling:** `cursor:move` events are throttled on the client side to ~30fps to prevent flooding the server and other clients with high-frequency mouse movements.

## 5. Conflict Resolution

* **Drawing:** There are no drawing conflicts. Since all drawing is just "painted on top," the last-write-wins principle applies at the pixel level, which is visually acceptable.
* **State (Undo/Redo):** All state-changing operations (`undo`, `redo`) are serialized by the server. If two users click "Undo" at the exact same time, the server receives two `history:undo` events. It processes them one by one.
    1.  Receives User A's `undo`. Pops Op 10. Broadcasts `history:update` (Stack 1-9).
    2.  Receives User B's `undo`. Pops Op 9. Broadcasts `history:update` (Stack 1-8).
    
    The clients will see two "undos" happen in quick succession. This is not a conflict, but a **race condition that is gracefully handled** by the server's single-threaded nature. The state remains consistent across all clients.