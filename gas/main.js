// POI Builder — GAS Web App 진입점
// doGet/doPost 라우터
// GAS는 파일 간 전역 스코프 공유 → 함수 직접 호출

const ACTIONS_GET = {
  meta:       (p, email) => getMeta(p, email),
  units:      (p, email) => getUnits(p, email),
  unit:       (p, email) => getUnit(p.unitId, email),
  constants:  (p, email) => getConstants(p, email),
  dashboard:  (p, email) => getDashboard(p, email),
  changelog:  (p, email) => getChangelog(p.unitId, email),
  snapshots:  (p, email) => getSnapshots(p, email),
  comments:   (p, email) => getComments({ unit_id: p.unitId || p.unit_id }, email),
  trash:      (p, email) => getTrash(p, email),  // v3.3 — 휴지통 목록
  users:      (p, email) => getUsers(p, email),  // v3.4 — 사용자 목록 (admin)
  whoami:     (p, email) => whoami(p, email),    // v3.4 — 본인 프로필 (역할 검사 없음, 자동 사전 등록)
  export:     (p, email) => handleExport(p, email),
};

const ACTIONS_POST = {
  createUnit:     (p, email) => createUnit(p, email),
  updateUnit:     (p, email) => updateUnit(p, email),
  // 드래그 이동 (v3.2, Phase 2-B)
  moveUnit:       (p, email) => moveUnit(p, email),
  submitReview:   (p, email) => submitReview(p, email),
  approveUnit:    (p, email) => approveUnit(p, email),
  rejectUnit:     (p, email) => rejectUnit(p, email),
  finalizeUnit:   (p, email) => finalizeUnit(p, email),
  unlockUnit:     (p, email) => unlockUnit(p, email),
  archiveYear:    (p, email) => archiveYear(p, email),  // v3.3 — Phase 4 연도 롤오버
  // 휴지통 (v3.3, Phase 4 후속)
  deleteUnit:     (p, email) => deleteUnit(p, email),
  restoreUnit:    (p, email) => restoreUnit(p, email),
  purgeUnit:      (p, email) => purgeUnit(p, email),
  // 댓글 시스템 (v3.1, Phase 2-A)
  addComment:     (p, email) => addComment(p, email),
  updateComment:  (p, email) => updateComment(p, email),
  deleteComment:  (p, email) => deleteComment(p, email),
  reactComment:   (p, email) => reactComment(p, email),
  resolveComment: (p, email) => resolveComment(p, email),
  // 사용자 관리
  updateUser:     (p, email) => updateUser(p, email),
  // v3.4 — 본인 자기소개(승인 대기 사용자도 호출 가능)
  submitMyIntro:  (p, email) => submitMyIntro(p, email),
};

function doGet(e) {
  return route_(e, ACTIONS_GET, 'GET');
}

function doPost(e) {
  return route_(e, ACTIONS_POST, 'POST');
}

function route_(e, actions, method) {
  let lock = null;
  try {
    const action = (e.parameter || {}).action;
    if (!action) return error_('VALIDATION', 'action 파라미터가 없습니다');

    const handler = actions[action];
    if (!handler) return error_('NOT_FOUND', `알 수 없는 action: ${action}`);

    const email = verifyToken_(e);
    if (!email) return error_('UNAUTHORIZED', '인증이 필요합니다');

    const params = method === 'POST'
      ? JSON.parse((e.postData || {}).contents || '{}')
      : (e.parameter || {});

    // 쓰기 요청은 스크립트 락으로 직렬화한다.
    // 낙관적 락(version 검사)의 read-check-write 사이에 다른 요청이 끼어들면
    // 두 요청이 모두 version 검증을 통과해 한쪽 변경이 유실될 수 있다.
    if (method === 'POST') {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(20000)) {
        lock = null;
        return error_('BUSY', '다른 저장 작업이 진행 중입니다. 잠시 후 다시 시도하세요.');
      }
    }

    const result = handler(params, email);
    return ok_(result);

  } catch (err) {
    Logger.log(`[ERROR] ${err.message}\n${err.stack}`);
    if (err.code_) return error_(err.code_, err.message);
    return error_('INTERNAL', err.message);
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ── 응답 헬퍼 ──────────────────────────────────────────────

function ok_(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function error_(code, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: { code, message } }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 연결 테스트 (인증 불필요) ─────────────────────────────

function doGetTest() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: { message: 'POI Builder GAS 동작 확인 완료' } }))
    .setMimeType(ContentService.MimeType.JSON);
}
