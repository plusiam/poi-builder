// POI Builder — GAS Web App 진입점
// doGet/doPost 라우터

const ACTIONS_GET = {
  meta: () => import_('meta').getMeta(),
  units: () => import_('units').getUnits(),
  unit: (p) => import_('units').getUnit(p.unitId),
  constants: () => import_('units').getConstants(),
  dashboard: (p, email) => import_('units').getDashboard(email),
  changelog: (p) => import_('changelog').getChangelog(p.unitId),
  snapshots: (p, email) => import_('units').getSnapshots(email),
  export: (p, email) => import_('export').handleExport(p, email),
};

const ACTIONS_POST = {
  createUnit: (p, email) => import_('units').createUnit(p, email),
  updateUnit: (p, email) => import_('units').updateUnit(p, email),
  submitReview: (p, email) => import_('workflow').submitReview(p, email),
  approveUnit: (p, email) => import_('workflow').approveUnit(p, email),
  rejectUnit: (p, email) => import_('workflow').rejectUnit(p, email),
  finalizeUnit: (p, email) => import_('workflow').finalizeUnit(p, email),
  unlockUnit: (p, email) => import_('workflow').unlockUnit(p, email),
  addComment: (p, email) => import_('units').addComment(p, email),
  updateUser: (p, email) => import_('users').updateUser(p, email),
};

function doGet(e) {
  return route_(e, ACTIONS_GET, 'GET');
}

function doPost(e) {
  return route_(e, ACTIONS_POST, 'POST');
}

function route_(e, actions, method) {
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

    const result = handler(params, email);
    return ok_(result);

  } catch (err) {
    Logger.log(`[ERROR] ${err.message}\n${err.stack}`);
    if (err.code_) return error_(err.code_, err.message);
    return error_('INTERNAL', err.message);
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

// ── Hello World 테스트 엔드포인트 (Phase 0 완료 기준) ──────

function doGetTest(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: { message: 'POI Builder GAS 동작 확인 완료' } }))
    .setMimeType(ContentService.MimeType.JSON);
}
