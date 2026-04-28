// POI 매트릭스 렌더링 (v3.2 — 드래그 재배치 지원, Phase 2-B)
//
// 드래그 가능 조건 (모두 충족):
//   1. status ∈ {draft, in_review}
//   2. locked === false
//   3. 본인 소유(owner_email === myEmail) 또는 admin
//
// 드래그 결과 처리:
//   - 같은 셀 내 순서 변경: display_order 정규화 (서버 호출 1회)
//   - 셀 간 이동(학년 또는 TDT 변경): moveUnit API 호출 → warnings 토스트
//   - 서버 거부 시 원위치 롤백 (load() 다시 호출)

const MatrixView = (() => {
  const THEMES = [
    { id: 'who_we_are',                        name: '우리는 누구인가' },
    { id: 'where_we_are_in_place_and_time',    name: '우리는 어떤 시공간에 있는가' },
    { id: 'how_we_express_ourselves',           name: '우리는 어떻게 표현하는가' },
    { id: 'how_the_world_works',                name: '세상은 어떻게 작동하는가' },
    { id: 'how_we_organize_ourselves',          name: '우리는 어떻게 조직되는가' },
    { id: 'sharing_the_planet',                 name: '지구를 공유하기' },
  ];
  const GRADES = [1, 2, 3, 4, 5, 6];

  let _onCellClick = null;
  let _onReload = null;
  let _userRole = 'viewer';
  let _myEmail = null;
  let _sortableInstances = [];

  function render(containerId, units, userRole, onCellClick, opts) {
    const container = document.getElementById(containerId);
    if (!container) return;

    _onCellClick = onCellClick;
    _userRole = userRole;
    _myEmail = (typeof Auth !== 'undefined' && Auth.getUser) ? (Auth.getUser()?.email || null) : null;
    _onReload = opts && opts.onReload;
    _destroySortables();

    // grade×theme 인덱스 생성 (display_order 기준 정렬)
    const index = {};
    (units || []).forEach(u => {
      const key = `${u.grade}_${u.theme_id}`;
      if (!index[key]) index[key] = [];
      index[key].push(u);
    });
    Object.values(index).forEach(arr =>
      arr.sort((a, b) => (parseInt(a.display_order) || 0) - (parseInt(b.display_order) || 0))
    );

    const canEdit = ['editor', 'admin'].includes(userRole);
    const dragEnabled = canEdit && (typeof Sortable !== 'undefined');

    const table = document.createElement('table');
    table.className = 'matrix-table';
    if (dragEnabled) table.classList.add('matrix-draggable');

    // 헤더
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    const th0 = document.createElement('th');
    th0.textContent = '학년';
    headerRow.appendChild(th0);
    THEMES.forEach(t => {
      const th = document.createElement('th');
      th.textContent = t.name;
      headerRow.appendChild(th);
    });

    // 바디
    const tbody = table.createTBody();
    GRADES.forEach(grade => {
      const tr = tbody.insertRow();
      const gradeCell = tr.insertCell();
      gradeCell.className = 'grade-cell';
      gradeCell.textContent = `${grade}학년`;

      THEMES.forEach(theme => {
        const td = tr.insertCell();
        td.className = 'uoi-cell';
        td.style.background = Utils.themeColor(theme.id);

        // 드롭 가능 여부 마커
        td.dataset.grade = grade;
        td.dataset.theme = theme.id;

        const key = `${grade}_${theme.id}`;
        const cellUnits = index[key] || [];

        if (cellUnits.length > 0) {
          cellUnits.forEach(u => {
            const mini = _buildMiniCard(u);
            mini.addEventListener('click', _handleCardClick);
            td.appendChild(mini);
          });
        } else {
          td.classList.add('empty');
        }

        // 빈 셀이어도 + 버튼은 항상 가능
        if (canEdit) {
          const addBtn = document.createElement('button');
          addBtn.className = 'add-uoi-btn';
          addBtn.innerHTML = `<span>+</span> 새 UOI`;
          addBtn.addEventListener('click', () => _onCellClick && _onCellClick({ grade, theme_id: theme.id, _new: true }));
          td.appendChild(addBtn);
        }
      });
    });

    container.innerHTML = '';
    container.appendChild(table);

    if (dragEnabled) _initSortables(table);
  }

  function _handleCardClick(e) {
    // 드래그 직후 click 이벤트 억제 (SortableJS가 'sortable-fallback'으로 mousedown→drag→drop 처리)
    if (e.currentTarget.dataset.justDragged === '1') {
      e.currentTarget.dataset.justDragged = '';
      return;
    }
    const id = e.currentTarget.dataset.unitId;
    if (!id || !_onCellClick) return;
    const u = e.currentTarget._unit;
    if (u) _onCellClick(u);
  }

  function _buildMiniCard(u) {
    const concepts = Utils.parseJSON(u.key_concepts, []);
    const div = document.createElement('div');
    div.className = 'uoi-card-mini';
    div.style.background = Utils.themeColor(u.theme_id);

    // 메타데이터 (드래그·권한·낙관적 락)
    div.dataset.unitId = u.unit_id || '';
    div.dataset.version = u.version != null ? String(u.version) : '0';
    div.dataset.locked = (u.locked === true || u.status === 'finalized' || u.status === 'archived' || u.status === 'approved') ? '1' : '0';
    div.dataset.owner = u.owner_email || '';
    div.dataset.status = u.status || 'draft';
    div._unit = u; // 클릭 시 onCellClick으로 그대로 전달

    const isLocked = div.dataset.locked === '1';
    const canDrag = !isLocked && _canDragUnit(u);
    if (!canDrag) div.classList.add('uoi-no-drag');
    if (isLocked) div.classList.add('uoi-locked');

    const lockBadge = isLocked ? `<span class="uoi-lock" title="${_lockReason(u)}">🔒</span>` : '';

    div.innerHTML = `
      ${lockBadge}
      <div class="uoi-title">${_esc(u.title || u.central_idea || '(제목 없음)')}</div>
      <div class="uoi-ci">${_esc(u.central_idea || '')}</div>
      <div class="uoi-footer">
        <span class="badge ${Utils.statusClass(u.status)}">${Utils.statusLabel(u.status)}</span>
        <span style="font-size:.7rem;color:var(--text-secondary)">${concepts.length ? concepts.slice(0,2).join(' · ') : ''}</span>
      </div>`;
    return div;
  }

  function _canDragUnit(u) {
    if (_userRole === 'admin') return true;
    if (_userRole !== 'editor') return false;
    if (!_myEmail) return false;
    return u.owner_email === _myEmail;
  }

  function _lockReason(u) {
    if (u.locked === true) return '확정 잠금';
    if (u.status === 'finalized') return '확정됨 — 잠금 해제 후 이동 가능';
    if (u.status === 'archived') return '아카이브됨';
    if (u.status === 'approved') return '승인됨 — draft로 되돌린 후 이동 가능';
    return '이동 불가';
  }

  function _initSortables(table) {
    const cells = table.querySelectorAll('.uoi-cell');
    cells.forEach(td => {
      const s = Sortable.create(td, {
        group: 'poi-units',
        animation: 160,
        ghostClass: 'uoi-ghost',
        chosenClass: 'uoi-chosen',
        dragClass: 'uoi-dragging',
        filter: '.uoi-no-drag, .add-uoi-btn',
        preventOnFilter: false,
        draggable: '.uoi-card-mini',
        onStart: _onDragStart,
        onEnd: _onDragEnd,
      });
      _sortableInstances.push(s);
    });
  }

  function _destroySortables() {
    _sortableInstances.forEach(s => { try { s.destroy(); } catch(_){} });
    _sortableInstances = [];
  }

  function _onDragStart(evt) {
    document.body.classList.add('matrix-dragging');
    // 클릭 이벤트와 충돌 방지 마커
    if (evt.item) evt.item.dataset.justDragged = '1';
  }

  async function _onDragEnd(evt) {
    document.body.classList.remove('matrix-dragging');

    const item = evt.item;
    const fromCell = evt.from;
    const toCell = evt.to;
    const unitId = item.dataset.unitId;
    const expectedVersion = parseInt(item.dataset.version) || 1;

    if (!unitId) return;

    const fromGrade = parseInt(fromCell.dataset.grade);
    const fromTheme = fromCell.dataset.theme;
    const toGrade = parseInt(toCell.dataset.grade);
    const toTheme = toCell.dataset.theme;

    // 새 셀 내 순서 (DOM 인덱스 기준, .add-uoi-btn 제외)
    const siblings = Array.from(toCell.querySelectorAll('.uoi-card-mini'));
    const newOrder = siblings.indexOf(item);

    const sameCell = (fromGrade === toGrade && fromTheme === toTheme);

    // 같은 셀 내 순서만 변경된 경우도 서버에 알려서 display_order 정규화
    if (sameCell && evt.oldIndex === evt.newIndex) {
      // 변동 없음 — 서버 호출 생략
      return;
    }

    try {
      const result = await API.post('moveUnit', {
        unit_id: unitId,
        new_grade: toGrade,
        new_theme_id: toTheme,
        new_order: newOrder,
        expected_version: expectedVersion,
      });

      // 메타데이터 갱신
      item.dataset.version = String(result.version);
      if (item._unit) {
        item._unit.grade = toGrade;
        item._unit.theme_id = toTheme;
        item._unit.version = result.version;
        item._unit.display_order = newOrder;
      }

      _showSuccessToast(sameCell, fromGrade, fromTheme, toGrade, toTheme);
      _showWarnings(result.warnings || []);

      // 데이터 동기화를 위해 외부 reload 콜백 트리거 (선택)
      if (_onReload) _onReload();

    } catch (e) {
      // 서버 거부 — 원위치 롤백
      _showErrorToast(e);
      if (_onReload) {
        _onReload();
      } else {
        // 폴백: DOM만 되돌리기
        if (fromCell !== toCell) fromCell.appendChild(item);
        else fromCell.insertBefore(item, fromCell.children[evt.oldIndex] || null);
      }
    }
  }

  function _showSuccessToast(sameCell, fg, ft, tg, tt) {
    if (typeof Utils === 'undefined' || !Utils.toast) return;
    if (sameCell) {
      Utils.toast('순서를 저장했어요', 'success');
    } else {
      const themeName = THEMES.find(x => x.id === tt)?.name || tt;
      Utils.toast(`이동 완료: ${tg}학년 · ${themeName}`, 'success');
    }
  }

  function _showWarnings(warnings) {
    if (typeof Utils === 'undefined' || !Utils.toast) return;
    warnings.forEach(w => {
      const icon = w.severity === 'warning' ? '⚠️ ' : 'ℹ️ ';
      Utils.toast(icon + w.message, 'warning');
    });
  }

  function _showErrorToast(e) {
    if (typeof Utils === 'undefined' || !Utils.toast) return;
    if (e.code === 'CONFLICT') {
      Utils.toast('다른 사용자가 먼저 수정했어요. 새로 불러옵니다.', 'error');
    } else if (e.code === 'LOCKED') {
      Utils.toast(`이동 불가: ${e.message}`, 'error');
    } else if (e.code === 'FORBIDDEN') {
      Utils.toast('본인 소유 단원만 이동할 수 있어요', 'error');
    } else {
      Utils.toast('이동 실패: ' + (e.message || ''), 'error');
    }
  }

  function _esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { render };
})();
