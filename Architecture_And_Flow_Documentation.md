# Intranet Remote Inspection System
**Technical Architecture & System Flow Documentation**

---

## 1. Executive Overview
The Intranet Remote Inspection System is a highly secure, 100% offline remote administration and screen-sharing application designed for strict corporate intranet environments. It allows an "Inspector" (Manager) to view and control a subordinate's "SBU" (Station) securely over a local area network without requiring internet access or third-party cloud servers.

It enforces strict permission-based security: the Inspector cannot connect without the SBU explicitly accepting the connection request and selecting the desired access level (View Only vs. Full Control).

## 2. Technology Stack
The system is built using modern, enterprise-grade technologies divided into three isolated components:

### Frontend (Web Dashboard)
* **Framework:** React 18, Vite
* **UI Library:** Material-UI (MUI)
* **Media Streaming:** WebRTC (Peer-to-Peer Video/Audio)
* **Networking:** Standard `fetch` API, native WebSockets

### Backend (Signaling & API Server)
* **Framework:** Java 21, Spring Boot 3
* **Security:** Spring Security with stateless JWT (JSON Web Tokens)
* **Realtime:** Spring WebSockets (for chat, commands, and WebRTC signaling)
* **Database:** H2 Embedded In-Memory Database (Zero-setup portability)

### Native Desktop Agent (OS Controller)
* **Language:** Java 21
* **Core Library:** `java.awt.Robot` (for native OS mouse/keyboard injection)
* **Networking:** Java 11+ native `HttpClient` & `WebSocket`

---

## 3. System Architecture Diagram

This diagram illustrates the high-level infrastructure and how the three main components communicate.

```mermaid
graph TD
    subgraph "Inspector PC"
        I_Browser["Inspector Browser (React)"]
    end

    subgraph "Intranet Server (SBU PC)"
        Backend["Spring Boot Backend Server"]
        DB[(H2 In-Memory DB)]
        Backend <--> DB
    end

    subgraph "SBU PC (The controlled computer)"
        S_Browser["SBU Browser (React)"]
        Agent["Java Native Agent (sbu-agent)"]
        OS["Windows Operating System"]
    end

    %% Connections
    I_Browser -->|1. HTTP REST and JWT| Backend
    S_Browser -->|1. HTTP REST and JWT| Backend
    Agent -->|1. HTTP REST Polling| Backend
    
    I_Browser -->|2. WebSocket Signaling and Inputs| Backend
    S_Browser -->|2. WebSocket Signaling| Backend
    Agent -->|2. WebSocket Inputs| Backend

    I_Browser -->|3. Pure WebRTC Peer to Peer Video| S_Browser
    
    Agent -->|4. Native API Injection| OS
    
    classDef browser fill:#f9f,stroke:#333,stroke-width:2px;
    classDef server fill:#bbf,stroke:#333,stroke-width:2px;
    classDef agent fill:#bfb,stroke:#333,stroke-width:2px;
    
    class I_Browser,S_Browser browser;
    class Backend server;
    class Agent agent;
```

---

## 4. Core Workflows (Flow Charts)

### A. Session Establishment Flow
Because the system uses WebRTC for high-speed video streaming, the two browsers must find each other on the network. The Spring Boot backend acts purely as a "Signaling Server" to introduce them.

```mermaid
sequenceDiagram
    participant I as Inspector (Browser)
    participant B as Backend (Spring Boot)
    participant S as SBU (Browser)
    
    I->>B: POST /request-access (SBU ID)
    B-->>S: Real-time Notification
    S->>B: POST /accept (Access Level: View or Control)
    B-->>I: Connection Accepted!
    
    Note over I,S: WebRTC Signaling Phase
    S->>B: Send WebRTC "Offer" (My IP/Ports)
    B-->>I: Relay "Offer"
    I->>B: Send WebRTC "Answer" (My IP/Ports)
    B-->>S: Relay "Answer"
    
    Note over I,S: Direct Peer-to-Peer Connection Established
    S->>I: Stream Real-time Screen Video
```

### B. Remote Control Flow (Full Control Mode)
When the Inspector interacts with the video feed, the system translates those browser events into physical Windows OS actions.

```mermaid
sequenceDiagram
    participant I as Inspector (Browser)
    participant B as Backend (WebSocket)
    participant A as Java Native Agent
    participant OS as Windows OS
    
    I->>I: User clicks video at coordinates (X, Y)
    I->>I: Calculate X/Y relative ratios (e.g. 50%, 50%)
    I->>B: Send WebSocket: {action: "click", xRatio: 0.5, yRatio: 0.5}
    
    alt If Session is VIEW_ONLY
        B->>B: Drop the packet (Security Enforced)
    else If Session is FULL_CONTROL
        B-->>A: Relay WebSocket Payload
        A->>A: Map 0.5 ratio to Physical Screen Resolution
        A->>OS: Execute Native Mouse Move
        A->>OS: Execute Native Mouse Click
    end
```

---

## 5. Security & Limitations

### Built-in Security Features
* **Explicit Consent:** An Inspector can never silently spy on an SBU. The SBU must click "Accept".
* **Granular Control:** The SBU can accept the session as `VIEW_ONLY` (read-only) or `FULL_CONTROL`.
* **Server-Side Enforcement:** If a session is `VIEW_ONLY`, the Spring Boot WebSocket server actively drops hacking attempts to send mouse inputs.
* **Offline Privacy:** The WebRTC configuration uses `iceServers: []`, completely disabling external Google STUN/TURN servers. Video never leaves the building.

### Known Limitations
* **Geometry Mapping Requirements:** The Java Agent natively controls the OS by mapping coordinates to the physical monitor resolution. The SBU must select **"Entire Screen"** in the browser sharing prompt. Sharing a single "Chrome Tab" will cause the mathematical coordinate mapping to fail if they switch applications.
* **Complex Key Macros:** Basic typing and navigation (arrows, space, enter) work perfectly. However, operating system intercepts like `Ctrl+Alt+Delete` are blocked by Windows User Account Control (UAC) and cannot be simulated remotely.
