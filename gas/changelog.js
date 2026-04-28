// 변경 이력 (Changelog 시트 전담)
// 댓글 로직은 comments.js로 분리됨 (v3.1)

function getChangelog(unitId, email) {
  requireRole_(email, 'viewer');
  const rows = sheetToArray_('Changelog');
  return unitId ? rows.filter(r => r.unit_id === unitId) : rows;
}

function appendChangelog_(entry) {
  const sheet = getSheet_('Changelog');
  sheet.appendRow([
    uuid_(),
    entry.unit_id,
    now_(),
    entry.actor_email,
    entry.action,
    entry.field || '',
    entry.before_value || '',
    entry.after_value || '',
    entry.diff_summary || '',
  ]);
}
