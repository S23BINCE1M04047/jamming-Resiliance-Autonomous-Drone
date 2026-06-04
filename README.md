═══════════════════════════════════════════════════════════════════
  AEGIS-7 · AI Surveillance Drone Simulation — FULL STACK
  Final Year Project · Group 11
═══════════════════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PROJECT FOLDER STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AEGIS7-FullStack/
│
├── frontend/                 ← FRONTEND (what user sees in browser)
│   ├── index.html            ← HTML structure — all panels, buttons, canvas
│   ├── style.css             ← CSS styles — military HUD, neon effects, layout
│   └── simulation.js         ← JavaScript — AI engine + Security module
│
├── backend/                  ← BACKEND (server that runs on your PC)
│   └── server.js             ← Node.js HTTP server + REST API endpoints
│
├── data/                     ← DATA LAYER (database / storage)
│   └── missions.json         ← Mission records, RF zone data, security events
│
└── README.txt                ← This file

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WHAT EACH FILE DOES (EXPLAIN TO YOUR TEACHER)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FRONTEND — index.html
  The HTML structure. Defines every visual element:
  - Login screen with username/password form
  - Header bar (mission time, battery, damage, threat, encryption)
  - Left panel (security status, telemetry, RF environment, AI engine,
                blacklisted frequencies, mission metrics, security log)
  - Center canvas (where the drone simulation is drawn)
  - Right panel (buttons, speed slider, security toggles, zone legend)
  - Event log at the bottom
  - Self-destruct overlay (countdown ring)
  - Crash/Offline overlay

FRONTEND — style.css
  All CSS visual design — 400+ lines:
  - Dark military HUD color theme
  - Login screen animation
  - Neon glow effects on buttons, panels, indicators
  - Progress bars for battery and damage
  - Alert toast popup animations
  - Scanline overlay effect
  - Responsive Flexbox layout

FRONTEND — simulation.js  ← MOST IMPORTANT FILE
  The brain. Contains two major systems:

  [A] SECURITY MODULE (Security object):
      - User authentication with brute-force lockout (max 3 failed attempts)
      - JWT-style token generation (base64 encoded header.payload.signature)
      - Session management with 30-minute auto-timeout
      - AES-256-GCM encryption simulation for command transmission
      - Intrusion Detection System (IDS) with threat scanning
      - Security event logging
      - Role-based access (OPERATOR, ADMIN, VIEWER)

  [B] DRONE AI ENGINE:
      - Canvas 2D rendering (60fps game loop)
      - Drone physics (velocity, acceleration, friction)
      - 9-point autonomous patrol route
      - RF jamming zone detection (900 MHz, 2.4 GHz, 5.8 GHz)
      - Radial escape vector algorithm
      - Frequency blacklisting (AI learning)
      - Self-destruct countdown protocol
      - Projectile physics and collision detection
      - Particle effects (exhaust, explosions)
      - Real-time UI updates (telemetry, RF data, security score)
      - Mission log export (.txt download)

BACKEND — server.js
  Node.js HTTP server. Runs on your PC and serves files over WiFi.
  Has 7 REST API endpoints:

    POST /api/login          Authenticate operator (returns token)
    POST /api/logout         End session (invalidates token)
    GET  /api/status         Server health check
    GET  /api/sessions       List active sessions (Admin only)
    GET  /api/logs           Server request log (last 50 entries)
    GET  /api/mission-data   Load saved missions from missions.json
    POST /api/save-mission   Save mission results to missions.json

  Security features in server.js:
    - Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
    - CORS headers (Access-Control-Allow-Origin)
    - IP address logging for every request
    - Session store (in-memory Map)
    - Request rate limiting can be added easily

DATA — missions.json
  JSON database file. Stores:
    - Past mission records (operator, time, metrics, termination reason)
    - RF zone database (frequencies, bands, risk levels, standards)
    - Security event history
  In a real production system this would be a real database (MongoDB,
  PostgreSQL, MySQL). For this FYP, we use a JSON file for simplicity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  HOW TO RUN (STEP BY STEP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

METHOD 1 — VS Code Live Server (Easiest, for development)
  1. Install VS Code: code.visualstudio.com
  2. Install extension: Live Server (by Ritwick Dey)
  3. File → Open Folder → select AEGIS7-FullStack folder
  4. Click index.html inside the frontend/ folder
  5. Click "Go Live" button (bottom-right corner of VS Code)
  6. Browser opens at http://127.0.0.1:5500/frontend/

METHOD 2 — Node.js Server (For sharing over WiFi)
  1. Install Node.js: nodejs.org (LTS version)
  2. Open terminal in the AEGIS7-FullStack folder
  3. Navigate to backend folder:   cd backend
  4. Start server:                  node server.js
  5. Open browser: http://localhost:3000
  6. Share with fellows: http://YOUR_IP:3000
  7. Stop server: Ctrl+C

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DEFAULT LOGIN CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Username: operator   Password: aegis2024   Role: OPERATOR
  Username: admin      Password: admin123    Role: ADMIN
  Username: viewer     Password: view123     Role: VIEWER

  After 3 failed login attempts, the account is LOCKED (brute-force protection).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECURITY FEATURES (NEW — ADDED TO THIS VERSION)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. LOGIN AUTHENTICATION
   - Username/password form on startup
   - 3 user accounts with different roles
   - Brute-force lockout after 3 failed attempts

2. JWT-STYLE TOKEN AUTHENTICATION
   - Login generates a token: base64(header).base64(payload).signature
   - Token stored in session and validated for protected API calls
   - Token shows: algorithm, issued-at, expiry, unique JTI

3. SESSION MANAGEMENT
   - 30-minute automatic session timeout
   - Session age shown live in Security Status panel
   - Logout clears session and returns to login screen

4. AES-256-GCM LINK ENCRYPTION (SIMULATED)
   - Every command sent to drone is "encrypted" and logged
   - Toggle in Security Config panel to enable/disable
   - Disabling triggers IDS alert and drops security score
   - Re-Encrypt button rotates the key

5. INTRUSION DETECTION SYSTEM (IDS)
   - Scans for threats: unencrypted link, high damage, frequency exhaustion
   - Run IDS Scan button triggers manual scan
   - Auto-scans every time jamming is detected
   - Results shown in Security Events panel

6. SECURITY SCORE
   - Live score (0-100%) based on: IDS threats, encryption status, damage level
   - Shown with colored progress bar (green/orange/red)

7. SECURITY EVENT LOG
   - Separate log for security events (auth, encryption, IDS alerts)
   - Different colors: info (blue), warn (yellow), alert (red)

8. COMMAND VERIFICATION
   - Every drone command (AUTO, MANUAL, waypoint) is logged with encrypted form
   - Toggle in Security Config panel

9. HTTP SECURITY HEADERS (server.js)
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: SAMEORIGIN
   - X-XSS-Protection: 1; mode=block

10. MISSION LOG EXPORT
    - Export button downloads .txt file with all events + security log
    - Includes operator name, role, encryption status, metrics

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ORIGINAL WEAKNESSES (THAT STILL EXIST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. AI is rule-based, not real machine learning
   The escape algorithm uses geometric vectors, not a trained neural
   network. Real DRL would need Python + TensorFlow.

2. 2D simulation only
   Real drones operate in 3D space with altitude, obstacles, terrain.

3. Simplified RF model
   Fixed circular zones. Real RF propagation depends on distance,
   terrain, multipath interference, and weather.

4. No real hardware connection
   Cannot connect to a physical drone without MAVLink/ROS integration.

5. Single drone only
   No swarm/multi-agent behavior.

6. JSON file database
   Not a real database. For production: use MongoDB or PostgreSQL.

7. Encryption is simulated
   The AES-256 in simulation.js is visual only (uses btoa encoding).
   Real encryption needs the WebCrypto API or a backend encryption library.

8. No HTTPS
   The server runs on HTTP. For production: use HTTPS with SSL certificates.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TECH STACK SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Frontend:   HTML5, CSS3, Vanilla JavaScript ES6+, Canvas 2D API
  Backend:    Node.js (built-in http module — no npm needed)
  Database:   JSON file (missions.json)
  Security:   JWT tokens, AES-256 simulation, IDS, session management
  Standards:  IEEE 802.11, ETSI EN 300 328, 3GPP TR 36.942, STANAG 4193
  Fonts:      Google Fonts (Orbitron, Share Tech Mono)

═══════════════════════════════════════════════════════════════════
  Project: AI-Driven Surveillance Drone with Jamming Resilience
           and Self-Destruct Protocol Simulation
  Group 11 · Final Year Project
═══════════════════════════════════════════════════════════════════
