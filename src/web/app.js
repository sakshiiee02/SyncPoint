/**
 * SyncPoint Web Application Companion
 * Live Group Travel Tracking & Navigation for Friends on Road Trips
 */

// Shared Single Destination: Goa Dabolim Airport
const DESTINATION = {
  lat: 15.3808,
  lng: 73.8314,
  displayName: 'Goa Dabolim Airport',
};

// 10 Convoy Travelers Converging on Goa
const INITIAL_TRAVELERS = [
  {
    uid: 'u1_delhi',
    name: 'Aarav Sharma',
    city: 'Delhi',
    role: 'CREATOR',
    isLocal: true,
    travelMode: 'CAR',
    origin: { lat: 28.6139, lng: 77.2090 },
    current: { lat: 18.2500, lng: 74.8000 },
    speedKmh: 86.4,
    battery: 88,
    status: 'ON_THE_WAY',
    sharingState: 'ACTIVE',
    color: '#06b6d4',
    routePoints: [],
  },
  {
    uid: 'u2_jaipur',
    name: 'Priya Patel',
    city: 'Jaipur',
    role: 'MEMBER',
    isLocal: false,
    travelMode: 'CAR',
    origin: { lat: 26.9124, lng: 75.7873 },
    current: { lat: 18.0500, lng: 74.6000 },
    speedKmh: 82.1,
    battery: 92,
    status: 'ON_THE_WAY',
    sharingState: 'ACTIVE',
    color: '#a855f7',
    routePoints: [],
  },
  {
    uid: 'u3_gwalior',
    name: 'Vikram Singh',
    city: 'Gwalior',
    role: 'MEMBER',
    isLocal: false,
    travelMode: 'CAR',
    origin: { lat: 26.2183, lng: 78.1828 },
    current: { lat: 17.6500, lng: 74.9000 },
    speedKmh: 78.5,
    battery: 76,
    status: 'FUEL_STOP',
    sharingState: 'ACTIVE',
    color: '#ec4899',
    routePoints: [],
  },
  {
    uid: 'u4_mumbai',
    name: 'Ananya Deshmukh',
    city: 'Mumbai',
    role: 'MEMBER',
    isLocal: false,
    travelMode: 'CAR',
    origin: { lat: 19.0760, lng: 72.8777 },
    current: { lat: 16.6000, lng: 73.5500 },
    speedKmh: 74.0,
    battery: 84,
    status: 'ON_THE_WAY',
    sharingState: 'ACTIVE',
    color: '#3b82f6',
    routePoints: [],
  },
  {
    uid: 'u5_pune',
    name: 'Kabir Joshi',
    city: 'Pune',
    role: 'MEMBER',
    isLocal: false,
    travelMode: 'CAR',
    origin: { lat: 18.5204, lng: 73.8567 },
    current: { lat: 16.4000, lng: 73.8000 },
    speedKmh: 68.2,
    battery: 69,
    status: 'TRAFFIC',
    sharingState: 'ACTIVE',
    color: '#f97316',
    routePoints: [],
  },
  {
    uid: 'u6_bengaluru',
    name: 'Sneha Rao',
    city: 'Bengaluru',
    role: 'MEMBER',
    isLocal: false,
    travelMode: 'BIKE',
    origin: { lat: 12.9716, lng: 77.5946 },
    current: { lat: 14.8000, lng: 75.1000 },
    speedKmh: 58.0,
    battery: 95,
    status: 'ON_THE_WAY',
    sharingState: 'ACTIVE',
    color: '#10b981',
    routePoints: [],
  },
  {
    uid: 'u7_hyderabad',
    name: 'Arjun Reddy',
    city: 'Hyderabad',
    role: 'MEMBER',
    isLocal: false,
    travelMode: 'CAR',
    origin: { lat: 17.3850, lng: 78.4867 },
    current: { lat: 15.9500, lng: 75.6000 },
    speedKmh: 0,
    battery: 62,
    status: 'BREAK',
    sharingState: 'PAUSED',
    color: '#eab308',
    routePoints: [],
  },
  {
    uid: 'u8_kolhapur',
    name: 'Meera Kulkarni',
    city: 'Kolhapur',
    role: 'MEMBER',
    isLocal: false,
    travelMode: 'BIKE',
    origin: { lat: 16.7050, lng: 74.2433 },
    current: { lat: 15.8200, lng: 74.0500 },
    speedKmh: 52.4,
    battery: 81,
    status: 'ON_THE_WAY',
    sharingState: 'ACTIVE',
    color: '#14b8a6',
    routePoints: [],
  },
  {
    uid: 'u9_belagavi',
    name: 'Dev Hegde',
    city: 'Belagavi',
    role: 'MEMBER',
    isLocal: false,
    travelMode: 'BIKE',
    origin: { lat: 15.8497, lng: 74.4977 },
    current: { lat: 15.5400, lng: 74.0800 },
    speedKmh: 46.0,
    battery: 73,
    status: 'ON_THE_WAY',
    sharingState: 'ACTIVE',
    color: '#6366f1',
    routePoints: [],
  },
  {
    uid: 'u10_panaji',
    name: 'Tanvi Naik',
    city: 'Panaji',
    role: 'MEMBER',
    isLocal: false,
    travelMode: 'WALK',
    origin: { lat: 15.4909, lng: 73.8278 },
    current: { lat: 15.4100, lng: 73.8300 },
    speedKmh: 4.8,
    battery: 98,
    status: 'ON_THE_WAY',
    sharingState: 'ACTIVE',
    color: '#84cc16',
    routePoints: [],
  },
];

// Group Chat Seed
const INITIAL_CHAT = [
  { sender: 'Aarav Sharma', text: 'Started from Delhi! ETA around sunset in Goa.', isMe: true, time: '8h ago' },
  { sender: 'Priya Patel', text: 'Jaipur bypass cleared, traffic looks great so far 🚗', isMe: false, time: '6h ago' },
  { sender: 'Vikram Singh', text: '⛽ Fuel Stop: Filling up near Gwalior highway pump.', isStatus: true, time: '4h ago' },
  { sender: 'Kabir Joshi', text: '🚦 Heavy Traffic: Satara ghats have slow moving trucks.', isStatus: true, time: '2h ago' },
  { sender: 'Tanvi Naik', text: 'I am walking down from Panaji now, only 8km left! 🚶', isMe: false, time: '35m ago' },
];

class SyncPointApp {
  constructor() {
    this.travelers = JSON.parse(JSON.stringify(INITIAL_TRAVELERS));
    this.chatMessages = [...INITIAL_CHAT];
    this.selectedTravelerUid = 'u1_delhi';
    this.secondaryRouteTarget = null;
    this.simSpeed = 1;
    this.isPlaying = true;
    this.isOffline = false;
    this.cameraMode = 'recenter'; // 'recenter' | 'overview'

    // Map canvas
    this.canvas = document.getElementById('mapCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Bounds for Map View
    this.geoBounds = {
      minLng: 71.5,
      maxLng: 80.5,
      minLat: 14.5,
      maxLat: 29.5,
    };

    this.init();
  }

  init() {
    this.initRoutes();
    this.bindEvents();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.renderSidebar();
    this.renderChatMessages();
    this.startSimulationLoop();
  }

  // Pre-calculate synthetic smooth corridor route points for each traveler
  initRoutes() {
    this.travelers.forEach((t) => {
      const steps = 100;
      t.routePoints = [];
      for (let i = 0; i <= steps; i++) {
        const factor = i / steps;
        // Curve factor for natural road-like curvature
        const curveLat = Math.sin(factor * Math.PI) * (t.origin.lng > 75 ? 0.4 : -0.3);
        const lat = t.origin.lat + (DESTINATION.lat - t.origin.lat) * factor + curveLat;
        const lng = t.origin.lng + (DESTINATION.lng - t.origin.lng) * factor;
        t.routePoints.push({ lat, lng });
      }
      t.progressIndex = 40; // initial progress %
    });
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.drawMap();
  }

  // Coordinate Projection to Canvas Pixels
  geoToPixel(lat, lng) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (this.cameraMode === 'recenter') {
      const me = this.travelers.find((t) => t.uid === this.selectedTravelerUid) || this.travelers[0];
      const scale = Math.min(w, h) * 0.45;
      const x = w / 2 + (lng - me.current.lng) * scale;
      const y = h / 2 - (lat - me.current.lat) * scale;
      return { x, y };
    } else {
      // Overview mode: fits all travelers and destination
      const scaleX = w / (this.geoBounds.maxLng - this.geoBounds.minLng);
      const scaleY = h / (this.geoBounds.maxLat - this.geoBounds.minLat);
      const scale = Math.min(scaleX, scaleY) * 0.85;

      const centerLng = (this.geoBounds.maxLng + this.geoBounds.minLng) / 2;
      const centerLat = (this.geoBounds.maxLat + this.geoBounds.minLat) / 2;

      const x = w / 2 + (lng - centerLng) * scale;
      const y = h / 2 - (lat - centerLat) * scale;
      return { x, y };
    }
  }

  drawMap() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Dark canvas background with grid
    ctx.fillStyle = '#090e17';
    ctx.fillRect(0, 0, w, h);

    // Grid coordinates lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 1. Draw Route Polylines
    this.travelers.forEach((t) => {
      const isSelected = t.uid === this.selectedTravelerUid;
      ctx.beginPath();
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.strokeStyle = isSelected ? '#06b6d4' : `${t.color}66`;

      if (isSelected) {
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowBlur = 0;
      }

      t.routePoints.forEach((pt, idx) => {
        const pix = this.geoToPixel(pt.lat, pt.lng);
        if (idx === 0) ctx.moveTo(pix.x, pix.y);
        else ctx.lineTo(pix.x, pix.y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // 2. Secondary Route Polyline if active
    if (this.secondaryRouteTarget) {
      const me = this.travelers.find((t) => t.isLocal);
      const target = this.travelers.find((t) => t.uid === this.secondaryRouteTarget);
      if (me && target) {
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#f59e0b';
        ctx.setLineDash([6, 6]);
        const p1 = this.geoToPixel(me.current.lat, me.current.lng);
        const p2 = this.geoToPixel(target.current.lat, target.current.lng);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 3. Destination Radar Marker (Goa Airport)
    const destPix = this.geoToPixel(DESTINATION.lat, DESTINATION.lng);
    // Radar wave rings
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(destPix.x, destPix.y, 28, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(destPix.x, destPix.y, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px Outfit, sans-serif';
    ctx.fillText('🏁 Goa Airport (Destination)', destPix.x + 12, destPix.y + 4);

    // 4. Participant Vehicle Markers
    this.travelers.forEach((t) => {
      const pix = this.geoToPixel(t.current.lat, t.current.lng);
      const isSelected = t.uid === this.selectedTravelerUid;
      const isPaused = t.sharingState === 'PAUSED';

      // Vehicle glow ring
      ctx.beginPath();
      ctx.arc(pix.x, pix.y, isSelected ? 18 : 12, 0, Math.PI * 2);
      ctx.fillStyle = isPaused ? 'rgba(100, 116, 139, 0.4)' : `${t.color}33`;
      ctx.fill();

      // Vehicle dot
      ctx.beginPath();
      ctx.arc(pix.x, pix.y, isSelected ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = isPaused ? '#94a3b8' : t.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label & Speed
      ctx.fillStyle = isSelected ? '#38bdf8' : '#e2e8f0';
      ctx.font = isSelected ? '700 12px Plus Jakarta Sans, sans-serif' : '600 11px Plus Jakarta Sans, sans-serif';
      const label = `${t.name.split(' ')[0]} ${isPaused ? '(PAUSED)' : `${Math.round(t.speedKmh)} km/h`}`;
      ctx.fillText(label, pix.x + 12, pix.y + 4);
    });
  }

  startSimulationLoop() {
    setInterval(() => {
      if (!this.isPlaying) return;

      this.travelers.forEach((t) => {
        if (t.sharingState === 'PAUSED') return;

        // Advance progress along route
        const speedStep = (t.travelMode === 'CAR' ? 0.35 : t.travelMode === 'BIKE' ? 0.22 : 0.05) * this.simSpeed;
        t.progressIndex = Math.min(100, t.progressIndex + speedStep);

        const pointIndex = Math.min(t.routePoints.length - 1, Math.floor((t.progressIndex / 100) * (t.routePoints.length - 1)));
        const nextPt = t.routePoints[pointIndex];
        t.current.lat = nextPt.lat;
        t.current.lng = nextPt.lng;

        // Decrease battery slowly
        if (Math.random() < 0.05) {
          t.battery = Math.max(12, t.battery - 1);
        }
      });

      this.drawMap();
      this.updateFloatingCard();
      this.updateSidebarTelemetry();
      this.updateManeuverBanner();
    }, 400);
  }

  updateManeuverBanner() {
    const me = this.travelers.find((t) => t.isLocal);
    if (!me) return;

    const remainingPercent = Math.max(0, 100 - me.progressIndex);
    const distRemainingKm = Math.round(remainingPercent * 5.8);

    const maneuverDistEl = document.getElementById('maneuverDist');
    const maneuverInstrEl = document.getElementById('maneuverInstr');

    if (distRemainingKm <= 1) {
      maneuverDistEl.textContent = 'In 120m';
      maneuverInstrEl.textContent = "You're arriving at Goa Dabolim Airport!";
      document.getElementById('maneuverIcon').textContent = '🏁';
    } else if (distRemainingKm < 50) {
      maneuverDistEl.textContent = `In 1.4 km`;
      maneuverInstrEl.textContent = 'Keep left onto Zuari Bridge NH 66';
      document.getElementById('maneuverIcon').textContent = '↖️';
    } else {
      maneuverDistEl.textContent = `In 850m`;
      maneuverInstrEl.textContent = 'Continue on National Highway 66';
      document.getElementById('maneuverIcon').textContent = '⬆️';
    }
  }

  renderSidebar() {
    const container = document.getElementById('travelersList');
    container.innerHTML = '';

    this.travelers.forEach((t) => {
      const row = document.createElement('div');
      row.className = `traveler-row ${t.uid === this.selectedTravelerUid ? 'selected' : ''}`;
      row.id = `traveler-row-${t.uid}`;
      row.onclick = () => this.selectTraveler(t.uid);

      const statusEmoji = {
        ON_THE_WAY: '🚗',
        FUEL_STOP: '⛽',
        FOOD_STOP: '🍔',
        BREAK: '☕',
        TRAFFIC: '🚦',
        NEED_HELP: '🆘',
      }[t.status] || '🚗';

      row.innerHTML = `
        <div class="traveler-avatar" style="background: ${t.color}22; color: ${t.color}; border: 1.5px solid ${t.color};">
          ${t.name.charAt(0)}
        </div>
        <div class="traveler-main">
          <div class="traveler-name-row">
            <span class="traveler-name">${t.name}</span>
            <span class="traveler-mode-pill">${t.travelMode}</span>
          </div>
          <div class="traveler-meta-row">
            <span>📍 ${t.city}</span>
            <span id="speed-${t.uid}">🚀 ${Math.round(t.speedKmh)} km/h</span>
            <span id="batt-${t.uid}">🔋 ${t.battery}%</span>
          </div>
        </div>
        <div class="traveler-status-badge" style="background: rgba(6, 182, 212, 0.15); color: #38bdf8;">
          ${statusEmoji}
        </div>
      `;
      container.appendChild(row);
    });
  }

  updateSidebarTelemetry() {
    this.travelers.forEach((t) => {
      const speedEl = document.getElementById(`speed-${t.uid}`);
      const battEl = document.getElementById(`batt-${t.uid}`);
      if (speedEl) speedEl.textContent = `🚀 ${t.sharingState === 'PAUSED' ? 'PAUSED' : `${Math.round(t.speedKmh)} km/h`}`;
      if (battEl) battEl.textContent = `🔋 ${t.battery}%`;
    });
  }

  selectTraveler(uid) {
    this.selectedTravelerUid = uid;
    document.querySelectorAll('.traveler-row').forEach((r) => r.classList.remove('selected'));
    const activeRow = document.getElementById(`traveler-row-${uid}`);
    if (activeRow) activeRow.classList.add('selected');

    this.showTravelerCard(uid);
    this.drawMap();
  }

  showTravelerCard(uid) {
    const traveler = this.travelers.find((t) => t.uid === uid);
    if (!traveler) return;

    const card = document.getElementById('travelerFloatingCard');
    card.classList.remove('hidden');

    document.getElementById('cardAvatar').textContent = traveler.name.charAt(0);
    document.getElementById('cardName').textContent = traveler.name;
    document.getElementById('cardOrigin').textContent = `From ${traveler.city} • Traveling by ${traveler.travelMode}`;
    document.getElementById('cardSpeed').textContent = `${Math.round(traveler.speedKmh)} km/h`;
    document.getElementById('cardBattery').textContent = `${traveler.battery}%`;

    const remainingKm = Math.round((100 - traveler.progressIndex) * 5.8);
    document.getElementById('cardDistance').textContent = `${remainingKm} km`;
    const etaHours = (remainingKm / Math.max(traveler.speedKmh, 20)).toFixed(1);
    document.getElementById('cardEta').textContent = `${etaHours}h`;

    const statusPill = document.getElementById('cardStatusPill');
    statusPill.textContent = traveler.status.replace(/_/g, ' ');

    const btnNav = document.getElementById('btnNavigateToTraveler');
    if (traveler.isLocal) {
      btnNav.style.display = 'none';
    } else {
      btnNav.style.display = 'block';
      btnNav.textContent = `🧭 Secondary Route to ${traveler.name.split(' ')[0]}`;
      btnNav.onclick = () => this.startSecondaryRoute(traveler.uid);
    }

    document.getElementById('btnCallTraveler').onclick = () => {
      alert(`Native dialer opened: Calling ${traveler.name} (+91 98765 43210)`);
    };
  }

  updateFloatingCard() {
    const card = document.getElementById('travelerFloatingCard');
    if (card.classList.contains('hidden')) return;

    const traveler = this.travelers.find((t) => t.uid === this.selectedTravelerUid);
    if (traveler) {
      document.getElementById('cardSpeed').textContent = `${Math.round(traveler.speedKmh)} km/h`;
      document.getElementById('cardBattery').textContent = `${traveler.battery}%`;
    }
  }

  startSecondaryRoute(uid) {
    const target = this.travelers.find((t) => t.uid === uid);
    if (!target) return;

    this.secondaryRouteTarget = uid;
    document.getElementById('secondaryRouteBanner').classList.remove('hidden');
    document.getElementById('secondaryTargetName').textContent = target.name;
    document.getElementById('travelerFloatingCard').classList.add('hidden');
    this.drawMap();
  }

  exitSecondaryRoute() {
    this.secondaryRouteTarget = null;
    document.getElementById('secondaryRouteBanner').classList.add('hidden');
    this.drawMap();
  }

  broadcastStatus(status) {
    const me = this.travelers.find((t) => t.isLocal);
    if (!me) return;

    me.status = status;
    this.chatMessages.push({
      sender: me.name,
      text: `Status update: ${status.replace(/_/g, ' ')}`,
      isStatus: true,
      time: 'Just now',
    });
    this.renderChatMessages();
    this.renderSidebar();

    if (status === 'NEED_HELP') {
      document.getElementById('emergencyModalOverlay').classList.remove('hidden');
    }
  }

  renderChatMessages() {
    const container = document.getElementById('chatMessagesList');
    container.innerHTML = '';

    this.chatMessages.forEach((msg) => {
      const div = document.createElement('div');
      if (msg.isStatus) {
        div.className = 'chat-msg status-msg';
        div.textContent = `${msg.sender}: ${msg.text}`;
      } else {
        div.className = `chat-msg ${msg.isMe ? 'me' : 'other'}`;
        div.innerHTML = `<strong>${msg.sender}</strong><br>${msg.text}<div style="font-size: 9px; opacity: 0.7; text-align: right; margin-top: 2px;">${msg.time}</div>`;
      }
      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  }

  sendChat() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    this.chatMessages.push({
      sender: 'Aarav Sharma',
      text,
      isMe: true,
      time: 'Just now',
    });

    input.value = '';
    this.renderChatMessages();
  }

  bindEvents() {
    // Top Controls
    document.getElementById('btnPlayPause').onclick = (e) => {
      this.isPlaying = !this.isPlaying;
      e.target.textContent = this.isPlaying ? '⏸' : '▶';
    };

    document.querySelectorAll('.btn-speed').forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll('.btn-speed').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.simSpeed = parseInt(btn.dataset.speed, 10);
      };
    });

    // Quick Status Bar
    document.querySelectorAll('.status-chip').forEach((chip) => {
      chip.onclick = () => {
        document.querySelectorAll('.status-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.broadcastStatus(chip.dataset.status);
      };
    });

    // Camera Controls
    document.getElementById('btnRecenterMe').onclick = () => {
      this.cameraMode = 'recenter';
      document.getElementById('btnRecenterMe').classList.add('active');
      document.getElementById('btnOverviewMode').classList.remove('active');
      this.drawMap();
    };

    document.getElementById('btnOverviewMode').onclick = () => {
      this.cameraMode = 'overview';
      document.getElementById('btnOverviewMode').classList.add('active');
      document.getElementById('btnRecenterMe').classList.remove('active');
      this.drawMap();
    };

    document.getElementById('btnToggleOfflineMode').onclick = (e) => {
      this.isOffline = !this.isOffline;
      e.target.textContent = this.isOffline ? '📵 Offline (SQLite Buffer)' : '📶 Online (Sync)';
      e.target.style.borderColor = this.isOffline ? '#ef4444' : '#06b6d4';
    };

    // Card Close
    document.getElementById('btnCloseTravelerCard').onclick = () => {
      document.getElementById('travelerFloatingCard').classList.add('hidden');
    };

    // Secondary route exit
    document.getElementById('btnExitSecondaryRoute').onclick = () => {
      this.exitSecondaryRoute();
    };

    // Pause sharing toggle
    document.getElementById('btnTogglePauseSharing').onclick = (e) => {
      const me = this.travelers.find((t) => t.isLocal);
      if (!me) return;
      if (me.sharingState === 'ACTIVE') {
        me.sharingState = 'PAUSED';
        e.target.textContent = '▶ Resume My Location';
        e.target.style.background = '#f59e0b';
      } else {
        me.sharingState = 'ACTIVE';
        e.target.textContent = '⏸ Pause My Location';
        e.target.style.background = '';
      }
      this.drawMap();
      this.renderSidebar();
    };

    // Finish Journey
    document.getElementById('btnFinishJourney').onclick = () => {
      alert('🏁 Journey Finished! Your track has been saved indefinitely in /history with 87% RDP compression.');
      document.getElementById('historyModalOverlay').classList.remove('hidden');
      this.populateHistoryTable();
    };

    // Chat Drawer Toggle
    document.getElementById('btnToggleChat').onclick = () => {
      document.getElementById('chatDrawerOverlay').classList.remove('hidden');
    };
    document.getElementById('btnCloseChatDrawer').onclick = () => {
      document.getElementById('chatDrawerOverlay').classList.add('hidden');
    };
    document.getElementById('chatDrawerOverlay').onclick = (e) => {
      if (e.target.id === 'chatDrawerOverlay') {
        document.getElementById('chatDrawerOverlay').classList.add('hidden');
      }
    };
    document.getElementById('btnSendChat').onclick = () => this.sendChat();
    document.getElementById('chatInput').onkeypress = (e) => {
      if (e.key === 'Enter') this.sendChat();
    };

    // Emergency Action Sheet
    document.getElementById('btnEmergencyTrigger').onclick = () => {
      document.getElementById('emergencyModalOverlay').classList.remove('hidden');
    };
    document.getElementById('btnCloseEmergencyModal').onclick = () => {
      document.getElementById('emergencyModalOverlay').classList.add('hidden');
    };
    document.getElementById('btnBroadcastEmergency').onclick = () => {
      this.broadcastStatus('NEED_HELP');
      alert('Urgent SOS alert broadcasted to all 9 other convoy travelers via FCM!');
      document.getElementById('emergencyModalOverlay').classList.add('hidden');
    };
    document.getElementById('btnCall112').onclick = () => {
      alert('Native dialer opened: Dialing 112 / 108 Emergency Services');
    };
    document.getElementById('btnShareGpsLink').onclick = () => {
      navigator.clipboard?.writeText('https://maps.google.com/?q=15.98124,73.71241');
      alert('Live emergency GPS location link copied to clipboard!');
    };

    // History Modal
    document.getElementById('btnToggleHistory').onclick = () => {
      document.getElementById('historyModalOverlay').classList.remove('hidden');
      this.populateHistoryTable();
    };
    document.getElementById('btnCloseHistoryModal').onclick = () => {
      document.getElementById('historyModalOverlay').classList.add('hidden');
    };
    document.getElementById('historySlider').oninput = (e) => {
      const val = e.target.value;
      document.getElementById('historyScrubberPercent').textContent = `Replay Progress: ${val}%`;
    };
  }

  populateHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    this.travelers.forEach((t) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${t.name}</strong></td>
        <td>${t.travelMode}</td>
        <td>${t.city}</td>
        <td>${Math.round(t.routePoints.length * 5.8)} km</td>
        <td>${Math.round(t.speedKmh)} km/h</td>
        <td><span style="color: #10b981; font-weight: 700;">Arrived 🏁</span></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  new SyncPointApp();
});
