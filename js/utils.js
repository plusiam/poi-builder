// 공통 유틸리티

const Utils = {
  // JSON 문자열 → 배열/객체 (실패 시 기본값)
  parseJSON(str, fallback = []) {
    try { return JSON.parse(str); } catch (_) { return fallback; }
  },

  // 상태 → 한글 레이블
  statusLabel(status) {
    return { draft: '초안', in_review: '검토중', approved: '승인됨', finalized: '확정', archived: '보관' }[status] || status;
  },

  // 상태 → CSS 클래스
  statusClass(status) {
    return { draft: 'status-draft', in_review: 'status-review', approved: 'status-approved', finalized: 'status-final', archived: 'status-archived' }[status] || '';
  },

  // 학년 → 레이블
  gradeLabel(grade) {
    return `${grade}학년`;
  },

  // 날짜 포맷
  formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  // 오류 토스트
  toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
  },

  // 로딩 스피너 토글
  setLoading(el, loading) {
    if (loading) { el.dataset.originalText = el.textContent; el.disabled = true; el.textContent = '처리 중...'; }
    else { el.disabled = false; el.textContent = el.dataset.originalText || el.textContent; }
  },

  // 6개 TDT 색상
  themeColor(themeId) {
    const colors = {
      who_we_are: '#e8f0fe',
      where_we_are_in_place_and_time: '#fce8b2',
      how_we_express_ourselves: '#fce8f3',
      how_the_world_works: '#e6f4ea',
      how_we_organize_ourselves: '#e8eaed',
      sharing_the_planet: '#e4f7fb',
    };
    return colors[themeId] || '#f8f9fa';
  },
};
