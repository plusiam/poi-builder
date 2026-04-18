// 상태 전이 로직

const TRANSITIONS = {
  draft:     { submit: 'in_review' },
  in_review: { approve: 'approved', reject: 'draft' },
  approved:  { finalize: 'finalized', revise: 'draft' },
  finalized: { unlock: 'approved', archive: 'archived' },
};

function submitReview(params, email) {
  return transition_(params.unit_id, email, 'submit', 'editor', '검토 요청');
}

function approveUnit(params, email) {
  return transition_(params.unit_id, email, 'approve', 'reviewer',
    params.comment || '승인', params.comment);
}

function rejectUnit(params, email) {
  if (!params.reason) throw appError_('VALIDATION', '반려 사유를 입력해주세요');
  return transition_(params.unit_id, email, 'reject', 'reviewer', `반려: ${params.reason}`, params.reason);
}

function finalizeUnit(params, email) {
  requireRole_(email, 'admin');
  const result = transition_(params.unit_id, email, 'finalize', 'admin', '확정');

  // 스냅샷 저장
  const { data, map } = findUnitRow_(params.unit_id);
  const snapSheet = getSheet_('Snapshots');
  const snapRow = [...data, uuid_(), now_(), email];
  snapSheet.appendRow(snapRow);

  // 잠금
  const { sheet, rowIdx } = findUnitRow_(params.unit_id);
  sheet.getRange(rowIdx, map.locked + 1).setValue(true);

  return result;
}

function unlockUnit(params, email) {
  requireRole_(email, 'admin');
  if (!params.reason) throw appError_('VALIDATION', '잠금 해제 사유를 입력해주세요');

  const { sheet, rowIdx, map } = findUnitRow_(params.unit_id);
  sheet.getRange(rowIdx, map.locked + 1).setValue(false);

  appendChangelog_({ unit_id: params.unit_id, actor_email: email, action: 'unlock',
    field: 'locked', before_value: 'true', after_value: 'false', diff_summary: `잠금 해제: ${params.reason}` });

  return transition_(params.unit_id, email, 'unlock', 'admin', `잠금 해제: ${params.reason}`);
}

// ── 내부 헬퍼 ─────────────────────────────────────────────

function transition_(unit_id, email, action, minRole, summary, comment) {
  requireRole_(email, minRole);
  const { sheet, rowIdx, data, map } = findUnitRow_(unit_id);

  if (data[map.locked] && action !== 'unlock') {
    throw appError_('LOCKED', '확정된 UOI는 상태를 변경할 수 없습니다');
  }

  const currentStatus = data[map.status];
  const nextStatus = (TRANSITIONS[currentStatus] || {})[action];
  if (!nextStatus) {
    throw appError_('VALIDATION', `'${currentStatus}' 상태에서 '${action}' 전이는 불가합니다`);
  }

  const ts = now_();
  sheet.getRange(rowIdx, map.status + 1).setValue(nextStatus);
  sheet.getRange(rowIdx, map.updated_at + 1).setValue(ts);
  sheet.getRange(rowIdx, map.updated_by + 1).setValue(email);

  if (comment) {
    appendComment_({ unit_id, author_email: email, body: comment });
  }

  appendChangelog_({ unit_id, actor_email: email, action: 'status_change',
    field: 'status', before_value: currentStatus, after_value: nextStatus, diff_summary: summary });

  return { unit_id, status: nextStatus };
}
