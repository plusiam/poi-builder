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

  // 6 TDT — IB PYP 인증 기준
  const THEMES = [
    { id: 'who_we_are',                        name: '우리는 누구인가',           short: 'Who We Are' },
    { id: 'where_we_are_in_place_and_time',    name: '우리는 어떤 시공간에 있는가', short: 'Where We Are' },
    { id: 'how_we_express_ourselves',           name: '우리는 어떻게 표현하는가',     short: 'How We Express' },
    { id: 'how_the_world_works',                name: '세상은 어떻게 작동하는가',     short: 'How the World' },
    { id: 'how_we_organize_ourselves',          name: '우리는 어떻게 조직되는가',     short: 'How We Organize' },
    { id: 'sharing_the_planet',                 name: '지구를 공유하기',              short: 'Sharing Planet' },
  ];

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

  // ── TDT × 학년 균형 히트맵 (IB PYP 인증 기준) ───────────
  //
  // 인증 규칙:
  //  - 각 학년 × 각 TDT = 최소 1개 단원 (총 36 셀 모두 채워야 함)
  //  - 같은 학년 + 같은 TDT가 2개 이상이면 ⚠️ (1개 권장)
  //  - 6학년은 5+Exhibition 변형 허용 (현재 도구는 6 TDT 권장 기준 검사)
  //
  // 색상:
  //   0개 → 빨강 (미충족)
  //   1개 → 초록 (적정)
  //   2개+ → 노랑 (과다)

  function renderThemeBalance(units) {
    const container = document.getElementById('theme-balance-container');
    const summaryEl = document.getElementById('theme-balance-summary');
    if (!container) return;

    // grade × theme 카운트
    const counts = {};
    THEMES.forEach(t => {
      counts[t.id] = {};
      GRADES.forEach(g => { counts[t.id][g] = 0; });
    });

    (units || []).forEach(u => {
      if (u.deleted === true) return;
      // archived 단원도 인증 매트릭스 평가에서는 제외
      if (u.status === 'archived') return;
      if (counts[u.theme_id] && counts[u.theme_id][u.grade] !== undefined) {
        counts[u.theme_id][u.grade]++;
      }
    });

    // 통계
    let missing = 0;        // 0개 셀
    let okCells = 0;        // 1개 셀
    let overCells = 0;      // 2개+ 셀
    const missingList = [];
    const overList = [];

    THEMES.forEach(t => {
      GRADES.forEach(g => {
        const cnt = counts[t.id][g];
        if (cnt === 0)      { missing++; missingList.push(`${g}학년 ${t.name}`); }
        else if (cnt === 1) okCells++;
        else                { overCells++; overList.push(`${g}학년 ${t.name} (${cnt}개)`); }
      });
    });

    const totalCells = THEMES.length * GRADES.length;  // 36
    const coveragePct = Math.round((okCells + overCells) / totalCells * 100);

    // 요약 배지
    if (summaryEl) {
      const tone =
        missing === 0 && overCells === 0 ? 'tbs-ok' :
        missing > 0 ? 'tbs-warn' : 'tbs-info';
      summaryEl.className = `theme-balance-summary ${tone}`;
      summaryEl.innerHTML = `
        <span class="tbs-cov">커버리지 ${coveragePct}%</span>
        <span class="tbs-sep">·</span>
        <span class="tbs-ok-cnt">✅ ${okCells}</span>
        <span class="tbs-warn-cnt">⚠️ 미충족 ${missing}</span>
        <span class="tbs-over-cnt">🔁 과다 ${overCells}</span>`;
    }

    // 테이블 생성
    let html = '<table class="heatmap-table tdt-table"><thead><tr><th class="concept-col">TDT</th>';
    GRADES.forEach(g => { html += `<th>${g}학년</th>`; });
    html += '<th class="row-total">합계</th></tr></thead><tbody>';

    THEMES.forEach(t => {
      const rowSum = GRADES.reduce((s, g) => s + counts[t.id][g], 0);
      html += `<tr>
        <td style="font-weight:600;text-align:left">
          ${t.name}
          <br><span style="font-size:.7rem;color:var(--text-secondary);font-weight:400">${t.short}</span>
        </td>`;
      GRADES.forEach(g => {
        const cnt = counts[t.id][g];
        let cls, title;
        if (cnt === 0) {
          cls = 'tdt-cell tdt-miss';
          title = `⚠️ ${g}학년에 ${t.name} 단원 없음 — 인증 미충족`;
        } else if (cnt === 1) {
          cls = 'tdt-cell tdt-ok';
          title = `✅ ${g}학년 ${t.name}: 1개 (적정)`;
        } else {
          cls = 'tdt-cell tdt-over';
          title = `🔁 ${g}학년 ${t.name}: ${cnt}개 (학년당 1개 권장)`;
        }
        html += `<td class="${cls}" title="${title}">${cnt || '—'}</td>`;
      });
      html += `<td class="row-total">${rowSum}</td>`;
      html += '</tr>';
    });

    // 하단 — 학년별 합계
    html += '<tr class="col-total-row"><td style="text-align:left;font-weight:600">학년별 합계</td>';
    GRADES.forEach(g => {
      const colSum = THEMES.reduce((s, t) => s + counts[t.id][g], 0);
      const cls = colSum === THEMES.length ? 'col-total col-ok'
                : colSum < THEMES.length   ? 'col-total col-miss'
                                            : 'col-total col-over';
      html += `<td class="${cls}" title="${g}학년 단원 ${colSum}개 (권장 ${THEMES.length}개)">${colSum}/${THEMES.length}</td>`;
    });
    html += `<td class="row-total"><strong>${okCells + overCells}/${totalCells}</strong></td></tr>`;
    html += '</tbody></table>';

    // 범례
    html += `
      <div class="heatmap-legend">
        <span class="legend-item"><span class="legend-dot" style="background:#fce8e6"></span>0개 ⚠️ 미충족</span>
        <span class="legend-item"><span class="legend-dot" style="background:#e6f4ea"></span>1개 ✅ 적정</span>
        <span class="legend-item"><span class="legend-dot" style="background:#fef7e0"></span>2개+ 🔁 과다</span>
      </div>`;

    // 경고 박스
    if (missingList.length > 0 || overList.length > 0) {
      html += '<div class="tdt-issues">';
      if (missingList.length > 0) {
        html += `<div class="tdt-issue tdt-issue-miss">
          ⚠️ <strong>미충족 ${missingList.length}건</strong>: ${missingList.slice(0, 6).join(', ')}${missingList.length > 6 ? ` 외 ${missingList.length - 6}건` : ''}
        </div>`;
      }
      if (overList.length > 0) {
        html += `<div class="tdt-issue tdt-issue-over">
          🔁 <strong>과다 ${overList.length}건</strong>: ${overList.slice(0, 6).join(', ')}${overList.length > 6 ? ` 외 ${overList.length - 6}건` : ''}
        </div>`;
      }
      html += '</div>';
    } else {
      html += `<div class="tdt-issues">
        <div class="tdt-issue tdt-issue-success">
          ✅ <strong>완벽한 균형</strong> — 모든 학년이 6개 TDT를 정확히 1개씩 다루고 있습니다. (IB PYP 인증 매트릭스 충족)
        </div>
      </div>`;
    }

    container.innerHTML = html;
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

  return { renderKPI, renderHeatmap, renderThemeBalance, renderActivityFeed };
})();
