// 사용자 관리

function updateUser(params, email) {
  requireRole_(email, 'admin');
  const sheet = getSheet_('Users');
  const map = headerMap_(sheet);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][map.email] === params.email) {
      if (params.role !== undefined) sheet.getRange(i + 1, map.role + 1).setValue(params.role);
      if (params.active !== undefined) sheet.getRange(i + 1, map.active + 1).setValue(params.active);
      if (params.assigned_grade !== undefined) sheet.getRange(i + 1, map.assigned_grade + 1).setValue(params.assigned_grade);
      if (params.display_name !== undefined) sheet.getRange(i + 1, map.display_name + 1).setValue(params.display_name);
      return { ok: true };
    }
  }

  // 신규 등록
  sheet.appendRow([
    params.email,
    params.display_name || '',
    params.role || 'viewer',
    params.assigned_grade || '',
    params.active !== false,
    now_(),
  ]);
  return { ok: true, created: true };
}
