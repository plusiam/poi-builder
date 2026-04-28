// 사용자 관리 (v3.1 — Users 시트 7컬럼 스키마 대응)
//
// 컬럼: email, display_name, role, assigned_grade, subject_tags, active, added_at
//
// 모든 set/append 연산은 헤더 기반(headerMap_)으로 수행하여
// 시트 컬럼 순서 변경에도 견고하다.

// ── 본인 프로필 조회 + 자동 사전 등록 (v3.4 — 승인 대기 체계) ──
//
// Google ID 토큰 검증을 통과한 모든 사용자가 호출 가능 (역할 검사 없음).
// 호출 시 Users 시트에 이메일이 없으면 role='pending', active=false로 자동 등록.
//
// 반환 필드:
//   email, status: 'active' | 'pending' | 'inactive',
//   role, display_name, assigned_grade, subject_tags, isNew
//
// 프론트는 status 에 따라 분기:
//   active   → 정상 진입
//   pending  → 승인 대기 화면
//   inactive → 비활성 상태 안내
function whoami(params, email) {
  if (!email) throw appError_('UNAUTHORIZED', '인증이 필요합니다');

  const sheet = getSheet_('Users');
  const map = headerMap_(sheet);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][map.email] === email) {
      const obj = rowToObj_(rows[i], map);
      if (obj.role === 'reviewer') obj.role = 'approver';
      return _toProfile_(obj, false);
    }
  }

  // 자동 사전 등록 (승인 대기 큐로 진입)
  const ts = now_();
  const headerCount = Object.keys(map).length;
  const row = new Array(headerCount).fill('');
  if (map.email !== undefined)          row[map.email]          = email;
  if (map.display_name !== undefined)   row[map.display_name]   = (params && params.display_name) || email.split('@')[0];
  if (map.role !== undefined)           row[map.role]           = 'pending';
  if (map.assigned_grade !== undefined) row[map.assigned_grade] = '';
  if (map.subject_tags !== undefined)   row[map.subject_tags]   = '[]';
  if (map.active !== undefined)         row[map.active]         = false;
  if (map.added_at !== undefined)       row[map.added_at]       = ts;
  sheet.appendRow(row);

  Logger.log(`whoami: auto-registered pending user ${email}`);

  return _toProfile_({
    email,
    display_name: (params && params.display_name) || email.split('@')[0],
    role: 'pending',
    assigned_grade: '',
    subject_tags: '[]',
    active: false,
    added_at: ts,
  }, true);
}

function _toProfile_(obj, isNew) {
  const role = obj.role || 'viewer';
  const active = obj.active === true || String(obj.active).toLowerCase() === 'true';
  let status;
  if (role === 'pending')      status = 'pending';
  else if (!active)            status = 'inactive';
  else                         status = 'active';

  return {
    email: obj.email,
    display_name: obj.display_name || (obj.email || '').split('@')[0],
    role,
    status,
    assigned_grade: obj.assigned_grade || null,
    subject_tags: _safeParseArray_(obj.subject_tags),
    is_new: !!isNew,
  };
}

// ── 본인 자기소개 제출 (v3.4 — pending 사용자도 호출 가능) ──
//
// 인증된 사용자라면 누구나 호출 가능 (역할 검사 없음).
// 단 자신의 행만 갱신하며, 안전 필드(display_name / assigned_grade / subject_tags)만
// 변경한다. role / active / email 등 권한 관련 필드는 절대 수정 불가.
//
// 신규 사용자가 승인 대기 화면에서 자기소개를 작성하면 admin이
// 본인 확인 근거로 활용할 수 있다.
function submitMyIntro(params, email) {
  if (!email) throw appError_('UNAUTHORIZED', '인증이 필요합니다');

  const sheet = getSheet_('Users');
  const map = headerMap_(sheet);
  const data = sheet.getDataRange().getValues();

  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][map.email] === email) { rowIdx = i + 1; break; }
  }
  if (rowIdx < 0) {
    // whoami로 사전 등록되어 있어야 함. 안전망으로 다시 호출.
    whoami({ display_name: params.display_name }, email);
    // 새로 추가된 마지막 행
    rowIdx = sheet.getLastRow();
  }

  // 안전 필드만 (display_name / assigned_grade / subject_tags)
  if (params.display_name !== undefined && map.display_name !== undefined) {
    const name = String(params.display_name || '').trim().slice(0, 50);
    sheet.getRange(rowIdx, map.display_name + 1).setValue(name);
  }
  if (params.assigned_grade !== undefined && map.assigned_grade !== undefined) {
    const g = parseInt(params.assigned_grade);
    sheet.getRange(rowIdx, map.assigned_grade + 1).setValue(
      Number.isFinite(g) && g >= 1 && g <= 6 ? g : ''
    );
  }
  if (params.subject_tags !== undefined && map.subject_tags !== undefined) {
    let tags = params.subject_tags;
    if (typeof tags === 'string') {
      tags = tags.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
    } else if (!Array.isArray(tags)) {
      tags = [];
    }
    sheet.getRange(rowIdx, map.subject_tags + 1).setValue(JSON.stringify(tags));
  }

  // role / active 등은 절대 손대지 않음 (pending 유지)

  return { ok: true };
}

function _safeParseArray_(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : []; }
    catch (_) { return v.split(',').map(s => s.trim()).filter(Boolean); }
  }
  return [];
}

// ── 사용자 목록 조회 (v3.4) ───────────────────────────────
// admin 전용. Users 시트 전체 행을 객체 배열로 반환.
// pending 상태 사용자 식별을 위해 status 필드도 함께 계산해서 응답에 포함한다.
function getUsers(params, email) {
  requireRole_(email, 'admin');
  const sheet = getSheet_('Users');
  const map = headerMap_(sheet);
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][map.email]) continue;
    const obj = rowToObj_(rows[i], map);
    if (obj.role === 'reviewer') obj.role = 'approver';
    // 프로필 도출에 사용된 status 도 같이 노출 (pending/inactive/active)
    const profile = _toProfile_(obj, false);
    obj.status = profile.status;
    out.push(obj);
  }
  // pending 먼저, 그다음 inactive, 그다음 active 순으로 정렬 (admin이 즉시 처리하기 쉽게)
  const order = { pending: 0, inactive: 1, active: 2 };
  return out.sort((a, b) =>
    (order[a.status] ?? 9) - (order[b.status] ?? 9) ||
    String(a.added_at || '').localeCompare(String(b.added_at || ''))
  );
}

function updateUser(params, email) {
  requireRole_(email, 'admin');

  if (!params.email) throw appError_('VALIDATION', 'email이 필요합니다');

  const sheet = getSheet_('Users');
  const map = headerMap_(sheet);
  const rows = sheet.getDataRange().getValues();

  // 기존 사용자 수정
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][map.email] === params.email) {
      _setIfDefined_(sheet, i + 1, map, 'role',           _aliasRole_(params.role));
      _setIfDefined_(sheet, i + 1, map, 'active',         params.active);
      _setIfDefined_(sheet, i + 1, map, 'assigned_grade', params.assigned_grade);
      _setIfDefined_(sheet, i + 1, map, 'display_name',   params.display_name);
      _setIfDefined_(sheet, i + 1, map, 'subject_tags',   _normalizeTags_(params.subject_tags));
      return { ok: true };
    }
  }

  // 신규 등록 — 헤더 순서대로 빈 배열을 만든 뒤 필드별로 채운다 (스키마 변화 안전)
  const headerCount = Object.keys(map).length;
  const row = new Array(headerCount).fill('');
  _putByHeader_(row, map, 'email',          params.email);
  _putByHeader_(row, map, 'display_name',   params.display_name || '');
  _putByHeader_(row, map, 'role',           _aliasRole_(params.role) || 'viewer');
  _putByHeader_(row, map, 'assigned_grade', params.assigned_grade || '');
  _putByHeader_(row, map, 'subject_tags',   _normalizeTags_(params.subject_tags));
  _putByHeader_(row, map, 'active',         params.active !== false);
  _putByHeader_(row, map, 'added_at',       now_());

  sheet.appendRow(row);
  return { ok: true, created: true };
}

// ── 내부 ───────────────────────────────────────────────────

function _setIfDefined_(sheet, rowIdx, map, header, value) {
  if (value === undefined) return;
  if (map[header] === undefined) return;
  sheet.getRange(rowIdx, map[header] + 1).setValue(value);
}

function _putByHeader_(row, map, header, value) {
  if (map[header] === undefined) return;
  row[map[header]] = value;
}

function _aliasRole_(role) {
  if (!role) return role;
  // 기존 reviewer 호칭이 들어오면 approver로 정규화 (v3.1)
  return role === 'reviewer' ? 'approver' : role;
}

function _normalizeTags_(tags) {
  if (tags === undefined || tags === null) return undefined;
  if (Array.isArray(tags)) return JSON.stringify(tags);
  if (typeof tags === 'string') {
    // 이미 JSON이면 그대로, 아니면 콤마 분리해 배열화
    try { JSON.parse(tags); return tags; } catch (_) {}
    return JSON.stringify(tags.split(',').map(s => s.trim()).filter(Boolean));
  }
  return JSON.stringify(tags);
}
