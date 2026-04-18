// 내보내기

const THEMES_KO_EX = {
  who_we_are:                        '우리는 누구인가',
  where_we_are_in_place_and_time:    '우리는 어떤 시공간에 있는가',
  how_we_express_ourselves:          '우리는 어떻게 표현하는가',
  how_the_world_works:               '세상은 어떻게 작동하는가',
  how_we_organize_ourselves:         '우리는 어떻게 조직되는가',
  sharing_the_planet:                '지구를 공유하기',
};

const STATUS_KO_EX = {
  draft: '초안', in_review: '검토 요청', approved: '승인',
  finalized: '확정', archived: '보관',
};

function handleExport(params, email) {
  requireRole_(email, 'viewer');
  const format = params.format || 'json';

  if (format === 'json')     return exportJson_(params, email);
  if (format === 'markdown') return exportMarkdown_(params, email);
  if (format === 'csv')      return exportCsv_(params, email);

  throw appError_('VALIDATION', `지원하지 않는 형식: ${format}. 지원: json, markdown, csv`);
}

// ── 공통: scope 필터 ─────────────────────────────────────────

function _filterUnits_(params) {
  const all   = sheetToArray_('Units');
  const scope = params.scope || 'all';
  const grade = params.grade ? parseInt(params.grade) : null;

  if (scope === 'finalized') return all.filter(u => u.status === 'finalized');
  if (scope === 'grade' && grade) return all.filter(u => parseInt(u.grade) === grade);
  return all;
}

function _scopeLabel_(params) {
  if (params.scope === 'finalized') return '확정된 UOI만';
  if (params.scope === 'grade')     return `${params.grade}학년`;
  return '전체';
}

function _parseArr_(val) {
  if (!val) return [];
  try {
    const r = JSON.parse(val);
    return Array.isArray(r) ? r : [];
  } catch (_) { return []; }
}

// ── JSON ─────────────────────────────────────────────────────

function exportJson_(params, email) {
  const units = _filterUnits_(params);
  const meta  = sheetToArray_('POI_Meta');
  return {
    schema_version: '1.1',
    exported_at:    now_(),
    exported_by:    email,
    scope:          params.scope || 'all',
    grade_filter:   params.grade || null,
    meta:           meta[0] || {},
    units,
  };
}

// ── Markdown (Obsidian 최적화) ────────────────────────────────

function exportMarkdown_(params, email) {
  const units  = _filterUnits_(params);
  const meta   = sheetToArray_('POI_Meta');
  const school = (meta[0] || {}).school_name || '학교';
  const ts     = now_();

  let md = `# ${school} POI (Programme of Inquiry)\n\n`;
  md += `> 내보낸 시각: ${ts}  \n`;
  md += `> 내보낸 사람: ${email}  \n`;
  md += `> 범위: ${_scopeLabel_(params)}\n\n`;
  md += `---\n\n`;

  const sorted = [...units].sort((a, b) =>
    (parseInt(a.grade) - parseInt(b.grade)) ||
    (a.theme_id || '').localeCompare(b.theme_id || '')
  );

  sorted.forEach(u => {
    const themeName = THEMES_KO_EX[u.theme_id] || u.theme_id;
    const loi = _parseArr_(u.lines_of_inquiry);
    const kcs = _parseArr_(u.key_concepts);
    const lp  = _parseArr_(u.learner_profile);

    // Obsidian YAML frontmatter
    md += `---\n`;
    md += `unit_id: ${u.unit_id || ''}\n`;
    md += `grade: ${u.grade}\n`;
    md += `theme: ${u.theme_id}\n`;
    md += `status: ${u.status}\n`;
    md += `owner: ${u.owner_email || ''}\n`;
    md += `updated: ${(u.updated_at || ts).slice(0, 10)}\n`;
    md += `---\n\n`;

    md += `# [${u.grade}학년] ${themeName}\n`;
    if (u.title) md += `## ${u.title}\n`;
    md += `\n`;

    md += `**Central Idea**: ${u.central_idea || '—'}\n\n`;

    if (loi.length > 0) {
      md += `### Lines of Inquiry\n`;
      loi.forEach((l, i) => { md += `${i + 1}. ${l}\n`; });
      md += `\n`;
    }

    if (kcs.length > 0) {
      md += `### Key Concepts\n`;
      md += kcs.map(c => `\`${c}\``).join(' ') + `\n\n`;
    }

    if (lp.length > 0) {
      md += `### Learner Profile\n`;
      md += lp.join(', ') + `\n\n`;
    }

    if (u.action) {
      md += `### Action\n${u.action}\n\n`;
    }

    md += `### 기타 정보\n`;
    md += `- **기간**: ${u.duration_weeks ? u.duration_weeks + '주' : '—'}\n`;
    md += `- **담당 교사**: ${u.owner_email || '—'}\n`;
    md += `- **상태**: ${STATUS_KO_EX[u.status] || u.status}\n`;
    if (u.notes) md += `- **메모**: ${u.notes}\n`;
    md += `\n---\n\n`;
  });

  return { markdown: md };
}

// ── CSV ──────────────────────────────────────────────────────

function exportCsv_(params, email) {
  const units = _filterUnits_(params);

  const HEADERS = [
    '학년', '테마(한글)', '테마(영문)', 'UOI 제목', 'Central Idea',
    'Lines of Inquiry 1', 'Lines of Inquiry 2', 'Lines of Inquiry 3', 'Lines of Inquiry 4',
    'Key Concepts', 'Learner Profile', 'Action', '기간(주)', '상태', '담당 교사', '수정일',
  ];

  const sorted = [...units].sort((a, b) =>
    (parseInt(a.grade) - parseInt(b.grade)) ||
    (a.theme_id || '').localeCompare(b.theme_id || '')
  );

  const rows = sorted.map(u => {
    const loi = _parseArr_(u.lines_of_inquiry);
    const kcs = _parseArr_(u.key_concepts);
    const lp  = _parseArr_(u.learner_profile);
    return [
      u.grade,
      THEMES_KO_EX[u.theme_id] || u.theme_id,
      u.theme_id || '',
      u.title || '',
      u.central_idea || '',
      loi[0] || '', loi[1] || '', loi[2] || '', loi[3] || '',
      kcs.join(', '),
      lp.join(', '),
      u.action || '',
      u.duration_weeks || '',
      STATUS_KO_EX[u.status] || u.status,
      u.owner_email || '',
      (u.updated_at || '').slice(0, 10),
    ];
  });

  const csv = [HEADERS, ...rows]
    .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  return { csv };
}
