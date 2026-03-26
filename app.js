// ─── DATA & STATE ───────────────────────────────────────────────────────────

const ACTIVITIES = [
  { id: 'yoga',    label: 'Yoga',    icon: '🧘', color: 'var(--yoga)',    met: 3.0 },
  { id: 'running', label: 'Running', icon: '🏃', color: 'var(--running)', met: 9.8 },
  { id: 'workout', label: 'Workout', icon: '💪', color: 'var(--workout)', met: 6.0 },
  { id: 'walking', label: 'Walking', icon: '🚶', color: 'var(--walking)', met: 3.5 },
  { id: 'biking',  label: 'Biking',  icon: '🚴', color: 'var(--biking)',  met: 7.5 },
];

const INTENSITY_METS = { light: 0.7, moderate: 1.0, intense: 1.4 };

let state = {
  workouts: [],
  weight: [],
  goals: [],
  settings: { githubToken: '', gistId: '', weightUnit: 'lbs', name: '' },
};

function loadState() {
  try {
    const saved = localStorage.getItem('fitlog_state');
    if (saved) state = JSON.parse(saved);
  } catch {}
  if (!state.workouts) state.workouts = [];
  if (!state.weight)   state.weight   = [];
  if (!state.goals)    state.goals    = [];
  if (!state.settings) state.settings = { githubToken: '', gistId: '', weightUnit: 'lbs', name: '' };
}

function saveState() {
  localStorage.setItem('fitlog_state', JSON.stringify(state));
  scheduleSyncToGist();
}

// ─── GITHUB GIST SYNC ───────────────────────────────────────────────────────

let syncTimeout = null;
let syncStatus = 'synced'; // 'synced' | 'pending' | 'error'

function scheduleSyncToGist() {
  if (!state.settings.githubToken) return;
  setSyncStatus('pending');
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(syncToGist, 3000);
}

function setSyncStatus(s) {
  syncStatus = s;
  const el = document.getElementById('syncBadge');
  if (!el) return;
  el.className = `sync-badge ${s}`;
  el.innerHTML = `<span class="sync-dot"></span>${s === 'synced' ? 'Synced' : s === 'pending' ? 'Saving…' : 'Sync error'}`;
}

async function syncToGist() {
  const { githubToken, gistId } = state.settings;
  if (!githubToken) return;
  const content = JSON.stringify(state, null, 2);
  try {
    let url = 'https://api.github.com/gists';
    let method = 'POST';
    let body = {
      description: 'FitLog Data Backup',
      public: false,
      files: { 'fitlog-data.json': { content } }
    };
    if (gistId) {
      url = `https://api.github.com/gists/${gistId}`;
      method = 'PATCH';
      body = { files: { 'fitlog-data.json': { content } } };
    }
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const data = await res.json();
    if (!gistId) {
      state.settings.gistId = data.id;
      localStorage.setItem('fitlog_state', JSON.stringify(state));
    }
    setSyncStatus('synced');
  } catch (err) {
    console.error('Gist sync failed', err);
    setSyncStatus('error');
  }
}

async function restoreFromGist() {
  const { githubToken, gistId } = state.settings;
  if (!githubToken || !gistId) { showToast('Enter GitHub token & Gist ID first'); return; }
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 'Authorization': `token ${githubToken}` }
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const content = data.files['fitlog-data.json']?.content;
    if (!content) throw new Error();
    state = JSON.parse(content);
    localStorage.setItem('fitlog_state', JSON.stringify(state));
    renderAll();
    showToast('✓ Restored from GitHub Gist');
  } catch {
    showToast('Restore failed – check token & Gist ID');
  }
}

// ─── CALORIES ───────────────────────────────────────────────────────────────

function calcCalories(activityId, durationMin, intensity = 'moderate') {
  const act = ACTIVITIES.find(a => a.id === activityId);
  if (!act) return 0;
  const weight_kg = getWeightKg();
  const met = act.met * (INTENSITY_METS[intensity] || 1);
  return Math.round(met * weight_kg * (durationMin / 60));
}

function getWeightKg() {
  const latest = state.weight.slice(-1)[0];
  if (!latest) return 70;
  return state.settings.weightUnit === 'kg' ? latest.value : latest.value * 0.453592;
}

// ─── TIMER ──────────────────────────────────────────────────────────────────

let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  document.getElementById('timerStart').textContent = 'Pause';
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById('timerStart').textContent = 'Resume';
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = 0;
  updateTimerDisplay();
  document.getElementById('timerStart').textContent = 'Start';
}

function updateTimerDisplay() {
  const h = Math.floor(timerSeconds / 3600);
  const m = Math.floor((timerSeconds % 3600) / 60);
  const s = timerSeconds % 60;
  document.getElementById('timerDisplay').textContent =
    h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ─── LOG WORKOUT ─────────────────────────────────────────────────────────────

let selectedActivity = null;
let selectedIntensity = 'moderate';
let durMode = 'manual'; // 'manual' | 'timer'

function initLogPage() {
  // Activity buttons
  const grid = document.getElementById('activityGrid');
  grid.innerHTML = '';
  ACTIVITIES.forEach(act => {
    const btn = document.createElement('button');
    btn.className = 'activity-btn' + (selectedActivity === act.id ? ' selected' : '');
    btn.innerHTML = `<span class="icon">${act.icon}</span>${act.label}`;
    btn.onclick = () => selectActivity(act.id);
    grid.appendChild(btn);
  });
}

function selectActivity(id) {
  selectedActivity = id;
  document.querySelectorAll('.activity-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', ACTIVITIES[i].id === id);
  });
}

function selectIntensity(level) {
  selectedIntensity = level;
  document.querySelectorAll('.intensity-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.level === level);
  });
}

function setDurMode(mode) {
  durMode = mode;
  document.querySelectorAll('.dur-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  document.getElementById('manualDur').style.display = mode === 'manual' ? 'block' : 'none';
  document.getElementById('timerSection').style.display = mode === 'timer' ? 'block' : 'none';
}

function logWorkout() {
  if (!selectedActivity) { showToast('Pick an activity first'); return; }

  let durationMin = 0;
  if (durMode === 'manual') {
    durationMin = parseInt(document.getElementById('durationInput').value, 10);
    if (!durationMin || durationMin < 1) { showToast('Enter a valid duration'); return; }
  } else {
    durationMin = Math.round(timerSeconds / 60);
    if (durationMin < 1) { showToast('Timer too short – minimum 1 min'); return; }
  }

  const notes = document.getElementById('notesInput').value.trim();
  const date  = new Date().toISOString();
  const cals  = calcCalories(selectedActivity, durationMin, selectedIntensity);

  state.workouts.unshift({ id: Date.now(), activity: selectedActivity, duration: durationMin, intensity: selectedIntensity, calories: cals, notes, date });
  saveState();
  updateGoals();
  resetTimer();
  document.getElementById('durationInput').value = '';
  document.getElementById('notesInput').value = '';
  selectedActivity = null;
  initLogPage();
  showToast(`✓ Logged ${durationMin} min – ${cals} cal`);
  navigateTo('home');
}

// ─── GOALS ──────────────────────────────────────────────────────────────────

function updateGoals() {
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0,0,0,0);

  const weekWorkouts = state.workouts.filter(w => new Date(w.date) >= weekStart);
  const weekMins = weekWorkouts.reduce((s, w) => s + w.duration, 0);
  const weekSessions = weekWorkouts.length;

  state.goals.forEach(g => {
    if (g.type === 'weekly_minutes') g.current = weekMins;
    if (g.type === 'weekly_sessions') g.current = weekSessions;
  });
  saveState();
}

function addGoal() {
  const type  = document.getElementById('goalType').value;
  const target = parseInt(document.getElementById('goalTarget').value, 10);
  if (!target) { showToast('Enter a target value'); return; }
  state.goals.push({ id: Date.now(), type, target, current: 0, label: type === 'weekly_minutes' ? 'Weekly Minutes' : 'Weekly Sessions' });
  saveState();
  document.getElementById('goalTarget').value = '';
  renderGoals();
  showToast('Goal added!');
}

function deleteGoal(id) {
  state.goals = state.goals.filter(g => g.id !== id);
  saveState();
  renderGoals();
}

// ─── STREAK ──────────────────────────────────────────────────────────────────

function calcStreak() {
  if (!state.workouts.length) return 0;
  const days = [...new Set(state.workouts.map(w => w.date.slice(0, 10)))].sort().reverse();
  let streak = 0;
  let check = new Date(); check.setHours(0,0,0,0);
  for (const d of days) {
    const date = new Date(d);
    const diff = Math.round((check - date) / 86400000);
    if (diff === 0 || diff === 1) { streak++; check = date; }
    else break;
  }
  return streak;
}

// ─── CHARTS ─────────────────────────────────────────────────────────────────

let chartPeriod = 'week';

function renderCharts() {
  renderBarChart();
  renderActivityBreakdown();
}

function getChartData() {
  const now = new Date();
  if (chartPeriod === 'week') {
    const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const vals = Array(7).fill(0);
    state.workouts.forEach(w => {
      const d = new Date(w.date);
      const diff = Math.floor((now - d) / 86400000);
      if (diff < 7) vals[d.getDay()] += w.duration;
    });
    return { labels, vals };
  } else {
    const labels = []; const vals = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      if (i % 5 === 0 || i === 0) labels.push(`${d.getMonth()+1}/${d.getDate()}`);
      else labels.push('');
      const key = d.toISOString().slice(0, 10);
      vals.push(state.workouts.filter(w => w.date.slice(0,10) === key).reduce((s,w) => s+w.duration, 0));
    }
    return { labels, vals };
  }
}

function renderBarChart() {
  const { labels, vals } = getChartData();
  const max = Math.max(...vals, 1);
  const wrap = document.getElementById('barChart');
  if (!wrap) return;
  wrap.innerHTML = '';
  labels.forEach((label, i) => {
    const col = document.createElement('div');
    col.className = 'bar-col';
    const pct = (vals[i] / max) * 100;
    col.innerHTML = `<div class="bar" style="height:${pct}%;"></div><div class="bar-label">${label}</div>`;
    wrap.appendChild(col);
  });
  const totalEl = document.getElementById('chartTotal');
  if (totalEl) totalEl.textContent = vals.reduce((a,b)=>a+b,0) + ' min ' + (chartPeriod==='week'?'this week':'last 30 days');
}

function renderActivityBreakdown() {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - (chartPeriod === 'week' ? 7 : 30));
  const filtered = state.workouts.filter(w => new Date(w.date) >= cutoff);
  const totals = {};
  filtered.forEach(w => { totals[w.activity] = (totals[w.activity] || 0) + w.duration; });
  const total = Object.values(totals).reduce((a,b)=>a+b,1);
  const wrap = document.getElementById('activityBreakdown');
  if (!wrap) return;
  wrap.innerHTML = '';
  ACTIVITIES.forEach(act => {
    const mins = totals[act.id] || 0;
    if (!mins) return;
    const pct = Math.round(mins / total * 100);
    const row = document.createElement('div');
    row.className = 'ab-row';
    row.innerHTML = `
      <div class="ab-name">${act.icon} ${act.label}</div>
      <div class="ab-bar-wrap"><div class="ab-bar" style="width:${pct}%;background:${act.color};"></div></div>
      <div class="ab-val">${mins}m</div>`;
    wrap.appendChild(row);
  });
  if (!Object.keys(totals).length) wrap.innerHTML = '<div class="empty-state"><p>No workouts yet</p></div>';
}

// ─── RENDER ──────────────────────────────────────────────────────────────────

function renderHome() {
  // Streak
  document.getElementById('streakVal').textContent = calcStreak();

  // Week stats
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
  const weekW = state.workouts.filter(w => new Date(w.date) >= weekStart);
  const weekMins = weekW.reduce((s,w) => s+w.duration, 0);
  const weekCals = weekW.reduce((s,w) => s+w.calories, 0);
  document.getElementById('weekMins').textContent = weekMins;
  document.getElementById('weekCals').textContent = weekCals;
  document.getElementById('weekSessions').textContent = weekW.length;

  // Recent workouts
  const list = document.getElementById('recentList');
  list.innerHTML = '';
  if (!state.workouts.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">🏋️</div><p>No workouts yet.<br>Tap Log to get started!</p></div>';
    return;
  }
  state.workouts.slice(0, 8).forEach(w => {
    const act = ACTIVITIES.find(a => a.id === w.activity);
    if (!act) return;
    const dateStr = new Date(w.date).toLocaleDateString('en-CA', { weekday:'short', month:'short', day:'numeric' });
    const item = document.createElement('div');
    item.className = 'workout-item';
    item.innerHTML = `
      <div class="activity-dot" style="background:${act.color}"></div>
      <div class="workout-info">
        <div class="workout-type">${act.icon} ${act.label}</div>
        <div class="workout-meta">${dateStr} · ${w.intensity}</div>
      </div>
      <div style="text-align:right">
        <div class="workout-dur">${w.duration}m</div>
        <div class="workout-cal">${w.calories} cal</div>
      </div>`;
    list.appendChild(item);
  });
}

function renderGoals() {
  updateGoals();
  const wrap = document.getElementById('goalsList');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!state.goals.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="icon">🎯</div><p>No goals yet. Add one below!</p></div>';
    return;
  }
  state.goals.forEach(g => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    const done = g.current >= g.target;
    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div class="goal-header">
        <div class="goal-name">${done ? '✅ ' : ''}${g.label}</div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="goal-progress-text">${g.current} / ${g.target}</div>
          <button class="btn btn-sm" style="background:none;color:var(--text2);padding:4px 8px;font-size:18px;" onclick="deleteGoal(${g.id})">×</button>
        </div>
      </div>
      <div class="goal-bar-wrap"><div class="goal-bar ${done?'done':''}" style="width:${pct}%"></div></div>`;
    wrap.appendChild(card);
  });
}

function renderWeight() {
  const latest = state.weight.slice(-1)[0];
  const unit = state.settings.weightUnit || 'lbs';
  document.getElementById('weightDisplay').innerHTML = latest
    ? `${latest.value} <span class="weight-unit">${unit}</span>`
    : `— <span class="weight-unit">${unit}</span>`;

  // Mini history
  const hist = document.getElementById('weightHistory');
  hist.innerHTML = '';
  [...state.weight].reverse().slice(0, 10).forEach(entry => {
    const dateStr = new Date(entry.date).toLocaleDateString('en-CA', { month:'short', day:'numeric' });
    const row = document.createElement('div');
    row.className = 'workout-item';
    row.innerHTML = `
      <div class="workout-info"><div class="workout-type">${dateStr}</div></div>
      <div class="workout-dur">${entry.value} ${unit}</div>
      <button class="btn btn-sm" style="background:none;color:var(--text2);padding:4px;" onclick="deleteWeight(${entry.id})">×</button>`;
    hist.appendChild(row);
  });
  if (!state.weight.length) hist.innerHTML = '<div class="empty-state"><div class="icon">⚖️</div><p>No weight entries yet</p></div>';
}

function logWeight() {
  const val = parseFloat(document.getElementById('weightInput').value);
  if (!val) { showToast('Enter a valid weight'); return; }
  state.weight.push({ id: Date.now(), value: val, date: new Date().toISOString() });
  saveState();
  document.getElementById('weightInput').value = '';
  renderWeight();
  showToast('✓ Weight logged');
}

function deleteWeight(id) {
  state.weight = state.weight.filter(w => w.id !== id);
  saveState();
  renderWeight();
}

function renderSettings() {
  document.getElementById('settingName').value    = state.settings.name || '';
  document.getElementById('settingToken').value   = state.settings.githubToken || '';
  document.getElementById('settingGistId').value  = state.settings.gistId || '';
  document.getElementById('settingWtUnit').value  = state.settings.weightUnit || 'lbs';
  const token = state.settings.githubToken;
  const badge = document.getElementById('syncBadge');
  if (badge) badge.style.display = token ? 'inline-flex' : 'none';
}

function saveSettings() {
  state.settings.name         = document.getElementById('settingName').value.trim();
  state.settings.githubToken  = document.getElementById('settingToken').value.trim();
  state.settings.gistId       = document.getElementById('settingGistId').value.trim();
  state.settings.weightUnit   = document.getElementById('settingWtUnit').value;
  saveState();
  renderSettings();
  showToast('Settings saved');
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `fitlog-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

function renderAll() {
  renderHome();
  renderGoals();
  renderWeight();
  renderSettings();
  renderCharts();
}

// ─── NAV ─────────────────────────────────────────────────────────────────────

function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + pageId)?.classList.add('active');
  document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
  if (pageId === 'home') renderHome();
  if (pageId === 'log')  initLogPage();
  if (pageId === 'charts') renderCharts();
  if (pageId === 'goals') renderGoals();
  if (pageId === 'settings') renderSettings();
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── INIT ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderAll();
  navigateTo('home');

  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }
});
