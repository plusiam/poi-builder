// 교사 페이지 — 진입점

let _constants = null;
let _units = [];
let _user = null;
let _userRole = 'viewer';

document.addEventListener('DOMContentLoaded', () => {
  Auth.init(onLogin);
});

async function onLogin(user) {
  _user = user;

  // 헤더 사용자 정보
  document.getElementById('user-name').textContent = user.name;
  if (user.picture) document.getElementById('user-avatar').src = user.picture;
  document.getElementById('header-user').style.display = 'flex';

  try {
    // 1) 본인 프로필 조회 + 자동 사전 등록 (v3.4 승인 대기 체계)
    const profile = await API.get('whoami', { display_name: user.name || '' });

    if (profile.status !== 'active') {
      showAccessGateScreen(profile);
      return;
    }

    // 2) 정상 사용자 — 실제 역할 반영 후 데이터 로드
    _userRole = profile.role;
    await loadData();
    renderHome();
  } catch (e) {
    if (e.code === 'UNAUTHORIZED') {
      window.location.href = 'login.html';
    } else {
      Utils.toast('데이터를 불러오지 못했습니다: ' + e.message, 'error');
    }
  }
}

async function loadData() {
  const [units, constants] = await Promise.all([
    API.get('units'),
    API.get('constants'),
  ]);
  _units = units || [];
  _constants = constants;
}

// ── 승인 대기 / 비활성 화면 (v3.4) ─────────────────────────
function showAccessGateScreen(profile) {
  // 모든 페이지 섹션을 숨기고 access-gate 섹션만 노출
  document.querySelectorAll('.page-section').forEach(el => el.style.display = 'none');
  const gate = document.getElementById('section-access-gate');
  if (!gate) return;
  gate.style.display = 'block';

  const isPending = profile.status === 'pending';
  document.getElementById('gate-icon').textContent  = isPending ? '⏳' : '🚫';
  document.getElementById('gate-title').textContent = isPending ? '승인 대기 중입니다' : '비활성화된 계정입니다';
  document.getElementById('gate-msg').textContent   = isPending
    ? '관리자가 권한을 승인하면 바로 사용하실 수 있습니다. 잠시 후 다시 시도해주세요.'
    : '계정이 비활성 상태입니다. 관리자에게 문의해주세요.';

  document.getElementById('gate-email').textContent = profile.email;
  document.getElementById('gate-role').textContent  = profile.role;
}

function gateReload() {
  // 새로고침으로 다시 whoami 호출 → 승인됐는지 확인
  window.location.reload();
}

function renderHome() {
  showSection('home');

  // 내 학년 UOI 카드
  const myUnits = _userRole === 'admin'
    ? _units
    : _units.filter(u => u.owner_email === _user.email);

  const grid = document.getElementById('my-uoi-grid');
  if (myUnits.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="icon">📝</div>
        <p>아직 작성된 UOI가 없습니다</p>
        <button class="btn btn-primary" onclick="openNewUOI()">+ 새 UOI 만들기</button>
      </div>`;
  } else {
    grid.innerHTML = myUnits.map(u => buildUOICard(u)).join('');
  }

  // 전체 매트릭스 — 드래그 후 서버 응답 반영을 위해 onReload 전달
  MatrixView.render('matrix-container', _units, _userRole, onCellClick, {
    onReload: async () => {
      try {
        const fresh = await API.get('units');
        _units = fresh || [];
        renderHome();
      } catch (_) { /* 조용히 무시 */ }
    },
  });
}

function buildUOICard(u) {
  const themes = {
    who_we_are: '우리는 누구인가',
    where_we_are_in_place_and_time: '우리는 어떤 시공간에 있는가',
    how_we_express_ourselves: '우리는 어떻게 표현하는가',
    how_the_world_works: '세상은 어떻게 작동하는가',
    how_we_organize_ourselves: '우리는 어떻게 조직되는가',
    sharing_the_planet: '지구를 공유하기',
  };
  const concepts = Utils.parseJSON(u.key_concepts, []);
  return `
  <div class="uoi-card" onclick="openUOI('${u.unit_id}')">
    <div class="uoi-card-header" style="background:${Utils.themeColor(u.theme_id)};height:6px;border-bottom:3px solid ${headerBorderColor(u.status)}"></div>
    <div class="uoi-card-content">
      <div class="theme-name">${u.grade}학년 · ${themes[u.theme_id] || u.theme_id}</div>
      <h3>${u.title || '(제목 없음)'}</h3>
      <div class="central-idea">${u.central_idea || '중심 아이디어를 작성하세요'}</div>
      ${concepts.length ? `<div class="concept-chips">${concepts.map(c => `<span class="concept-chip">${c}</span>`).join('')}</div>` : ''}
    </div>
    <div class="uoi-card-footer">
      <span class="badge ${Utils.statusClass(u.status)}">${Utils.statusLabel(u.status)}</span>
      <span class="meta">${Utils.formatDate(u.updated_at)}</span>
    </div>
  </div>`;
}

function headerBorderColor(status) {
  return { draft: '#dadce0', in_review: '#f29900', approved: '#1a73e8', finalized: '#188038', archived: '#9aa0a6' }[status] || '#dadce0';
}

function onCellClick(cellData) {
  if (cellData._new) {
    openNewUOI(cellData.grade, cellData.theme_id);
  } else {
    openUOI(cellData.unit_id);
  }
}

function showSection(name) {
  document.querySelectorAll('.page-section').forEach(el => el.style.display = 'none');
  const el = document.getElementById(`section-${name}`);
  if (el) el.style.display = 'block';
}

function openUOI(unitId) {
  const unit = _units.find(u => u.unit_id === unitId);
  if (!unit) return;
  UOIEditor.open(unit, _constants, _userRole, async (saved) => {
    // 휴지통으로 이동된 경우 로컬 목록에서 제거
    if (saved && saved.deleted === true) {
      _units = _units.filter(u => u.unit_id !== saved.unit_id);
      renderHome();
      return;
    }
    // 일반 저장 후 로컬 업데이트
    const idx = _units.findIndex(u => u.unit_id === saved.unit_id);
    if (idx >= 0) Object.assign(_units[idx], saved);
    renderHome();
  });
}

function openNewUOI(grade, themeId) {
  UOIEditor.open({ grade: grade || 1, theme_id: themeId || 'who_we_are', _new: true }, _constants, _userRole, async (saved) => {
    _units.push(saved);
    renderHome();
  });
}
