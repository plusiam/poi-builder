// 인증 · 권한 체크

const ROLES = { viewer: 0, editor: 1, reviewer: 2, admin: 3 };

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
function getRole_(email) {
  const sheet = getSheet_('Users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][4] === true) {
      return data[i][2]; // role 컬럼
    }
  }
  return null;
}

// 최소 역할 체크 — 부족하면 예외 발생
function requireRole_(email, minRole) {
  const role = getRole_(email);
  if (!role || ROLES[role] < ROLES[minRole]) {
    const err = new Error('권한이 없습니다');
    err.code_ = 'FORBIDDEN';
    throw err;
  }
  return role;
}
