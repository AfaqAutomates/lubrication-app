const sb = window.supabase.createClient(
  window.LMS_CONFIG.SUPABASE_URL,
  window.LMS_CONFIG.SUPABASE_ANON_KEY
);

let session = null;
let me = { id: null, name: '', email: '', isAdmin: false, featureToggles: {} };
let cache = {
  equipment: [],
  components: [],
  lubricationPoints: [],
  lubricants: [],
  activities: [],
  oilFlags: [],
  resources: [],
  componentTypeSuggestions: [],
  lubricationPointSuggestions: [],
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

// Typeahead autocomplete
function createTypeahead(inputId, suggestions, onSelect) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const listId = inputId + '-list';
  const list = el('div', 'typeahead-list', '');
  list.id = listId;
  list.style.display = 'none';
  input.parentNode.appendChild(list);

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase();
    if (val.length < 1) {
      list.style.display = 'none';
      return;
    }

    const filtered = suggestions.filter(s => s.toLowerCase().includes(val)).slice(0, 5);
    if (filtered.length === 0) {
      list.style.display = 'none';
      return;
    }

    list.innerHTML = filtered.map(s => `<div class="typeahead-item">${s}</div>`).join('');
    list.style.display = 'block';

    document.querySelectorAll('.typeahead-item').forEach(item => {
      item.onclick = () => {
        input.value = item.textContent;
        list.style.display = 'none';
        if (onSelect) onSelect(item.textContent);
      };
    });
  });

  document.addEventListener('click', (e) => {
    if (e.target !== input) list.style.display = 'none';
  });
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
    .select('*')
    .eq('id', me.id)
    .maybeSingle();

  me.name = (prof && prof.full_name) ? prof.full_name : me.email.split('@')[0];
  me.isAdmin = !!(prof && prof.is_admin);
  me.featureToggles = {
    assetsEdit: !!(prof && prof.assets_edit),
    pointsEdit: !!(prof && prof.points_edit),
    workordersRecord: !!(prof && prof.workorders_record),
    workordersEdit: !!(prof && prof.workorders_edit),
    inventoryEdit: !!(prof && prof.inventory_edit),
  };

  document.getElementById('userName').textContent = me.name;
  document.getElementById('userAvatar').textContent = me.name.charAt(0).toUpperCase();
  const roleText = me.isAdmin ? 'ADMIN' : (me.featureToggles.assetsEdit ? 'ENGINEER' : 'TECHNICIAN');
  document.getElementById('userRole').textContent = roleText;

  buildSidebar();
  await loadAll();
  render();
}

async function loadAll() {
  const [eq, comp, lp, lub, act, flags, res, ctypes, lpnames] = await Promise.all([
    sb.from('equipment').select('*').order('created_at', { ascending: false }),
    sb.from('components').select('*').order('created_at', { ascending: false }),
    sb.from('lubrication_points').select('*').order('created_at', { ascending: false }),
    sb.from('lubricants').select('*').order('name'),
    sb.from('activities').select('*').order('activity_date', { ascending: false }),
    sb.from('oil_flags').select('*').order('flag_date', { ascending: false }),
    sb.from('resources').select('*').order('resource_name'),
    sb.from('component_type_suggestions').select('component_type'),
    sb.from('lubrication_point_suggestions').select('point_name'),
  ]);

  cache.equipment = eq.data || [];
  cache.components = comp.data || [];
  cache.lubricationPoints = lp.data || [];
  cache.lubricants = lub.data || [];
  cache.activities = act.data || [];
  cache.oilFlags = flags.data || [];
  cache.resources = res.data || [];
  cache.componentTypeSuggestions = (ctypes.data || []).map(c => c.component_type);
  cache.lubricationPointSuggestions = (lpnames.data || []).map(p => p.point_name);
}

function buildSidebar() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';

  const pages = me.isAdmin
    ? ['dashboard', 'equipment', 'components', 'lubrication-points', 'running-hours', 'activities', 'oil-analysis', 'reports', 'admin']
    : ['dashboard', 'equipment', 'components', 'lubrication-points', 'running-hours', 'activities', 'oil-analysis', 'reports'];

  const labels = {
    dashboard: 'Dashboard',
    equipment: 'Equipment',
    components: 'Components',
    'lubrication-points': 'Lubrication Points',
    'running-hours': 'Running Hours',
    activities: 'Work Orders',
    'oil-analysis': 'Oil Analysis',
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
    ? ['dashboard', 'equipment', 'components', 'lubrication-points', 'running-hours', 'activities', 'oil-analysis', 'reports', 'admin']
    : ['dashboard', 'equipment', 'components', 'lubrication-points', 'running-hours', 'activities', 'oil-analysis', 'reports'];

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
      pageSubtitle.textContent = 'Overview of your lubrication operations.';
      content.appendChild(renderDashboard());
      break;
    case 'equipment':
      pageTitle.textContent = 'Equipment';
      pageSubtitle.textContent = 'Manage equipment across all plants.';
      if (me.isAdmin || me.featureToggles.assetsEdit) {
        const btn = el('button', 'btn-primary', '+ Add equipment');
        btn.onclick = openEquipmentModal;
        topbarExtra.appendChild(btn);
      }
      content.appendChild(renderEquipment());
      break;
    case 'components':
      pageTitle.textContent = 'Components';
      pageSubtitle.textContent = 'Manage equipment components.';
      if (me.isAdmin || me.featureToggles.assetsEdit) {
        const btn = el('button', 'btn-primary', '+ Add component');
        btn.onclick = openComponentModal;
        topbarExtra.appendChild(btn);
      }
      content.appendChild(renderComponents());
      break;
    case 'lubrication-points':
      pageTitle.textContent = 'Lubrication Points';
      pageSubtitle.textContent = 'Define lubrication requirements.';
      if (me.isAdmin || me.featureToggles.pointsEdit) {
        const btn = el('button', 'btn-primary', '+ Add point');
        btn.onclick = openLubricationPointModal;
        topbarExtra.appendChild(btn);
      }
      content.appendChild(renderLubricationPoints());
      break;
    case 'running-hours':
      pageTitle.textContent = 'Running Hours';
      pageSubtitle.textContent = 'Track and update resource running hours.';
      content.appendChild(renderRunningHours());
      break;
    case 'activities':
      pageTitle.textContent = 'Work Orders';
      pageSubtitle.textContent = 'Record lubrication activities.';
      if (me.featureToggles.workordersRecord || me.isAdmin) {
        const btn = el('button', 'btn-primary', '+ Log activity');
        btn.onclick = openActivityModal;
        topbarExtra.appendChild(btn);
      }
      content.appendChild(renderActivities());
      break;
    case 'oil-analysis':
      pageTitle.textContent = 'Oil Analysis';
      pageSubtitle.textContent = 'Oil analysis results and flags.';
      content.appendChild(renderOilAnalysis());
      break;
    case 'reports':
      pageTitle.textContent = 'Reports';
      pageSubtitle.textContent = 'Summary reports and analytics.';
      content.appendChild(renderReports());
      break;
    case 'admin':
      pageTitle.textContent = 'Admin';
      pageSubtitle.textContent = 'User management and access control.';
      content.appendChild(renderAdmin());
      break;
  }
}

function renderDashboard() {
  const container = el('div');

  const kpiGrid = el('div', 'kpi-grid');
  const totalPoints = cache.lubricationPoints.length;
  const overdue = cache.activities.filter(a => {
    const lp = cache.lubricationPoints.find(l => l.id === a.lubrication_point_id);
    if (!lp || !lp.calendar_interval_months) return false;
    const dueDate = new Date(a.activity_date);
    dueDate.setMonth(dueDate.getMonth() + lp.calendar_interval_months);
    return dueDate < new Date();
  }).length;

  [
    { label: 'Lubrication Points', value: totalPoints, desc: 'Total points tracked' },
    { label: 'Overdue', value: overdue, desc: 'Service overdue' },
    { label: 'Recent Activities', value: cache.activities.length, desc: 'Last 30 days' },
    { label: 'Oil Flags', value: cache.oilFlags.length, desc: 'Critical samples' }
  ].forEach(kpi => {
    const card = el('div', 'kpi-card');
    card.innerHTML = `<div class="kpi-label">${kpi.label}</div><div class="kpi-value">${kpi.value}</div><div class="kpi-description">${kpi.desc}</div>`;
    kpiGrid.appendChild(card);
  });

  container.appendChild(kpiGrid);

  const recentCard = el('div', 'card');
  recentCard.appendChild(el('div', 'card-title', 'Recent Activities'));

  if (cache.activities.length === 0) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = '<div class="empty-state-title">No activities</div>';
    recentCard.appendChild(empty);
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
    recentCard.appendChild(wrapper);
  }

  container.appendChild(recentCard);
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
    table.innerHTML = '<thead><tr><th>Name</th><th>SAP Number</th><th>Type</th><th>Status</th><th>Criticality</th></tr></thead>';
    const tbody = el('tbody');
    cache.equipment.forEach(eq => {
      const row = el('tr');
      const status = eq.status === 'active' ? '<span class="badge badge-success">ACTIVE</span>' : '<span class="badge badge-info">INACTIVE</span>';
      row.innerHTML = `<td><strong>${eq.name}</strong></td><td>${eq.sap_equipment_number || '—'}</td><td>${eq.type || '—'}</td><td>${status}</td><td>${eq.lubrication_criticality || '—'}</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    card.appendChild(wrapper);
  }

  container.appendChild(card);
  return container;
}

function renderComponents() {
  const container = el('div');
  const card = el('div', 'card');
  card.appendChild(el('div', 'card-title', 'Components'));

  if (cache.components.length === 0) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = '<div class="empty-state-title">No components</div>';
    card.appendChild(empty);
  } else {
    const wrapper = el('div', 'table-wrapper');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Name</th><th>Equipment</th><th>Type</th><th>Criticality</th><th>Status</th></tr></thead>';
    const tbody = el('tbody');
    cache.components.forEach(comp => {
      const eq = cache.equipment.find(e => e.id === comp.equipment_id);
      const row = el('tr');
      const status = comp.status === 'active' ? '<span class="badge badge-success">ACTIVE</span>' : '<span class="badge badge-info">INACTIVE</span>';
      row.innerHTML = `<td>${comp.name}</td><td>${eq ? eq.name : '—'}</td><td>${comp.type || '—'}</td><td>${comp.criticality || '—'}</td><td>${status}</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    card.appendChild(wrapper);
  }

  container.appendChild(card);
  return container;
}

function renderLubricationPoints() {
  const container = el('div');
  const card = el('div', 'card');
  card.appendChild(el('div', 'card-title', 'Lubrication Points'));

  if (cache.lubricationPoints.length === 0) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = '<div class="empty-state-title">No points defined</div>';
    card.appendChild(empty);
  } else {
    const wrapper = el('div', 'table-wrapper');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Point</th><th>Component</th><th>Lubricant</th><th>Interval (Days)</th><th>Status</th></tr></thead>';
    const tbody = el('tbody');
    cache.lubricationPoints.forEach(lp => {
      const comp = cache.components.find(c => c.id === lp.component_id);
      const lub = cache.lubricants.find(l => l.id === lp.lubricant_id);
      const row = el('tr');
      const status = lp.status === 'active' ? '<span class="badge badge-success">ACTIVE</span>' : '<span class="badge badge-info">INACTIVE</span>';
      const interval = lp.calendar_interval_months ? (lp.calendar_interval_months * 30) : '—';
      row.innerHTML = `<td><strong>${lp.name}</strong></td><td>${comp ? comp.name : '—'}</td><td>${lub ? lub.name : '—'}</td><td>${interval}</td><td>${status}</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    card.appendChild(wrapper);
  }

  container.appendChild(card);
  return container;
}

function renderRunningHours() {
  const container = el('div');
  const card = el('div', 'card');
  card.appendChild(el('div', 'card-title', 'Running Hours Tracking'));

  const form = el('div', 'mb-20');
  form.innerHTML = `
    <div class="form-group">
      <label>Resource *</label>
      <select class="input" id="resourceSelect">
        <option value="">Select resource...</option>
        ${cache.resources.map(r => `<option value="${r.id}">${r.resource_name} (${r.running_hours || 0} hrs)</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>New Running Hours *</label>
      <input type="number" class="input" id="newHours" placeholder="e.g. 5000">
    </div>
    <button class="btn-primary" onclick="window.updateRunningHours()">Update</button>
  `;
  card.appendChild(form);

  const table = el('table');
  table.innerHTML = '<thead><tr><th>Resource</th><th>Running Hours</th><th>Last Updated</th><th>Linked Equipment</th></tr></thead>';
  const tbody = el('tbody');
  cache.resources.forEach(res => {
    const row = el('tr');
    const lastUpd = res.last_updated ? formatDate(res.last_updated) : '—';
    const linkedEq = cache.equipment.filter(e => {
      // This would need equipment_resource_mapping query, placeholder for now
      return false;
    });
    row.innerHTML = `<td><strong>${res.resource_name}</strong></td><td>${res.running_hours || 0} hrs</td><td>${lastUpd}</td><td>${linkedEq.length} items</td>`;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  const wrapper = el('div', 'table-wrapper');
  wrapper.appendChild(table);
  card.appendChild(wrapper);

  container.appendChild(card);
  return container;
}

window.updateRunningHours = async function() {
  const resId = document.getElementById('resourceSelect').value;
  const hours = parseFloat(document.getElementById('newHours').value);

  if (!resId || !hours) {
    alert('Resource and hours required');
    return;
  }

  const { data, error } = await sb.rpc('update_resource_running_hours', {
    res_id: resId,
    new_hours: hours
  });

  if (error) {
    alert('Error: ' + error.message);
  } else {
    alert('Running hours updated');
    await loadAll();
    render();
  }
};

function renderActivities() {
  const container = el('div');
  const card = el('div', 'card');
  card.appendChild(el('div', 'card-title', 'Activities'));

  if (cache.activities.length === 0) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = '<div class="empty-state-title">No activities</div>';
    card.appendChild(empty);
  } else {
    const wrapper = el('div', 'table-wrapper');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Date</th><th>Equipment</th><th>Component</th><th>Qty</th><th>UOM</th><th>Technician</th><th>Status</th></tr></thead>';
    const tbody = el('tbody');
    cache.activities.forEach(a => {
      const row = el('tr');
      const status = a.status === 'completed' ? '<span class="badge badge-success">DONE</span>' : '<span class="badge badge-warning">PENDING</span>';
      row.innerHTML = `<td>${formatDate(a.activity_date)}</td><td>${a.equipment || '—'}</td><td>${a.component || '—'}</td><td>${a.qty || '—'}</td><td>${a.qty_uom || '—'}</td><td>${a.technician || '—'}</td><td>${status}</td>`;
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
    table.innerHTML = '<thead><tr><th>Date</th><th>Equipment</th><th>Component</th><th>Flag Type</th><th>Notes</th></tr></thead>';
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
      <div class="kpi-label">Total Equipment</div>
      <div class="kpi-value">${cache.equipment.length}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Components</div>
      <div class="kpi-value">${cache.components.length}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Lubrication Points</div>
      <div class="kpi-value">${cache.lubricationPoints.length}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Recent Activities</div>
      <div class="kpi-value">${cache.activities.length}</div>
    </div>
  `;
  card.appendChild(kpiGrid);

  container.appendChild(card);
  return container;
}

function renderAdmin() {
  const container = el('div');
  const card = el('div', 'card');
  card.appendChild(el('div', 'card-title', 'User Management'));

  const form = el('div');
  form.innerHTML = `
    <div class="form-group">
      <label>Create User</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <input type="email" class="input" id="newUserEmail" placeholder="Email">
        <input type="password" class="input" id="newUserPass" placeholder="Password (min 8)">
      </div>
      <button class="btn-primary mt-20" onclick="window.createNewUser()">Create user</button>
    </div>

    <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border);">

    <div class="form-group">
      <label>Manage Users</label>
      <div id="usersList"></div>
    </div>
  `;

  card.appendChild(form);
  container.appendChild(card);

  // Load users list
  loadUsersList();

  return container;
}

async function loadUsersList() {
  const { data: users } = await sb.from('profiles').select('*').order('created_at');
  const list = document.getElementById('usersList');
  if (!list) return;

  if (!users || users.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-title">No users</div></div>';
    return;
  }

  const table = el('table');
  table.innerHTML = '<thead><tr><th>Email</th><th>Role</th><th>Assets Edit</th><th>Points Edit</th><th>Workorders</th></tr></thead>';
  const tbody = el('tbody');

  users.forEach(u => {
    const row = el('tr');
    const role = u.is_admin ? 'ADMIN' : 'USER';
    row.innerHTML = `
      <td>${u.full_name || '—'}</td>
      <td>${role}</td>
      <td>${u.assets_edit ? '✓' : '✗'}</td>
      <td>${u.points_edit ? '✓' : '✗'}</td>
      <td>${u.workorders_record ? '✓' : '✗'}</td>
    `;
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  list.appendChild(table);
}

async function openEquipmentModal() {
  const form = el('div');
  form.innerHTML = `
    <div class="form-group">
      <label>Equipment Name *</label>
      <input type="text" class="input" id="eqName" placeholder="e.g., Pump A1" autofocus>
    </div>
    <div class="form-group">
      <label>SAP Equipment Number</label>
      <input type="text" class="input" id="eqSap" placeholder="e.g., 123456">
    </div>
    <div class="form-group">
      <label>Type</label>
      <input type="text" class="input" id="eqType" placeholder="e.g., Pump">
    </div>
    <div class="form-group">
      <label>Criticality</label>
      <select class="input" id="eqCriticality">
        <option value="">Select...</option>
        <option>Critical</option>
        <option>High</option>
        <option>Medium</option>
        <option>Low</option>
      </select>
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
      sap_equipment_number: document.getElementById('eqSap').value.trim(),
      type: document.getElementById('eqType').value.trim(),
      lubrication_criticality: document.getElementById('eqCriticality').value,
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

async function openComponentModal() {
  const form = el('div');
  form.innerHTML = `
    <div class="form-group">
      <label>Equipment *</label>
      <select class="input" id="compEquipment">
        <option value="">Select equipment...</option>
        ${cache.equipment.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Component Name *</label>
      <input type="text" class="input" id="compName" placeholder="e.g., Bearing" autofocus>
    </div>
    <div class="form-group">
      <label>Type</label>
      <input type="text" class="input" id="compType" placeholder="e.g., Roller Bearing">
    </div>
    <div class="form-group">
      <label>Criticality</label>
      <select class="input" id="compCriticality">
        <option value="">Select...</option>
        <option>Critical</option>
        <option>High</option>
        <option>Medium</option>
        <option>Low</option>
      </select>
    </div>
  `;

  window.openModal('Add Component', form, async () => {
    const eqId = document.getElementById('compEquipment').value;
    const name = document.getElementById('compName').value.trim();

    if (!eqId || !name) {
      alert('Equipment and name required');
      return false;
    }

    // Log suggestion
    await sb.from('component_type_suggestions').insert({
      component_type: document.getElementById('compType').value.trim()
    }).catch(() => {});

    const { error } = await sb.from('components').insert({
      equipment_id: eqId,
      name,
      type: document.getElementById('compType').value.trim(),
      criticality: document.getElementById('compCriticality').value,
      status: 'active',
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

async function openLubricationPointModal() {
  const form = el('div');
  form.innerHTML = `
    <div class="form-group">
      <label>Component *</label>
      <select class="input" id="lpComponent">
        <option value="">Select component...</option>
        ${cache.components.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Point Name *</label>
      <input type="text" class="input" id="lpName" placeholder="e.g., Main Bearing" autofocus>
    </div>
    <div class="form-group">
      <label>Lubrication Type</label>
      <select class="input" id="lpType">
        <option value="">Select...</option>
        <option>Oil</option>
        <option>Grease</option>
        <option>Aerosol</option>
      </select>
    </div>
    <div class="form-group">
      <label>Lubricant *</label>
      <select class="input" id="lpLubricant">
        <option value="">Select lubricant...</option>
        ${cache.lubricants.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Calendar Interval (months)</label>
      <input type="number" class="input" id="lpInterval" placeholder="e.g., 1">
    </div>
    <div class="form-group">
      <label>Criticality</label>
      <select class="input" id="lpCriticality">
        <option value="">Select...</option>
        <option>Critical</option>
        <option>High</option>
        <option>Medium</option>
        <option>Low</option>
      </select>
    </div>
  `;

  window.openModal('Add Lubrication Point', form, async () => {
    const compId = document.getElementById('lpComponent').value;
    const name = document.getElementById('lpName').value.trim();
    const lubId = document.getElementById('lpLubricant').value;

    if (!compId || !name || !lubId) {
      alert('Component, name, and lubricant required');
      return false;
    }

    // Log suggestion
    await sb.from('lubrication_point_suggestions').insert({
      point_name: name
    }).catch(() => {});

    const { error } = await sb.from('lubrication_points').insert({
      component_id: compId,
      name,
      lubrication_type: document.getElementById('lpType').value,
      lubricant_id: lubId,
      calendar_interval_months: parseFloat(document.getElementById('lpInterval').value) || null,
      status: 'active',
      criticality: document.getElementById('lpCriticality').value,
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
      <label>Quantity</label>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;">
        <input type="number" class="input" id="actQty">
        <select class="input" id="actUOM">
          <option>L</option>
          <option>ml</option>
          <option>kg</option>
          <option>g</option>
        </select>
      </div>
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

  window.openModal('Log Activity', form, async () => {
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
      qty_uom: document.getElementById('actUOM').value,
      technician: document.getElementById('actTech').value.trim(),
      notes: document.getElementById('actNotes').value.trim(),
      status: 'completed',
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
      alert('User created!');
      document.getElementById('newUserEmail').value = '';
      document.getElementById('newUserPass').value = '';
      await loadAll();
      render();
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
};

// AUTH
document.addEventListener('DOMContentLoaded', async () => {
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
      document.getElementById('authError').textContent = 'Password must be 8+ characters';
      document.getElementById('authError').style.display = '';
      return;
    }

    const { error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });

    if (error) {
      document.getElementById('authError').textContent = error.message;
      document.getElementById('authError').style.display = '';
    } else {
      document.getElementById('authError').textContent = 'Account created! Signing in...';
      document.getElementById('authError').style.display = '';
      setTimeout(async () => {
        await sb.auth.signInWithPassword({ email, password });
      }, 1000);
    }
  };

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

  sb.auth.onAuthStateChange((_event, session) => {
    route();
  });

  await route();
});
