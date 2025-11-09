# Collaborative Canvas

A real-time, multi-user drawing application built with Node.js, Socket.io, and pure HTML5 Canvas. This project avoids all frontend frameworks (React, Vue) and canvas libraries (p5.js, Fabric.js) to demonstrate core concepts of real-time state synchronization.

## 🚀 Setup & Running

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start the Server:**
    ```bash
    npm start
    ```

3.  **Open in Browser:**
    Open `http://localhost:3000` in your browser.

## 🧪 How to Test with Multiple Users

1.  Open `http://localhost:3000` in a normal browser window.
2.  Open `http://localhost:3000` in a second browser window (e.g., an Incognito window or a different browser).
3.  Draw in one window. You should see the drawing appear in real-time in the other window.
4.  You will also see the other user's cursor (a colored circle) moving on your canvas.
5.  Test the **Global Undo/Redo**:
    * Draw something in Window A.
    * Draw something in Window B.
    * Click "Undo" in **Window A**. The last stroke (from Window B) should disappear from *both* canvases, as the undo/redo is global.

## ⏳ Time Spent

Approximately 2 hours (planning and implementation).

## ⚠️ Known Limitations & Bugs

* **Performance:** The "clear and replay" strategy for undo/redo is extremely robust for consistency but not scalable. With thousands of operations, the canvas will lag significantly during a replay. A more advanced solution would involve canvas snapshotting or layer-based history.
* **Resize:** The canvas is fixed at 800x600. Resizing the browser window will not resize the canvas, and the drawing history will be lost on a page refresh (as it's only stored in server memory).
* **"Eraser" Tool:** A true eraser tool (vs. drawing with the background color) is not implemented. This would require more complex canvas composite operations (`globalCompositeOperation = 'destination-out'`).
* **No Persistence:** All drawings are lost when the server restarts, as the `historyStack` is in-memory.