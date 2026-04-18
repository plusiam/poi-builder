// 관리자 페이지 진입점

let _units = [];
let _changelog = [];
let _adminUser = null;
let _selectedUnit = null;

const THEMES_KO = {
  who_we_are: '우리는 누구인가',
  where_we_are_in_place_and_time: '우리는 어떤 시공간에 있는가',
  how_we_express_ourselves: '우리는 어떻게 표현하는가',
  how_the_world_works: '세상은 어떻게 작동하는가',
  how_we_organize_ourselves: '우리는 어떻게 조직되는가',
  sharing_the_planet: '지구를 공유하기',
};

document.addEventListener('DOMContentLoaded', () => {
  Auth.init(onAdminLogin);
});

async function onAdminLogin(user) {
  _adminUser = user;
  document.getElementById('admin-user-name').textContent = user.name;
  if (user.picture) document.getElementById('admin-avatar').src = user.picture;

  try {
    await loadAdminData();
    showAdminSection('dashboard');
  } catch (e) {
    if (e.code === 'UNAUTHORIZED') { window.location.href = 'login.html'; return; }
    if (e.code === 'FORBIDDEN')    { Utils.toast('관리자 권한이 없습니다. 수석교사에게 문의하세요.', 'error'); setTimeout(() => window.location.href = 'index.html', 2000); return; }
    Utils.toast('데이터 로드 실패: ' + e.message, 'error');
  }
}

async function loadAdminData() {
  const [dashData, changelogData] = await Promise.all([
    API.get('dashboard'),
    API.get('changelog'),
  ]);
  _units     = dashData.units || [];
  _changelog = Array.isArray(changelogData) ? changelogData : [];
  renderDashboard();
}

// ── 네비게이션 ────────────────────────────────────────────

function showAdminSection(name) {
  document.querySelectorAll('.admin-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === name));
  const el = document.getElementById(`section-${name}`);
  if (el) el.classList.add('active');
  document.getElementById('section-title').textContent = {
    dashboard: '대시보드', review: 'UOI 검토', export: '내보내기',
    users: '사용자 관리', snapshots: '스냅샷',
  }[name] || '';

  // 섹션별 초기 렌더
  if (name === 'review')    renderReviewList();
  if (name === 'export')    renderExport();
  if (name === 'users')     renderUsers();
  if (name === 'snapshots') renderSnapshots();
}

// ── 대시보드 ─────────────────────────────────────────────

function renderDashboard() {
  Dashboard.renderKPI(_units);
  Dashboard.renderHeatmap(_units);
  Dashboard.renderActivityFeed(_changelog);
  MatrixView.render('admin-matrix', _units, 'admin', (cell) => {
    if (!cell._new) {
      showAdminSection('review');
      selectReviewUnit(cell.unit_id);
    }
  });
}

// ── UOI 검토 ─────────────────────────────────────────────

function renderReviewList() {
  const container = document.getElementById('review-list');
  // in_review / approved 우선 정렬
  const sorted = [..._units].sort((a, b) => {
    const order = { in_review: 0, approved: 1, draft: 2, finalized: 3, archived: 4 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>UOI가 없습니다</p></div>';
    return;
  }

  container.innerHTML = sorted.map(u => `
    <div class="review-item ${_selectedUnit?.unit_id === u.unit_id ? 'active' : ''}"
         onclick="selectReviewUnit('${u.unit_id}')">
      <div class="ri-grade">${u.grade}학년 · ${THEMES_KO[u.theme_id] || u.theme_id}</div>
      <div class="ri-title">${u.title || u.central_idea || '(제목 없음)'}</div>
      <div class="ri-footer">
        <span class="badge ${Utils.statusClass(u.status)}">${Utils.statusLabel(u.status)}</span>
        <span class="ri-owner">${u.owner_email?.split('@')[0] || ''}</span>
      </div>
    </div>`).join('');

  // 첫 번째 아이템 자동 선택
  if (!_selectedUnit && sorted.length > 0) selectReviewUnit(sorted[0].unit_id);
}

function selectReviewUnit(unitId) {
  _selectedUnit = _units.find(u => u.unit_id === unitId);
  if (!_selectedUnit) return;
  renderReviewList(); // 선택 상태 업데이트
  renderReviewPanel(_selectedUnit);
}

function renderReviewPanel(u) {
  const panel = document.getElementById('review-panel');
  if (!panel) return;

  const loi     = Utils.parseJSON(u.lines_of_inquiry, []);
  const kcs     = Utils.parseJSON(u.key_concepts, []);
  const lp      = Utils.parseJSON(u.learner_profile, []);
  const canAct  = u.status !== 'finalized' && u.status !== 'archived';

  const actionBtns = canAct ? `
    ${u.status === 'in_review' ? `
      <button class="btn btn-primary btn-sm" onclick="reviewAction('approve','${u.unit_id}')">✅ 승인</button>
      <button class="btn btn-danger btn-sm"  onclick="reviewAction('reject','${u.unit_id}')">❌ 반려</button>` : ''}
    ${u.status === 'approved' ? `
      <button class="btn btn-primary btn-sm" onclick="reviewAction('finalize','${u.unit_id}')">🔒 확정</button>
      <button class="btn btn-outline btn-sm" onclick="reviewAction('reject','${u.unit_id}')">↩ 반려</button>` : ''}
    ${u.status === 'finalized' ? `
      <button class="btn btn-ghost btn-sm"   onclick="reviewAction('unlock','${u.unit_id}')">🔓 잠금 해제</button>` : ''}
  ` : '<span style="color:var(--text-secondary);font-size:.85rem">읽기 전용</span>';

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div style="font-size:.78rem;color:var(--text-secondary);margin-bottom:.25rem">${u.grade}학년 · ${THEMES_KO[u.theme_id] || u.theme_id}</div>
        <h3>${u.title || u.central_idea || '(제목 없음)'}</h3>
      </div>
      <span class="badge ${Utils.statusClass(u.status)}">${Utils.statusLabel(u.status)}</span>
    </div>
    <div class="panel-body">
      <div class="detail-field">
        <div class="df-label">Central Idea</div>
        <div class="df-value">${u.central_idea || '—'}</div>
      </div>
      <div class="detail-field">
        <div class="df-label">Lines of Inquiry</div>
        <div class="df-value"><ul>${loi.map(l => `<li>${l}</li>`).join('') || '<li>—</li>'}</ul></div>
      </div>
      <div class="detail-field">
        <div class="df-label">Key Concepts</div>
        <div class="df-value">
          <div class="concept-chips">
            ${kcs.map(c => `<span class="concept-chip">${c}</span>`).join('') || '—'}
          </div>
        </div>
      </div>
      <div class="detail-field">
        <div class="df-label">Learner Profile</div>
        <div class="df-value">${lp.join(', ') || '—'}</div>
      </div>
      ${u.action ? `<div class="detail-field"><div class="df-label">Action</div><div class="df-value">${u.action}</div></div>` : ''}
      <div class="detail-field">
        <div class="df-label">담당 교사</div>
        <div class="df-value">${u.owner_email || '—'} · ${Utils.formatDate(u.updated_at)}</div>
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0">

      <div class="detail-field">
        <div class="df-label">코멘트</div>
        <div class="comment-thread" id="comment-thread">
          ${_renderComments(u.unit_id)}
        </div>
        <div class="comment-form">
          <textarea id="comment-input" rows="2" placeholder="코멘트를 입력하세요..."></textarea>
          <button class="btn btn-outline btn-sm" onclick="submitComment('${u.unit_id}')">전송</button>
        </div>
      </div>
    </div>
    <div class="panel-actions">${actionBtns}</div>`;
}

function _renderComments(unitId) {
  const comments = _changelog
    .filter(c => c.unit_id === unitId && c.action === 'comment')
    .slice(-10);
  if (comments.length === 0) return '<div style="color:var(--text-secondary);font-size:.82rem">코멘트 없음</div>';
  return comments.map(c => `
    <div class="comment-item">
      <div class="ci-meta">${c.actor_email?.split('@')[0]} · ${Utils.formatDate(c.timestamp)}</div>
      <div class="ci-body">${c.after_value || c.diff_summary || ''}</div>
    </div>`).join('');
}

// ── 검토 액션 ─────────────────────────────────────────────

async function reviewAction(type, unitId) {
  const labels = { approve: '승인', reject: '반려', finalize: '확정', unlock: '잠금 해제' };
  const label  = labels[type] || type;
  let reason = '';

  if (type === 'reject' || type === 'unlock') {
    reason = prompt(`${label} 사유를 입력하세요:`);
    if (reason === null) return;
    if (!reason.trim()) { Utils.toast('사유를 입력해주세요', 'warning'); return; }
  }
  if (type === 'finalize') {
    if (!confirm('이 UOI를 확정하면 잠깁니다. 계속하시겠습니까?')) return;
  }

  try {
    const actionMap = { approve: 'approveUnit', reject: 'rejectUnit', finalize: 'finalizeUnit', unlock: 'unlockUnit' };
    const body = { unit_id: unitId };
    if (reason) body.reason = reason;
    if (type === 'reject') body.reason = reason;

    await API.post(actionMap[type], body);
    Utils.toast(`${label} 완료`, 'success');
    await loadAdminData();
    if (_selectedUnit) selectReviewUnit(unitId);
  } catch (e) {
    Utils.toast(`${label} 실패: ` + e.message, 'error');
  }
}

async function submitComment(unitId) {
  const body = document.getElementById('comment-input')?.value?.trim();
  if (!body) return;
  try {
    await API.post('addComment', { unit_id: unitId, body });
    document.getElementById('comment-input').value = '';
    Utils.toast('코멘트 전송됨', 'success');
    await loadAdminData();
    document.getElementById('comment-thread').innerHTML = _renderComments(unitId);
  } catch (e) {
    Utils.toast('전송 실패: ' + e.message, 'error');
  }
}

// ── 내보내기 ─────────────────────────────────────────────

function renderExport() {
  // 이미 HTML에 카드 구조 정의됨
}

async function doExport(format) {
  const scopeEl = document.querySelector('input[name="export-scope"]:checked');
  const scope   = scopeEl?.value || 'all';
  const grade   = document.getElementById('export-grade')?.value;

  const params = { format, scope };
  if (scope === 'grade' && grade) params.grade = grade;

  Utils.toast(`${format.toUpperCase()} 내보내기 준비 중...`, 'info');

  try {
    const data = await API.get('export', params);

    let content, mime, ext;
    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      mime = 'application/json';
      ext  = 'json';
    } else if (format === 'markdown') {
      content = data.markdown || '';
      mime = 'text/markdown';
      ext  = 'md';
    } else if (format === 'csv') {
      content = data.csv || '';
      mime = 'text/csv;charset=utf-8';
      ext  = 'csv';
    }

    const scopeTag = scope === 'grade' ? `${grade}학년` : scope;
    const dateTag  = new Date().toISOString().slice(0, 10);

    // BOM 추가: 엑셀에서 한글 깨짐 방지
    const blob = new Blob(['\uFEFF' + content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `poi-${scopeTag}-${dateTag}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    Utils.toast('내보내기 완료', 'success');
  } catch (e) {
    Utils.toast('내보내기 실패: ' + e.message, 'error');
  }
}

// ── 사용자 관리 ───────────────────────────────────────────

let _users = [];

async function renderUsers() {
  try {
    // Units의 owner_email로 간단한 사용자 목록 추출 (Phase 4에서 Users API로 교체)
    const emails = [...new Set(_units.map(u => u.owner_email).filter(Boolean))];
    const container = document.getElementById('user-table-body');
    if (!container) return;
    if (emails.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">등록된 사용자 없음</td></tr>';
      return;
    }
    container.innerHTML = emails.map(email => `
      <tr>
        <td>${email}</td>
        <td>${email.split('@')[0]}</td>
        <td><span class="role-badge role-editor">editor</span></td>
        <td>—</td>
        <td><button class="btn btn-ghost btn-sm" onclick="Utils.toast('사용자 관리 Phase 4 예정','info')">편집</button></td>
      </tr>`).join('');
  } catch (e) {
    Utils.toast('사용자 목록 로드 실패', 'error');
  }
}

async function addUser() {
  const email = document.getElementById('new-email')?.value?.trim();
  const role  = document.getElementById('new-role')?.value;
  const grade = document.getElementById('new-grade')?.value;
  if (!email || !email.includes('@')) { Utils.toast('유효한 이메일을 입력하세요', 'warning'); return; }
  try {
    await API.post('updateUser', { email, role, assigned_grade: grade ? parseInt(grade) : null });
    Utils.toast(`${email} 추가 완료`, 'success');
    document.getElementById('new-email').value = '';
  } catch (e) {
    Utils.toast('추가 실패: ' + e.message, 'error');
  }
}

// ── 스냅샷 ───────────────────────────────────────────────

function renderSnapshots() {
  const container = document.getElementById('snapshot-container');
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <div class="icon">📸</div>
      <p>스냅샷 관리 기능은 Phase 4에서 구현 예정입니다.</p>
      <p style="font-size:.85rem;color:var(--text-secondary)">확정(finalize) 시 자동으로 Snapshots 시트에 저장됩니다.</p>
    </div>`;
}
