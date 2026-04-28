// 사용자 관리 (v3.1 — Users 시트 7컬럼 스키마 대응)
//
// 컬럼: email, display_name, role, assigned_grade, subject_tags, active, added_at
//
// 모든 set/append 연산은 헤더 기반(headerMap_)으로 수행하여
// 시트 컬럼 순서 변경에도 견고하다.

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
