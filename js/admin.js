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
  if (name === 'trash')     renderTrash();
}

// ── 대시보드 ─────────────────────────────────────────────

function renderDashboard() {
  Dashboard.renderKPI(_units);
  Dashboard.renderThemeBalance(_units);  // v3.4 — 6 TDT × 학년 균형
  Dashboard.renderHeatmap(_units);
  Dashboard.renderActivityFeed(_changelog);
  MatrixView.render('admin-matrix', _units, 'admin', (cell) => {
    if (!cell._new) {
      showAdminSection('review');
      selectReviewUnit(cell.unit_id);
    }
  }, {
    onReload: async () => {
      try {
        const dashData = await API.get('dashboard');
        _units = dashData.units || [];
        renderDashboard();
      } catch (_) { /* 무시 */ }
    },
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
    // 확정 단계의 최종 검증 실패는 별도 모달로 표시 (여러 위반 한 번에 보여주기)
    if (type === 'finalize' && e.code === 'VALIDATION') {
      const force = confirm(
        `❌ 최종 확정 불가\n\n${e.message}\n\n` +
        `긴급 우회(force)로 검증을 무시하고 강제 확정하시겠습니까?\n` +
        `(IB PYP 인증 요건 위반 가능 — 권장하지 않음)`
      );
      if (force) {
        try {
          await API.post('finalizeUnit', { unit_id: unitId, force: true });
          Utils.toast('⚠️ 강제 확정 완료 (검증 우회)', 'warning');
          await loadAdminData();
          if (_selectedUnit) selectReviewUnit(unitId);
        } catch (e2) {
          Utils.toast('강제 확정 실패: ' + e2.message, 'error');
        }
      }
      return;
    }
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

// ── 사용자 관리 (v3.4 — 실제 Users 시트 연동) ───────────

let _users = [];

const ROLE_LABEL_KO = {
  viewer: '열람',
  commenter: '피드백',
  editor: '교사',
  approver: '승인자',
  admin: '수석',
};

async function renderUsers() {
  const container = document.getElementById('user-table-body');
  if (!container) return;
  container.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">로딩 중…</td></tr>';

  try {
    const list = await API.get('users');
    _users = Array.isArray(list) ? list : [];

    if (_users.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">등록된 사용자 없음</td></tr>';
      return;
    }

    container.innerHTML = _users.map(u => {
      const role = u.role || 'viewer';
      const label = ROLE_LABEL_KO[role] || role;
      // active=false 행은 음영 처리
      const inactive = u.active === false ? ' style="opacity:.5"' : '';
      return `
        <tr${inactive} data-email="${_esc(u.email)}">
          <td>${_esc(u.email)}</td>
          <td>${_esc(u.display_name || u.email.split('@')[0])}</td>
          <td><span class="role-badge role-${role}">${role} <span style="opacity:.7">(${label})</span></span></td>
          <td>${u.assigned_grade ? u.assigned_grade + '학년' : '—'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm" onclick="editUser('${_esc(u.email)}')">편집</button>
            ${u.active === false
              ? `<button class="btn btn-ghost btn-sm" onclick="toggleUserActive('${_esc(u.email)}', true)">활성화</button>`
              : `<button class="btn btn-ghost btn-sm" onclick="toggleUserActive('${_esc(u.email)}', false)">비활성화</button>`}
          </td>
        </tr>`;
    }).join('');
  } catch (e) {
    if (e.code === 'FORBIDDEN') {
      container.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">사용자 목록 조회는 admin 권한이 필요합니다</td></tr>';
    } else {
      container.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger)">사용자 목록 로드 실패: ${_esc(e.message || '')}</td></tr>`;
    }
  }
}

function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function addUser() {
  const emailEl = document.getElementById('new-email');
  const nameEl  = document.getElementById('new-name');
  const roleEl  = document.getElementById('new-role');
  const gradeEl = document.getElementById('new-grade');

  const email = emailEl?.value?.trim();
  const name  = nameEl?.value?.trim();
  const role  = roleEl?.value;
  const grade = gradeEl?.value;

  if (!email) {
    Utils.toast('이메일을 입력해주세요', 'warning');
    emailEl?.focus();
    return;
  }
  if (!email.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    Utils.toast('유효한 이메일 형식이 아닙니다', 'warning');
    emailEl?.focus();
    return;
  }

  try {
    const body = { email, role: role || 'viewer' };
    if (name) body.display_name = name;
    if (grade) body.assigned_grade = parseInt(grade);

    const result = await API.post('updateUser', body);
    const verb = result?.created ? '추가' : '갱신';
    Utils.toast(`${email} ${verb} 완료`, 'success');

    // 입력 필드 초기화
    if (emailEl) emailEl.value = '';
    if (nameEl)  nameEl.value  = '';
    if (gradeEl) gradeEl.value = '';

    // 목록 즉시 갱신
    await renderUsers();
  } catch (e) {
    if (e.code === 'FORBIDDEN') Utils.toast('사용자 관리는 admin만 가능합니다', 'error');
    else Utils.toast('추가 실패: ' + (e.message || ''), 'error');
  }
}

async function editUser(email) {
  const u = _users.find(x => x.email === email);
  if (!u) return;

  const newRole = prompt(
    `[${email}]의 역할을 변경합니다.\n` +
    `\n옵션: viewer / commenter / editor / approver / admin\n\n현재: ${u.role}`,
    u.role || 'viewer'
  );
  if (newRole === null) return;
  const cleaned = newRole.trim().toLowerCase();
  if (!['viewer', 'commenter', 'editor', 'approver', 'admin'].includes(cleaned)) {
    Utils.toast('허용된 역할이 아닙니다', 'warning');
    return;
  }

  try {
    await API.post('updateUser', { email, role: cleaned });
    Utils.toast(`${email} → ${cleaned} 변경됨`, 'success');
    await renderUsers();
  } catch (e) {
    Utils.toast('변경 실패: ' + e.message, 'error');
  }
}

async function toggleUserActive(email, active) {
  const verb = active ? '활성화' : '비활성화';
  if (!confirm(`${email} 계정을 ${verb}하시겠습니까?`)) return;
  try {
    await API.post('updateUser', { email, active });
    Utils.toast(`${email} ${verb} 완료`, 'success');
    await renderUsers();
  } catch (e) {
    Utils.toast(`${verb} 실패: ` + e.message, 'error');
  }
}

// ── 스냅샷 + 연도 롤오버 (v3.3, Phase 4) ────────────────

let _archivePreview = null;

async function renderSnapshots() {
  // 현재 연도 표시
  await _refreshCurrentYear();

  // 스냅샷 목록 (간단 버전 — diff 비교는 Phase 4 후속에서 확장)
  const container = document.getElementById('snapshot-container');
  if (!container) return;
  try {
    const snaps = await API.get('snapshots');
    if (!Array.isArray(snaps) || snaps.length === 0) {
      container.innerHTML = `
        <div class="card" style="margin-top:1rem">
          <div class="card-header"><h3 style="margin:0">📸 스냅샷</h3></div>
          <div class="empty-state">
            <p>아직 보관된 스냅샷이 없습니다.</p>
            <p style="font-size:.85rem;color:var(--text-secondary)">확정(finalize) 또는 학년도 롤오버 시 자동 저장됩니다.</p>
          </div>
        </div>`;
      return;
    }

    const sorted = [...snaps].sort((a, b) =>
      String(b.snapshot_at || '').localeCompare(String(a.snapshot_at || '')));

    container.innerHTML = `
      <div class="card" style="margin-top:1rem">
        <div class="card-header"><h3 style="margin:0">📸 스냅샷 (${snaps.length})</h3></div>
        <div style="overflow-x:auto">
          <table class="user-table">
            <thead>
              <tr>
                <th>저장 시각</th><th>저장자</th><th>학년</th><th>주제</th>
                <th>제목</th><th>상태</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.slice(0, 100).map(s => `
                <tr>
                  <td>${Utils.formatDate(s.snapshot_at)}</td>
                  <td>${(s.snapshot_by || '').split('@')[0]}</td>
                  <td>${s.grade}</td>
                  <td>${THEMES_KO[s.theme_id] || s.theme_id}</td>
                  <td>${s.title || '(제목 없음)'}</td>
                  <td><span class="badge ${Utils.statusClass(s.status)}">${Utils.statusLabel(s.status)}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${sorted.length > 100 ? `<p style="text-align:center;font-size:.85rem;color:var(--text-secondary);padding:.5rem">최근 100개만 표시</p>` : ''}
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>스냅샷 로드 실패: ${e.message}</p></div>`;
  }
}

async function _refreshCurrentYear() {
  const el = document.getElementById('rollover-current-year');
  if (!el) return;
  try {
    const meta = await API.get('meta');
    const year = (Array.isArray(meta) && meta[0] && meta[0].year) ? meta[0].year : '—';
    el.textContent = year;
    // 새 연도 입력 기본값 = current+1
    const input = document.getElementById('rollover-new-year');
    if (input && !input.value && /^\d{4}$/.test(String(year))) {
      input.value = String(parseInt(year) + 1);
    }
  } catch (_) {
    el.textContent = '—';
  }
}

async function previewArchiveYear() {
  const newYear = document.getElementById('rollover-new-year')?.value?.trim();
  if (!newYear || !/^\d{4}$/.test(newYear)) {
    Utils.toast('4자리 연도를 입력해주세요 (예: 2027)', 'warning');
    return;
  }
  try {
    const result = await API.post('archiveYear', { new_year: newYear, dry_run: true });
    _archivePreview = { new_year: newYear, result };
    _renderArchivePreview(result);
  } catch (e) {
    Utils.toast('미리보기 실패: ' + e.message, 'error');
  }
}

function _renderArchivePreview(r) {
  const box = document.getElementById('rollover-preview');
  if (!box) return;
  box.style.display = 'block';
  document.getElementById('rs-from').textContent = r.from_year || '—';
  document.getElementById('rs-to').textContent   = r.to_year || '—';
  document.getElementById('rs-count').textContent = r.archived_count;

  const list = document.getElementById('rs-preview-list');
  if (!Array.isArray(r.units_preview) || r.units_preview.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary);font-size:.85rem">아카이브할 단원이 없습니다.</p>';
  } else {
    list.innerHTML = `
      <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:.35rem">
        대상 단원 미리보기 (최대 10개):
      </p>
      <ul class="rs-preview-ul">
        ${r.units_preview.map(u => `
          <li>
            <span class="rs-grade">${u.grade}학년</span>
            <span class="rs-title">${(u.title || '(제목 없음)')}</span>
            <span class="badge ${Utils.statusClass(u.status)}">${Utils.statusLabel(u.status)}</span>
          </li>`).join('')}
      </ul>`;
  }

  // 동일 연도면 실행 비활성
  const btn = document.getElementById('rs-execute-btn');
  if (btn) {
    if (r.from_year === r.to_year) {
      btn.disabled = true;
      btn.textContent = '동일 연도 — 실행 불가';
    } else {
      btn.disabled = false;
      btn.textContent = `예, ${r.from_year} → ${r.to_year}로 전환합니다`;
    }
  }
}

function cancelArchiveYear() {
  const box = document.getElementById('rollover-preview');
  if (box) box.style.display = 'none';
  _archivePreview = null;
}

async function executeArchiveYear() {
  if (!_archivePreview) {
    Utils.toast('먼저 [미리보기]를 눌러주세요', 'warning');
    return;
  }
  const newYear = _archivePreview.new_year;
  const expected = _archivePreview.result.archived_count;

  // 안전장치 — 사용자가 연도를 직접 한 번 더 타이핑
  const confirmInput = prompt(
    `정말 ${expected}개 단원을 archived 처리하고 새 학년도(${newYear})로 전환하시겠습니까?\n\n` +
    `확인을 위해 새 학년도를 다시 입력해주세요:`
  );
  if (!confirmInput || confirmInput.trim() !== newYear) {
    Utils.toast('확인 입력이 일치하지 않아 취소되었습니다', 'info');
    return;
  }

  const btn = document.getElementById('rs-execute-btn');
  if (btn) Utils.setLoading(btn, true);

  try {
    const result = await API.post('archiveYear', { new_year: newYear, dry_run: false });
    Utils.toast(
      `✅ 학년도 전환 완료: ${result.from_year} → ${result.to_year} ` +
      `(${result.archived_count}단원 아카이브, ${result.snapshot_count}개 스냅샷 저장)`,
      'success'
    );
    cancelArchiveYear();
    await loadAdminData();
    await _refreshCurrentYear();
    await renderSnapshots();
  } catch (e) {
    Utils.toast('전환 실패: ' + e.message, 'error');
  } finally {
    if (btn) Utils.setLoading(btn, false);
  }
}

// ── 인쇄 / PDF 출력 (v3.3, Phase 4) ──────────────────────
//
// 현재 내보내기 범위 라디오/학년 선택을 그대로 query string으로 변환해
// print.html을 새 창으로 연다. print.html이 자체적으로 데이터 로드 + 자동 인쇄.

// ── 휴지통 (v3.3, Phase 4 후속) ─────────────────────────

let _trashItems = [];

async function renderTrash() {
  const container = document.getElementById('trash-container');
  if (!container) return;
  container.innerHTML = `<div class="empty-state"><p>로드 중…</p></div>`;

  try {
    const items = await API.get('trash');
    _trashItems = Array.isArray(items) ? items : [];

    if (_trashItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🗑️</div>
          <p>휴지통이 비어 있습니다.</p>
          <p style="font-size:.85rem;color:var(--text-secondary)">
            단원 편집 모달에서 <strong>🗑️ 삭제</strong>를 누르면 이곳으로 이동합니다.
          </p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0">휴지통 단원 (${_trashItems.length})</h3>
        </div>
        <div style="overflow-x:auto">
          <table class="user-table trash-table">
            <thead>
              <tr>
                <th>삭제 시각</th>
                <th>삭제자</th>
                <th>학년</th>
                <th>주제</th>
                <th>제목</th>
                <th>상태</th>
                <th style="text-align:right">관리</th>
              </tr>
            </thead>
            <tbody>
              ${_trashItems.map(u => `
                <tr data-unit-id="${u.unit_id}">
                  <td>${Utils.formatDate(u.deleted_at) || '—'}</td>
                  <td>${(u.deleted_by || '').split('@')[0] || '—'}</td>
                  <td>${u.grade}</td>
                  <td>${THEMES_KO[u.theme_id] || u.theme_id}</td>
                  <td>${u.title || '<span style="color:var(--text-secondary)">(제목 없음)</span>'}</td>
                  <td><span class="badge ${Utils.statusClass(u.status)}">${Utils.statusLabel(u.status)}</span></td>
                  <td style="text-align:right;white-space:nowrap">
                    <button class="btn btn-ghost btn-sm" onclick="restoreTrashItem('${u.unit_id}')">↩️ 복원</button>
                    <button class="btn btn-danger btn-sm" onclick="purgeTrashItem('${u.unit_id}')">🔥 영구삭제</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>휴지통 로드 실패: ${e.message}</p></div>`;
  }
}

async function restoreTrashItem(unitId) {
  const u = _trashItems.find(x => x.unit_id === unitId);
  const title = u ? (u.title || '(제목 없음)') : unitId;
  if (!confirm(`다음 단원을 복원할까요?\n\n${title}`)) return;

  try {
    await API.post('restoreUnit', { unit_id: unitId });
    Utils.toast('단원을 복원했습니다', 'success');
    await loadAdminData();   // _units 갱신
    await renderTrash();
  } catch (e) {
    Utils.toast('복원 실패: ' + e.message, 'error');
  }
}

async function purgeTrashItem(unitId) {
  const u = _trashItems.find(x => x.unit_id === unitId);
  const title = u ? (u.title || '(제목 없음)') : unitId;

  // 영구 삭제 — 두 단계 확인
  if (!confirm(`⚠️ 영구 삭제\n\n다음 단원을 완전히 제거합니다. 되돌릴 수 없습니다.\n\n${title}\n\n` +
    `관련 코멘트도 모두 삭제 처리되며, Snapshots 시트의 사본은 그대로 보존됩니다.\n\n계속할까요?`)) return;

  const confirmInput = prompt(`확인을 위해 단원 제목을 다시 입력해주세요:\n\n${title}`);
  if (!confirmInput || confirmInput.trim() !== title) {
    Utils.toast('확인 입력이 일치하지 않아 취소되었습니다', 'info');
    return;
  }

  try {
    const r = await API.post('purgeUnit', { unit_id: unitId });
    Utils.toast(`✅ 영구 삭제 완료: ${title}`, 'success');
    await loadAdminData();
    await renderTrash();
  } catch (e) {
    if (e.code === 'FORBIDDEN') Utils.toast('영구 삭제는 admin만 가능합니다', 'error');
    else Utils.toast('영구 삭제 실패: ' + e.message, 'error');
  }
}

function openPrintView() {
  const scopeEl = document.querySelector('input[name="export-scope"]:checked');
  const scope   = scopeEl?.value || 'all';
  const grade   = document.getElementById('export-grade')?.value || '';

  const qs = new URLSearchParams();
  qs.set('scope', scope);
  if (scope === 'grade' && grade) qs.set('grade', grade);

  const url = `print.html?${qs.toString()}`;
  const w = window.open(url, '_blank', 'noopener');
  if (!w) {
    Utils.toast('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요', 'warning');
  } else {
    Utils.toast('인쇄 미리보기를 새 창에서 엽니다', 'info');
  }
}
