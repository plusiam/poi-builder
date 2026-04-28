// 팀 피드백 댓글 시스템 (v3.1)
//
// 데이터 모델: Comments 시트
//   comment_id, unit_id, parent_id, anchor_field, author_email, body,
//   mentions, reactions, resolved, resolved_by, resolved_at,
//   created_at, updated_at, deleted
//
// 핵심 정책
//  - 작성: commenter 이상 누구나
//  - 본문 수정/삭제: 작성자 본인 또는 admin
//  - 해결 처리: commenter 이상 누구나 (Google Docs 스타일)
//  - 이모지 반응: commenter 이상 누구나 토글
//  - finalized 단원: 신규 일반 댓글 차단 (회고 댓글은 별도 anchor_field='retro' 허용)

const COMMENT_BODY_MAX = 2000;
const ALLOWED_REACTIONS = ['👍', '❤️', '🤔', '🎉', '👀', '✅'];
const ALLOWED_ANCHOR_PREFIXES = ['unit', 'central_idea', 'loi', 'key_concepts', 'subject_links', 'action', 'retro'];

// ── 조회 ───────────────────────────────────────────────────

function getComments(params, email) {
  requireRole_(email, 'viewer');
  if (!params.unit_id) throw appError_('VALIDATION', 'unit_id가 필요합니다');

  const rows = sheetToArray_('Comments').filter(r =>
    r.unit_id === params.unit_id && r.deleted !== true
  );

  return rows.map(parseComment_).sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  );
}

// ── 작성 ───────────────────────────────────────────────────

function addComment(params, email) {
  requireRole_(email, 'commenter');

  if (!params.unit_id) throw appError_('VALIDATION', 'unit_id가 필요합니다');
  if (!params.body || !String(params.body).trim()) {
    throw appError_('VALIDATION', '코멘트 내용을 입력해주세요');
  }
  if (String(params.body).length > COMMENT_BODY_MAX) {
    throw appError_('VALIDATION', `코멘트는 ${COMMENT_BODY_MAX}자 이내여야 합니다`);
  }

  const anchor = normalizeAnchor_(params.anchor_field);
  const { data, map } = findUnitRow_(params.unit_id);
  const status = data[map.status];

  // 확정 단원은 회고 댓글만 허용
  if (status === 'finalized' && anchor !== 'retro') {
    throw appError_('LOCKED', '확정된 UOI에는 회고 댓글만 가능합니다 (anchor_field="retro")');
  }
  if (status === 'archived') {
    throw appError_('LOCKED', '아카이브된 UOI에는 댓글을 달 수 없습니다');
  }

  // parent_id 검증
  if (params.parent_id) {
    const parent = findCommentRow_(params.parent_id);
    if (parent.row.unit_id !== params.unit_id) {
      throw appError_('VALIDATION', '부모 댓글이 다른 UOI에 속합니다');
    }
  }

  const id = uuid_();
  const ts = now_();
  const mentions = sanitizeMentions_(params.mentions);

  const sheet = getSheet_('Comments');
  const headerMap = headerMap_(sheet);
  const row = buildCommentRow_(headerMap, {
    comment_id: id,
    unit_id: params.unit_id,
    parent_id: params.parent_id || '',
    anchor_field: anchor,
    author_email: email,
    body: params.body,
    mentions: JSON.stringify(mentions),
    reactions: JSON.stringify({}),
    resolved: false,
    resolved_by: '',
    resolved_at: '',
    created_at: ts,
    updated_at: ts,
    deleted: false,
  });
  sheet.appendRow(row);

  appendChangelog_({
    unit_id: params.unit_id,
    actor_email: email,
    action: 'comment',
    field: anchor,
    before_value: '',
    after_value: id,
    diff_summary: `댓글 추가: ${truncate_(params.body, 80)}`,
  });

  // 멘션 알림 (opt-in 메일은 Phase 2-C에서 활성화 예정)
  if (mentions.length > 0) {
    notifyMentions_({ unit_id: params.unit_id, comment_id: id, mentions, author: email });
  }

  return { comment_id: id, created_at: ts };
}

// ── 수정 ───────────────────────────────────────────────────

function updateComment(params, email) {
  requireRole_(email, 'commenter');

  const { sheet, rowIdx, row, map } = findCommentRow_(params.comment_id);
  if (row.deleted === true) throw appError_('NOT_FOUND', '삭제된 댓글입니다');

  const isAuthor = row.author_email === email;
  const isAdmin = getRole_(email) === 'admin';
  if (!isAuthor && !isAdmin) {
    throw appError_('FORBIDDEN', '본인이 작성한 댓글만 수정할 수 있습니다');
  }

  if (!params.body || !String(params.body).trim()) {
    throw appError_('VALIDATION', '코멘트 내용을 입력해주세요');
  }
  if (String(params.body).length > COMMENT_BODY_MAX) {
    throw appError_('VALIDATION', `코멘트는 ${COMMENT_BODY_MAX}자 이내여야 합니다`);
  }

  const ts = now_();
  sheet.getRange(rowIdx, map.body + 1).setValue(params.body);
  sheet.getRange(rowIdx, map.updated_at + 1).setValue(ts);

  if (Array.isArray(params.mentions)) {
    sheet.getRange(rowIdx, map.mentions + 1).setValue(JSON.stringify(sanitizeMentions_(params.mentions)));
  }

  return { comment_id: params.comment_id, updated_at: ts };
}

// ── 소프트 삭제 ────────────────────────────────────────────

function deleteComment(params, email) {
  requireRole_(email, 'commenter');

  const { sheet, rowIdx, row, map } = findCommentRow_(params.comment_id);
  if (row.deleted === true) return { ok: true, already: true };

  const isAuthor = row.author_email === email;
  const isAdmin = getRole_(email) === 'admin';
  if (!isAuthor && !isAdmin) {
    throw appError_('FORBIDDEN', '본인이 작성한 댓글만 삭제할 수 있습니다');
  }

  sheet.getRange(rowIdx, map.deleted + 1).setValue(true);
  sheet.getRange(rowIdx, map.updated_at + 1).setValue(now_());

  appendChangelog_({
    unit_id: row.unit_id,
    actor_email: email,
    action: 'comment',
    field: 'deleted',
    before_value: params.comment_id,
    after_value: '',
    diff_summary: '댓글 삭제',
  });

  return { ok: true };
}

// ── 이모지 반응 토글 ───────────────────────────────────────

function reactComment(params, email) {
  requireRole_(email, 'commenter');

  const emoji = params.emoji;
  if (!ALLOWED_REACTIONS.includes(emoji)) {
    throw appError_('VALIDATION', `허용되지 않은 이모지입니다 (${ALLOWED_REACTIONS.join(' ')})`);
  }

  const { sheet, rowIdx, row, map } = findCommentRow_(params.comment_id);
  if (row.deleted === true) throw appError_('NOT_FOUND', '삭제된 댓글입니다');

  const reactions = parseJSON_(row.reactions, {});
  const users = reactions[emoji] || [];
  const idx = users.indexOf(email);
  let toggled;
  if (idx >= 0) {
    users.splice(idx, 1);
    toggled = 'removed';
  } else {
    users.push(email);
    toggled = 'added';
  }
  if (users.length === 0) {
    delete reactions[emoji];
  } else {
    reactions[emoji] = users;
  }

  sheet.getRange(rowIdx, map.reactions + 1).setValue(JSON.stringify(reactions));
  sheet.getRange(rowIdx, map.updated_at + 1).setValue(now_());

  appendChangelog_({
    unit_id: row.unit_id,
    actor_email: email,
    action: 'react',
    field: 'reactions',
    before_value: '',
    after_value: `${emoji}:${toggled}`,
    diff_summary: `${emoji} ${toggled === 'added' ? '추가' : '제거'}`,
  });

  return { comment_id: params.comment_id, reactions, toggled };
}

// ── 해결 상태 토글 ─────────────────────────────────────────

function resolveComment(params, email) {
  requireRole_(email, 'commenter');

  const { sheet, rowIdx, row, map } = findCommentRow_(params.comment_id);
  if (row.deleted === true) throw appError_('NOT_FOUND', '삭제된 댓글입니다');

  const next = !row.resolved;
  const ts = now_();

  sheet.getRange(rowIdx, map.resolved + 1).setValue(next);
  sheet.getRange(rowIdx, map.resolved_by + 1).setValue(next ? email : '');
  sheet.getRange(rowIdx, map.resolved_at + 1).setValue(next ? ts : '');
  sheet.getRange(rowIdx, map.updated_at + 1).setValue(ts);

  appendChangelog_({
    unit_id: row.unit_id,
    actor_email: email,
    action: 'resolve',
    field: 'resolved',
    before_value: String(!next),
    after_value: String(next),
    diff_summary: next ? '댓글 해결 처리' : '댓글 해결 취소',
  });

  return { comment_id: params.comment_id, resolved: next, resolved_by: next ? email : '', resolved_at: next ? ts : '' };
}

// ── 헬퍼 ───────────────────────────────────────────────────

function findCommentRow_(comment_id) {
  if (!comment_id) throw appError_('VALIDATION', 'comment_id가 필요합니다');
  const sheet = getSheet_('Comments');
  const map = headerMap_(sheet);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][map.comment_id] === comment_id) {
      return { sheet, rowIdx: i + 1, row: parseComment_(rowToObj_(data[i], map)), map };
    }
  }
  throw appError_('NOT_FOUND', `댓글을 찾을 수 없습니다: ${comment_id}`);
}

function buildCommentRow_(map, obj) {
  const row = new Array(Object.keys(map).length).fill('');
  Object.entries(obj).forEach(([k, v]) => {
    if (map[k] !== undefined) row[map[k]] = v;
  });
  return row;
}

function parseComment_(r) {
  return {
    ...r,
    parent_id: r.parent_id || null,
    anchor_field: r.anchor_field || 'unit',
    mentions: parseJSON_(r.mentions, []),
    reactions: parseJSON_(r.reactions, {}),
    resolved: r.resolved === true,
    deleted: r.deleted === true,
  };
}

function parseJSON_(v, fallback) {
  if (v === '' || v === null || v === undefined) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (_) { return fallback; }
}

function normalizeAnchor_(anchor) {
  const a = anchor || 'unit';
  // 'loi:0', 'loi:1' ... 또는 단일 키
  const prefix = String(a).split(':')[0];
  if (!ALLOWED_ANCHOR_PREFIXES.includes(prefix)) {
    throw appError_('VALIDATION', `허용되지 않은 anchor_field: ${a}`);
  }
  return a;
}

function sanitizeMentions_(arr) {
  if (!Array.isArray(arr)) return [];
  // 이메일 형식만 통과 + 중복 제거
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return [...new Set(arr.filter(x => typeof x === 'string' && re.test(x)))];
}

function truncate_(s, n) {
  const str = String(s || '');
  return str.length > n ? str.slice(0, n) + '…' : str;
}

// 멘션 알림 — Phase 2-C에서 메일/배지 발송 활성화
// 현재는 Changelog `mention` 액션으로 흔적만 남김
function notifyMentions_(payload) {
  payload.mentions.forEach(target => {
    appendChangelog_({
      unit_id: payload.unit_id,
      actor_email: payload.author,
      action: 'mention',
      field: 'mentions',
      before_value: '',
      after_value: target,
      diff_summary: `@${target} 멘션`,
    });
  });
}
