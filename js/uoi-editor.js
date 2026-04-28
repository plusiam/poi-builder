// UOI 편집 폼

const UOIEditor = (() => {
  let _unit = null;
  let _constants = null;
  let _role = 'viewer';
  let _onSave = null;
  let _version = 1;
  let _isDirty = false;

  function open(unit, constants, role, onSave) {
    _unit = unit;
    _constants = constants;
    _role = role;
    _onSave = onSave;
    _version = unit.version || 1;
    _isDirty = false;

    document.getElementById('editor-modal').classList.add('show');
    _render();

    // 팀 피드백 모듈 초기화 (신규 UOI 제외)
    if (typeof Comments !== 'undefined') {
      Comments.init(unit._new ? null : unit.unit_id);
      if (!unit._new && unit.unit_id) Comments.load();
    }
  }

  function close() {
    if (_isDirty && !confirm('저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?')) return;
    document.getElementById('editor-modal').classList.remove('show');
    _isDirty = false;

    // 팀 피드백 탭 초기화
    const tabBtn = document.getElementById('tab-btn-feedback');
    if (tabBtn) {
      tabBtn.textContent = '💬 팀 피드백';
      tabBtn.classList.remove('tab-badge-active');
    }
    const thread = document.getElementById('feedback-thread');
    if (thread) thread.innerHTML = '';
    const empty = document.getElementById('feedback-empty');
    if (empty) empty.style.display = 'block';
    const fbBody = document.getElementById('fb-body');
    if (fbBody) fbBody.value = '';
  }

  function _render() {
    const isNew = !!_unit._new;
    const canEdit = ['editor', 'admin'].includes(_role) && (_unit.locked !== true) && (_unit.status !== 'finalized');

    document.getElementById('editor-title').textContent = isNew ? '새 UOI 만들기' : 'UOI 편집';

    // 기본 정보
    _setVal('ed-grade', _unit.grade || 1);
    _setVal('ed-theme', _unit.theme_id || 'who_we_are');
    _setVal('ed-unit-title', _unit.title || '');
    _setVal('ed-central-idea', _unit.central_idea || '');

    // Lines of Inquiry
    _renderLOI(Utils.parseJSON(_unit.lines_of_inquiry, ['', '', '']));

    // Key Concepts 체크박스
    _renderKeyConcepts(Utils.parseJSON(_unit.key_concepts, []));

    // Learner Profile 체크박스
    _renderLearnerProfile(Utils.parseJSON(_unit.learner_profile, []));

    // 기타
    _setVal('ed-action', _unit.action || '');
    _setVal('ed-duration', _unit.duration_weeks || '');
    _setVal('ed-notes', _unit.notes || '');

    // 상태 표시
    const statusEl = document.getElementById('ed-status');
    if (statusEl) {
      statusEl.className = `badge ${Utils.statusClass(_unit.status || 'draft')}`;
      statusEl.textContent = Utils.statusLabel(_unit.status || 'draft');
    }

    // 편집 가능 여부
    document.querySelectorAll('#editor-modal input, #editor-modal textarea, #editor-modal select').forEach(el => {
      el.disabled = !canEdit;
    });

    // 버튼 표시
    _renderActions(isNew, canEdit);

    // 변경 감지
    document.getElementById('editor-form').addEventListener('input', () => { _isDirty = true; });

    // 첫 탭 활성화
    switchTab('tab-basic');
  }

  function _renderLOI(lines) {
    const container = document.getElementById('loi-list');
    container.innerHTML = '';
    lines.forEach((line, i) => {
      const row = document.createElement('div');
      row.className = 'loi-item';
      row.innerHTML = `
        <span style="font-size:.8rem;color:var(--text-secondary);width:20px;flex-shrink:0">${i + 1}</span>
        <input type="text" class="loi-input" value="${_esc(line)}" placeholder="탐구 질문 또는 탐구 진술 ${i + 1}" maxlength="150">
        <button type="button" class="remove-btn" onclick="UOIEditor.removeLOI(${i})" ${lines.length <= 3 ? 'disabled' : ''}>×</button>`;
      container.appendChild(row);
    });

    // 팀 피드백 anchor 셀렉트도 LOI 개수에 맞춰 갱신
    if (typeof Comments !== 'undefined' && Comments.syncAnchorOptions) {
      Comments.syncAnchorOptions(lines.length);
    }
  }

  function _renderKeyConcepts(selected) {
    const container = document.getElementById('key-concepts-grid');
    container.innerHTML = '';
    const concepts = (_constants?.keyConcepts) || [];
    concepts.forEach(c => {
      const isSelected = selected.includes(c.id);
      const div = document.createElement('div');
      div.className = `checkbox-item${isSelected ? ' selected' : ''}`;
      div.innerHTML = `
        <input type="checkbox" id="kc-${c.id}" value="${c.id}" ${isSelected ? 'checked' : ''}>
        <label for="kc-${c.id}" style="cursor:pointer">
          <div class="label-main">${c.name_ko}</div>
          <div class="label-sub">${c.key_question_ko}</div>
        </label>`;
      div.querySelector('input').addEventListener('change', (e) => {
        div.classList.toggle('selected', e.target.checked);
        _validateKeyConcepts();
        _isDirty = true;
      });
      container.appendChild(div);
    });
  }

  function _renderLearnerProfile(selected) {
    const container = document.getElementById('learner-profile-grid');
    container.innerHTML = '';
    const profiles = (_constants?.learnerProfile) || [];
    profiles.forEach(p => {
      const isSelected = selected.includes(p.id);
      const div = document.createElement('div');
      div.className = `checkbox-item${isSelected ? ' selected' : ''}`;
      div.innerHTML = `
        <input type="checkbox" id="lp-${p.id}" value="${p.id}" ${isSelected ? 'checked' : ''}>
        <label for="lp-${p.id}" style="cursor:pointer">
          <div class="label-main">${p.name_ko}</div>
          <div class="label-sub">${p.name_en}</div>
        </label>`;
      div.querySelector('input').addEventListener('change', (e) => {
        div.classList.toggle('selected', e.target.checked);
        _isDirty = true;
      });
      container.appendChild(div);
    });
  }

  function _renderActions(isNew, canEdit) {
    const container = document.getElementById('editor-action-btns');
    container.innerHTML = '';

    if (!canEdit) {
      container.innerHTML = '<span style="color:var(--text-secondary);font-size:.875rem">읽기 전용</span>';
      return;
    }

    const saveBtn = `<button class="btn btn-primary" onclick="UOIEditor.save()">${isNew ? 'UOI 생성' : '임시 저장'}</button>`;
    const submitBtn = !isNew && _unit.status === 'draft'
      ? `<button class="btn btn-outline" onclick="UOIEditor.submitReview()">검토 요청</button>` : '';

    // 휴지통 버튼 — 신규/확정/아카이브가 아닌 경우만 노출 (v3.3)
    const trashable = !isNew && _unit.unit_id
      && _unit.status !== 'finalized' && _unit.status !== 'archived' && _unit.locked !== true;
    const trashBtn = trashable
      ? `<button class="btn btn-ghost btn-trash" onclick="UOIEditor.trash()" title="휴지통으로 이동">🗑️ 삭제</button>`
      : '';

    container.innerHTML = trashBtn + saveBtn + submitBtn;
  }

  async function trash() {
    if (!_unit || !_unit.unit_id) return;
    const title = _unit.title || _unit.central_idea || '(제목 없음)';
    if (!confirm(`이 단원을 휴지통으로 이동할까요?\n\n${title}\n\n관리자 페이지의 휴지통에서 30일 안에 복원하거나 영구 삭제할 수 있습니다.`)) return;

    const trashBtnEl = document.querySelector('#editor-action-btns .btn-trash');
    if (trashBtnEl) Utils.setLoading(trashBtnEl, true);

    try {
      await API.post('deleteUnit', { unit_id: _unit.unit_id });
      Utils.toast('휴지통으로 이동했습니다', 'success');
      _unit.deleted = true;
      _isDirty = false;
      if (_onSave) _onSave({ ..._unit, deleted: true });
      // 모달 닫기 (강제 — _isDirty=false라 confirm 안 뜸)
      document.getElementById('editor-modal').classList.remove('show');
    } catch (e) {
      if (e.code === 'LOCKED') Utils.toast('이 단원은 삭제할 수 없습니다: ' + e.message, 'error');
      else if (e.code === 'FORBIDDEN') Utils.toast('본인 소유 단원만 삭제할 수 있어요', 'error');
      else Utils.toast('삭제 실패: ' + e.message, 'error');
    } finally {
      if (trashBtnEl) Utils.setLoading(trashBtnEl, false);
    }
  }

  function _validateKeyConcepts() {
    const checked = document.querySelectorAll('#key-concepts-grid input:checked');
    const errEl = document.getElementById('kc-error');
    if (checked.length > 3) {
      if (errEl) { errEl.textContent = 'Key Concept은 최대 3개입니다'; errEl.classList.add('show'); }
      return false;
    }
    if (errEl) errEl.classList.remove('show');
    return true;
  }

  function _collectFormData() {
    const loiInputs = document.querySelectorAll('.loi-input');
    const loiArr = Array.from(loiInputs).map(el => el.value.trim()).filter(Boolean);
    const keyConcepts = Array.from(document.querySelectorAll('#key-concepts-grid input:checked')).map(el => el.value);
    const learnerProfile = Array.from(document.querySelectorAll('#learner-profile-grid input:checked')).map(el => el.value);

    return {
      grade: parseInt(document.getElementById('ed-grade')?.value),
      theme_id: document.getElementById('ed-theme')?.value,
      title: document.getElementById('ed-unit-title')?.value?.trim(),
      central_idea: document.getElementById('ed-central-idea')?.value?.trim(),
      lines_of_inquiry: loiArr,
      key_concepts: keyConcepts,
      learner_profile: learnerProfile,
      action: document.getElementById('ed-action')?.value?.trim(),
      duration_weeks: parseInt(document.getElementById('ed-duration')?.value) || null,
      notes: document.getElementById('ed-notes')?.value?.trim(),
    };
  }

  async function save() {
    const data = _collectFormData();

    // 검증
    const ciResult = Validators.centralIdea(data.central_idea);
    Validators.show('ed-central-idea', ciResult);
    if (!ciResult.ok && !ciResult.warn) { switchTab('tab-basic'); Utils.toast('Central Idea를 확인해주세요', 'warning'); return; }

    if (!_validateKeyConcepts()) { switchTab('tab-concepts'); return; }

    const saveBtn = document.querySelector('#editor-action-btns .btn-primary');
    if (saveBtn) Utils.setLoading(saveBtn, true);

    try {
      let result;
      if (_unit._new) {
        result = await API.post('createUnit', data);
        _unit._new = false;
        _unit.unit_id = result.unit_id;
      } else {
        result = await API.post('updateUnit', { unit_id: _unit.unit_id, expected_version: _version, ...data });
      }
      _version = result.version;
      _isDirty = false;
      Utils.toast('저장됐습니다', 'success');

      // 신규 단원 첫 저장 후 댓글 모듈에 unit_id 바인딩 + 로드
      if (typeof Comments !== 'undefined' && _unit.unit_id) {
        Comments.init(_unit.unit_id);
        Comments.load();
      }

      if (_onSave) _onSave({ ..._unit, ...data, version: _version });
    } catch (e) {
      if (e.code === 'CONFLICT') {
        document.getElementById('conflict-banner').classList.add('show');
      } else {
        Utils.toast('저장 실패: ' + e.message, 'error');
      }
    } finally {
      if (saveBtn) Utils.setLoading(saveBtn, false);
    }
  }

  async function submitReview() {
    if (!confirm('검토를 요청하시겠습니까? 요청 후에는 수정이 제한됩니다.')) return;
    try {
      await API.post('submitReview', { unit_id: _unit.unit_id });
      Utils.toast('검토 요청이 완료됐습니다', 'success');
      _unit.status = 'in_review';
      if (_onSave) _onSave({ ..._unit, status: 'in_review' });
      close();
    } catch (e) {
      Utils.toast('요청 실패: ' + e.message, 'error');
    }
  }

  function addLOI() {
    const inputs = document.querySelectorAll('.loi-input');
    if (inputs.length >= 4) { Utils.toast('탐구 질문은 최대 4개입니다', 'warning'); return; }
    const currentLines = Array.from(inputs).map(el => el.value);
    currentLines.push('');
    _renderLOI(currentLines);
    _isDirty = true;
  }

  function removeLOI(idx) {
    const inputs = document.querySelectorAll('.loi-input');
    if (inputs.length <= 3) { Utils.toast('탐구 질문은 최소 3개입니다', 'warning'); return; }
    const lines = Array.from(inputs).map(el => el.value);
    lines.splice(idx, 1);
    _renderLOI(lines);
    _isDirty = true;
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  }

  function _esc(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  return { open, close, save, submitReview, addLOI, removeLOI, trash };
})();

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tabId));
}
