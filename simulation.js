'use strict';
/* ════════════════════════════════════════════════════════════════
   AEGIS-7  |  simulation.js  |  Backend Logic + Security Layer
   Drone AI · RF Detection · Jamming Resilience · Self-Destruct
   Security: JWT Auth · AES Simulation · IDS · Session Mgmt
   ════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════
//  SECURITY MODULE — Authentication & Session Management
// ══════════════════════════════════════════════════════════════
const Security = {
  // Simulated user database (in real app this is in backend DB)
  users: {
    'operator': { password: 'aegis2024', role: 'OPERATOR', clearance: 'TOP SECRET' },
    'admin':    { password: 'admin123',  role: 'ADMIN',    clearance: 'TOP SECRET' },
    'viewer':   { password: 'view123',   role: 'VIEWER',   clearance: 'CONFIDENTIAL' },
  },

  session: null,
  loginAttempts: {},
  MAX_ATTEMPTS: 3,
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  sessionTimer: null,

  // Simulated JWT token generator
  generateToken(user) {
    const header  = btoa(JSON.stringify({ alg:'HS256', typ:'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: user, iat: Date.now(),
      exp: Date.now() + this.SESSION_TIMEOUT,
      jti: Math.random().toString(36).slice(2),
    }));
    const sig = btoa(user + Date.now() + Math.random()).slice(0,20);
    return `${header}.${payload}.${sig}`;
  },

  // Login with brute-force protection
  login(username, password) {
    const attempts = this.loginAttempts[username] || 0;
    if (attempts >= this.MAX_ATTEMPTS) {
      secLog(`LOCKOUT: Account ${username} locked after ${this.MAX_ATTEMPTS} failed attempts`, 'alert');
      return { success: false, error: `Account locked after ${this.MAX_ATTEMPTS} failed attempts` };
    }
    const user = this.users[username];
    if (!user || user.password !== password) {
      this.loginAttempts[username] = attempts + 1;
      const remaining = this.MAX_ATTEMPTS - this.loginAttempts[username];
      secLog(`FAILED LOGIN: ${username} — ${remaining} attempts remaining`, 'warn');
      return { success: false, error: `Invalid credentials. ${remaining} attempts remaining.` };
    }
    this.loginAttempts[username] = 0;
    const token = this.generateToken(username);
    this.session = { username, role: user.role, clearance: user.clearance, token, loginTime: Date.now() };
    this.startSessionTimer();
    secLog(`AUTH SUCCESS: ${username} | Role: ${user.role} | Token: ${token.slice(-12)}...`, 'info');
    return { success: true, session: this.session };
  },

  logout() {
    if (this.session) secLog(`LOGOUT: ${this.session.username}`, 'info');
    this.session = null;
    if (this.sessionTimer) clearTimeout(this.sessionTimer);
  },

  startSessionTimer() {
    if (this.sessionTimer) clearTimeout(this.sessionTimer);
    this.sessionTimer = setTimeout(() => {
      secLog('SESSION EXPIRED: Auto-logout after 30 min', 'warn');
      doLogout();
    }, this.SESSION_TIMEOUT);
  },

  isAuthenticated() { return this.session !== null; },
  getSessionAge() {
    if (!this.session) return '—';
    const s = Math.floor((Date.now() - this.session.loginTime) / 1000);
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  },

  // AES-256 simulation (visual — real AES needs WebCrypto in production)
  encryptionKey: 'AES-256-GCM',
  encryptionActive: true,
  encryptCmd(cmd) {
    if (!this.encryptionActive) return cmd;
    return `[ENC:AES256] ${btoa(cmd).slice(0,16)}...`;
  },

  // Intrusion Detection System
  ids: {
    active: true,
    events: [],
    threatCount: 0,
    lastScan: null,
    scan(drone, zones) {
      this.lastScan = new Date().toLocaleTimeString();
      const threats = [];
      // Check: multiple jammer encounters in short time
      if (drone && drone.damage > 50) threats.push('HIGH DAMAGE DETECTED — Possible GPS spoofing');
      // Check: drone outside patrol bounds
      const zone = getZoneAt(drone.x, drone.y);
      if (zone && zone.type === 'jam' && drone.ignoredFreqs.length >= 3)
        threats.push('FREQUENCY EXHAUSTION — All known bands compromised');
      // Check: encryption toggle
      if (!Security.encryptionActive) threats.push('UNENCRYPTED DATA LINK — Interception risk');
      this.threatCount = threats.length;
      if (threats.length > 0) {
        threats.forEach(t => { secLog(`IDS ALERT: ${t}`, 'alert'); });
        return threats;
      }
      return [];
    },
  },
};

// ══════════════════════════════════════════════════════════════
//  LOGIN / LOGOUT UI FUNCTIONS
// ══════════════════════════════════════════════════════════════
function doLogin() {
  const u = document.getElementById('login-user').value.trim().toLowerCase();
  const p = document.getElementById('login-pass').value;
  const result = Security.login(u, p);
  if (!result.success) {
    const errEl = document.getElementById('login-error');
    errEl.textContent = result.error;
    errEl.style.display = 'block';
    document.getElementById('login-pass').value = '';
    return;
  }
  document.getElementById('login-screen').style.display = 'none';
  const app = document.getElementById('app');
  app.style.display = 'flex';
  document.getElementById('hdr-opname').textContent =
    `${result.session.role}: ${result.session.username.toUpperCase()}`;
  resizeCanvas();
  resetSim();
  startLoop();
  showAlert(`Welcome, ${result.session.username.toUpperCase()}`, 'success');
  addLog(`Operator authenticated: ${result.session.username} [${result.session.role}]`, 'security');
}

function doLogout() {
  Security.logout();
  stopLoop();
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
}

// Allow Enter key on login
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('login-user').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-pass').focus();
  });
  resizeCanvas();
  window.addEventListener('resize', () => { resizeCanvas(); setTimeout(resizeCanvas, 150); });
});

// ══════════════════════════════════════════════════════════════
//  CANVAS SETUP
// ══════════════════════════════════════════════════════════════
const canvas = document.getElementById('sim');
const ctx    = canvas.getContext('2d');
let W, H;

function resizeCanvas() {
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap) return;
  W = wrap.clientWidth;
  H = wrap.clientHeight;
  canvas.width  = W;
  canvas.height = H;
}

// ══════════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════════
const HOME         = () => ({ x: W * 0.07, y: H * 0.87 });
const DR           = 13;
const BASE_SPD     = 2.2;
const MAX_SPD_DMG  = 0.9;
const ACCEL        = 0.12;
const FRICTION     = 0.88;
const BATT_DRAIN   = 0.0016;
const BATT_LOW     = 18;
const PROJ_SPD     = 4.2;
const PROJ_IVRL    = 330;
const SD_THRESHOLD = 80;
const SD_SECS      = 5;

// ══════════════════════════════════════════════════════════════
//  ZONE DEFINITIONS
// ══════════════════════════════════════════════════════════════
const ZONE_DEFS = [
  { id:1, type:'safe',    rx:.07, ry:.87, rr:.075, freq:null, sig:null,  snr:null, label:'HOME BASE',  sublabel:'LAUNCH POINT' },
  { id:2, type:'safe',    rx:.93, ry:.87, rr:.065, freq:null, sig:null,  snr:null, label:'SAFE ZONE B',sublabel:null },
  { id:3, type:'safe',    rx:.50, ry:.08, rr:.06,  freq:null, sig:null,  snr:null, label:'SAFE ZONE C',sublabel:null },
  { id:4, type:'caution', rx:.22, ry:.26, rr:.09,  freq:2400, sig:-62,  snr:9,    label:'CAUTION',    sublabel:'2.4 GHz ISM' },
  { id:5, type:'caution', rx:.38, ry:.73, rr:.085, freq:2400, sig:-58,  snr:8,    label:'CAUTION',    sublabel:'2.4 GHz ISM' },
  { id:6, type:'jam',     rx:.57, ry:.32, rr:.11,  freq:5800, sig:-44,  snr:3,    label:'JAMMER',     sublabel:'5.8 GHz FPV' },
  { id:7, type:'jam',     rx:.79, ry:.56, rr:.105, freq:900,  sig:-41,  snr:2,    label:'JAMMER',     sublabel:'900 MHz LoRa' },
  { id:8, type:'jam',     rx:.20, ry:.60, rr:.10,  freq:5800, sig:-47,  snr:4,    label:'JAMMER',     sublabel:'5.8 GHz FPV' },
];
const PATROL_REL = [[.14,.15],[.57,.32],[.91,.11],[.79,.56],[.93,.87],[.50,.91],[.10,.87],[.20,.60],[.08,.35]];

function getZones() { return ZONE_DEFS.map(z => ({ ...z, cx:z.rx*W, cy:z.ry*H, r:z.rr*Math.min(W,H) })); }
function getPatrol() { return PATROL_REL.map(([rx,ry]) => ({ x:rx*W, y:ry*H })); }

// ══════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════
const dist  = (x1,y1,x2,y2) => Math.sqrt((x2-x1)**2+(y2-y1)**2);
const deg   = r => Math.round(r*180/Math.PI+90+360)%360;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const lerp  = (a,b,t) => a+(b-a)*t;
const fmtFreq = mhz => !mhz ? '—' : mhz>=1000 ? `${(mhz/1000).toFixed(1)} GHz` : `${mhz} MHz`;
const nowStr  = () => { const d=new Date(); return [d.getHours(),d.getMinutes(),d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':'); };

function getZoneAt(x, y) {
  const zones = getZones(), order={jam:3,caution:2,safe:1};
  let worst = null;
  for (const z of zones)
    if (dist(x,y,z.cx,z.cy) <= z.r && (!worst || order[z.type]>order[worst.type])) worst = z;
  return worst;
}

// ══════════════════════════════════════════════════════════════
//  DRONE STATE
// ══════════════════════════════════════════════════════════════
function makeDrone() {
  const h = HOME();
  return {
    x:h.x, y:h.y, vx:0, vy:0, angle:0,
    battery:100, damage:0, maxSpd:BASE_SPD,
    status:'SURVEILLANCE',
    currentZoneId:null, escapingFromId:null,
    isEscaping:false, isManual:false, isRTH:false,
    isCrashed:false, isSelfDestruct:false,
    sdCountdown:SD_SECS, sdReason:'',
    escapeTarget:null, detectedFreq:null,
    ignoredFreqs:[], panicLevel:0, wpIdx:0,
    trail:[], engParticles:[], explosionParticles:[],
  };
}

let drone, projs, projTimer, frame, running, paused, loopId;
let manualTarget, simSeconds, simTimer, pulseT, metrics, alertCooldowns;
let sdInterval = null;
let secEvents = [];

function resetSim() {
  if (sdInterval) { clearInterval(sdInterval); sdInterval = null; }
  drone = makeDrone(); projs=[]; projTimer=0; frame=0;
  running=true; paused=false; manualTarget=null;
  simSeconds=0; simTimer=0; pulseT=0;
  metrics={enc:0,esc:0,hits:0,safeTicks:0,dangerTicks:0};
  alertCooldowns={}; secEvents=[];
  document.getElementById('log-list').innerHTML='';
  document.getElementById('sec-log-list').innerHTML='';
  document.getElementById('crash-overlay').classList.remove('show');
  document.getElementById('sd-overlay').classList.remove('show');
  addLog('Mission initialized. AEGIS-7 AI engine online.','info');
  addLog('RF environment scanning active.','info');
  addLog(`Self-destruct armed at ${SD_THRESHOLD}% damage.`,'warn');
  secLog('Encryption active: AES-256-GCM','info');
  secLog('IDS monitoring enabled','info');
  secLog(`Session: ${Security.session?.username || '?'} [${Security.session?.role || '?'}]`,'info');
  renderBlacklist(); renderMetrics(); updateBtns();
  Security.ids.scan(drone, getZones());
}

// ══════════════════════════════════════════════════════════════
//  SELF DESTRUCT
// ══════════════════════════════════════════════════════════════
function initiateSD(reason) {
  if (drone.isSelfDestruct || drone.isCrashed) return;
  drone.isSelfDestruct = true; drone.sdCountdown = SD_SECS; drone.sdReason = reason;
  drone.status = 'SELFDESTRUCT'; running = false;
  document.getElementById('sd-count').textContent = SD_SECS;
  document.getElementById('sd-reason').textContent = reason;
  document.getElementById('sd-overlay').classList.add('show');
  addLog(`☢ SELF-DESTRUCT: ${reason}`, 'danger');
  showAlert('SELF-DESTRUCT INITIATED', 'danger');
  secLog(`SELF-DESTRUCT TRIGGERED: ${reason}`, 'alert');
  let c = SD_SECS;
  sdInterval = setInterval(() => {
    c--;
    document.getElementById('sd-count').textContent = c;
    if (c <= 0) { clearInterval(sdInterval); sdInterval = null; executeSD(); }
  }, 1000);
}

function executeSD() {
  document.getElementById('sd-overlay').classList.remove('show');
  for (let i=0;i<100;i++) {
    const a=Math.random()*Math.PI*2, s=1+Math.random()*7;
    drone.explosionParticles.push({ x:drone.x,y:drone.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,age:0,maxAge:70+Math.random()*50,size:1+Math.random()*5,color:['#ef4444','#f97316','#f59e0b','#ff0099','#fff'][Math.floor(Math.random()*5)] });
  }
  drone.isCrashed=true; drone.battery=0; drone.damage=100; drone.status='CRASHED';
  addLog('💥 SELF-DESTRUCT EXECUTED','danger');
  secLog('DRONE DESTROYED — MISSION TERMINATED','alert');
  setTimeout(() => {
    document.getElementById('crash-overlay').classList.add('show');
    document.getElementById('crash-sub').textContent = 'Self-Destruct Executed';
    document.getElementById('crash-reason').textContent = drone.sdReason;
  }, 1800);
}

function abortSD() {
  if (sdInterval) { clearInterval(sdInterval); sdInterval = null; }
  document.getElementById('sd-overlay').classList.remove('show');
  secLog('SELF-DESTRUCT ABORTED by operator','warn');
  resetSim(); startLoop();
}

// ══════════════════════════════════════════════════════════════
//  PHYSICS
// ══════════════════════════════════════════════════════════════
function steerTo(tx, ty, spd) {
  const dx=tx-drone.x, dy=ty-drone.y, d=Math.sqrt(dx*dx+dy*dy);
  if (d<2) return true;
  drone.vx += (dx/d)*ACCEL*speedMult; drone.vy += (dy/d)*ACCEL*speedMult;
  const s=Math.sqrt(drone.vx**2+drone.vy**2);
  if (s>spd){ drone.vx=(drone.vx/s)*spd; drone.vy=(drone.vy/s)*spd; }
  return d<18;
}
function applyPhysics() {
  drone.vx*=FRICTION; drone.vy*=FRICTION;
  drone.x=clamp(drone.x+drone.vx,DR,W-DR); drone.y=clamp(drone.y+drone.vy,DR,H-DR);
  const s=Math.sqrt(drone.vx**2+drone.vy**2);
  if (s>0.08) drone.angle=Math.atan2(drone.vy,drone.vx);
}
function calcEscapeTarget(zone) {
  const ang=Math.atan2(drone.y-zone.cy,drone.x-zone.cx)+(Math.random()-.5)*0.6;
  return { x:clamp(zone.cx+Math.cos(ang)*(zone.r+100),DR+20,W-DR-20), y:clamp(zone.cy+Math.sin(ang)*(zone.r+100),DR+20,H-DR-20) };
}

// ══════════════════════════════════════════════════════════════
//  DRONE UPDATE
// ══════════════════════════════════════════════════════════════
function updateDrone() {
  if (drone.isCrashed||drone.isSelfDestruct) return;
  drone.battery = Math.max(0, drone.battery - BATT_DRAIN*speedMult);
  if (drone.battery<=0) { crashDrone('BATTERY DEPLETED'); return; }
  if (drone.battery<BATT_LOW&&!drone.isRTH) {
    drone.isRTH=true; drone.isEscaping=false; drone.status='RETURN_HOME';
    addLog('⚡ Battery critical — RTH initiated.','warn');
    showAlert('Battery Critical — RTH','warn');
  }
  if (drone.damage>=SD_THRESHOLD&&!drone.isSelfDestruct)
    { initiateSD(`CRITICAL DAMAGE ${drone.damage}%`); return; }

  if (drone.isRTH) {
    const h=HOME(); steerTo(h.x,h.y,drone.maxSpd*0.85);
    if (dist(drone.x,drone.y,h.x,h.y)<14){ drone.vx=0;drone.vy=0;drone.x=h.x;drone.y=h.y; }
    applyPhysics(); updateTrail(); updateEngParticles(); return;
  }

  const zones=getZones(), zone=getZoneAt(drone.x,drone.y), ztype=zone?zone.type:'none';

  if (drone.isEscaping&&ztype!=='jam') {
    const ez=zones.find(z=>z.id===drone.escapingFromId);
    if (ez&&!drone.ignoredFreqs.includes(ez.freq)) {
      drone.ignoredFreqs.push(ez.freq); metrics.esc++;
      addLog(`✓ Escaped. ${fmtFreq(ez.freq)} blacklisted.`,'success');
      showAlert(`Escaped — ${fmtFreq(ez.freq)} Blocked`,'success');
      renderBlacklist();
    }
    drone.isEscaping=false; drone.escapeTarget=null; drone.escapingFromId=null;
    drone.currentZoneId=null; drone.panicLevel=0;
    if (!drone.isManual) drone.status='SURVEILLANCE';
  }

  if (ztype==='jam') {
    metrics.dangerTicks++;
    if (zone.id!==drone.currentZoneId&&!drone.isEscaping) {
      drone.currentZoneId=zone.id;
      const known=drone.ignoredFreqs.includes(zone.freq);
      if (known) {
        drone.panicLevel=0.1;
        addLog(`Known jammer. ${fmtFreq(zone.freq)} — suppressed.`,'info');
      } else {
        metrics.enc++; drone.panicLevel=1.0; drone.detectedFreq=zone.freq;
        addLog(`⚠ JAMMING: ${fmtFreq(zone.freq)} | ${zone.sig} dBm | SNR ${zone.snr} dB`,'danger');
        showAlert(`Jamming — ${fmtFreq(zone.freq)}`,'danger');
        secLog(`THREAT: Jamming detected at ${fmtFreq(zone.freq)}`,'warn');
        Security.ids.scan(drone, zones);
        if (!drone.isManual) {
          drone.escapeTarget=calcEscapeTarget(zone); drone.escapingFromId=zone.id;
          drone.isEscaping=true; drone.status='ESCAPE';
        } else drone.status='JAMMING';
      }
    }
    if (drone.isEscaping&&drone.escapeTarget&&dist(drone.x,drone.y,drone.escapeTarget.x,drone.escapeTarget.y)<20)
      drone.escapeTarget=calcEscapeTarget(zone);
  } else if (ztype==='caution') {
    metrics.safeTicks++;
    if (zone.id!==drone.currentZoneId&&!drone.isEscaping) {
      drone.currentZoneId=zone.id; drone.detectedFreq=zone.freq;
      if (!drone.isManual) drone.status='CAUTION';
      addLog(`Interference: ${fmtFreq(zone.freq)} at ${zone.sig} dBm`,'warn');
    }
  } else {
    metrics.safeTicks++;
    if (!drone.isEscaping) {
      drone.currentZoneId=null; drone.detectedFreq=null;
      if (!drone.isManual&&drone.status!=='RETURN_HOME') drone.status='SURVEILLANCE';
    }
  }
  drone.panicLevel=Math.max(0,drone.panicLevel-0.005);

  const patrol=getPatrol();
  if (drone.isEscaping&&drone.escapeTarget) steerTo(drone.escapeTarget.x,drone.escapeTarget.y,drone.maxSpd*1.3);
  else if (drone.isManual&&manualTarget) { if (steerTo(manualTarget.x,manualTarget.y,drone.maxSpd)) manualTarget=null; }
  else if (!drone.isManual) {
    const wp=patrol[drone.wpIdx];
    if (dist(drone.x,drone.y,wp.x,wp.y)<24) drone.wpIdx=(drone.wpIdx+1)%patrol.length;
    steerTo(wp.x,wp.y,drone.maxSpd);
  }
  applyPhysics(); updateTrail(); updateEngParticles();
}

function crashDrone(reason) {
  drone.isCrashed=true; drone.vx=0; drone.vy=0; drone.status='CRASHED'; running=false;
  addLog(`💥 DRONE OFFLINE: ${reason}`,'danger'); showAlert(`OFFLINE: ${reason}`,'danger');
  document.getElementById('crash-sub').textContent='Mission Terminated';
  document.getElementById('crash-reason').textContent=reason;
  document.getElementById('crash-overlay').classList.add('show');
  secLog(`DRONE OFFLINE: ${reason}`,'alert');
}

function updateTrail() {
  if (frame%2===0) drone.trail.push({x:drone.x,y:drone.y,age:0,status:drone.status});
  if (drone.trail.length>200) drone.trail.shift();
  drone.trail.forEach(p=>p.age++);
}
function updateEngParticles() {
  const s=Math.sqrt(drone.vx**2+drone.vy**2);
  if (s>0.3&&!drone.isCrashed) {
    [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4].forEach(a=>{
      if (Math.random()<0.3) drone.engParticles.push({x:drone.x+Math.cos(drone.angle+a)*DR,y:drone.y+Math.sin(drone.angle+a)*DR,vx:(Math.random()-.5)*.7,vy:(Math.random()-.5)*.7,age:0,maxAge:15+Math.random()*10,size:1.5+Math.random()*1.5});
    });
  }
  for (let i=drone.explosionParticles.length-1;i>=0;i--) {
    const p=drone.explosionParticles[i]; p.x+=p.vx; p.y+=p.vy; p.vx*=0.93; p.vy*=0.93; p.vy+=0.07; p.age++;
    if (p.age>p.maxAge) drone.explosionParticles.splice(i,1);
  }
  for (let i=drone.engParticles.length-1;i>=0;i--) {
    const p=drone.engParticles[i]; p.x+=p.vx; p.y+=p.vy; p.age++;
    if (p.age>p.maxAge) drone.engParticles.splice(i,1);
  }
}

function updateProjectiles() {
  if (drone.isCrashed||drone.isSelfDestruct) return;
  projTimer++;
  if (projTimer>=PROJ_IVRL) {
    projTimer=0;
    const jams=getZones().filter(z=>z.type==='jam');
    if (jams.length) {
      const z=jams[Math.floor(Math.random()*jams.length)],ang=Math.atan2(drone.y-z.cy,drone.x-z.cx);
      projs.push({x:z.cx+Math.cos(ang)*z.r,y:z.cy+Math.sin(ang)*z.r,vx:Math.cos(ang)*PROJ_SPD,vy:Math.sin(ang)*PROJ_SPD,age:0,trail:[]});
    }
  }
  for (let i=projs.length-1;i>=0;i--) {
    const p=projs[i]; p.trail.push({x:p.x,y:p.y}); if (p.trail.length>14) p.trail.shift();
    p.x+=p.vx; p.y+=p.vy; p.age++;
    if (dist(p.x,p.y,drone.x,drone.y)<DR+5) {
      drone.damage=Math.min(100,drone.damage+15);
      drone.maxSpd=Math.max(0.5,BASE_SPD-(drone.damage/100)*(BASE_SPD-MAX_SPD_DMG));
      metrics.hits++;
      addLog(`💥 HIT! Damage: ${drone.damage}% | Speed: ${drone.maxSpd.toFixed(2)}`,'danger');
      showAlert(`IMPACT — ${drone.damage}% Damage`,'danger');
      for (let j=0;j<18;j++) { const a=Math.random()*Math.PI*2,s=0.5+Math.random()*3; drone.explosionParticles.push({x:p.x,y:p.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,age:0,maxAge:25+Math.random()*20,size:1+Math.random()*3,color:['#ef4444','#f97316','#fbbf24'][Math.floor(Math.random()*3)]}); }
      projs.splice(i,1); continue;
    }
    if (p.x<-50||p.x>W+50||p.y<-50||p.y>H+50||p.age>600) projs.splice(i,1);
  }
}

// ══════════════════════════════════════════════════════════════
//  RENDERING
// ══════════════════════════════════════════════════════════════
function render() {
  if (!W||!H) return;
  ctx.clearRect(0,0,W,H); pulseT+=0.04;
  drawBg(); drawGrid(); drawZones(); drawHome(); drawTrail();
  if (!drone.isManual) drawWaypoints();
  if (manualTarget&&drone.isManual) drawManualTarget();
  if (drone.escapeTarget) drawEscapeArrow();
  drawProjectiles(); drawEngParticles(); drawExplosions(); drawDrone(); drawHUDExtras();
}

function drawBg() {
  const g=ctx.createRadialGradient(W*.5,H*.4,0,W*.5,H*.5,Math.max(W,H)*.8);
  g.addColorStop(0,'#060e1f'); g.addColorStop(.4,'#030b18'); g.addColorStop(1,'#010408');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // nebula blobs
  [{x:W*.2,y:H*.3,c:'rgba(0,150,255,0.02)',r:W*.2},{x:W*.75,y:H*.6,c:'rgba(124,58,237,0.015)',r:W*.16},{x:W*.5,y:H*.8,c:'rgba(16,185,129,0.015)',r:W*.14}].forEach(b=>{
    const gr=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r); gr.addColorStop(0,b.c); gr.addColorStop(1,'transparent');
    ctx.fillStyle=gr; ctx.fillRect(0,0,W,H);
  });
}

function drawGrid() {
  ctx.save(); ctx.strokeStyle='rgba(56,189,248,0.03)'; ctx.lineWidth=1;
  const step=60;
  for(let x=0;x<=W;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<=H;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.restore();
}

const ZONE_CLR={safe:{fill:'rgba(16,185,129,0.06)',stroke:'#10b981',glow:'rgba(16,185,129,0.08)'},caution:{fill:'rgba(251,191,36,0.07)',stroke:'#fbbf24',glow:'rgba(251,191,36,0.06)'},jam:{fill:'rgba(239,68,68,0.07)',stroke:'#ef4444',glow:'rgba(239,68,68,0.12)'}};
function drawZones() {
  const zones=getZones();
  for (const z of zones) {
    const cfg=ZONE_CLR[z.type],isJam=z.type==='jam',pulse=isJam?.6+.4*Math.sin(pulseT*1.3+z.id):1;
    ctx.save();
    const outerGrd=ctx.createRadialGradient(z.cx,z.cy,z.r*.4,z.cx,z.cy,z.r*(isJam?1.7:1.3));
    outerGrd.addColorStop(0,'transparent'); outerGrd.addColorStop(1,isJam?`rgba(239,68,68,${0.05*pulse})`:'transparent');
    ctx.fillStyle=outerGrd; ctx.beginPath(); ctx.arc(z.cx,z.cy,z.r*(isJam?1.7:1.3),0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=isJam?pulse:.9;
    const fillGrd=ctx.createRadialGradient(z.cx,z.cy,0,z.cx,z.cy,z.r); fillGrd.addColorStop(0,cfg.fill); fillGrd.addColorStop(1,'transparent');
    ctx.fillStyle=fillGrd; ctx.beginPath(); ctx.arc(z.cx,z.cy,z.r,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=isJam?.5*pulse:.35; ctx.strokeStyle=cfg.stroke; ctx.lineWidth=isJam?1.5:1;
    if(z.type==='caution') ctx.setLineDash([10,6]);
    ctx.shadowColor=cfg.stroke; ctx.shadowBlur=isJam?12*pulse:5;
    ctx.beginPath(); ctx.arc(z.cx,z.cy,z.r,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur=0;
    if(isJam){ ctx.globalAlpha=.18*pulse; ctx.beginPath(); ctx.arc(z.cx,z.cy,z.r*.6,0,Math.PI*2); ctx.stroke();
      const sa=pulseT*.8+z.id; ctx.globalAlpha=.1*pulse; ctx.beginPath(); ctx.moveTo(z.cx,z.cy); ctx.lineTo(z.cx+Math.cos(sa)*z.r,z.cy+Math.sin(sa)*z.r); ctx.stroke(); }
    ctx.globalAlpha=.9; ctx.shadowBlur=0;
    const tc=isJam?'#f87171':z.type==='caution'?'#fcd34d':'#6ee7b7';
    ctx.font=`bold 10px 'Share Tech Mono',monospace`; ctx.textAlign='center';
    const ly=z.cy-(z.sublabel?10:4); ctx.fillStyle=tc; ctx.fillText(z.label,z.cx,ly);
    if(z.sublabel){ctx.font=`8px 'Share Tech Mono',monospace`;ctx.fillStyle='rgba(255,255,255,0.35)';ctx.fillText(z.sublabel,z.cx,ly+13);}
    if(isJam&&z.freq){ctx.font=`7px 'Share Tech Mono',monospace`;ctx.fillStyle='rgba(248,113,113,0.55)';ctx.fillText(fmtFreq(z.freq),z.cx,ly+25);}
    ctx.restore();
  }
}

function drawHome() {
  const h=HOME(); ctx.save();
  ctx.globalAlpha=.5+.3*Math.sin(pulseT); ctx.strokeStyle='#818cf8'; ctx.lineWidth=1; ctx.shadowColor='#818cf8'; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.arc(h.x,h.y,20,0,Math.PI*2); ctx.stroke(); ctx.shadowBlur=0;
  ctx.globalAlpha=.75; ctx.font=`bold 9px 'Share Tech Mono',monospace`; ctx.textAlign='center'; ctx.fillStyle='#818cf8';
  ctx.fillText('⌂ HOME',h.x,h.y-28); ctx.restore();
}

const TRAIL_CLR={SURVEILLANCE:'#00f5ff',ESCAPE:'#f97316',RETURN_HOME:'#a78bfa',MANUAL:'#fbbf24',CAUTION:'#fbbf24',JAMMING:'#ef4444',SELFDESTRUCT:'#ff0099',CRASHED:'#475569'};
function drawTrail() {
  ctx.save();
  for (const p of drone.trail) {
    const a=Math.max(0,(1-p.age/300)*.55); if(a<=0)continue;
    ctx.globalAlpha=a; ctx.fillStyle=TRAIL_CLR[p.status]||'#00f5ff';
    const sz=lerp(2,.5,p.age/300); ctx.beginPath(); ctx.arc(p.x,p.y,sz,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawWaypoints() {
  const patrol=getPatrol(); ctx.save();
  ctx.strokeStyle='rgba(0,245,255,0.07)'; ctx.lineWidth=1; ctx.setLineDash([8,12]);
  ctx.beginPath(); patrol.forEach((wp,i)=>i===0?ctx.moveTo(wp.x,wp.y):ctx.lineTo(wp.x,wp.y)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
  patrol.forEach((wp,i)=>{
    const active=i===drone.wpIdx,next=i===(drone.wpIdx+1)%patrol.length;
    if(active){ctx.globalAlpha=.07+.03*Math.sin(pulseT*2);ctx.fillStyle='rgba(0,245,255,1)';ctx.beginPath();ctx.arc(wp.x,wp.y,18,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=active?.9:next?.45:.18; ctx.strokeStyle=active?'rgba(0,245,255,.9)':next?'rgba(0,245,255,.4)':'rgba(0,245,255,.18)'; ctx.lineWidth=active?1.5:1;
    ctx.shadowColor='#00f5ff'; ctx.shadowBlur=active?8:0;
    ctx.beginPath(); ctx.arc(wp.x,wp.y,5,0,Math.PI*2); ctx.stroke(); ctx.shadowBlur=0;
    ctx.font=`7px 'Share Tech Mono',monospace`; ctx.fillStyle=active?'rgba(0,245,255,.9)':next?'rgba(0,245,255,.45)':'rgba(0,245,255,.18)'; ctx.textAlign='center';
    ctx.fillText(`WP${String(i+1).padStart(2,'0')}`,wp.x,wp.y+16);
  });
  ctx.restore();
}

function drawManualTarget() {
  ctx.save(); const p=.5+.5*Math.sin(pulseT*3);
  ctx.setLineDash([5,7]); ctx.strokeStyle='rgba(167,139,250,.4)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(drone.x,drone.y); ctx.lineTo(manualTarget.x,manualTarget.y); ctx.stroke(); ctx.setLineDash([]);
  ctx.shadowColor='#a78bfa'; ctx.shadowBlur=12; ctx.strokeStyle=`rgba(167,139,250,${.7+.3*p})`; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(manualTarget.x,manualTarget.y,10+2*p,0,Math.PI*2); ctx.stroke();
  ctx.lineWidth=.8; ctx.shadowBlur=0; ctx.strokeStyle='rgba(167,139,250,.5)';
  ctx.beginPath(); ctx.moveTo(manualTarget.x-13,manualTarget.y); ctx.lineTo(manualTarget.x+13,manualTarget.y);
  ctx.moveTo(manualTarget.x,manualTarget.y-13); ctx.lineTo(manualTarget.x,manualTarget.y+13); ctx.stroke();
  ctx.restore();
}

function drawEscapeArrow() {
  ctx.save(); const p=.5+.5*Math.sin(pulseT*4);
  ctx.setLineDash([5,6]); ctx.strokeStyle='rgba(249,115,22,.4)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(drone.x,drone.y); ctx.lineTo(drone.escapeTarget.x,drone.escapeTarget.y); ctx.stroke(); ctx.setLineDash([]);
  ctx.shadowColor='#f97316'; ctx.shadowBlur=12; ctx.strokeStyle=`rgba(249,115,22,${.7+.3*p})`; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.arc(drone.escapeTarget.x,drone.escapeTarget.y,11,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

function drawProjectiles() {
  ctx.save();
  for (const p of projs) {
    const ang=Math.atan2(p.vy,p.vx);
    for(let i=0;i<p.trail.length;i++){const t=p.trail[i],a=(i/p.trail.length)*.45,sz=(i/p.trail.length)*2.2;ctx.globalAlpha=a;ctx.fillStyle='#f97316';ctx.beginPath();ctx.arc(t.x,t.y,sz,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(ang);
    ctx.shadowColor='#ef4444'; ctx.shadowBlur=18; ctx.fillStyle='#fecaca';
    ctx.beginPath(); ctx.moveTo(9,0); ctx.lineTo(-4,3.5); ctx.lineTo(-4,-3.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ef4444'; ctx.beginPath(); ctx.arc(0,0,2.5,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

function drawEngParticles() {
  ctx.save();
  for (const p of drone.engParticles) {
    const a=Math.max(0,(1-p.age/p.maxAge)*.55); ctx.globalAlpha=a; ctx.fillStyle='#00f5ff';
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(1-p.age/p.maxAge),0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawExplosions() {
  ctx.save();
  for (const p of drone.explosionParticles) {
    const life=p.age/p.maxAge; ctx.globalAlpha=Math.max(0,(1-life)*.9);
    ctx.shadowColor=p.color; ctx.shadowBlur=7; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(1-life*.5),0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawDrone() {
  ctx.save(); ctx.translate(drone.x,drone.y);
  const color=TRAIL_CLR[drone.status]||'#00f5ff';
  if(drone.panicLevel>0.05){const r=DR+10+drone.panicLevel*12+3*Math.sin(pulseT*4),gr=ctx.createRadialGradient(0,0,DR*.3,0,0,r);gr.addColorStop(0,'rgba(239,68,68,0)');gr.addColorStop(1,`rgba(239,68,68,${drone.panicLevel*.2})`);ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();}
  if(drone.isSelfDestruct){const p=.5+.5*Math.sin(pulseT*8),gr=ctx.createRadialGradient(0,0,0,0,0,DR*3);gr.addColorStop(0,`rgba(255,0,153,${.3*p})`);gr.addColorStop(1,'transparent');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,DR*3,0,Math.PI*2);ctx.fill();}
  ctx.rotate(drone.angle);
  const armA=[Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4];
  const spinR=drone.isCrashed?0:(drone.damage>50?.007:.017)*speedMult;
  armA.forEach((a,i)=>{
    const ex=Math.cos(a)*DR,ey=Math.sin(a)*DR;
    ctx.strokeStyle=drone.isCrashed?'rgba(71,85,105,.4)':'rgba(200,225,255,.32)'; ctx.lineWidth=2.2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.save(); ctx.translate(ex,ey); const sa=frame*spinR*60+a*2;
    ctx.globalAlpha=drone.isCrashed?.08:(0.12+.08*Math.abs(Math.sin(sa))); ctx.fillStyle=color;
    ctx.beginPath(); ctx.arc(0,0,6.5,0,Math.PI*2); ctx.fill();
    for(let b=0;b<2;b++){ctx.save();ctx.rotate(sa+b*Math.PI);ctx.globalAlpha=drone.isCrashed?.12:(.45+.25*Math.abs(Math.sin(sa)));ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.shadowColor=color;ctx.shadowBlur=drone.isCrashed?0:4;ctx.beginPath();ctx.moveTo(-6.5,0);ctx.lineTo(6.5,0);ctx.stroke();ctx.restore();}
    ctx.globalAlpha=drone.isCrashed?.2:1; ctx.fillStyle=drone.isCrashed?'#475569':color; ctx.shadowColor=color; ctx.shadowBlur=drone.isCrashed?0:7;
    ctx.beginPath(); ctx.arc(0,0,2.2,0,Math.PI*2); ctx.fill(); ctx.restore();
  });
  ctx.shadowBlur=0; ctx.shadowColor=color; ctx.shadowBlur=drone.isCrashed?0:18+6*Math.sin(pulseT*2);
  ctx.strokeStyle=color; ctx.lineWidth=1.7; ctx.globalAlpha=drone.isCrashed?.3:.9;
  ctx.beginPath(); ctx.arc(0,0,DR*.75,0,Math.PI*2); ctx.stroke();
  ctx.shadowBlur=0;
  const bg=ctx.createRadialGradient(-2,-2,1,0,0,DR*.75); bg.addColorStop(0,'rgba(200,225,255,.1)'); bg.addColorStop(1,'rgba(5,15,30,.9)');
  ctx.fillStyle=bg; ctx.globalAlpha=drone.isCrashed?.4:1; ctx.beginPath(); ctx.arc(0,0,DR*.75,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=`rgba(200,225,255,${drone.isCrashed?.08:.14})`; ctx.lineWidth=.7;
  ctx.beginPath(); ctx.arc(0,0,DR*.44,0,Math.PI*2); ctx.stroke();
  ctx.shadowColor=color; ctx.shadowBlur=drone.isCrashed?0:14; ctx.fillStyle=drone.isCrashed?'#475569':color;
  ctx.beginPath(); ctx.arc(0,0,3.5,0,Math.PI*2); ctx.fill();
  if(!drone.isCrashed){const tip=DR*.75+7;ctx.shadowBlur=0;ctx.fillStyle=color;ctx.globalAlpha=.7;ctx.beginPath();ctx.moveTo(tip,0);ctx.lineTo(tip-5,3);ctx.lineTo(tip-5,-3);ctx.closePath();ctx.fill();}
  ctx.restore();
}

function drawHUDExtras() {
  if(!drone.isCrashed){
    const c=TRAIL_CLR[drone.status]||'#00f5ff';
    ctx.save(); ctx.strokeStyle=c; ctx.globalAlpha=.13; ctx.lineWidth=.7; ctx.setLineDash([4,8]);
    ctx.beginPath(); ctx.arc(drone.x,drone.y,28+4*Math.sin(pulseT*2),0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=.07; ctx.beginPath(); ctx.arc(drone.x,drone.y,52,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  const zone=getZoneAt(drone.x,drone.y);
  document.getElementById('coord-bar').textContent=`X:${Math.round(drone.x)} · Y:${Math.round(drone.y)} · ALT:45m · HDG:${deg(drone.angle).toString().padStart(3,'0')}°${zone?` · ${zone.type.toUpperCase()}`:''}`;
}

// ══════════════════════════════════════════════════════════════
//  UI UPDATES
// ══════════════════════════════════════════════════════════════
let speedMult = 1.0;
document.getElementById('spd-slider').addEventListener('input',e=>{
  speedMult=e.target.value/10; document.getElementById('spd-lbl').textContent=speedMult.toFixed(1)+'×';
});

const STATUS_LABELS={SURVEILLANCE:'SURVEILLANCE',ESCAPE:'ESCAPE MANEUVER',RETURN_HOME:'RETURN HOME',MANUAL:'MANUAL CTRL',CAUTION:'CAUTION ZONE',JAMMING:'JAMMING',SELFDESTRUCT:'SELF-DESTRUCT',CRASHED:'OFFLINE'};
const STATUS_PILL_CLR={SURVEILLANCE:'rgba(16,185,129,0.07) rgba(16,185,129,0.3) #10b981',ESCAPE:'rgba(249,115,22,0.1) rgba(249,115,22,0.5) #f97316',RETURN_HOME:'rgba(124,58,237,0.08) rgba(124,58,237,0.4) #a78bfa',MANUAL:'rgba(245,158,11,0.07) rgba(245,158,11,0.35) #f59e0b',CAUTION:'rgba(245,158,11,0.07) rgba(245,158,11,0.35) #f59e0b',JAMMING:'rgba(239,68,68,0.1) rgba(239,68,68,0.5) #ef4444',SELFDESTRUCT:'rgba(255,0,153,0.12) rgba(255,0,153,0.6) #ff0099',CRASHED:'rgba(71,85,105,0.08) rgba(71,85,105,0.3) #64748b'};

function updateUI() {
  // Status pill
  const pill=document.getElementById('status-pill'), dot=pill.querySelector('.pill-dot');
  const [bg,border,color]=(STATUS_PILL_CLR[drone.status]||STATUS_PILL_CLR.SURVEILLANCE).split(' ');
  pill.style.background=bg; pill.style.borderColor=border; pill.style.color=color;
  dot.style.background=color; dot.style.boxShadow=`0 0 7px ${color}`;
  document.getElementById('status-text').textContent=STATUS_LABELS[drone.status]||drone.status;

  // Header gauges
  const b=drone.battery, bColor=b<20?'#ef4444':b<35?'#f97316':'#10b981';
  const dColor=drone.damage>60?'#ef4444':drone.damage>30?'#f97316':'#10b981';
  const el_b=document.getElementById('h-battery'); el_b.textContent=b.toFixed(1)+'%'; el_b.style.color=bColor;
  const el_d=document.getElementById('h-damage');  el_d.textContent=drone.damage+'%'; el_d.style.color=dColor;
  const zone=getZoneAt(drone.x,drone.y);
  const el_t=document.getElementById('h-threat');
  if(zone?.type==='jam'){el_t.textContent='CRITICAL';el_t.style.color='#ef4444';}
  else if(zone?.type==='caution'){el_t.textContent='ELEVATED';el_t.style.color='#f59e0b';}
  else{el_t.textContent='CLEAR';el_t.style.color='#10b981';}

  // Encryption header
  const el_enc=document.getElementById('h-encryption');
  el_enc.textContent=Security.encryptionActive?'AES-256':'UNENC';
  el_enc.style.color=Security.encryptionActive?'#10b981':'#ef4444';

  // Timer
  simTimer++; if(simTimer>=60&&!paused){simTimer=0;simSeconds++;}
  const mm=String(Math.floor(simSeconds/60)).padStart(2,'0'), ss=String(simSeconds%60).padStart(2,'0');
  document.getElementById('h-timer').textContent=`${mm}:${ss}`;

  // Telemetry panel
  document.getElementById('sb-pos').textContent=`${Math.round(drone.x)}, ${Math.round(drone.y)}`;
  const spd=Math.sqrt(drone.vx**2+drone.vy**2);
  document.getElementById('sb-spd').textContent=`${spd.toFixed(2)} u/s`;
  document.getElementById('sb-hdg').textContent=`${deg(drone.angle).toString().padStart(3,'0')}°`;
  document.getElementById('sb-wp').textContent=drone.isManual?'MANUAL':`WP${String(drone.wpIdx+1).padStart(2,'0')}/${PATROL_REL.length}`;

  // Battery bars
  document.getElementById('batt-val-lbl').textContent=b.toFixed(1)+'%'; document.getElementById('batt-val-lbl').style.color=bColor;
  const bf=document.getElementById('batt-fill'); bf.style.width=b+'%'; bf.style.background=`linear-gradient(90deg,${b<20?'#ef4444':b<40?'#f97316':'#10b981'},${b<20?'#dc2626':b<40?'#ea580c':'#059669'})`;
  document.getElementById('dmg-val-lbl').textContent=drone.damage+'%'; document.getElementById('dmg-val-lbl').style.color=dColor;
  document.getElementById('dmg-fill').style.width=drone.damage+'%';

  // RF panel
  if(zone?.freq){
    const rc=zone.type==='jam'?'#f87171':'#fcd34d';
    const el_rf=document.getElementById('rf-freq'); el_rf.textContent=fmtFreq(zone.freq); el_rf.style.color=rc; el_rf.style.textShadow=`0 0 12px ${rc}`;
    document.getElementById('rf-band').textContent=zone.sublabel||'—';
    document.getElementById('rf-rssi').textContent=zone.sig+' dBm';
    document.getElementById('rf-snr').textContent=zone.snr+' dB';
    const el_rft=document.getElementById('rf-threat'); el_rft.textContent=zone.type==='jam'?'HIGH':'MEDIUM'; el_rft.className=`sec-val ${zone.type==='jam'?'red':'orange'}`;
    const segs=zone.type==='jam'?5:zone.type==='caution'?3:1;
    const sc=['#10b981','#f59e0b','#f97316','#ef4444','#ff0099'];
    for(let i=0;i<5;i++){const el=document.getElementById('ts'+i);el.style.background=i<segs?sc[i]:'rgba(56,189,248,0.08)';el.style.boxShadow=i<segs?`0 0 5px ${sc[i]}`:'none';}
  } else {
    const el_rf=document.getElementById('rf-freq'); el_rf.textContent='NO SIGNAL'; el_rf.style.color='var(--t3)'; el_rf.style.textShadow='none';
    document.getElementById('rf-band').textContent='—'; document.getElementById('rf-rssi').textContent='—'; document.getElementById('rf-snr').textContent='—';
    document.getElementById('rf-threat').textContent='NONE'; document.getElementById('rf-threat').className='sec-val green';
    for(let i=0;i<5;i++){document.getElementById('ts'+i).style.background='rgba(56,189,248,0.08)';document.getElementById('ts'+i).style.boxShadow='none';}
  }

  // AI confidence
  const conf=Math.max(0,Math.min(100,100-drone.damage*.6-(drone.panicLevel*30)-(zone?.type==='jam'?20:0)));
  const el_ai=document.getElementById('ai-conf'); el_ai.textContent=Math.round(conf)+'%'; el_ai.className=`sec-val ${conf>70?'green':conf>40?'orange':'red'}`;
  document.getElementById('ai-bar').style.width=(100-conf)+'%';
  const decisions={SURVEILLANCE:'PATROL',ESCAPE:'EVADE',RETURN_HOME:'RTH',MANUAL:'OVERRIDE',CAUTION:'MONITOR',JAMMING:'DETECT',SELFDESTRUCT:'ARM',CRASHED:'HALT'};
  document.getElementById('ai-mode').textContent=decisions[drone.status]||'IDLE';

  // Security status panel
  document.getElementById('sec-session').textContent=Security.getSessionAge();
  const idsThreats=Security.ids.threatCount;
  const el_ids=document.getElementById('sec-ids'); el_ids.textContent=idsThreats>0?`${idsThreats} THREAT${idsThreats>1?'S':''}!`:'NONE DETECTED'; el_ids.className=`sec-val ${idsThreats>0?'red':'green'}`;
  const encActive=Security.encryptionActive;
  document.getElementById('sec-enc').textContent=encActive?'AES-256-GCM':'DISABLED'; document.getElementById('sec-enc').className=`sec-val ${encActive?'green':'red'}`;
  document.getElementById('sec-link').textContent=encActive?'SECURE':'EXPOSED'; document.getElementById('sec-link').className=`sec-val ${encActive?'green':'red'}`;
  const score=Math.max(0,98-(idsThreats*20)-(encActive?0:30)-(drone.damage>70?20:0));
  document.getElementById('sec-score').textContent=score+'%'; document.getElementById('sec-score').className=`sec-val ${score>75?'green':score>45?'orange':'red'}`;
  document.getElementById('sec-score-bar').style.width=score+'%'; document.getElementById('sec-score-bar').style.background=`linear-gradient(90deg,${score>75?'#10b981':score>45?'#f97316':'#ef4444'},${score>75?'#059669':score>45?'#ea580c':'#dc2626'})`;

  renderMetrics();
}

function renderBlacklist() {
  const el=document.getElementById('blacklist-container');
  if(!drone.ignoredFreqs.length){el.innerHTML='<div class="sec-lbl" style="font-size:9px;padding:4px 0">No frequencies blocked yet</div>';return;}
  el.innerHTML=drone.ignoredFreqs.map(f=>`<div class="freq-chip"><span>${fmtFreq(f)}</span><span class="freq-badge">BLOCKED</span></div>`).join('');
}
function renderMetrics() {
  document.getElementById('m-enc').textContent=metrics.enc;
  document.getElementById('m-esc').textContent=metrics.esc;
  document.getElementById('m-hits').textContent=metrics.hits;
  const tot=metrics.safeTicks+metrics.dangerTicks;
  document.getElementById('m-safe').textContent=tot>0?Math.round(metrics.safeTicks/tot*100)+'%':'—';
}

// ══════════════════════════════════════════════════════════════
//  LOG FUNCTIONS
// ══════════════════════════════════════════════════════════════
let logEntries=[];
function addLog(msg, type='info') {
  logEntries.unshift({msg,type,t:nowStr()});
  if(logEntries.length>60) logEntries.pop();
  const el=document.getElementById('log-list');
  el.innerHTML=logEntries.slice(0,30).map(e=>`<div class="log-entry log-${e.type}"><span class="log-ts">${e.t}</span><span>${e.msg}</span></div>`).join('');
  el.scrollTop=0;
}

function secLog(msg, type='info') {
  secEvents.unshift({msg,type,t:nowStr()});
  if(secEvents.length>20) secEvents.pop();
  const el=document.getElementById('sec-log-list');
  if(el) el.innerHTML=secEvents.slice(0,10).map(e=>`<div class="sec-log-entry sle-${e.type==='alert'?'alert':e.type==='warn'?'warn':'info'}"><span class="sle-ts">${e.t}</span><span>${e.msg}</span></div>`).join('');
}

// ══════════════════════════════════════════════════════════════
//  ALERTS
// ══════════════════════════════════════════════════════════════
function showAlert(msg, type='info') {
  const key=type+msg;
  if(alertCooldowns[key]&&frame-alertCooldowns[key]<180) return;
  alertCooldowns[key]=frame;
  const ov=document.getElementById('alert-overlay'), el=document.createElement('div');
  el.className=`alert-toast at-${type}`;
  const icons={danger:'⚠',warn:'◈',info:'◉',success:'✓',security:'🔐'};
  el.innerHTML=`<span>${icons[type]||'◉'}</span><span>${msg}</span>`;
  ov.appendChild(el);
  setTimeout(()=>{el.classList.add('fading');setTimeout(()=>el.remove(),380);},2800);
}

// ══════════════════════════════════════════════════════════════
//  BUTTON HANDLERS
// ══════════════════════════════════════════════════════════════
function updateBtns() {
  document.getElementById('btn-auto').classList.toggle('active',!drone.isManual);
  document.getElementById('btn-manual').classList.toggle('active',drone.isManual);
  document.getElementById('manual-hint').style.display=drone.isManual?'block':'none';
  document.getElementById('btn-pause').innerHTML=paused?'▶ RESUME':'⏸ PAUSE';
  document.getElementById('btn-pause').classList.toggle('active',paused);
  canvas.className=drone.isManual?'manual':'';
  const dis=!running||drone.isCrashed;
  ['btn-auto','btn-manual','btn-fire','btn-sd','btn-encrypt','btn-ids'].forEach(id=>document.getElementById(id).disabled=dis);
}

document.getElementById('btn-auto').addEventListener('click',()=>{
  if(!running||drone.isCrashed)return;
  drone.isManual=false; manualTarget=null;
  if(!drone.isRTH) drone.status='SURVEILLANCE';
  addLog('AUTO PATROL mode activated.','info');
  const enc=Security.encryptCmd('MODE:AUTO'); addLog(`CMD: ${enc}`,'security'); updateBtns();
});
document.getElementById('btn-manual').addEventListener('click',()=>{
  if(!running||drone.isCrashed)return;
  drone.isManual=true; drone.status='MANUAL'; manualTarget=null;
  addLog('MANUAL CTRL active. Click map to set waypoint.','info');
  const enc=Security.encryptCmd('MODE:MANUAL'); addLog(`CMD: ${enc}`,'security'); updateBtns();
});
document.getElementById('btn-fire').addEventListener('click',()=>{
  if(!running||drone.isCrashed||paused)return;
  const jams=getZones().filter(z=>z.type==='jam');
  if(jams.length){const z=jams[Math.floor(Math.random()*jams.length)],ang=Math.atan2(drone.y-z.cy,drone.x-z.cx);projs.push({x:z.cx+Math.cos(ang)*z.r,y:z.cy+Math.sin(ang)*z.r,vx:Math.cos(ang)*PROJ_SPD,vy:Math.sin(ang)*PROJ_SPD,age:0,trail:[]});}
  addLog('Hostile projectile launched!','danger'); showAlert('Incoming Projectile!','warn');
});
document.getElementById('btn-sd').addEventListener('click',()=>{
  if(!running||drone.isCrashed||paused||drone.isSelfDestruct)return;
  if(confirm('Initiate SELF-DESTRUCT? Cannot be undone.')) initiateSD('OPERATOR COMMAND — MANUAL TRIGGER');
});
document.getElementById('btn-encrypt').addEventListener('click',()=>{
  if(!running||drone.isCrashed)return;
  Security.encryptionActive=true;
  document.getElementById('tog-enc').checked=true;
  addLog('🔐 Encryption key rotated — AES-256-GCM re-established','security');
  showAlert('Link Re-Encrypted — AES-256','security');
  secLog('Encryption key rotation successful','info');
  Security.ids.scan(drone,getZones());
});
document.getElementById('btn-ids').addEventListener('click',()=>{
  if(!running||drone.isCrashed)return;
  const threats=Security.ids.scan(drone,getZones());
  if(threats.length===0){addLog('🛡 IDS Scan: No threats detected','security');showAlert('IDS Clear — No Threats','success');}
  else{threats.forEach(t=>{addLog(`🛡 IDS: ${t}`,'danger');});showAlert(`IDS: ${threats.length} Threat(s)!`,'danger');}
});
document.getElementById('btn-pause').addEventListener('click',()=>{ paused=!paused; updateBtns(); });
document.getElementById('btn-reset').addEventListener('click',()=>{ logEntries=[]; resetSim(); startLoop(); });
document.getElementById('btn-export').addEventListener('click',()=>{
  const lines=['AEGIS-7 Mission Log Export',`Exported: ${new Date().toLocaleString()}`,`Operator: ${Security.session?.username}`,`Role: ${Security.session?.role}`,`Encryption: ${Security.encryptionActive?'AES-256-GCM':'DISABLED'}`,'','=== EVENT LOG ===',''];
  lines.push(...logEntries.map(e=>`[${e.t}] [${e.type.toUpperCase()}] ${e.msg}`));
  lines.push('','=== SECURITY LOG ===','');
  lines.push(...secEvents.map(e=>`[${e.t}] [${e.type.toUpperCase()}] ${e.msg}`));
  lines.push('','=== METRICS ===',`Encounters: ${metrics.enc}`,`Escapes: ${metrics.esc}`,`Hits: ${metrics.hits}`,`Battery Remaining: ${drone.battery.toFixed(1)}%`,`Hull Damage: ${drone.damage}%`,'','=== BLACKLISTED RF ===');
  lines.push(...drone.ignoredFreqs.map(f=>fmtFreq(f)));
  const blob=new Blob([lines.join('\n')],{type:'text/plain'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`AEGIS7_Mission_${Date.now()}.txt`; a.click();
  addLog('📁 Mission log exported','info');
});

// Encryption toggle
document.getElementById('tog-enc').addEventListener('change',e=>{
  Security.encryptionActive=e.target.checked;
  if(!e.target.checked){addLog('⚠ WARNING: Encryption DISABLED — data link exposed!','danger');showAlert('Link Unencrypted!','danger');secLog('ENCRYPTION DISABLED — interception risk','alert');}
  else{addLog('🔐 Encryption re-enabled','security');}
  Security.ids.scan(drone,getZones());
});
document.getElementById('tog-ids').addEventListener('change',e=>{
  Security.ids.active=e.target.checked;
  addLog(e.target.checked?'🛡 IDS monitoring activated':'⚠ IDS monitoring DISABLED','security');
});

// Canvas click for manual waypoint
canvas.addEventListener('click',e=>{
  if(!drone.isManual||!running||drone.isCrashed)return;
  const r=canvas.getBoundingClientRect(),sx=W/r.width,sy=H/r.height;
  const mx=(e.clientX-r.left)*sx, my=(e.clientY-r.top)*sy;
  manualTarget={x:mx,y:my};
  const z=getZoneAt(mx,my);
  if(z?.type==='jam'){showAlert('WARNING: Jammer Zone!','warn');addLog(`⚠ Manual WP in JAMMER zone (${fmtFreq(z.freq)})!`,'warn');}
  else addLog(`Manual WP → (${Math.round(mx)}, ${Math.round(my)})`,'info');
  const enc=Security.encryptCmd(`WP:${Math.round(mx)},${Math.round(my)}`); addLog(`CMD: ${enc}`,'security');
});

// ══════════════════════════════════════════════════════════════
//  GAME LOOP
// ══════════════════════════════════════════════════════════════
function loop() {
  frame++;
  if(!paused){
    if(running&&!drone.isCrashed&&!drone.isSelfDestruct){ updateDrone(); updateProjectiles(); }
    render(); updateUI();
  } else { render(); updateUI(); }
  loopId=requestAnimationFrame(loop);
}
function startLoop() { if(loopId) cancelAnimationFrame(loopId); loopId=requestAnimationFrame(loop); }
function stopLoop()  { if(loopId) { cancelAnimationFrame(loopId); loopId=null; } }
