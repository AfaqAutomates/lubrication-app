const sb = window.supabase.createClient(
  window.LMS_CONFIG.SUPABASE_URL,
  window.LMS_CONFIG.SUPABASE_ANON_KEY
);

let session = null;
let me = { id: null, name: '', email: '', isAdmin: false };
let cache = {
  equipment: [],
  schedules: [],
  activities: [],
  oilFlags: [],
};
let currentPage = 'dashboard';
let modalSaveCallback = null;

function el(tag = 'div', className = '', html = '') {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html) e.innerHTML = html;
  return e;
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString();
}

window.openModal = function(title, content, onSave) {
  document.getElementById('modalTitle').textContent = title;
  const body = document.getElementById('modalBody');
  body.innerHTML = '';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else {
    body.appendChild(content);
  }
  modalSaveCallback = onSave;
  const saveBtn = document.getElementById('modalBtnSave');
  saveBtn.style.display = onSave ? '' : 'none';
  document.getElementById('modalOverlay').style.display = 'flex';
};

window.closeModal = function() {
  document.getElementById('modalOverlay').style.display = 'none';
  modalSaveCallback = null;
};

window.saveModal = async function() {
  if (modalSaveCallback) {
    const result = await modalSaveCallback();
    if (result !== false) {
      window.closeModal();
    }
  }
};

async function route() {
  const { data: { session: s } } = await sb.auth.getSession();
  session = s;

  if (!session) {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appScreen').style.display = 'none';
    return;
  }

  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = '';

  me.id = session.user.id;
  me.email = session.user.email;

  const { data: prof } = await sb
    .from('profiles')
    .select('full_name, is_admin')
    .eq('id', me.id)
    .maybeSingle();

  me.name = (prof && prof.full_name) ? prof.full_name : me.email.split('@')[0];
  me.isAdmin = !!(prof && prof.is_admin);

  document.getElementById('userName').textContent = me.name;
  document.getElementById('userAvatar').textContent = me.name.charAt(0).toUpperCase();
  document.getElementById('userRole').textContent = me.isAdmin ? 'ADMIN' : 'VIEWER';

  buildSidebar();
  await loadAll();
  render();
}

async function loadAll() {
  const [eq, sch, act, flags] = await Promise.all([
    sb.from('equipment').select('*').order('created_at', { ascending: false }),
    sb.from('schedules').select('*').order('due_date'),
    sb.from('activities').select('*').order('activity_date', { ascending: false }),
    sb.from('oil_flags').select('*').order('flag_date', { ascending: false }),
  ]);

  cache.equipment = eq.data || [];
  cache.schedules = sch.data || [];
  cache.activities = act.data || [];
  cache.oilFlags = flags.data || [];
}

function buildSidebar() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';

  const pages = me.isAdmin
    ? ['dashboard', 'equipment', 'schedule', 'log-service', 'oil-analysis', 'reports', 'admin']
    : ['dashboard', 'equipment', 'schedule', 'log-service', 'oil-analysis', 'reports'];

  const labels = {
    dashboard: 'Dashboard',
    equipment: 'Equipment',
    schedule: 'Schedule',
    'log-service': 'Log service',
    'oil-analysis': 'Oil analysis',
    reports: 'Reports',
    admin: 'Admin'
  };

  pages.forEach(page => {
    const item = el('div', 'nav-item', labels[page]);
    item.onclick = () => {
      currentPage = page;
      render();
    };
    nav.appendChild(item);
  });
}

function render() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = me.isAdmin
    ? ['dashboard', 'equipment', 'schedule', 'log-service', 'oil-analysis', 'reports', 'admin']
    : ['dashboard', 'equipment', 'schedule', 'log-service', 'oil-analysis', 'reports'];

  navItems.forEach(item => item.classList.remove('active'));
  const idx = pages.indexOf(currentPage);
  if (idx >= 0) navItems[idx].classList.add('active');

  const content = document.getElementById('pageContent');
  content.innerHTML = '';

  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  const topbarExtra = document.getElementById('topbarExtra');
  topbarExtra.innerHTML = '';

  switch (currentPage) {
    case 'dashboard':
      pageTitle.textContent = 'Dashboard';
      pageSubtitle.textContent = 'Overview of your operations.';
      content.appendChild(renderDashboard());
      break;
    case 'equipment':
      pageTitle.textContent = 'Equipment';
      pageSubtitle.textContent = 'Manage equipment and machines.';
      if (me.isAdmin) {
        const btn = el('button', 'btn-primary', '+ Add equipment');
        btn.onclick = openEquipmentModal;
        topbarExtra.appendChild(btn);
      }
      content.appendChild(renderEquipment());
      break;
    case 'schedule':
      pageTitle.textContent = 'Schedule';
      pageSubtitle.textContent = 'Lubrication schedules and due dates.';
      content.appendChild(renderSchedule());
      break;
    case 'log-service':
      pageTitle.textContent = 'Log service';
      pageSubtitle.textContent = 'Record lubrication services.';
      const logBtn = el('button', 'btn-primary', '+ Log service');
      logBtn.onclick = openActivityModal;
      topbarExtra.appendChild(logBtn);
      content.appendChild(renderLogService());
      break;
    case 'oil-analysis':
      pageTitle.textContent = 'Oil analysis';
      pageSubtitle.textContent = 'Oil analysis results and flags.';
      content.appendChild(renderOilAnalysis());
      break;
    case 'reports':
      pageTitle.textContent = 'Reports';
      pageSubtitle.textContent = 'Service records summary.';
      content.appendChild(renderReports());
      break;
    case 'admin':
      pageTitle.textContent = 'Admin';
      pageSubtitle.textContent = 'User management and settings.';
      content.appendChild(renderAdmin());
      break;
  }
}

function renderDashboard() {
  const container = el('div');

  const kpiGrid = el('div', 'kpi-grid');
  const overdue = cache.schedules.filter(s => new Date(s.due_date) < new Date()).length;
  const dueSoon = cache.schedules.filter(s => {
    const due = new Date(s.due_date);
    const now = new Date();
    const days = (due - now) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 7;
  }).length;

  [
    { label: 'Overdue', value: overdue, desc: 'Past due date' },
    { label: 'Due soon', value: dueSoon, desc: 'Within 7 days' },
    { label: 'Oil flags', value: cache.oilFlags.length, desc: 'Flagged samples' },
    { label: 'Serviced', value: cache.activities.length, desc: 'Service records' }
  ].forEach(kpi => {
    const card = el('div', 'kpi-card');
    card.innerHTML = `<div class="kpi-label">${kpi.label}</div><div class="kpi-value">${kpi.value}</div><div class="kpi-description">${kpi.desc}</div>`;
    kpiGrid.appendChild(card);
  });

  container.appendChild(kpiGrid);

  const needsCard = el('div', 'card');
  needsCard.appendChild(el('div', 'card-title', 'Needs attention'));

  if (overdue === 0 && dueSoon === 0) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = '<div class="empty-state-title">Nothing due</div>';
    needsCard.appendChild(empty);
  } else {
    const wrapper = el('div', 'table-wrapper');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Equipment</th><th>Component</th><th>Lubricant</th><th>Status</th><th>Due</th></tr></thead>';
    const tbody = el('tbody');
    cache.schedules.filter(s => {
      const due = new Date(s.due_date);
      return due < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }).slice(0, 5).forEach(s => {
      const row = el('tr');
      const status = new Date(s.due_date) < new Date() 
        ? '<span class="badge badge-error">OVERDUE</span>' 
        : '<span class="badge badge-warning">SOON</span>';
      row.innerHTML = `<td>${s.equipment || '—'}</td><td>${s.component || '—'}</td><td>${s.lubricant || '—'}</td><td>${status}</td><td>${formatDate(s.due_date)}</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    needsCard.appendChild(wrapper);
  }

  container.appendChild(needsCard);

  const actCard = el('div', 'card');
  actCard.appendChild(el('div', 'card-title', 'Recent activity'));

  if (cache.activities.length === 0) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = '<div class="empty-state-title">No records yet</div>';
    actCard.appendChild(empty);
  } else {
    const wrapper = el('div', 'table-wrapper');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Date</th><th>Equipment</th><th>Component</th><th>Qty</th><th>Technician</th></tr></thead>';
    const tbody = el('tbody');
    cache.activities.slice(0, 5).forEach(a => {
      const row = el('tr');
      row.innerHTML = `<td>${formatDate(a.activity_date)}</td><td>${a.equipment || '—'}</td><td>${a.component || '—'}</td><td>${a.qty || '—'}</td><td>${a.technician || '—'}</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    actCard.appendChild(wrapper);
  }

  container.appendChild(actCard);
  return container;
}

function renderEquipment() {
  const container = el('div');
  const card = el('div', 'card');
  card.appendChild(el('div', 'card-title', 'Equipment'));

  if (cache.equipment.length === 0) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = '<div class="empty-state-title">No equipment</div>';
    card.appendChild(empty);
  } else {
    const wrapper = el('div', 'table-wrapper');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Created</th></tr></thead>';
    const tbody = el('tbody');
    cache.equipment.forEach(eq => {
      const row = el('tr');
      const status = eq.status === 'active' ? '<span class="badge badge-success">ACTIVE</span>' : '<span class="badge badge-info">INACTIVE</span>';
      row.innerHTML = `<td><strong>${eq.name}</strong></td><td>${eq.type || '—'}</td><td>${status}</td><td>${formatDate(eq.created_at)}</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    card.appendChild(wrapper);
  }

  container.appendChild(card);
  return container;
}

function renderSchedule() {
  const container = el('div');
  const card = el('div', 'card');
  card.appendChild(el('div', 'card-title', 'Lubrication Schedule'));

  if (cache.schedules.length === 0) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = '<div class="empty-state-title">No schedules</div>';
    card.appendChild(empty);
  } else {
    const wrapper = el('div', 'table-wrapper');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Equipment</th><th>Component</th><th>Lubricant</th><th>Frequency</th><th>Due Date</th><th>Status</th></tr></thead>';
    const tbody = el('tbody');
    cache.schedules.forEach(s => {
      const now = new Date();
      const due = new Date(s.due_date);
      let statusBadge = '<span class="badge badge-success">OK</span>';
      if (due < now) statusBadge = '<span class="badge badge-error">OVERDUE</span>';
      else if (due - now < 7 * 24 * 60 * 60 * 1000) statusBadge = '<span class="badge badge-warning">SOON</span>';

      const row = el('tr');
      row.innerHTML = `<td>${s.equipment || '—'}</td><td>${s.component || '—'}</td><td>${s.lubricant || '—'}</td><td>${s.frequency || '—'}</td><td>${formatDate(s.due_date)}</td><td>${statusBadge}</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    card.appendChild(wrapper);
  }

  container.appendChild(card);
  return container;
}

function renderLogService() {
  const container = el('div');
  const card = el('div', 'card');
  card.appendChild(el('div', 'card-title', 'Service Log'));

  if (cache.activities.length === 0) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = '<div class="empty-state-title">No records</div>';
    card.appendChild(empty);
  } else {
    const wrapper = el('div', 'table-wrapper');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Date</th><th>Equipment</th><th>Component</th><th>Qty</th><th>Technician</th><th>Notes</th></tr></thead>';
    const tbody = el('tbody');
    cache.activities.forEach(a => {
      const row = el('tr');
      row.innerHTML = `<td>${formatDate(a.activity_date)}</td><td>${a.equipment || '—'}</td><td>${a.component || '—'}</td><td>${a.qty || '—'}</td><td>${a.technician || '—'}</td><td>${a.notes || '—'}</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    card.appendChild(wrapper);
  }

  container.appendChild(card);
  return container;
}

function renderOilAnalysis() {
  const container = el('div');
  const card = el('div', 'card');
  card.appendChild(el('div', 'card-title', 'Oil Analysis Flags'));

  if (cache.oilFlags.length === 0) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = '<div class="empty-state-title">No flags</div>';
    card.appendChild(empty);
  } else {
    const wrapper = el('div', 'table-wrapper');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Date</th><th>Equipment</th><th>Component</th><th>Flag</th><th>Notes</th></tr></thead>';
    const tbody = el('tbody');
    cache.oilFlags.forEach(f => {
      const row = el('tr');
      row.innerHTML = `<td>${formatDate(f.flag_date)}</td><td>${f.equipment || '—'}</td><td>${f.component || '—'}</td><td><span class="badge badge-error">${f.flag_type}</span></td><td>${f.notes || '—'}</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    card.appendChild(wrapper);
  }

  container.appendChild(card);
  return container;
}

function renderReports() {
  const container = el('div');
  const card = el('div', 'card');
  card.appendChild(el('div', 'card-title', 'Reports'));

  const kpiGrid = el('div', 'kpi-grid');
  kpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Service records</div>
      <div class="kpi-value">${cache.activities.length}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Equipment</div>
      <div class="kpi-value">${cache.equipment.length}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Oil samples</div>
      <div class="kpi-value">${cache.oilFlags.length}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Compliance</div>
      <div class="kpi-value">${Math.round((cache.schedules.filter(s => new Date(s.due_date) >= new Date()).length / Math.max(cache.schedules.length, 1)) * 100)}%</div>
    </div>
  `;
  card.appendChild(kpiGrid);

  container.appendChild(card);
  return container;
}

function renderAdmin() {
  const container = el('div');
  const card = el('div', 'card');
  card.appendChild(el('div', 'card-title', 'Admin'));

  const html = `
    <div class="form-group">
      <label>Create User</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <input type="email" class="input" id="newUserEmail" placeholder="Email">
        <input type="password" class="input" id="newUserPass" placeholder="Password (min 8)">
      </div>
      <button class="btn-primary mt-20" onclick="window.createNewUser()">Create user</button>
    </div>
  `;

  card.appendChild(el('div', null, html));
  container.appendChild(card);
  return container;
}

async function openEquipmentModal() {
  const form = el('div');
  form.innerHTML = `
    <div class="form-group">
      <label>Equipment Name *</label>
      <input type="text" class="input" id="eqName" placeholder="e.g., Pump A1" autofocus>
    </div>
    <div class="form-group">
      <label>Type</label>
      <input type="text" class="input" id="eqType" placeholder="e.g., Centrifugal Pump">
    </div>
    <div class="form-group">
      <label>Status</label>
      <select class="input" id="eqStatus">
        <option>active</option>
        <option>inactive</option>
      </select>
    </div>
  `;

  window.openModal('Add Equipment', form, async () => {
    const name = document.getElementById('eqName').value.trim();
    if (!name) {
      alert('Name required');
      return false;
    }

    const { error } = await sb.from('equipment').insert({
      name,
      type: document.getElementById('eqType').value.trim(),
      status: document.getElementById('eqStatus').value,
      created_at: new Date().toISOString(),
      created_by: me.id
    });

    if (error) {
      alert('Error: ' + error.message);
      return false;
    }

    await loadAll();
    render();
    return true;
  });
}

async function openActivityModal() {
  const form = el('div');
  form.innerHTML = `
    <div class="form-group">
      <label>Date *</label>
      <input type="date" class="input" id="actDate" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <div class="form-group">
      <label>Equipment</label>
      <input type="text" class="input" id="actEquipment">
    </div>
    <div class="form-group">
      <label>Component</label>
      <input type="text" class="input" id="actComponent">
    </div>
    <div class="form-group">
      <label>Quantity (L/ml)</label>
      <input type="number" class="input" id="actQty">
    </div>
    <div class="form-group">
      <label>Technician</label>
      <input type="text" class="input" id="actTech">
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea class="input" id="actNotes"></textarea>
    </div>
  `;

  window.openModal('Log Service', form, async () => {
    const date = document.getElementById('actDate').value;
    if (!date) {
      alert('Date required');
      return false;
    }

    const { error } = await sb.from('activities').insert({
      activity_date: date,
      equipment: document.getElementById('actEquipment').value.trim(),
      component: document.getElementById('actComponent').value.trim(),
      qty: parseFloat(document.getElementById('actQty').value) || 0,
      technician: document.getElementById('actTech').value.trim(),
      notes: document.getElementById('actNotes').value.trim(),
      created_at: new Date().toISOString(),
      created_by: me.id
    });

    if (error) {
      alert('Error: ' + error.message);
      return false;
    }

    await loadAll();
    render();
    return true;
  });
}

window.createNewUser = async function() {
  const email = document.getElementById('newUserEmail').value.trim();
  const password = document.getElementById('newUserPass').value;

  if (!email || !password) {
    alert('Email and password required');
    return;
  }

  try {
    const { error } = await sb.auth.signUp({
      email,
      password
    });

    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('User created! They can now sign up or login.');
      document.getElementById('newUserEmail').value = '';
      document.getElementById('newUserPass').value = '';
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
};

// AUTH UI HANDLERS
document.addEventListener('DOMContentLoaded', async () => {
  // Login
  document.getElementById('btnSignIn').onclick = async () => {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;

    if (!email || !password) {
      document.getElementById('authError').textContent = 'Email and password required';
      document.getElementById('authError').style.display = '';
      return;
    }

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      document.getElementById('authError').textContent = error.message;
      document.getElementById('authError').style.display = '';
    }
  };

  // Sign up
  document.getElementById('btnShowSignup').onclick = () => {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = '';
  };

  document.getElementById('btnShowLogin').onclick = () => {
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('loginForm').style.display = '';
    document.getElementById('authError').style.display = 'none';
  };

  document.getElementById('btnSignUp').onclick = async () => {
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const name = document.getElementById('signupName').value.trim();

    if (!email || !password || !name) {
      document.getElementById('authError').textContent = 'All fields required';
      document.getElementById('authError').style.display = '';
      return;
    }

    if (password.length < 8) {
      document.getElementById('authError').textContent = 'Password must be at least 8 characters';
      document.getElementById('authError').style.display = '';
      return;
    }

    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    });

    if (error) {
      document.getElementById('authError').textContent = error.message;
      document.getElementById('authError').style.display = '';
    } else {
      document.getElementById('authError').textContent = 'Account created! Logging in...';
      document.getElementById('authError').style.display = '';
      setTimeout(async () => {
        const { error: signInError } = await sb.auth.signInWithPassword({ email, password });
        if (signInError) {
          document.getElementById('authError').textContent = 'Account created but auto-login failed. Try signing in manually.';
        }
      }, 500);
    }
  };

  // App buttons
  document.getElementById('btnChangePw').onclick = () => {
    const newPass = prompt('New password (min 8 characters):');
    if (newPass && newPass.length >= 8) {
      sb.auth.updateUser({ password: newPass }).then(({ error }) => {
        if (error) alert('Error: ' + error.message);
        else alert('Password changed!');
      });
    }
  };

  document.getElementById('btnSignOut').onclick = async () => {
    await sb.auth.signOut();
  };

  // Auth state listener
  sb.auth.onAuthStateChange((_event, session) => {
    route();
  });

  // Initial route
  await route();
});
