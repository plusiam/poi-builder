// 대시보드 렌더링 — KPI · 매트릭스 · 히트맵 · 활동 피드

const Dashboard = (() => {
  const CONCEPTS = [
    { id: 'form',           name: '형태' },
    { id: 'function',       name: '기능' },
    { id: 'causation',      name: '원인' },
    { id: 'change',         name: '변화' },
    { id: 'connection',     name: '연결' },
    { id: 'perspective',    name: '관점' },
    { id: 'responsibility', name: '책임' },
    { id: 'reflection',     name: '성찰' },
  ];
  const GRADES = [1, 2, 3, 4, 5, 6];

  // ── KPI 카드 ────────────────────────────────────────────

  function renderKPI(units) {
    const total     = units.length;
    const finalized = units.filter(u => u.status === 'finalized').length;
    const inReview  = units.filter(u => u.status === 'in_review' || u.status === 'approved').length;
    const draft     = units.filter(u => u.status === 'draft').length;

    _setKPI('kpi-total',   total,     `전체 ${total}개 UOI`);
    _setKPI('kpi-final',   finalized, '확정 완료');
    _setKPI('kpi-review',  inReview,  '검토 / 승인 대기');
    _setKPI('kpi-draft',   draft,     '초안 작성 중');
  }

  function _setKPI(id, value, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.kpi-value').textContent = value;
    el.querySelector('.kpi-label').textContent = label;
  }

  // ── Key Concepts 히트맵 ─────────────────────────────────

  function renderHeatmap(units) {
    const container = document.getElementById('heatmap-container');
    if (!container) return;

    // grade × concept 카운트
    const counts = {};
    CONCEPTS.forEach(c => {
      counts[c.id] = {};
      GRADES.forEach(g => { counts[c.id][g] = 0; });
    });

    units.forEach(u => {
      const kcs = Utils.parseJSON(u.key_concepts, []);
      kcs.forEach(cid => {
        if (counts[cid] && counts[cid][u.grade] !== undefined) {
          counts[cid][u.grade]++;
        }
      });
    });

    // 누락 경고 수집
    const warnings = [];
    CONCEPTS.forEach(c => {
      GRADES.forEach(g => {
        if (counts[c.id][g] === 0) warnings.push(`${g}학년 ${c.name}`);
      });
    });

    // 테이블 생성
    let html = '<table class="heatmap-table"><thead><tr><th class="concept-col">개념</th>';
    GRADES.forEach(g => { html += `<th>${g}학년</th>`; });
    html += '</tr></thead><tbody>';

    CONCEPTS.forEach(c => {
      html += `<tr><td style="font-weight:600;text-align:left">${c.name}<br><span style="font-size:.7rem;color:var(--text-secondary);font-weight:400">${c.id}</span></td>`;
      GRADES.forEach(g => {
        const cnt = counts[c.id][g];
        const cls = cnt === 0 ? 'heatmap-0' : cnt === 1 ? 'heatmap-1' : cnt === 2 ? 'heatmap-2' : 'heatmap-3';
        const warn = cnt === 0 ? ' heatmap-warn' : '';
        const title = cnt === 0 ? `⚠️ ${g}학년에 ${c.name} 없음` : `${g}학년: ${cnt}회`;
        html += `<td class="${cls}${warn}" title="${title}">${cnt}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    html += `
    <div class="heatmap-legend">
      <span class="legend-item"><span class="legend-dot" style="background:#fce8e6"></span>0회 ⚠️</span>
      <span class="legend-item"><span class="legend-dot" style="background:#fef7e0"></span>1회</span>
      <span class="legend-item"><span class="legend-dot" style="background:#e8f0fe"></span>2회</span>
      <span class="legend-item"><span class="legend-dot" style="background:#e6f4ea"></span>3회+</span>
    </div>`;

    if (warnings.length > 0) {
      html += `<div style="margin-top:.75rem;padding:.6rem .875rem;background:#fce8e6;border-radius:6px;font-size:.8rem;color:#d93025">
        ⚠️ 미출현 항목 ${warnings.length}개: ${warnings.slice(0, 5).join(', ')}${warnings.length > 5 ? ` 외 ${warnings.length - 5}개` : ''}
      </div>`;
    }

    container.innerHTML = html;
  }

  // ── 활동 피드 ───────────────────────────────────────────

  function renderActivityFeed(changelog) {
    const container = document.getElementById('activity-feed');
    if (!container) return;

    const ACTION_ICONS = {
      create: '✏️', update: '📝', status_change: '🔄',
      finalize: '✅', unlock: '🔓', comment: '💬',
    };
    const ACTION_LABELS = {
      create: '생성', update: '수정', status_change: '상태 변경',
      finalize: '확정', unlock: '잠금 해제', comment: '코멘트',
    };
    const STATUS_KO = {
      draft: '초안', in_review: '검토 요청', approved: '승인',
      finalized: '확정', archived: '보관',
    };

    // 최근 24시간 필터 + 최대 20개
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = (changelog || [])
      .filter(c => new Date(c.timestamp).getTime() > cutoff)
      .slice(0, 20);

    if (recent.length === 0) {
      container.innerHTML = '<div class="feed-empty">최근 24시간 활동 없음</div>';
      return;
    }

    container.innerHTML = recent.map(c => {
      const icon  = ACTION_ICONS[c.action] || '📌';
      const label = ACTION_LABELS[c.action] || c.action;
      const actor = c.actor_email?.split('@')[0] || '알 수 없음';
      const after = c.after_value ? (STATUS_KO[c.after_value] || c.after_value) : '';
      const desc  = c.action === 'status_change'
        ? `→ <strong>${after}</strong>`
        : (c.diff_summary || '');

      return `
      <div class="activity-item">
        <span class="activity-icon">${icon}</span>
        <div class="activity-text">
          <strong>${actor}</strong> · ${label} ${desc}
          <div style="font-size:.75rem;color:var(--text-secondary)">${c.unit_id?.slice(0, 8) || ''}</div>
        </div>
        <span class="activity-time">${_relTime(c.timestamp)}</span>
      </div>`;
    }).join('');
  }

  function _relTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1)  return '방금';
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    return `${Math.floor(hr / 24)}일 전`;
  }

  return { renderKPI, renderHeatmap, renderActivityFeed };
})();
