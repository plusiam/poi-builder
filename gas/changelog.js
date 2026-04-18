// 변경 이력 · 코멘트

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
    entry.field,
    entry.before_value,
    entry.after_value,
    entry.diff_summary,
  ]);
}

function appendComment_(entry) {
  const sheet = getSheet_('Comments');
  sheet.appendRow([
    uuid_(),
    entry.unit_id,
    now_(),
    entry.author_email,
    entry.body,
  ]);
}

function addComment(params, email) {
  requireRole_(email, 'editor');
  if (!params.body) throw appError_('VALIDATION', '코멘트 내용을 입력해주세요');
  appendComment_({ unit_id: params.unit_id, author_email: email, body: params.body });
  return { ok: true };
}
