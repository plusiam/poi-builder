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

    // 피드백 로드 (신규 UOI 제외)
    if (!unit._new && unit.unit_id) {
      _loadFeedback(unit.unit_id);
    }
  }

  async function _loadFeedback(unitId) {
    const tabBtn = document.getElementById('tab-btn-feedback');
    try {
      const data = await API.get('changelog', { unitId });
      const comments = (Array.isArray(data) ? data : [])
        .filter(c => c.action === 'comment');
      _renderFeedback(comments);
      if (comments.length > 0 && tabBtn) {
        tabBtn.textContent = `수석교사 피드백 (${comments.length})`;
        tabBtn.style.fontWeight = '700';
        tabBtn.style.color = 'var(--primary)';
      }
    } catch (_) {
      // 피드백 로드 실패는 조용히 무시
    }
  }

  function _renderFeedback(comments) {
    const thread = document.getElementById('feedback-thread');
    const empty  = document.getElementById('feedback-empty');
    if (!thread) return;

    if (comments.length === 0) {
      if (empty) empty.style.display = 'block';
      thread.innerHTML = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    thread.innerHTML = comments.map(c => {
      const actor = c.actor_email?.split('@')[0] || '수석교사';
      const time  = _formatTime(c.timestamp);
      const body  = c.after_value || c.diff_summary || '';
      return `
        <div class="teacher-comment-item">
          <div class="tci-meta">
            <span class="tci-actor">📋 ${actor}</span>
            <span class="tci-time">${time}</span>
          </div>
          <div class="tci-body">${_esc(body)}</div>
        </div>`;
    }).join('');
  }

  function _formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function close() {
    if (_isDirty && !confirm('저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?')) return;
    document.getElementById('editor-modal').classList.remove('show');
    _isDirty = false;
    // 피드백 탭 초기화
    const tabBtn = document.getElementById('tab-btn-feedback');
    if (tabBtn) { tabBtn.textContent = '수석교사 피드백'; tabBtn.style.fontWeight = ''; tabBtn.style.color = ''; }
    const thread = document.getElementById('feedback-thread');
    if (thread) thread.innerHTML = '';
    const empty = document.getElementById('feedback-empty');
    if (empty) empty.style.display = 'block';
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

    container.innerHTML = saveBtn + submitBtn;
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

  return { open, close, save, submitReview, addLOI, removeLOI };
})();

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tabId));
}
