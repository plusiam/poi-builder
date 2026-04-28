// UOI CRUD · 상수 조회 · 메타 조회

// ── 메타 ───────────────────────────────────────────────────

function getMeta(params, email) {
  requireRole_(email, 'viewer');
  const sheet = getSheet_('POI_Meta');
  const [headers, ...rows] = sheet.getDataRange().getValues();
  const map = {};
  headers.forEach((h, i) => { map[h] = i; });
  return rows.map(r => rowToObj_(r, map));
}

// ── 상수 ───────────────────────────────────────────────────

function getConstants(params, email) {
  requireRole_(email, 'viewer');
  return {
    themes: sheetToArray_('Constants_Themes'),
    keyConcepts: sheetToArray_('Constants_KeyConcepts'),
    learnerProfile: sheetToArray_('Constants_LearnerProfile'),
    atl: sheetToArray_('Constants_ATL'),
  };
}

// ── UOI 목록 · 상세 ────────────────────────────────────────
// 기본 조회는 deleted=true 행을 제외한다 (v3.3, 휴지통)

function getUnits(params, email) {
  requireRole_(email, 'viewer');
  return sheetToArray_('Units').filter(u => u.deleted !== true);
}

function getUnit(unitId, email) {
  requireRole_(email, 'viewer');
  return findUnit_(unitId);
}

function getDashboard(params, email) {
  requireRole_(email, 'admin');
  const units = sheetToArray_('Units').filter(u => u.deleted !== true);
  const total = units.length;
  const byStatus = units.reduce((acc, u) => { acc[u.status] = (acc[u.status] || 0) + 1; return acc; }, {});
  return { total, byStatus, units };
}

function getSnapshots(params, email) {
  requireRole_(email, 'admin');
  return sheetToArray_('Snapshots');
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

  if (data[map.deleted] === true) throw appError_('LOCKED', '휴지통에 있는 단원은 수정할 수 없습니다. 먼저 복원하세요.');
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

// ── UOI 휴지통 / 영구삭제 (v3.3, Phase 4 후속) ────────────
//
// 정책:
//   소프트 삭제 (deleteUnit)
//     - 권한: editor 이상 + (소유자 또는 admin)
//     - 상태 제한: finalized/archived/locked 단원은 거부 (먼저 unlock 필요)
//     - 동작: deleted=true, deleted_at=now, deleted_by=email
//             버전(version)도 +1 해서 낙관적 락 흐름 유지
//
//   복원 (restoreUnit)
//     - 권한: 소유자 또는 admin
//     - 동작: deleted=false, deleted_at='', deleted_by=''
//
//   영구 삭제 (purgeUnit)
//     - 권한: admin 전용
//     - 사전 조건: deleted=true 인 단원만 가능 (먼저 휴지통으로 이동되어야 함)
//     - 동작: Units 행 삭제 + 해당 unit_id 코멘트 모두 deleted=true 마킹
//             스냅샷은 그대로 보존 (감사 추적)
//
//   휴지통 조회 (getTrash)
//     - 권한: viewer 이상 (admin은 전체, 일반은 본인 것만)

function deleteUnit(params, email) {
  const role = requireRole_(email, 'editor');
  if (!params.unit_id) throw appError_('VALIDATION', 'unit_id가 필요합니다');

  const { sheet, rowIdx, data, map } = findUnitRow_(params.unit_id);

  if (data[map.deleted] === true) {
    return { unit_id: params.unit_id, deleted: true, already: true };
  }
  if (data[map.locked] === true) throw appError_('LOCKED', '확정 잠금된 단원은 삭제할 수 없습니다. 먼저 잠금 해제하세요.');
  const status = data[map.status];
  if (status === 'finalized' || status === 'archived') {
    throw appError_('LOCKED', `'${status}' 상태의 단원은 삭제할 수 없습니다.`);
  }
  if (role !== 'admin' && data[map.owner_email] !== email) {
    throw appError_('FORBIDDEN', '본인 소유 단원만 삭제할 수 있습니다');
  }

  const ts = now_();
  sheet.getRange(rowIdx, map.deleted + 1).setValue(true);
  sheet.getRange(rowIdx, map.deleted_at + 1).setValue(ts);
  sheet.getRange(rowIdx, map.deleted_by + 1).setValue(email);
  sheet.getRange(rowIdx, map.updated_at + 1).setValue(ts);
  sheet.getRange(rowIdx, map.updated_by + 1).setValue(email);
  if (map.version !== undefined) {
    const v = parseInt(data[map.version]) || 1;
    sheet.getRange(rowIdx, map.version + 1).setValue(v + 1);
  }

  appendChangelog_({
    unit_id: params.unit_id,
    actor_email: email,
    action: 'delete',
    field: 'deleted',
    before_value: 'false',
    after_value: 'true',
    diff_summary: '휴지통으로 이동',
  });

  return { unit_id: params.unit_id, deleted: true };
}

function restoreUnit(params, email) {
  const role = requireRole_(email, 'editor');
  if (!params.unit_id) throw appError_('VALIDATION', 'unit_id가 필요합니다');

  const { sheet, rowIdx, data, map } = findUnitRow_(params.unit_id);

  if (data[map.deleted] !== true) {
    return { unit_id: params.unit_id, deleted: false, already: true };
  }
  if (role !== 'admin' && data[map.owner_email] !== email) {
    throw appError_('FORBIDDEN', '본인 소유 단원만 복원할 수 있습니다');
  }

  const ts = now_();
  sheet.getRange(rowIdx, map.deleted + 1).setValue(false);
  sheet.getRange(rowIdx, map.deleted_at + 1).setValue('');
  sheet.getRange(rowIdx, map.deleted_by + 1).setValue('');
  sheet.getRange(rowIdx, map.updated_at + 1).setValue(ts);
  sheet.getRange(rowIdx, map.updated_by + 1).setValue(email);

  appendChangelog_({
    unit_id: params.unit_id,
    actor_email: email,
    action: 'restore',
    field: 'deleted',
    before_value: 'true',
    after_value: 'false',
    diff_summary: '휴지통에서 복원',
  });

  return { unit_id: params.unit_id, deleted: false };
}

function purgeUnit(params, email) {
  requireRole_(email, 'admin');
  if (!params.unit_id) throw appError_('VALIDATION', 'unit_id가 필요합니다');

  const { sheet, rowIdx, data, map } = findUnitRow_(params.unit_id);

  // 영구 삭제는 휴지통(deleted=true)에서만 가능
  if (data[map.deleted] !== true) {
    throw appError_('VALIDATION', '먼저 휴지통으로 이동(소프트 삭제)한 단원만 영구 삭제할 수 있습니다');
  }

  const unitSnapshot = {
    unit_id: data[map.unit_id],
    grade: data[map.grade],
    theme_id: data[map.theme_id],
    title: data[map.title],
    status: data[map.status],
  };

  // 1) 관련 코멘트 소프트 삭제 마킹 (감사 추적 유지, 행은 삭제하지 않음)
  try {
    const cSheet = getSheet_('Comments');
    const cMap = headerMap_(cSheet);
    const cData = cSheet.getDataRange().getValues();
    let cleared = 0;
    for (let i = 1; i < cData.length; i++) {
      if (cData[i][cMap.unit_id] === params.unit_id && cData[i][cMap.deleted] !== true) {
        cSheet.getRange(i + 1, cMap.deleted + 1).setValue(true);
        cSheet.getRange(i + 1, cMap.updated_at + 1).setValue(now_());
        cleared++;
      }
    }
    Logger.log(`purgeUnit: ${cleared} comments marked deleted for ${params.unit_id}`);
  } catch (e) {
    Logger.log(`purgeUnit comment cleanup error: ${e.message}`);
  }

  // 2) Changelog 기록 (Units 행 삭제 전에)
  appendChangelog_({
    unit_id: params.unit_id,
    actor_email: email,
    action: 'purge',
    field: '*',
    before_value: JSON.stringify(unitSnapshot),
    after_value: '',
    diff_summary: `영구 삭제: ${unitSnapshot.grade}학년 / ${unitSnapshot.theme_id} / ${unitSnapshot.title || '(제목 없음)'}`,
  });

  // 3) Units 행 영구 삭제
  sheet.deleteRow(rowIdx);

  return { unit_id: params.unit_id, purged: true, removed_unit: unitSnapshot };
}

function getTrash(params, email) {
  const role = requireRole_(email, 'viewer');
  const all = sheetToArray_('Units').filter(u => u.deleted === true);

  // admin은 전체, 그 외는 본인 소유만
  const visible = role === 'admin' ? all : all.filter(u => u.owner_email === email);

  return visible.sort((a, b) =>
    String(b.deleted_at || '').localeCompare(String(a.deleted_at || ''))
  );
}

// ── UOI 드래그 이동 (Phase 2-B, v3.2) ─────────────────────
//
// 5중 검증:
//   1. 권한      — editor 이상 + 본인 소유 또는 admin
//   2. 잠금      — locked=false, status ∈ {draft, in_review} 만 허용
//   3. 낙관적 락 — expected_version 일치
//   4. TDT 균형  — 같은 학년에 동일 theme_id가 2개 이상이면 ⚠️ (warning)
//   5. 학년군 정합성 — subject_links 코드의 grade_group이 새 학년과 불일치 시 ⚠️ (warning)
//
// 균형/학년군 위반은 차단(에러)이 아닌 경고로 반환하여 UI에서 사용자에게 알린다.
// 차단 정책은 학교별로 다르므로, 우선 경고 모드로 둔다.
//
// 입력: { unit_id, new_grade, new_theme_id, new_order, expected_version }
// 반환: { unit_id, version, warnings: [{type, message, ...}] }

function moveUnit(params, email) {
  const role = requireRole_(email, 'editor');
  if (!params.unit_id) throw appError_('VALIDATION', 'unit_id가 필요합니다');
  if (params.expected_version === undefined) throw appError_('VALIDATION', 'expected_version이 필요합니다');

  const newGrade = parseInt(params.new_grade);
  const newTheme = String(params.new_theme_id || '');
  const newOrder = Number.isFinite(parseInt(params.new_order)) ? parseInt(params.new_order) : 0;

  if (!(newGrade >= 1 && newGrade <= 6)) throw appError_('VALIDATION', '학년은 1~6이어야 합니다');
  if (!VALID_THEMES_.includes(newTheme)) throw appError_('VALIDATION', `허용되지 않은 theme_id: ${newTheme}`);

  const { sheet, rowIdx, data, map } = findUnitRow_(params.unit_id);

  // (1) 권한
  if (role !== 'admin' && data[map.owner_email] !== email) {
    throw appError_('FORBIDDEN', '본인 소유 단원만 이동할 수 있습니다');
  }

  // (2) 잠금/상태
  if (data[map.locked] === true) throw appError_('LOCKED', '확정된 UOI는 이동할 수 없습니다');
  const status = data[map.status];
  if (!['draft', 'in_review'].includes(status)) {
    throw appError_('LOCKED', `'${status}' 상태에서는 이동할 수 없습니다 (draft/in_review만 가능)`);
  }

  // (3) 낙관적 락
  if (data[map.version] !== params.expected_version) {
    throw appError_('CONFLICT', '다른 사용자가 먼저 저장했습니다. 최신본을 다시 불러오세요.');
  }

  const oldGrade = data[map.grade];
  const oldTheme = data[map.theme_id];
  const oldOrder = (map.display_order !== undefined && data[map.display_order] !== '') ? data[map.display_order] : 0;

  // 변경 사항 적용
  const newVersion = params.expected_version + 1;
  const ts = now_();
  sheet.getRange(rowIdx, map.grade + 1).setValue(newGrade);
  sheet.getRange(rowIdx, map.theme_id + 1).setValue(newTheme);
  if (map.display_order !== undefined) {
    sheet.getRange(rowIdx, map.display_order + 1).setValue(newOrder);
  }
  sheet.getRange(rowIdx, map.updated_at + 1).setValue(ts);
  sheet.getRange(rowIdx, map.updated_by + 1).setValue(email);
  sheet.getRange(rowIdx, map.version + 1).setValue(newVersion);

  // 같은 (grade, theme) 내 다른 단원들의 display_order 정규화 (선택, 충돌 방지)
  if (map.display_order !== undefined) {
    normalizeDisplayOrder_(sheet, map, newGrade, newTheme);
  }

  // Changelog
  appendChangelog_({
    unit_id: params.unit_id,
    actor_email: email,
    action: 'move',
    field: 'grade,theme_id,display_order',
    before_value: JSON.stringify({ grade: oldGrade, theme_id: oldTheme, order: oldOrder }),
    after_value: JSON.stringify({ grade: newGrade, theme_id: newTheme, order: newOrder }),
    diff_summary: `이동: ${oldGrade}학년/${oldTheme} → ${newGrade}학년/${newTheme}`,
  });

  // (4) TDT 균형 검증 (이동 후 상태 기준)
  const warnings = [];
  const balanceWarn = checkThemeBalance_(newGrade, newTheme);
  if (balanceWarn) warnings.push(balanceWarn);

  // (5) 학년군 정합성 검증
  if (oldGrade !== newGrade) {
    const subjLinks = parseJSONSafe_(data[map.subject_links], []);
    const curriculumWarn = checkCurriculumGroup_(subjLinks, newGrade);
    if (curriculumWarn) warnings.push(curriculumWarn);
  }

  return { unit_id: params.unit_id, version: newVersion, warnings };
}

// ── 검증 헬퍼 ────────────────────────────────────────────

const VALID_THEMES_ = [
  'who_we_are', 'where_we_are_in_place_and_time', 'how_we_express_ourselves',
  'how_the_world_works', 'how_we_organize_ourselves', 'sharing_the_planet',
];

function checkThemeBalance_(grade, themeId) {
  const all = sheetToArray_('Units');
  const sameCell = all.filter(u =>
    parseInt(u.grade) === grade && u.theme_id === themeId &&
    u.status !== 'archived'
  );
  if (sameCell.length >= 2) {
    return {
      type: 'theme_balance',
      severity: 'warning',
      message: `${grade}학년에 '${themeId}' 주제가 ${sameCell.length}개입니다. IB는 학년당 TDT 1개 권장입니다.`,
      count: sameCell.length,
    };
  }
  return null;
}

function checkCurriculumGroup_(subjectLinks, newGrade) {
  if (!Array.isArray(subjectLinks) || subjectLinks.length === 0) return null;

  // 새 학년의 학년군: 1-2 / 3-4 / 5-6
  const targetGroup = newGrade <= 2 ? '1-2' : (newGrade <= 4 ? '3-4' : '5-6');

  // [4도01-01] 형식에서 첫 숫자가 학년군 상한 (예: 4 → 3-4 학년군)
  const mismatched = [];
  subjectLinks.forEach(code => {
    if (typeof code !== 'string') return;
    // [4도01-01] [6사02-03] 등 패턴
    const m = code.match(/^\[(\d)/);
    if (!m) return;
    const upper = parseInt(m[1]);
    const codeGroup = upper <= 2 ? '1-2' : (upper <= 4 ? '3-4' : '5-6');
    if (codeGroup !== targetGroup) {
      mismatched.push({ code, codeGroup, targetGroup });
    }
  });

  if (mismatched.length > 0) {
    return {
      type: 'curriculum_group',
      severity: 'warning',
      message: `${mismatched.length}개 성취기준이 새 학년군(${targetGroup})과 불일치합니다. 재매핑이 필요할 수 있습니다.`,
      mismatched,
    };
  }
  return null;
}

function normalizeDisplayOrder_(sheet, map, grade, themeId) {
  // 같은 셀 내 단원들의 display_order를 0,1,2... 로 재정규화
  const data = sheet.getDataRange().getValues();
  const items = [];
  for (let i = 1; i < data.length; i++) {
    if (parseInt(data[i][map.grade]) === grade && data[i][map.theme_id] === themeId) {
      const order = data[i][map.display_order];
      items.push({ rowIdx: i + 1, order: Number.isFinite(parseInt(order)) ? parseInt(order) : 0 });
    }
  }
  items.sort((a, b) => a.order - b.order);
  items.forEach((item, idx) => {
    sheet.getRange(item.rowIdx, map.display_order + 1).setValue(idx);
  });
}

function parseJSONSafe_(v, fallback) {
  if (v === '' || v === null || v === undefined) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (_) { return fallback; }
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
