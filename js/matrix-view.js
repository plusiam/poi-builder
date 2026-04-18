// POI 매트릭스 렌더링

const MatrixView = (() => {
  const THEMES = [
    { id: 'who_we_are',                        name: '우리는 누구인가' },
    { id: 'where_we_are_in_place_and_time',    name: '우리는 어떤 시공간에 있는가' },
    { id: 'how_we_express_ourselves',           name: '우리는 어떻게 표현하는가' },
    { id: 'how_the_world_works',                name: '세상은 어떻게 작동하는가' },
    { id: 'how_we_organize_ourselves',          name: '우리는 어떻게 조직되는가' },
    { id: 'sharing_the_planet',                 name: '지구를 공유하기' },
  ];
  const GRADES = [1, 2, 3, 4, 5, 6];

  function render(containerId, units, userRole, onCellClick) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // grade×theme 인덱스 생성
    const index = {};
    (units || []).forEach(u => {
      const key = `${u.grade}_${u.theme_id}`;
      if (!index[key]) index[key] = [];
      index[key].push(u);
    });

    const canEdit = ['editor', 'admin'].includes(userRole);

    const table = document.createElement('table');
    table.className = 'matrix-table';

    // 헤더
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    const th0 = document.createElement('th');
    th0.textContent = '학년';
    headerRow.appendChild(th0);
    THEMES.forEach(t => {
      const th = document.createElement('th');
      th.textContent = t.name;
      headerRow.appendChild(th);
    });

    // 바디
    const tbody = table.createTBody();
    GRADES.forEach(grade => {
      const tr = tbody.insertRow();
      const gradeCell = tr.insertCell();
      gradeCell.className = 'grade-cell';
      gradeCell.textContent = `${grade}학년`;

      THEMES.forEach(theme => {
        const td = tr.insertCell();
        td.className = 'uoi-cell';
        td.style.background = Utils.themeColor(theme.id);

        const key = `${grade}_${theme.id}`;
        const cellUnits = index[key] || [];

        if (cellUnits.length > 0) {
          cellUnits.forEach(u => {
            const mini = _buildMiniCard(u);
            mini.addEventListener('click', () => onCellClick && onCellClick(u));
            td.appendChild(mini);
          });
        } else {
          td.classList.add('empty');
          if (canEdit) {
            const addBtn = document.createElement('button');
            addBtn.className = 'add-uoi-btn';
            addBtn.innerHTML = `<span>+</span> 새 UOI`;
            addBtn.addEventListener('click', () => onCellClick && onCellClick({ grade, theme_id: theme.id, _new: true }));
            td.appendChild(addBtn);
          }
        }
      });
    });

    container.innerHTML = '';
    container.appendChild(table);
  }

  function _buildMiniCard(u) {
    const concepts = Utils.parseJSON(u.key_concepts, []);
    const div = document.createElement('div');
    div.className = 'uoi-card-mini';
    div.style.background = Utils.themeColor(u.theme_id);
    div.innerHTML = `
      <div class="uoi-title">${u.title || u.central_idea || '(제목 없음)'}</div>
      <div class="uoi-ci">${u.central_idea || ''}</div>
      <div class="uoi-footer">
        <span class="badge ${Utils.statusClass(u.status)}">${Utils.statusLabel(u.status)}</span>
        <span style="font-size:.7rem;color:var(--text-secondary)">${concepts.length ? concepts.slice(0,2).join(' · ') : ''}</span>
      </div>`;
    return div;
  }

  return { render };
})();
