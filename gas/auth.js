// 인증 · 권한 체크

// 역할 위계 (v3.1 ~ v3.4)
//  pending   : (시트에만 존재) 자동 사전 등록 — 권한 체크 모두 거부 (ROLES 미포함)
//              → admin이 사용자 관리 화면에서 [승인] 시 editor 등으로 전환
//  viewer    : 조회만
//  commenter : 조회 + 댓글·이모지·해결 처리 (편집 불가)
//  editor    : 본인 학년 UOI 편집 + 모든 댓글
//  approver  : 승인·반려 (구 reviewer)
//  admin     : 모든 권한
//
// 호환성: 기존 'reviewer' 값은 'approver'로 자동 매핑된다.
// 'pending'은 ROLES enum에 일부러 미포함 → ROLES['pending'] === undefined →
// requireRole_(email, anything) 호출 시 항상 FORBIDDEN 처리됨.
const ROLES = { viewer: 0, commenter: 1, editor: 2, approver: 3, admin: 4 };
const ROLE_ALIASES = { reviewer: 'approver' };

// Google ID Token 검증 → 이메일 반환 (실패 시 null)
function verifyToken_(e) {
  try {
    const header = (e.parameter || {}).Authorization || '';
    const token = header.replace('Bearer ', '').trim();
    if (!token) return null;

    const res = UrlFetchApp.fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`,
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;

    const info = JSON.parse(res.getContentText());
    return info.email || null;
  } catch (_) {
    return null;
  }
}

// Users 시트에서 이메일 조회 → 역할 반환 (없으면 null)
// 헤더 기반 조회로 변경 (컬럼 추가에 견고)
function getRole_(email) {
  const sheet = getSheet_('Users');
  const map = headerMap_(sheet);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][map.email] === email && data[i][map.active] === true) {
      const raw = data[i][map.role];
      return ROLE_ALIASES[raw] || raw;
    }
  }
  return null;
}

// 최소 역할 체크 — 부족하면 예외 발생
function requireRole_(email, minRole) {
  const role = getRole_(email);
  if (!role || ROLES[role] === undefined || ROLES[role] < ROLES[minRole]) {
    const err = new Error('권한이 없습니다');
    err.code_ = 'FORBIDDEN';
    throw err;
  }
  return role;
}
