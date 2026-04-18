// UOI CRUD · 상수 조회 · 메타 조회

// ── 메타 ───────────────────────────────────────────────────

function getMeta() {
  requireRole_(arguments[1] || _callerEmail_(), 'viewer');
  const sheet = getSheet_('POI_Meta');
  const [headers, ...rows] = sheet.getDataRange().getValues();
  const map = {};
  headers.forEach((h, i) => { map[h] = i; });
  return rows.map(r => rowToObj_(r, map));
}

// ── 상수 ───────────────────────────────────────────────────

function getConstants() {
  return {
    themes: sheetToArray_('Constants_Themes'),
    keyConcepts: sheetToArray_('Constants_KeyConcepts'),
    learnerProfile: sheetToArray_('Constants_LearnerProfile'),
    atl: sheetToArray_('Constants_ATL'),
  };
}

// ── UOI 목록 · 상세 ────────────────────────────────────────

function getUnits(params, email) {
  requireRole_(email, 'viewer');
  return sheetToArray_('Units');
}

function getUnit(unitId, email) {
  requireRole_(email, 'viewer');
  return findUnit_(unitId);
}

// ── UOI 생성 ───────────────────────────────────────────────

function createUnit(params, email) {
  requireRole_(email, 'editor');
  validateUnit_(params);

  const sheet = getSheet_('Units');
  const map = headerMap_(sheet);
  const id = uuid_();
  const ts = now_();
  const row = buildRow_(map, {
    unit_id: id,
    grade: params.grade,
    theme_id: params.theme_id,
    title: params.title || '',
    central_idea: params.central_idea || '',
    lines_of_inquiry: JSON.stringify(params.lines_of_inquiry || []),
    key_concepts: JSON.stringify(params.key_concepts || []),
    related_concepts: JSON.stringify(params.related_concepts || []),
    learner_profile: JSON.stringify(params.learner_profile || []),
    atl_skills: JSON.stringify(params.atl_skills || {}),
    action: params.action || '',
    subject_links: JSON.stringify(params.subject_links || []),
    duration_weeks: params.duration_weeks || '',
    notes: params.notes || '',
    status: 'draft',
    owner_email: email,
    created_at: ts,
    updated_at: ts,
    updated_by: email,
    version: 1,
    locked: false,
  });
  sheet.appendRow(row);

  appendChangelog_({ unit_id: id, actor_email: email, action: 'create',
    field: '*', before_value: '', after_value: JSON.stringify(params), diff_summary: 'UOI 생성' });

  return { unit_id: id, version: 1 };
}

// ── UOI 수정 (낙관적 락) ───────────────────────────────────

function updateUnit(params, email) {
  const role = requireRole_(email, 'editor');
  const { unit_id, expected_version, ...fields } = params;

  const { sheet, rowIdx, data, map } = findUnitRow_(unit_id);

  if (data[map.locked] === true) throw appError_('LOCKED', '확정된 UOI는 수정할 수 없습니다');
  if (data[map.status] === 'finalized') throw appError_('LOCKED', '확정된 UOI는 수정할 수 없습니다');

  // 학년 제한 (admin 제외)
  if (role !== 'admin' && data[map.owner_email] !== email) {
    throw appError_('FORBIDDEN', '본인 학년의 UOI만 수정할 수 있습니다');
  }

  // 낙관적 락
  if (data[map.version] !== expected_version) {
    throw appError_('CONFLICT', '다른 사용자가 먼저 저장했습니다. 최신본을 다시 불러오세요.');
  }

  validateUnit_(fields);

  const newVersion = expected_version + 1;
  const ts = now_();
  const updates = {
    ...fields,
    updated_at: ts,
    updated_by: email,
    version: newVersion,
  };

  Object.entries(updates).forEach(([k, v]) => {
    if (map[k] !== undefined) {
      const val = typeof v === 'object' ? JSON.stringify(v) : v;
      sheet.getRange(rowIdx, map[k] + 1).setValue(val);
    }
  });

  appendChangelog_({ unit_id, actor_email: email, action: 'update',
    field: Object.keys(fields).join(','), before_value: '', after_value: JSON.stringify(fields),
    diff_summary: `필드 수정: ${Object.keys(fields).join(', ')}` });

  return { unit_id, version: newVersion };
}

// ── 내부 헬퍼 ─────────────────────────────────────────────

function sheetToArray_(name) {
  const sheet = getSheet_(name);
  const [headers, ...rows] = sheet.getDataRange().getValues();
  const map = {};
  headers.forEach((h, i) => { map[h] = i; });
  return rows.map(r => rowToObj_(r, map));
}

function findUnit_(unit_id) {
  const { data, map } = findUnitRow_(unit_id);
  return rowToObj_(data, map);
}

function findUnitRow_(unit_id) {
  const sheet = getSheet_('Units');
  const map = headerMap_(sheet);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][map.unit_id] === unit_id) {
      return { sheet, rowIdx: i + 1, data: rows[i], map };
    }
  }
  throw appError_('NOT_FOUND', `UOI를 찾을 수 없습니다: ${unit_id}`);
}

function buildRow_(map, obj) {
  const row = new Array(Object.keys(map).length).fill('');
  Object.entries(obj).forEach(([k, v]) => {
    if (map[k] !== undefined) row[map[k]] = v;
  });
  return row;
}

function validateUnit_(fields) {
  if (fields.central_idea !== undefined) {
    const ci = fields.central_idea;
    if (ci.length < 10 || ci.length > 200) throw appError_('VALIDATION', 'Central Idea는 10~200자여야 합니다');
  }
  if (fields.key_concepts !== undefined) {
    if (fields.key_concepts.length > 3) throw appError_('VALIDATION', 'Key Concepts는 최대 3개입니다');
  }
  if (fields.grade !== undefined) {
    if (fields.grade < 1 || fields.grade > 6) throw appError_('VALIDATION', '학년은 1~6이어야 합니다');
  }
}
