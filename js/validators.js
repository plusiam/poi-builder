// 입력 검증 규칙 (프론트 UX용)

const Validators = {
  centralIdea(val) {
    if (!val || val.trim().length < 10) return { ok: false, msg: '최소 10자 이상 입력하세요' };
    if (val.trim().length > 200) return { ok: false, msg: '200자 이내로 작성하세요' };
    if (val.trim().endsWith('?')) return { ok: false, warn: true, msg: '진술문으로 작성하세요 (물음표로 끝나면 안 됩니다)' };
    return { ok: true };
  },

  linesOfInquiry(arr) {
    // LOI는 선택 항목 (v3.4) — 비어 있어도 통과
    if (!arr || arr.length === 0) return { ok: true };
    if (arr.length > 4) return { ok: false, msg: '탐구 질문은 최대 4개입니다' };
    // 작성된 항목만 길이 검증 (5자 미만은 경고)
    for (const line of arr) {
      if (line && line.trim().length > 0 && line.trim().length < 5) {
        return { ok: false, warn: true, msg: '작성하실 거면 각 탐구 질문은 5자 이상 권장합니다' };
      }
    }
    return { ok: true };
  },

  keyConcepts(arr) {
    if (!arr || arr.length === 0) return { ok: false, msg: 'Key Concept을 1개 이상 선택하세요' };
    if (arr.length > 3) return { ok: false, msg: 'Key Concept은 최대 3개입니다' };
    return { ok: true };
  },

  // 필드에 검증 결과 표시
  show(fieldId, result) {
    const errEl = document.getElementById(`${fieldId}-error`);
    const warnEl = document.getElementById(`${fieldId}-warn`);
    if (errEl) errEl.classList.toggle('show', !result.ok && !result.warn);
    if (warnEl) warnEl.classList.toggle('show', !!result.warn);
    const input = document.getElementById(fieldId);
    if (input) input.classList.toggle('error', !result.ok && !result.warn);
    return result.ok;
  },
};
