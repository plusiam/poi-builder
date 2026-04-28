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

  // 최종 검증 (v3.4): IB PYP 인증 기준 충족 여부 확인
  // 위반이 있으면 모두 모아 한 번에 반환 → 사용자가 한 번에 고칠 수 있게
  const { data, map } = findUnitRow_(params.unit_id);
  const violations = validateForFinalize_(data, map);
  if (violations.length > 0) {
    if (params.force === true) {
      // admin이 명시적으로 force=true 보내면 검증 건너뜀 (예외 상황 대응)
      Logger.log(`finalizeUnit force=true: ${params.unit_id} bypassed ${violations.length} violations`);
    } else {
      const msg = '최종 확정 전 다음 항목을 보완해야 합니다:\n\n' +
        violations.map((v, i) => `${i + 1}. ${v.message}`).join('\n') +
        '\n\n(긴급 시 관리자가 force=true 옵션으로 우회 가능)';
      throw appError_('VALIDATION', msg);
    }
  }

  const result = transition_(params.unit_id, email, 'finalize', 'admin', '확정');

  // 스냅샷 저장
  const { data: data2 } = findUnitRow_(params.unit_id);
  const snapSheet = getSheet_('Snapshots');
  const snapRow = [...data2, uuid_(), now_(), email];
  snapSheet.appendRow(snapRow);

  // 잠금
  const { sheet, rowIdx, map: map2 } = findUnitRow_(params.unit_id);
  sheet.getRange(rowIdx, map2.locked + 1).setValue(true);

  return result;
}

// ── 최종 확정 전 검증 (v3.4) ─────────────────────────────
//
// IB PYP 인증 매트릭스에 들어갈 단원이 갖춰야 할 최소 요건.
// 위반 항목을 모두 수집해 배열로 반환 (첫 위반에서 throw하지 않음 → 한 번에 수정 가능).
//
// 검사 항목:
//   1. theme_id  ∈ 6개 TDT
//   2. grade     ∈ 1~6
//   3. central_idea: 10~200자, 진술문 (물음표로 끝나면 안 됨)
//   4. lines_of_inquiry: 3~4개, 각 5자 이상  ← 핵심 (LOI 최종 검증)
//   5. key_concepts: 1~3개
//
// 다른 항목(LP/ATL/Subject Links/Action 등)은 IB 권장이지만 학교 정책에 따라
// 다르므로 현재는 강제하지 않음. 필요하면 정책에 맞춰 확장.

const VALID_THEMES_FINALIZE_ = [
  'who_we_are', 'where_we_are_in_place_and_time', 'how_we_express_ourselves',
  'how_the_world_works', 'how_we_organize_ourselves', 'sharing_the_planet',
];

function validateForFinalize_(data, map) {
  const violations = [];

  // 1. theme_id
  const theme = data[map.theme_id];
  if (!theme || !VALID_THEMES_FINALIZE_.includes(theme)) {
    violations.push({ field: 'theme_id', message: 'TDT(주제)가 6개 표준 주제 중 하나여야 합니다' });
  }

  // 2. grade
  const grade = parseInt(data[map.grade]);
  if (!(grade >= 1 && grade <= 6)) {
    violations.push({ field: 'grade', message: `학년이 1~6 범위가 아닙니다 (현재: ${data[map.grade]})` });
  }

  // 3. central_idea
  const ci = String(data[map.central_idea] || '').trim();
  if (ci.length < 10) {
    violations.push({ field: 'central_idea', message: `Central Idea가 너무 짧습니다 (현재 ${ci.length}자, 최소 10자)` });
  } else if (ci.length > 200) {
    violations.push({ field: 'central_idea', message: `Central Idea가 너무 깁니다 (현재 ${ci.length}자, 최대 200자)` });
  } else if (ci.endsWith('?')) {
    violations.push({ field: 'central_idea', message: 'Central Idea는 진술문이어야 합니다 (물음표로 끝나면 안 됨)' });
  }

  // 4. lines_of_inquiry — 최종 확정에서는 IB PYP 표준대로 3~4개 필수
  let lois = [];
  try { lois = JSON.parse(data[map.lines_of_inquiry] || '[]'); } catch (_) { lois = []; }
  const validLois = (Array.isArray(lois) ? lois : []).filter(l =>
    typeof l === 'string' && l.trim().length > 0
  );
  if (validLois.length < 3) {
    violations.push({
      field: 'lines_of_inquiry',
      message: `Lines of Inquiry가 부족합니다 (현재 ${validLois.length}개, IB PYP 표준 3~4개)`,
    });
  } else if (validLois.length > 4) {
    violations.push({
      field: 'lines_of_inquiry',
      message: `Lines of Inquiry가 너무 많습니다 (현재 ${validLois.length}개, IB PYP 표준 3~4개)`,
    });
  } else {
    // 각 LOI 5자 이상 — 너무 짧으면 의미 부족
    const tooShort = validLois.filter(l => l.trim().length < 5);
    if (tooShort.length > 0) {
      violations.push({
        field: 'lines_of_inquiry',
        message: `LOI 중 ${tooShort.length}개가 5자 미만입니다 (각 5자 이상 권장)`,
      });
    }
  }

  // 5. key_concepts
  let kcs = [];
  try { kcs = JSON.parse(data[map.key_concepts] || '[]'); } catch (_) { kcs = []; }
  const kcArr = Array.isArray(kcs) ? kcs : [];
  if (kcArr.length === 0) {
    violations.push({ field: 'key_concepts', message: 'Key Concept을 1개 이상 선택해야 합니다 (1~3개)' });
  } else if (kcArr.length > 3) {
    violations.push({ field: 'key_concepts', message: `Key Concept이 너무 많습니다 (현재 ${kcArr.length}개, 최대 3개)` });
  }

  return violations;
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
