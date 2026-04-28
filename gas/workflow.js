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
  return transition_(params.unit_id, email, 'approve', 'approver',
    params.comment || '승인', params.comment);
}

function rejectUnit(params, email) {
  if (!params.reason) throw appError_('VALIDATION', '반려 사유를 입력해주세요');
  return transition_(params.unit_id, email, 'reject', 'approver', `반려: ${params.reason}`, params.reason);
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

// ── 연도 롤오버 (일괄 아카이브) ──────────────────────────
//
// 사용 시점: 학년 종료 후 새 학년도로 넘어갈 때 단 한 번 실행한다.
// 효과:
//   1) POI_Meta.year 를 new_year 로 갱신
//   2) 대상 단원(기본: status 가 draft/in_review/approved/finalized 인 것 전부)을
//      모두 status=archived, locked=true 로 일괄 변경
//   3) 그 시점의 행을 Snapshots 시트에 자동 복제 (감사·복원용)
//   4) 모든 액션을 Changelog 에 archive 액션으로 기록
//
// 입력: {
//   new_year:  string|number,    // 예: "2027"
//   dry_run:   boolean,          // true 면 변경하지 않고 영향 카운트만 반환
//   include_status: string[]     // 기본 ['draft','in_review','approved','finalized']
// }
//
// 반환: { from_year, to_year, archived_count, snapshot_count, dry_run, units_preview }

function archiveYear(params, email) {
  requireRole_(email, 'admin');

  const newYear = String(params.new_year || '').trim();
  if (!newYear) throw appError_('VALIDATION', 'new_year를 입력해주세요');
  if (!/^\d{4}$/.test(newYear)) throw appError_('VALIDATION', 'new_year는 4자리 연도여야 합니다 (예: 2027)');

  const dryRun = params.dry_run === true;
  const include = Array.isArray(params.include_status) && params.include_status.length > 0
    ? params.include_status
    : ['draft', 'in_review', 'approved', 'finalized'];

  // 현재 연도 조회
  const meta = getSheet_('POI_Meta');
  const metaMap = headerMap_(meta);
  const metaRows = meta.getDataRange().getValues();
  const fromYear = metaRows.length >= 2 ? String(metaRows[1][metaMap.year] || '') : '';

  // 대상 단원 수집
  const unitsSheet = getSheet_('Units');
  const map = headerMap_(unitsSheet);
  const data = unitsSheet.getDataRange().getValues();
  const targets = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (include.includes(row[map.status])) {
      targets.push({ rowIdx: i + 1, row });
    }
  }

  // 미리보기(샘플 10개)
  const preview = targets.slice(0, 10).map(t => ({
    unit_id:  t.row[map.unit_id],
    grade:    t.row[map.grade],
    theme_id: t.row[map.theme_id],
    title:    t.row[map.title] || '(제목 없음)',
    status:   t.row[map.status],
  }));

  if (dryRun) {
    return {
      from_year: fromYear,
      to_year: newYear,
      archived_count: targets.length,
      snapshot_count: 0,
      dry_run: true,
      units_preview: preview,
    };
  }

  if (fromYear === newYear) {
    throw appError_('VALIDATION', `현재 연도(${fromYear})와 동일합니다. 다른 연도를 입력해주세요.`);
  }

  // 실제 처리
  const snapshotsSheet = getSheet_('Snapshots');
  const ts = now_();
  let archivedCount = 0;
  let snapshotCount = 0;

  targets.forEach(t => {
    const oldStatus = t.row[map.status];

    // 1) 스냅샷 복제 (snapshot_id, snapshot_at, snapshot_by 추가)
    const snapRow = [...t.row, uuid_(), ts, email];
    snapshotsSheet.appendRow(snapRow);
    snapshotCount++;

    // 2) status=archived, locked=true 로 변경
    unitsSheet.getRange(t.rowIdx, map.status + 1).setValue('archived');
    unitsSheet.getRange(t.rowIdx, map.locked + 1).setValue(true);
    unitsSheet.getRange(t.rowIdx, map.updated_at + 1).setValue(ts);
    unitsSheet.getRange(t.rowIdx, map.updated_by + 1).setValue(email);

    archivedCount++;

    // 3) Changelog
    appendChangelog_({
      unit_id: t.row[map.unit_id],
      actor_email: email,
      action: 'archive',
      field: 'status',
      before_value: oldStatus,
      after_value: 'archived',
      diff_summary: `${fromYear} → ${newYear} 연도 롤오버로 일괄 아카이브`,
    });
  });

  // 4) POI_Meta 연도 갱신
  if (metaRows.length >= 2) {
    meta.getRange(2, metaMap.year + 1).setValue(newYear);
    if (metaMap.updated_at !== undefined) {
      meta.getRange(2, metaMap.updated_at + 1).setValue(ts);
    }
  } else {
    // 없으면 한 행 추가
    const row = new Array(Object.keys(metaMap).length).fill('');
    if (metaMap.school_name !== undefined) row[metaMap.school_name] = '';
    if (metaMap.year !== undefined) row[metaMap.year] = newYear;
    if (metaMap.version !== undefined) row[metaMap.version] = '1.0';
    if (metaMap.created_at !== undefined) row[metaMap.created_at] = ts;
    if (metaMap.updated_at !== undefined) row[metaMap.updated_at] = ts;
    if (metaMap.notes !== undefined) row[metaMap.notes] = `${fromYear} → ${newYear} 롤오버`;
    meta.appendRow(row);
  }

  return {
    from_year: fromYear,
    to_year: newYear,
    archived_count: archivedCount,
    snapshot_count: snapshotCount,
    dry_run: false,
    units_preview: preview,
  };
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
