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

## Local Run Order

1. Start PostgreSQL and create the `inspection_system` database.

With Docker:

```bash
docker compose up -d
```

Without Docker:

```sql
CREATE DATABASE inspection_system;
```

2. Start the backend:

```bash
cd backend
mvn spring-boot:run
```

3. Start the frontend:

```bash
cd frontend
npm.cmd install
npm.cmd run dev
```

4. Open:

```text
http://localhost:5173
```

## Demo Users

```text
sbu1 / password
inspector1 / password
```
