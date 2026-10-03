/**
 * SyncPoint Web Application - Production Real-Time Companion
 * Directly wired to Firebase Realtime Database
 * Live GPS tracking, mutual traveler telemetry, and convoy chat
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, off, push, set, get } from 'firebase/database';

// Firebase configuration (Reads from environment variables or .env)
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || import.meta.env?.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyYourActualApiKeyHere',
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || import.meta.env?.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'your-project-id.firebaseapp.com',
  databaseURL: import.meta.env?.VITE_FIREBASE_DATABASE_URL || import.meta.env?.EXPO_PUBLIC_FIREBASE_DATABASE_URL || 'https://your-project-id-default-rtdb.firebaseio.com',
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || import.meta.env?.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'your-project-id',
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || import.meta.env?.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'your-project-id.appspot.com',
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta.env?.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || import.meta.env?.EXPO_PUBLIC_FIREBASE_APP_ID || '1:123456789012:android:abcdef0123456789',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

// Traveler color palette for map differentiation
const TRAVELER_COLORS = [
  '#06b6d4', '#a855f7', '#ec4899', '#3b82f6', '#f97316',
  '#10b981', '#eab308', '#14b8a6', '#6366f1', '#84cc16'
];

class SyncPointProductionApp {
  constructor() {
    this.currentJourneyId = null;
    this.journeyMeta = null;
    this.destination = { lat: 15.3808, lng: 73.8314, displayName: 'Shared Destination' };
    this.members = {};
    this.liveLocations = {};
    this.chatMessages = [];
    this.historyData = null;

    this.selectedTravelerUid = null;
    this.secondaryRouteTarget = null;
    this.cameraMode = 'recenter'; // 'recenter' | 'overview'

    this.canvas = document.getElementById('mapCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.listeners = [];

    this.init();
  }

  async init() {
    this.bindEvents();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Check URL parameters for journeyId or joinCode
    const urlParams = new URLSearchParams(window.location.search);
    const paramJourneyId = urlParams.get('journeyId');
    const paramJoinCode = urlParams.get('code');

    if (paramJourneyId) {
      this.connectToJourney(paramJourneyId);
    } else if (paramJoinCode) {
      this.resolveJoinCode(paramJoinCode);
    } else {
      this.discoverActiveJourneys();
    }

    // Refresh map canvas smoothly
    setInterval(() => {
      this.drawMap();
    }, 500);
  }

  async discoverActiveJourneys() {
    try {
      const snap = await get(ref(db, 'journeys'));
      if (snap.exists()) {
        const journeys = snap.val();
        const activeIds = Object.keys(journeys).filter(
          (id) => journeys[id]?.meta && journeys[id].meta.status !== 'EXPIRED'
        );
        if (activeIds.length > 0) {
          // Connect to the latest active journey
          const latestId = activeIds[activeIds.length - 1];
          this.connectToJourney(latestId);
          return;
        }
      }
    } catch (e) {
      console.warn('Realtime database discovery notice:', e.message);
    }

    // Render empty waiting state
    this.renderWaitingState();
  }

  async resolveJoinCode(code) {
    try {
      const snap = await get(ref(db, `joinCodes/${code.toUpperCase()}`));
      if (snap.exists()) {
        const data = snap.val();
        if (data.journeyId) {
          this.connectToJourney(data.journeyId);
          return;
        }
      }
      alert(`Join code "${code}" was not found or has expired.`);
    } catch (e) {
      alert(`Failed to resolve join code: ${e.message}`);
    }
  }

  connectToJourney(journeyId) {
    this.cleanupListeners();
    this.currentJourneyId = journeyId;

    // 1. Subscribe to Journey Metadata
    const metaRef = ref(db, `journeys/${journeyId}/meta`);
    const metaCb = onValue(metaRef, (snap) => {
      if (snap.exists()) {
        this.journeyMeta = snap.val();
        if (this.journeyMeta.destination) {
          this.destination = this.journeyMeta.destination;
        }
        this.updateHeaderUI();
      }
    });
    this.listeners.push({ ref: metaRef, cb: metaCb });

    // 2. Subscribe to Journey Members
    const membersRef = ref(db, `journeys/${journeyId}/members`);
    const membersCb = onValue(membersRef, (snap) => {
      if (snap.exists()) {
        this.members = snap.val();
      } else {
        this.members = {};
      }
      this.renderSidebar();
      this.drawMap();
    });
    this.listeners.push({ ref: membersRef, cb: membersCb });

    // 3. Subscribe to Real-Time Live Locations from Physical Devices
    const liveRef = ref(db, `journeys/${journeyId}/live`);
    const liveCb = onValue(liveRef, (snap) => {
      if (snap.exists()) {
        this.liveLocations = snap.val();
      } else {
        this.liveLocations = {};
      }
      this.updateSidebarTelemetry();
      this.updateFloatingCard();
      this.drawMap();
    });
    this.listeners.push({ ref: liveRef, cb: liveCb });

    // 4. Subscribe to Real-Time Chat
    const chatRef = ref(db, `journeys/${journeyId}/chat`);
    const chatCb = onValue(chatRef, (snap) => {
      if (snap.exists()) {
        const raw = snap.val();
        this.chatMessages = Object.values(raw).sort((a, b) => a.timestamp - b.timestamp);
      } else {
        this.chatMessages = [];
      }
      this.renderChatMessages();
    });
    this.listeners.push({ ref: chatRef, cb: chatCb });

    // Update browser URL query param without reload
    const newUrl = `${window.location.pathname}?journeyId=${journeyId}`;
    window.history.replaceState({}, '', newUrl);
  }

  cleanupListeners() {
    this.listeners.forEach(({ ref: r, cb }) => off(r, 'value', cb));
    this.listeners = [];
  }

  renderWaitingState() {
    const titleEl = document.getElementById('journeyTitle');
    const badgeEl = document.getElementById('journeyCodeBadge');
    if (titleEl) titleEl.textContent = 'Waiting for Active Journey...';
    if (badgeEl) badgeEl.textContent = 'CONNECT';

    const container = document.getElementById('travelersList');
    if (container) {
      container.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; color: #94a3b8;">
          <p style="font-size: 14px; font-weight: 700; color: #f8fafc; margin-bottom: 6px;">No Active Journey Connected</p>
          <p style="font-size: 12px; line-height: 18px; margin-bottom: 16px;">
            Start a journey on your Android phone, or enter a 6-character short code to track your convoy live.
          </p>
          <button id="btnPromptConnect" style="background: #06b6d4; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer;">
            Enter Journey Code
          </button>
        </div>
      `;
      const btnPrompt = document.getElementById('btnPromptConnect');
      if (btnPrompt) {
        btnPrompt.onclick = () => this.promptForJourneyCode();
      }
    }
  }

  promptForJourneyCode() {
    const code = prompt('Enter 6-character Journey Join Code (e.g. GOA42K) or Journey ID:');
    if (code && code.trim()) {
      const clean = code.trim();
      if (clean.length === 6) {
        this.resolveJoinCode(clean);
      } else {
        this.connectToJourney(clean);
      }
    }
  }

  updateHeaderUI() {
    if (!this.journeyMeta) return;

    const titleEl = document.getElementById('journeyTitle');
    if (titleEl) titleEl.textContent = this.journeyMeta.name || 'Active Journey';

    const badgeEl = document.getElementById('journeyCodeBadge');
    if (badgeEl) badgeEl.textContent = `#${this.currentJourneyId.substring(this.currentJourneyId.length - 6).toUpperCase()}`;

    const memberCountBadge = document.getElementById('memberCountBadge');
    const memberCount = Object.keys(this.members).length;
    if (memberCountBadge) {
      memberCountBadge.textContent = `${memberCount} / 10 Active`;
    }

    const destSub = document.querySelector('.destination-sub');
    if (destSub && this.destination) {
      destSub.innerHTML = `Destination: <strong>${this.destination.displayName}</strong> (120m arrival zone)`;
    }
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.drawMap();
  }

  geoToPixel(lat, lng) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Center map around destination and travelers
    const centerLat = this.destination?.lat || 15.3808;
    const centerLng = this.destination?.lng || 73.8314;

    const scale = Math.min(w, h) * 0.35;
    const x = w / 2 + (lng - centerLng) * scale;
    const y = h / 2 - (lat - centerLat) * scale;
    return { x, y };
  }

  drawMap() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#090e17';
    ctx.fillRect(0, 0, w, h);

    // Subtle dark map grid
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
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

    // 1. Destination Marker (Real coordinates)
    if (this.destination) {
      const destPix = this.geoToPixel(this.destination.lat, this.destination.lng);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(destPix.x, destPix.y, 24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(destPix.x, destPix.y, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px Outfit, sans-serif';
      ctx.fillText(`🏁 ${this.destination.displayName}`, destPix.x + 14, destPix.y + 4);
    }

    // 2. Real Participant Device Markers from Firebase RTDB
    const memberUids = Object.keys(this.members);
    memberUids.forEach((uid, index) => {
      const member = this.members[uid];
      const live = this.liveLocations[uid];
      const color = TRAVELER_COLORS[index % TRAVELER_COLORS.length];

      const lat = live?.lat || member?.origin?.lat || this.destination.lat;
      const lng = live?.lng || member?.origin?.lng || this.destination.lng;

      const pix = this.geoToPixel(lat, lng);
      const isSelected = uid === this.selectedTravelerUid;
      const isPaused = live?.isSharing === false || member.sharingState === 'PAUSED';

      // Draw route connecting origin to destination or current fix
      if (member?.origin) {
        const originPix = this.geoToPixel(member.origin.lat, member.origin.lng);
        ctx.beginPath();
        ctx.strokeStyle = `${color}44`;
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.moveTo(originPix.x, originPix.y);
        ctx.lineTo(pix.x, pix.y);
        ctx.stroke();
      }

      // Halo ring
      ctx.beginPath();
      ctx.arc(pix.x, pix.y, isSelected ? 18 : 12, 0, Math.PI * 2);
      ctx.fillStyle = isPaused ? 'rgba(100, 116, 139, 0.3)' : `${color}33`;
      ctx.fill();

      // Vehicle point
      ctx.beginPath();
      ctx.arc(pix.x, pix.y, isSelected ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = isPaused ? '#94a3b8' : color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Telemetry badge
      ctx.fillStyle = isSelected ? '#38bdf8' : '#e2e8f0';
      ctx.font = isSelected ? '700 12px Plus Jakarta Sans, sans-serif' : '600 11px Plus Jakarta Sans, sans-serif';
      const speedKmh = live?.speedMps ? Math.round(live.speedMps * 3.6) : 0;
      const label = `${member.name.split(' ')[0]} ${isPaused ? '(PAUSED)' : `${speedKmh} km/h`}`;
      ctx.fillText(label, pix.x + 12, pix.y + 4);
    });
  }

  renderSidebar() {
    const container = document.getElementById('travelersList');
    if (!container) return;

    container.innerHTML = '';
    const memberUids = Object.keys(this.members);

    if (memberUids.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">
          No travelers joined yet. Share join code with your friends to track together.
        </div>
      `;
      return;
    }

    memberUids.forEach((uid, index) => {
      const member = this.members[uid];
      const live = this.liveLocations[uid];
      const color = TRAVELER_COLORS[index % TRAVELER_COLORS.length];

      const row = document.createElement('div');
      row.className = `traveler-row ${uid === this.selectedTravelerUid ? 'selected' : ''}`;
      row.id = `traveler-row-${uid}`;
      row.onclick = () => this.selectTraveler(uid);

      const statusEmoji = {
        ON_THE_WAY: '🚗',
        FUEL_STOP: '⛽',
        FOOD_STOP: '🍔',
        BREAK: '☕',
        TRAFFIC: '🚦',
        NEED_HELP: '🆘',
        STOPPED: '🛑',
      }[live?.status || 'ON_THE_WAY'] || '🚗';

      const speedKmh = live?.speedMps ? Math.round(live.speedMps * 3.6) : 0;
      const batt = live?.batteryPct ?? 90;

      row.innerHTML = `
        <div class="traveler-avatar" style="background: ${color}22; color: ${color}; border: 1.5px solid ${color};">
          ${member.name ? member.name.charAt(0) : '?'}
        </div>
        <div class="traveler-main">
          <div class="traveler-name-row">
            <span class="traveler-name">${member.name || 'Traveler'}</span>
            <span class="traveler-mode-pill">${member.travelMode || 'CAR'}</span>
          </div>
          <div class="traveler-meta-row">
            <span>📍 ${member.origin?.displayName?.split(',')[0] || 'Origin'}</span>
            <span id="speed-${uid}">🚀 ${live?.isSharing === false ? 'PAUSED' : `${speedKmh} km/h`}</span>
            <span id="batt-${uid}">🔋 ${batt}%</span>
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
    Object.keys(this.members).forEach((uid) => {
      const live = this.liveLocations[uid];
      const speedEl = document.getElementById(`speed-${uid}`);
      const battEl = document.getElementById(`batt-${uid}`);
      const speedKmh = live?.speedMps ? Math.round(live.speedMps * 3.6) : 0;

      if (speedEl) speedEl.textContent = `🚀 ${live?.isSharing === false ? 'PAUSED' : `${speedKmh} km/h`}`;
      if (battEl) battEl.textContent = `🔋 ${live?.batteryPct ?? 90}%`;
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
    const member = this.members[uid];
    const live = this.liveLocations[uid];
    if (!member) return;

    const card = document.getElementById('travelerFloatingCard');
    card.classList.remove('hidden');

    document.getElementById('cardAvatar').textContent = member.name.charAt(0);
    document.getElementById('cardName').textContent = member.name;
    document.getElementById('cardOrigin').textContent = `From ${member.origin?.displayName || 'Origin'} • ${member.travelMode || 'CAR'}`;

    const speedKmh = live?.speedMps ? Math.round(live.speedMps * 3.6) : 0;
    document.getElementById('cardSpeed').textContent = `${speedKmh} km/h`;
    document.getElementById('cardBattery').textContent = `${live?.batteryPct ?? 90}%`;

    const remainingM = live?.distanceRemainingM || 0;
    document.getElementById('cardDistance').textContent = remainingM > 1000 ? `${(remainingM / 1000).toFixed(1)} km` : `${remainingM} m`;

    const etaMs = live?.etaEpochMs || Date.now();
    const etaDiffMins = Math.max(0, Math.round((etaMs - Date.now()) / 60000));
    document.getElementById('cardEta').textContent = `${Math.floor(etaDiffMins / 60)}h ${etaDiffMins % 60}m`;

    const statusPill = document.getElementById('cardStatusPill');
    statusPill.textContent = (live?.status || 'ON THE WAY').replace(/_/g, ' ');

    document.getElementById('btnCallTraveler').onclick = () => {
      if (member.phone) {
        window.location.href = `tel:${member.phone}`;
      } else {
        alert(`No phone registered for ${member.name}.`);
      }
    };
  }

  updateFloatingCard() {
    if (!this.selectedTravelerUid) return;
    const card = document.getElementById('travelerFloatingCard');
    if (card.classList.contains('hidden')) return;

    const live = this.liveLocations[this.selectedTravelerUid];
    if (live) {
      const speedKmh = live.speedMps ? Math.round(live.speedMps * 3.6) : 0;
      document.getElementById('cardSpeed').textContent = `${speedKmh} km/h`;
      document.getElementById('cardBattery').textContent = `${live.batteryPct ?? 90}%`;
    }
  }

  async sendChatMessage() {
    if (!this.currentJourneyId) {
      alert('Please connect to an active journey first.');
      return;
    }

    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    const chatRef = ref(db, `journeys/${this.currentJourneyId}/chat`);
    const newMsgRef = push(chatRef);
    await set(newMsgRef, {
      id: newMsgRef.key,
      senderUid: 'web_dashboard',
      senderName: 'Web Monitor',
      text,
      timestamp: Date.now(),
      type: 'TEXT',
    });

    input.value = '';
  }

  renderChatMessages() {
    const container = document.getElementById('chatMessagesList');
    if (!container) return;
    container.innerHTML = '';

    if (this.chatMessages.length === 0) {
      container.innerHTML = '<div style="color: #64748b; font-size: 12px; text-align: center; padding: 20px;">No messages yet. Send a message to your convoy!</div>';
      return;
    }

    this.chatMessages.forEach((msg) => {
      const div = document.createElement('div');
      const isMe = msg.senderUid === 'web_dashboard';

      if (msg.type === 'STATUS' || msg.type === 'EMERGENCY') {
        div.className = msg.type === 'EMERGENCY' ? 'chat-msg emergency-msg' : 'chat-msg status-msg';
        div.textContent = `${msg.senderName}: ${msg.text}`;
      } else {
        div.className = `chat-msg ${isMe ? 'me' : 'other'}`;
        div.innerHTML = `<strong>${msg.senderName}</strong><br>${msg.text}<div style="font-size: 9px; opacity: 0.7; text-align: right; margin-top: 2px;">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
      }
      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  }

  bindEvents() {
    // Journey Code Header Click
    document.getElementById('journeyStatusPill').onclick = () => {
      this.promptForJourneyCode();
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
    document.getElementById('btnSendChat').onclick = () => this.sendChatMessage();
    document.getElementById('chatInput').onkeypress = (e) => {
      if (e.key === 'Enter') this.sendChatMessage();
    };

    // Emergency Action Sheet
    document.getElementById('btnEmergencyTrigger').onclick = () => {
      document.getElementById('emergencyModalOverlay').classList.remove('hidden');
    };
    document.getElementById('btnCloseEmergencyModal').onclick = () => {
      document.getElementById('emergencyModalOverlay').classList.add('hidden');
    };
    document.getElementById('btnCall112').onclick = () => {
      window.location.href = 'tel:112';
    };

    // Card Close
    document.getElementById('btnCloseTravelerCard').onclick = () => {
      document.getElementById('travelerFloatingCard').classList.add('hidden');
    };

    // History Modal
    document.getElementById('btnToggleHistory').onclick = async () => {
      document.getElementById('historyModalOverlay').classList.remove('hidden');
      if (this.currentJourneyId) {
        const histSnap = await get(ref(db, `journeys/${this.currentJourneyId}/history`));
        this.populateHistoryTable(histSnap.exists() ? histSnap.val() : {});
      }
    };
    document.getElementById('btnCloseHistoryModal').onclick = () => {
      document.getElementById('historyModalOverlay').classList.add('hidden');
    };
  }

  populateHistoryTable(historyData) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const records = Object.values(historyData);
    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">No completed traveler tracks recorded in history yet.</td></tr>';
      return;
    }

    records.forEach((rec) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${rec.name}</strong></td>
        <td>${rec.travelMode}</td>
        <td>Origin</td>
        <td>${(rec.totalDistanceM / 1000).toFixed(1)} km</td>
        <td>${rec.avgSpeedKmh} km/h</td>
        <td><span style="color: #10b981; font-weight: 700;">Completed 🏁</span></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  new SyncPointProductionApp();
});
