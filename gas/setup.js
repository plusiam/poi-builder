// ═══════════════════════════════════════════════════════════
// POI Builder — 초기 설정 스크립트 (Phase 0)
// GAS 에디터에서 setupAll() 을 한 번만 실행하세요.
// ═══════════════════════════════════════════════════════════

function setupAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('이 스크립트는 Spreadsheet에 바인딩된 상태에서 실행해야 합니다.\n'
      + '또는 setupStandalone() 을 사용하세요.');
  }

  Logger.log('=== POI Builder 초기 설정 시작 ===');
  setupSheets_(ss);
  seedConstants_(ss);
  setSpreadsheetId_(ss.getId());
  Logger.log('=== 초기 설정 완료 ✅ ===');
  Logger.log('Spreadsheet ID: ' + ss.getId());
}

// 독립형 실행 (바인딩 없이 새 Spreadsheet 생성)
function setupStandalone() {
  Logger.log('새 Spreadsheet 생성 중...');
  const ss = SpreadsheetApp.create('POI Builder DB');
  Logger.log('생성 완료: ' + ss.getUrl());

  setupSheets_(ss);
  seedConstants_(ss);
  setSpreadsheetId_(ss.getId());

  Logger.log('=== 초기 설정 완료 ✅ ===');
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('이 ID를 PropertiesService에 저장했습니다.');
}

// ── 시트 생성 · 헤더 설정 ─────────────────────────────────

function setupSheets_(ss) {
  Logger.log('시트 스키마 설정 중...');

  const schemas = {
    POI_Meta: ['school_name', 'year', 'version', 'created_at', 'updated_at', 'notes'],

    Units: [
      'unit_id', 'grade', 'theme_id', 'title', 'central_idea',
      'lines_of_inquiry', 'key_concepts', 'related_concepts',
      'learner_profile', 'atl_skills', 'action', 'subject_links',
      'duration_weeks', 'notes', 'status', 'owner_email',
      'created_at', 'updated_at', 'updated_by', 'version', 'locked',
      'display_order', // v3.2 — 같은 (grade, theme_id) 내 카드 정렬용
    ],

    Users: ['email', 'display_name', 'role', 'assigned_grade', 'subject_tags', 'active', 'added_at'],

    Comments: [
      'comment_id', 'unit_id', 'parent_id', 'anchor_field',
      'author_email', 'body', 'mentions', 'reactions',
      'resolved', 'resolved_by', 'resolved_at',
      'created_at', 'updated_at', 'deleted',
    ],

    Changelog: [
      'change_id', 'unit_id', 'timestamp', 'actor_email',
      'action', 'field', 'before_value', 'after_value', 'diff_summary',
    ],

    Snapshots: [
      'unit_id', 'grade', 'theme_id', 'title', 'central_idea',
      'lines_of_inquiry', 'key_concepts', 'related_concepts',
      'learner_profile', 'atl_skills', 'action', 'subject_links',
      'duration_weeks', 'notes', 'status', 'owner_email',
      'created_at', 'updated_at', 'updated_by', 'version', 'locked',
      'display_order', // v3.2
      'snapshot_id', 'snapshot_at', 'snapshot_by',
    ],

    Constants_Themes: [
      'id', 'name_ko', 'name_en',
      'old_descriptor', 'new_statement',
      'new_bullet_1', 'new_bullet_2', 'new_bullet_3',
    ],

    Constants_KeyConcepts: [
      'id', 'name_ko', 'name_en',
      'key_question_ko', 'key_question_en', 'description_ko',
    ],

    Constants_LearnerProfile: ['id', 'name_en', 'name_ko', 'description_ko'],

    Constants_ATL: ['id', 'category', 'category_ko', 'skill_en', 'skill_ko'],

    Constants_Curriculum2022: ['subject', 'grade_group', 'code', 'statement'],
  };

  // 기본 시트 이름 변경 또는 기존 시트 재활용
  const existingSheets = ss.getSheets().map(s => s.getName());
  const firstSheet = ss.getSheets()[0];

  Object.entries(schemas).forEach(([name, headers]) => {
    let sheet;
    if (existingSheets.includes(name)) {
      sheet = ss.getSheetByName(name);
      sheet.clearContents();
    } else if (name === Object.keys(schemas)[0] && firstSheet.getName() === 'Sheet1') {
      firstSheet.setName(name);
      sheet = firstSheet;
    } else {
      sheet = ss.insertSheet(name);
    }

    // 헤더 행 작성
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // 헤더 스타일
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#1a73e8');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);

    Logger.log(`  ✅ ${name} (${headers.length}개 컬럼)`);
  });
}

// ── 상수 데이터 시드 ──────────────────────────────────────

function seedConstants_(ss) {
  Logger.log('상수 데이터 입력 중...');
  seedThemes_(ss);
  seedKeyConcepts_(ss);
  seedLearnerProfile_(ss);
  seedATL_(ss);
  seedPOIMeta_(ss);
  Logger.log('  상수 데이터 입력 완료');
}

function seedThemes_(ss) {
  const sheet = ss.getSheetByName('Constants_Themes');
  const data = [
    ['who_we_are', '우리는 누구인가', 'Who we are',
      '자아의 본질, 신념과 가치, 개인의 신체·정신·사회·영적 건강, 가족·친구·공동체·문화 등의 인간 관계, 권리와 책임',
      '개인 및 집단으로서의 정체성 탐구',
      '신체·정서·사회·영적 건강과 웰빙', '관계와 소속감', '배움과 성장'],
    ['where_we_are_in_place_and_time', '우리는 어떤 시공간에 있는가', 'Where we are in place and time',
      '장소와 시간에 대한 방향성, 개인적·지역적·지구적 역사, 가정과 여정, 인류의 발견·탐험·이주',
      '역사와 방향성 탐구',
      '시대·사건·발전', '공동체·문화·환경', '이동·적응·변혁'],
    ['how_we_express_ourselves', '우리는 어떻게 표현하는가', 'How we express ourselves',
      '아이디어·감정·자연·문화·신념·가치를 발견·표현하는 방식, 예술 활동과 창의성',
      '목소리·관점·표현 다양성 탐구',
      '창의성과 표현 방식', '소통 방식과 도구', '의도·해석·반응'],
    ['how_the_world_works', '세상은 어떻게 작동하는가', 'How the world works',
      '자연 세계와 법칙, 물리적·생물적 세계, 과학과 기술의 상호작용과 영향',
      '세계와 현상 이해 탐구',
      '패턴·주기·시스템', '방법·도구·기술', '발견·설계·혁신'],
    ['how_we_organize_ourselves', '우리는 어떻게 조직되는가', 'How we organize ourselves',
      '인간이 만든 시스템과 공동체의 상호 연결, 조직의 구조와 기능, 사회적 의사결정',
      '시스템·구조·네트워크 탐구',
      '사회·생태 상호작용', '생계·무역·거버넌스', '협력·의사결정·변화'],
    ['sharing_the_planet', '지구를 공유하기', 'Sharing the planet',
      '유한한 자원의 공유를 위한 권리와 책임, 지구·사람들·국가 간의 관계, 평화와 갈등 해결',
      '인간과 자연 세계의 상호의존성 탐구',
      '모든 존재의 권리·책임·존엄', '정의·평화·재구상된 미래로의 경로', '자연, 복잡성, 공존, 지혜'],
  ];
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
}

function seedKeyConcepts_(ss) {
  const sheet = ss.getSheetByName('Constants_KeyConcepts');
  const data = [
    ['form', '형태', 'Form', '어떻게 생겼는가?', 'What is it like?', '모든 것은 관찰·식별·분류 가능한 형태를 가짐'],
    ['function', '기능', 'Function', '어떻게 작동하는가?', 'How does it work?', '모든 것은 탐구 가능한 목적·역할·작동 방식을 가짐'],
    ['causation', '원인', 'Causation', '왜 그러한가?', 'Why is it like it is?', '모든 일은 인과 관계 속에서 일어나며, 행동은 결과를 낳음'],
    ['change', '변화', 'Change', '어떻게 변하는가?', 'How is it changing?', '변화는 한 상태에서 다른 상태로의 움직임 과정'],
    ['connection', '연결', 'Connection', '무엇과 연결되는가?', 'How is it connected to other things?', '모든 것은 서로 연결되어 있음'],
    ['perspective', '관점', 'Perspective', '어떤 관점들이 있는가?', 'What are the points of view?', '지식은 관점에 따라 조정됨'],
    ['responsibility', '책임', 'Responsibility', '우리의 책임은 무엇인가?', 'What is our responsibility?', '이해를 바탕으로 한 선택과 실천'],
    ['reflection', '성찰', 'Reflection', '어떻게 알게 되는가?', 'How do we know?', '어떻게 알게 되었는가, 어떤 증거가 있는가'],
  ];
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
}

function seedLearnerProfile_(ss) {
  const sheet = ss.getSheetByName('Constants_LearnerProfile');
  const data = [
    ['inquirer', 'Inquirer', '탐구하는 사람', '호기심을 갖고 탐구 기능을 기르며 스스로 학습하는 방법을 알고 즐긴다'],
    ['knowledgeable', 'Knowledgeable', '지식이 있는 사람', '다양한 분야의 개념을 탐구하고 중요한 지식과 이해를 개발한다'],
    ['thinker', 'Thinker', '생각하는 사람', '복잡한 문제에 창의적·비판적으로 접근하며 윤리적 판단을 내린다'],
    ['communicator', 'Communicator', '소통하는 사람', '여러 언어와 방법으로 자신을 자신 있게 표현하고 협력한다'],
    ['principled', 'Principled', '원칙이 있는 사람', '정직하고 진실하게 행동하며 개인·집단 행동에 책임을 진다'],
    ['open_minded', 'Open-minded', '열린 마음을 가진 사람', '자신의 문화와 역사를 소중히 여기고 다른 관점과 가치를 존중한다'],
    ['caring', 'Caring', '배려하는 사람', '공감·연민·존중을 바탕으로 타인의 삶과 세계에 긍정적 변화를 만든다'],
    ['risk_taker', 'Risk-taker', '도전하는 사람', '불확실성에도 새로운 아이디어와 전략을 용기 있게 탐구한다'],
    ['balanced', 'Balanced', '균형 잡힌 사람', '개인의 웰빙을 위해 지적·신체적·정서적 균형의 중요성을 이해한다'],
    ['reflective', 'Reflective', '성찰하는 사람', '자신의 학습과 경험을 깊이 생각하고 강점과 약점을 이해한다'],
  ];
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
}

function seedATL_(ss) {
  const sheet = ss.getSheetByName('Constants_ATL');
  const data = [
    // Thinking Skills
    ['think_01', 'Thinking', '사고 기능', 'Critical thinking', '비판적 사고'],
    ['think_02', 'Thinking', '사고 기능', 'Creative thinking', '창의적 사고'],
    ['think_03', 'Thinking', '사고 기능', 'Transfer', '지식 전이'],
    ['think_04', 'Thinking', '사고 기능', 'Reflection', '성찰'],
    // Communication Skills
    ['comm_01', 'Communication', '소통 기능', 'Communication', '소통'],
    ['comm_02', 'Communication', '소통 기능', 'Collaboration', '협력'],
    // Social Skills
    ['soc_01', 'Social', '사회 기능', 'Collaboration', '협력'],
    ['soc_02', 'Social', '사회 기능', 'Interpersonal relationships', '대인 관계'],
    // Self-management Skills
    ['self_01', 'Self-management', '자기관리 기능', 'Organization', '조직화'],
    ['self_02', 'Self-management', '자기관리 기능', 'Affective skills', '정서 관리'],
    ['self_03', 'Self-management', '자기관리 기능', 'Reflection', '성찰'],
    // Research Skills
    ['res_01', 'Research', '연구 기능', 'Information literacy', '정보 활용 능력'],
    ['res_02', 'Research', '연구 기능', 'Media literacy', '미디어 리터러시'],
    ['res_03', 'Research', '연구 기능', 'Ethical use of information', '정보의 윤리적 활용'],
  ];
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
}

function seedPOIMeta_(ss) {
  const sheet = ss.getSheetByName('POI_Meta');
  sheet.getRange(2, 1, 1, 6).setValues([[
    '대구 남부초', '2026', '1.0', new Date().toISOString(), new Date().toISOString(), 'POI Builder 초기 설정',
  ]]);
}

// ── SPREADSHEET_ID 저장 ───────────────────────────────────

function setSpreadsheetId_(id) {
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
  Logger.log('SPREADSHEET_ID 저장 완료: ' + id);
}

// ═══════════════════════════════════════════════════════════
// v3.1 마이그레이션 (실데이터 보존)
// 기존 Phase 0/1 환경에서 한 번만 실행하세요.
//   - Users 시트에 subject_tags 컬럼 삽입
//   - 기존 reviewer 사용자를 approver로 변경
//   - Comments 시트에 신규 컬럼 추가 + 기존 행 기본값 보존
// ═══════════════════════════════════════════════════════════

function migrate_v3_1() {
  const ss = getSpreadsheet_();
  Logger.log('=== v3.1 마이그레이션 시작 ===');

  migrateUsers_v3_1_(ss);
  migrateComments_v3_1_(ss);

  Logger.log('=== v3.1 마이그레이션 완료 ✅ ===');
}

function migrateUsers_v3_1_(ss) {
  const sheet = ss.getSheetByName('Users');
  if (!sheet) { Logger.log('  Users 시트 없음 — 건너뜀'); return; }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const targetHeaders = ['email', 'display_name', 'role', 'assigned_grade', 'subject_tags', 'active', 'added_at'];

  // subject_tags 컬럼이 없으면 active 앞에 삽입
  if (!headers.includes('subject_tags')) {
    const activeIdx = headers.indexOf('active');
    if (activeIdx === -1) {
      Logger.log('  ⚠️ Users.active 컬럼이 없음 — 수동 점검 필요');
    } else {
      sheet.insertColumnBefore(activeIdx + 1);
      sheet.getRange(1, activeIdx + 1).setValue('subject_tags');
      Logger.log('  ✅ Users.subject_tags 컬럼 삽입');
    }
  } else {
    Logger.log('  ↻ Users.subject_tags 이미 존재');
  }

  // reviewer → approver 일괄 변환
  const map = {};
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].forEach((h, i) => { map[h] = i; });
  const data = sheet.getDataRange().getValues();
  let converted = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][map.role] === 'reviewer') {
      sheet.getRange(i + 1, map.role + 1).setValue('approver');
      converted++;
    }
  }
  Logger.log(`  ✅ reviewer → approver 변환: ${converted}명`);
}

// ═══════════════════════════════════════════════════════════
// v3.2 마이그레이션 (Phase 2-B, UOI 드래그 지원)
//   - Units 시트에 display_order 컬럼 추가
//   - 기존 단원에 created_at 순서로 0,1,2... 부여 (같은 grade×theme 내)
//   - Snapshots 시트에도 display_order 컬럼 추가 (기존 행은 빈 값으로)
// ═══════════════════════════════════════════════════════════

function migrate_v3_2() {
  const ss = getSpreadsheet_();
  Logger.log('=== v3.2 마이그레이션 시작 ===');

  migrateUnits_v3_2_(ss);
  migrateSnapshots_v3_2_(ss);

  Logger.log('=== v3.2 마이그레이션 완료 ✅ ===');
}

function migrateUnits_v3_2_(ss) {
  const sheet = ss.getSheetByName('Units');
  if (!sheet) { Logger.log('  Units 시트 없음 — 건너뜀'); return; }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (headers.includes('display_order')) {
    Logger.log('  ↻ Units.display_order 이미 존재');
  } else {
    // 마지막 컬럼 뒤에 추가
    const newCol = headers.length + 1;
    sheet.getRange(1, newCol).setValue('display_order');
    Logger.log(`  ✅ Units.display_order 컬럼 추가 (column ${newCol})`);
  }

  // 기존 단원에 display_order 부여 — 같은 (grade, theme_id) 내 created_at 순
  const map = {};
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .forEach((h, i) => { map[h] = i; });

  const rows = sheet.getDataRange().getValues();
  const groups = {};
  for (let i = 1; i < rows.length; i++) {
    const g = parseInt(rows[i][map.grade]);
    const t = rows[i][map.theme_id];
    const key = `${g}_${t}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({
      rowIdx: i + 1,
      created_at: rows[i][map.created_at] || '',
      currentOrder: rows[i][map.display_order],
    });
  }

  let assigned = 0;
  Object.values(groups).forEach(items => {
    items.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    items.forEach((item, idx) => {
      // 이미 값이 있으면 건너뜀 (재실행 안전)
      if (item.currentOrder === '' || item.currentOrder === null || item.currentOrder === undefined) {
        sheet.getRange(item.rowIdx, map.display_order + 1).setValue(idx);
        assigned++;
      }
    });
  });

  Logger.log(`  ✅ display_order 값 할당: ${assigned}행`);
}

function migrateSnapshots_v3_2_(ss) {
  const sheet = ss.getSheetByName('Snapshots');
  if (!sheet) { Logger.log('  Snapshots 시트 없음 — 건너뜀'); return; }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.includes('display_order')) {
    Logger.log('  ↻ Snapshots.display_order 이미 존재');
    return;
  }

  // snapshot_id 컬럼 앞에 display_order 삽입 (없으면 마지막에 추가)
  const snapIdIdx = headers.indexOf('snapshot_id');
  if (snapIdIdx === -1) {
    const newCol = headers.length + 1;
    sheet.getRange(1, newCol).setValue('display_order');
  } else {
    sheet.insertColumnBefore(snapIdIdx + 1);
    sheet.getRange(1, snapIdIdx + 1).setValue('display_order');
  }
  Logger.log('  ✅ Snapshots.display_order 컬럼 삽입');
}

function migrateComments_v3_1_(ss) {
  const sheet = ss.getSheetByName('Comments');
  if (!sheet) { Logger.log('  Comments 시트 없음 — 건너뜀'); return; }

  const oldHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const targetHeaders = [
    'comment_id', 'unit_id', 'parent_id', 'anchor_field',
    'author_email', 'body', 'mentions', 'reactions',
    'resolved', 'resolved_by', 'resolved_at',
    'created_at', 'updated_at', 'deleted',
  ];

  // 이미 신규 스키마면 스킵
  if (targetHeaders.every(h => oldHeaders.includes(h))) {
    Logger.log('  ↻ Comments 시트 이미 v3.1 스키마');
    return;
  }

  // 기존 데이터 추출
  const rows = sheet.getDataRange().getValues();
  const oldMap = {};
  oldHeaders.forEach((h, i) => { oldMap[h] = i; });

  // 시트 헤더 재구성
  sheet.clear();
  sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
  sheet.setFrozenRows(1);
  const headerRange = sheet.getRange(1, 1, 1, targetHeaders.length);
  headerRange.setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');

  // 기존 행 → 신규 스키마로 재기록
  if (rows.length > 1) {
    const newRows = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      newRows.push([
        r[oldMap.comment_id] || Utilities.getUuid(),
        r[oldMap.unit_id] || '',
        '',                                    // parent_id
        'unit',                                // anchor_field 기본
        r[oldMap.author_email] || '',
        r[oldMap.body] || '',
        '[]',                                  // mentions
        '{}',                                  // reactions
        false,                                 // resolved
        '',                                    // resolved_by
        '',                                    // resolved_at
        r[oldMap.created_at] || new Date().toISOString(),
        r[oldMap.created_at] || new Date().toISOString(), // updated_at
        false,                                 // deleted
      ]);
    }
    if (newRows.length > 0) {
      sheet.getRange(2, 1, newRows.length, targetHeaders.length).setValues(newRows);
    }
    Logger.log(`  ✅ Comments ${newRows.length}행 마이그레이션 완료`);
  } else {
    Logger.log('  ↻ Comments 시트 데이터 없음');
  }
}
