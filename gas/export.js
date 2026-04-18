// 내보내기 (Phase 3에서 상세 구현 예정)

function handleExport(params, email) {
  requireRole_(email, 'viewer');
  const format = params.format || 'json';

  if (format === 'json') return exportJson_(params, email);
  if (format === 'markdown') return exportMarkdown_(params, email);

  throw appError_('VALIDATION', `지원하지 않는 형식: ${format}. 현재 지원: json, markdown`);
}

function exportJson_(params, email) {
  const units = sheetToArray_('Units');
  const meta = sheetToArray_('POI_Meta');
  return {
    schema_version: '1.0',
    exported_at: now_(),
    exported_by: email,
    meta: meta[0] || {},
    units,
  };
}

function exportMarkdown_(params, email) {
  const units = sheetToArray_('Units');
  let md = `# POI Builder 내보내기\n\n내보낸 시각: ${now_()}\n\n`;
  units.forEach(u => {
    md += `## [${u.grade}학년] ${u.theme_id} — ${u.title || u.central_idea}\n\n`;
    md += `**Central Idea**: ${u.central_idea}\n\n`;
    md += `**상태**: ${u.status}\n\n---\n\n`;
  });
  return { markdown: md };
}
