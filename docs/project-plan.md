# Inspection System Project Plan

## Goal

Build an intranet-only inspection platform where SBU users can perform product testing work, inspectors can view CCTV feeds, request screen access from SBU systems, view shared screens, and eventually send control commands.

## Technology Stack

- Frontend: React, Material UI
- Backend: Java 21, Spring Boot
- Database: PostgreSQL 15 or 16
- Realtime communication: Spring WebSocket
- Screen sharing: WebRTC

## Modules

1. Authentication and role-based access
2. SBU dashboard
3. Inspector dashboard
4. Access request workflow
5. WebRTC screen sharing
6. CCTV viewing
7. Remote command/control workflow
8. Audit logs and session history

## Phase 1 MVP

Deliver only the login and dashboard foundation:

- Login page
- Backend authentication API
- PostgreSQL user table
- Role-based redirect
- Empty SBU dashboard
- Empty Inspector dashboard

## Phase 2

- Inspector can view available SBU users/systems.
- Inspector can request access.
- SBU receives pending request.
- SBU can accept or reject request.
- Request status updates live.

Current implementation note: Phase 2 uses REST APIs with a 5-second dashboard refresh interval. This keeps the UI simple while preparing the request workflow for WebSocket updates in the next realtime phase.

## Phase 3

- Add WebSocket signaling.
- SBU starts screen sharing with `getDisplayMedia`.
- Inspector receives SBU screen through WebRTC.
- Spring Boot handles signaling only; video flows browser-to-browser inside intranet.

Current implementation note: Phase 3 is implemented with `/ws/sessions` for WebRTC offer, answer, and ICE candidate signaling. The SBU starts sharing after accepting a request, and the inspector viewer connects to the accepted session.

## Phase 4

- Start with app-level commands.
- Add full PC control only if the company approves a native SBU-side agent.
- Record all control actions in audit logs.

Current implementation note: Phase 4 MVP is implemented as app-level control commands from inspector to SBU over WebSocket. Full operating-system mouse/keyboard control is intentionally not implemented because browsers cannot safely control the host OS without a native installed agent.

## CCTV

The inspector dashboard includes CCTV feed placeholders. Real CCTV requires the company camera protocol details. If cameras expose RTSP, add an intranet gateway that converts RTSP to browser-playable HLS or WebRTC.
