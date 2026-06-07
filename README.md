# Inspection System

Intranet-only inspection platform starter.

## Structure

```text
backend/   Spring Boot Java 21 API
frontend/  React + Material UI app
docs/      Planning notes
```

## Phase 1

This starter includes:

- Login API
- Role-based users
- JWT-style bearer token authentication
- React login page
- SBU dashboard route
- Inspector dashboard route

## Phase 2

Also included:

- Inspector SBU station list
- Inspector access request creation
- SBU incoming request list
- SBU accept/reject actions
- Request status history on both dashboards
- 5-second dashboard refresh for near-live updates

## Phase 3 And 4

Also included:

- WebSocket endpoint for WebRTC signaling: `/ws/sessions`
- SBU screen share through browser `getDisplayMedia`
- Inspector WebRTC screen viewer
- Inspector app-level control buttons
- SBU command log for received inspector actions
- CCTV placeholder panel for future RTSP/HLS/WebRTC camera integration

Browser screen sharing may require HTTPS on real intranet machines. Localhost works for development.

## Native SBU Control Agent

For real mouse clicks on the SBU computer, run the Java agent in `sbu-agent/`.

```bash
cd sbu-agent
mvn package
java -jar target/sbu-agent-0.0.1-SNAPSHOT.jar --backend http://127.0.0.1:8080 --username sbu1 --password password
```

The inspector can then click inside the shared screen video. The agent maps that click to the SBU primary display.

For accurate control, the SBU should share the full screen, not just one browser tab.

## Browser-Only Remote Control

The browser app also supports browser-level remote control without the native agent:

- SBU accepts the request.
- SBU starts screen sharing and selects the SBU dashboard tab.
- Inspector clicks inside the screen viewer.
- SBU dashboard shows a fake inspector cursor.
- The SBU page dispatches a browser click at that position.

This controls only the SBU web page, not the operating system or other apps.

## Office Demonstration Guide (2 PCs)

This system now uses an **embedded zero-setup H2 Database**, meaning you do NOT need PostgreSQL or Docker anymore. You can run it instantly on any PC.

To demonstrate the "AnyDesk-style" remote control across two computers in an office (PC 1: Controlled SBU, PC 2: Manager/Inspector):

### Step 1: Set up PC 1 (The SBU Computer)
Ensure Node.js and Java (Maven) are installed. Open a terminal and run `ipconfig` to find this computer's IP Address (e.g., `192.168.1.50`).

**1. Start the Backend:**
```bash
cd backend
mvn spring-boot:run
```

**2. Start the Frontend:**
```bash
cd frontend
npm.cmd install
npm.cmd run dev -- --host
```
*(The `--host` flag is crucial! It allows PC 2 to connect over the network).*

**3. Start the Native Java Agent:**
```bash
cd sbu-agent
mvn package
java -jar target/sbu-agent-0.0.1-SNAPSHOT.jar --backend http://127.0.0.1:8080 --username sbu1 --password password
```

Log in to `http://localhost:5173/sbu/dashboard` as `sbu1` (password: `password`) and wait.

### Step 2: Set up PC 2 (The Inspector/Manager Computer)
No installation required!
1. Connect to the same office Wi-Fi as PC 1.
2. Open Chrome and navigate to the IP address of PC 1:
   `http://<PC_1_IP_ADDRESS>:5173/inspector/dashboard`
3. Log in as `inspector1` (password: `password`) and click **"Request Access"**.

### Step 3: The Demo
1. **On PC 1:** Accept the request, click "Start Screen Share", and **MUST select "Entire Screen"**.
2. **On PC 2:** The manager can now click inside the video feed and start typing. The Java Agent on PC 1 will physically move the mouse and type the keys!

## Demo Users

```text
sbu1 / password
inspector1 / password
```
