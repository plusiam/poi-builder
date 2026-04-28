// 팀 피드백 댓글 모듈 (v3.1, Phase 2-A)
//
// 책임
//  - UOI 단위 댓글 조회/작성/수정/삭제/이모지/해결 처리
//  - 필터(전체/미해결/해결됨/내 댓글/@나에게) 및 anchor_field 필터
//  - 인라인 앵커 댓글 배지 갱신
//
// 의존: API, Auth, Utils

const Comments = (() => {
  const REACTIONS = ['👍', '❤️', '🤔', '🎉', '👀', '✅'];
  let _unitId = null;
  let _all = [];
  let _filter = 'all';
  let _anchorFilter = 'all';
  let _myEmail = null;

  function init(unitId) {
    _unitId = unitId;
    _all = [];
    _filter = 'all';
    _anchorFilter = 'all';
    _myEmail = (Auth.getUser && Auth.getUser()?.email) || null;
    _bindUi();
  }

  // 단원의 실제 LOI 개수에 맞춰 댓글 anchor 셀렉트를 재구성한다.
  // uoi-editor가 _renderLOI 호출 시점마다 호출.
  function syncAnchorOptions(loiCount) {
    const composer = document.getElementById('fb-anchor');
    if (composer) _rebuildAnchorSelect(composer, loiCount, false);

    const filter = document.getElementById('fb-anchor-filter');
    if (filter) _rebuildAnchorFilter(filter);
  }

  function _rebuildAnchorSelect(sel, loiCount, includeAllOption) {
    const prev = sel.value;
    const items = [];
    items.push({ value: 'unit',         label: '전체 단원' });
    items.push({ value: 'central_idea', label: 'Central Idea' });
    const n = Math.max(0, Math.min(4, parseInt(loiCount) || 0));
    for (let i = 0; i < n; i++) items.push({ value: `loi:${i}`, label: `LOI ${i + 1}` });
    items.push({ value: 'key_concepts', label: 'Key Concepts' });
    items.push({ value: 'subject_links', label: '연계 교과' });
    items.push({ value: 'action',        label: 'Action' });
    items.push({ value: 'retro',         label: '회고 (확정 후)' });

    sel.innerHTML = items.map(it => `<option value="${it.value}">${it.label}</option>`).join('');
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
  }

  function _rebuildAnchorFilter(sel) {
    // 필터는 그룹 단위(접두사)로 묶이므로 LOI는 단일 'loi' 옵션 유지
    const prev = sel.value;
    sel.innerHTML = `
      <option value="all">모든 필드</option>
      <option value="unit">전체 단원</option>
      <option value="central_idea">Central Idea</option>
      <option value="loi">Lines of Inquiry</option>
      <option value="key_concepts">Key Concepts</option>
      <option value="subject_links">연계 교과</option>
      <option value="action">Action</option>
      <option value="retro">회고</option>`;
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
  }

  function _bindUi() {
    document.querySelectorAll('.feedback-filters .chip').forEach(btn => {
      btn.onclick = () => {
        _filter = btn.dataset.filter;
        document.querySelectorAll('.feedback-filters .chip').forEach(b =>
          b.classList.toggle('chip-active', b === btn));
        _render();
      };
    });
    const sel = document.getElementById('fb-anchor-filter');
    if (sel) sel.onchange = e => { _anchorFilter = e.target.value; _render(); };
  }

  async function load() {
    if (!_unitId) return;
    try {
      const data = await API.get('comments', { unitId: _unitId });
      _all = Array.isArray(data) ? data : [];
      _render();
      _refreshAnchorBadges();
      _refreshTabBadge();
    } catch (e) {
      // 신규 단원이거나 권한 부족 시 조용히 무시
      _all = [];
      _render();
    }
  }

  async function submit() {
    if (!_unitId) {
      Utils.toast('단원을 먼저 저장한 뒤 댓글을 달 수 있습니다', 'warning');
      return;
    }
    const body = (document.getElementById('fb-body')?.value || '').trim();
    if (!body) { Utils.toast('내용을 입력해주세요', 'warning'); return; }
    if (body.length > 2000) { Utils.toast('2000자를 초과했습니다', 'warning'); return; }

    const anchor = document.getElementById('fb-anchor')?.value || 'unit';
    const mentions = _extractMentions(body);
    const btn = document.getElementById('fb-submit');
    if (btn) Utils.setLoading(btn, true);

    try {
      await API.post('addComment', {
        unit_id: _unitId, body, anchor_field: anchor, mentions,
      });
      document.getElementById('fb-body').value = '';
      Utils.toast('댓글을 달았습니다', 'success');
      await load();
    } catch (e) {
      Utils.toast('댓글 등록 실패: ' + e.message, 'error');
    } finally {
      if (btn) Utils.setLoading(btn, false);
    }
  }

  async function react(commentId, emoji) {
    try {
      await API.post('reactComment', { comment_id: commentId, emoji });
      await load();
    } catch (e) {
      Utils.toast('반응 처리 실패: ' + e.message, 'error');
    }
  }

  async function toggleResolve(commentId) {
    try {
      await API.post('resolveComment', { comment_id: commentId });
      await load();
    } catch (e) {
      Utils.toast('해결 처리 실패: ' + e.message, 'error');
    }
  }

  async function remove(commentId) {
    if (!confirm('이 댓글을 삭제할까요?')) return;
    try {
      await API.post('deleteComment', { comment_id: commentId });
      Utils.toast('댓글을 삭제했습니다', 'success');
      await load();
    } catch (e) {
      Utils.toast('삭제 실패: ' + e.message, 'error');
    }
  }

  async function startEdit(commentId) {
    const c = _all.find(x => x.comment_id === commentId);
    if (!c) return;
    const next = prompt('댓글 수정', c.body || '');
    if (next === null) return;
    const body = next.trim();
    if (!body) { Utils.toast('내용이 비었습니다', 'warning'); return; }
    try {
      await API.post('updateComment', {
        comment_id: commentId, body, mentions: _extractMentions(body),
      });
      await load();
    } catch (e) {
      Utils.toast('수정 실패: ' + e.message, 'error');
    }
  }

  function _extractMentions(text) {
    const re = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const out = new Set();
    let m;
    while ((m = re.exec(text)) !== null) out.add(m[1]);
    return [...out];
  }

  function _filtered() {
    return _all.filter(c => {
      if (c.deleted) return false;
      if (_filter === 'open' && c.resolved) return false;
      if (_filter === 'resolved' && !c.resolved) return false;
      if (_filter === 'mine' && c.author_email !== _myEmail) return false;
      if (_filter === 'mention') {
        const mentions = Array.isArray(c.mentions) ? c.mentions : [];
        if (!mentions.includes(_myEmail)) return false;
      }
      if (_anchorFilter !== 'all') {
        const prefix = String(c.anchor_field || 'unit').split(':')[0];
        if (prefix !== _anchorFilter) return false;
      }
      return true;
    });
  }

  function _render() {
    const thread = document.getElementById('feedback-thread');
    const empty = document.getElementById('feedback-empty');
    if (!thread) return;

    const list = _filtered();
    if (list.length === 0) {
      thread.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    // 부모 → 자식 그룹핑 (단순 1뎁스)
    const tops = list.filter(c => !c.parent_id);
    const childrenOf = (id) => list.filter(c => c.parent_id === id);

    thread.innerHTML = tops.map(c => _renderCard(c, childrenOf(c.comment_id))).join('');
  }

  function _renderCard(c, replies) {
    const isMine = c.author_email === _myEmail;
    const author = (c.author_email || '').split('@')[0] || '익명';
    const time = _fmtTime(c.created_at);
    const anchor = _anchorLabel(c.anchor_field);
    const reactionsHtml = _renderReactions(c);
    const resolved = c.resolved
      ? `<span class="cmt-resolved">✅ 해결됨${c.resolved_by ? ' · ' + _esc(c.resolved_by.split('@')[0]) : ''}</span>`
      : '';
    const ownerActions = isMine
      ? `<button class="cmt-link" onclick="Comments.startEdit('${c.comment_id}')">수정</button>
         <button class="cmt-link cmt-link-danger" onclick="Comments.remove('${c.comment_id}')">삭제</button>` : '';

    return `
      <div class="cmt-card ${c.resolved ? 'cmt-resolved-card' : ''}" data-comment-id="${c.comment_id}">
        <div class="cmt-head">
          <span class="cmt-author">${_esc(author)}</span>
          <span class="cmt-anchor">${anchor}</span>
          <span class="cmt-time">${time}</span>
          ${resolved}
        </div>
        <div class="cmt-body">${_renderBody(c.body)}</div>
        <div class="cmt-foot">
          <div class="cmt-reactions">${reactionsHtml}</div>
          <div class="cmt-actions">
            <button class="cmt-link" onclick="Comments.toggleResolve('${c.comment_id}')">
              ${c.resolved ? '해결 취소' : '✅ 해결'}
            </button>
            ${ownerActions}
          </div>
        </div>
        ${replies.length > 0 ? `<div class="cmt-replies">${replies.map(r => _renderReply(r)).join('')}</div>` : ''}
      </div>`;
  }

  function _renderReply(c) {
    const author = (c.author_email || '').split('@')[0];
    const time = _fmtTime(c.created_at);
    return `
      <div class="cmt-reply">
        <div class="cmt-head">
          <span class="cmt-author">${_esc(author)}</span>
          <span class="cmt-time">${time}</span>
        </div>
        <div class="cmt-body">${_renderBody(c.body)}</div>
      </div>`;
  }

  function _renderReactions(c) {
    const reactions = c.reactions || {};
    const buttons = REACTIONS.map(emoji => {
      const users = reactions[emoji] || [];
      const mine = users.includes(_myEmail);
      const count = users.length;
      return `<button class="cmt-reaction ${mine ? 'cmt-reaction-mine' : ''} ${count === 0 ? 'cmt-reaction-empty' : ''}"
        onclick="Comments.react('${c.comment_id}', '${emoji}')"
        title="${users.map(u => u.split('@')[0]).join(', ')}">
        ${emoji}${count > 0 ? `<span class="cmt-reaction-count">${count}</span>` : ''}
      </button>`;
    });
    return buttons.join('');
  }

  function _renderBody(body) {
    // 멘션 강조 + 줄바꿈 보존
    const escaped = _esc(body || '');
    return escaped.replace(/@([\w.+-]+@[\w.-]+\.\w+)/g,
      '<span class="cmt-mention">@$1</span>').replace(/\n/g, '<br>');
  }

  function _anchorLabel(a) {
    if (!a || a === 'unit') return '전체 단원';
    if (a === 'central_idea') return 'Central Idea';
    if (a === 'key_concepts') return 'Key Concepts';
    if (a === 'subject_links') return '연계 교과';
    if (a === 'action') return 'Action';
    if (a === 'retro') return '회고';
    if (String(a).startsWith('loi:')) {
      const n = parseInt(String(a).split(':')[1]);
      return `LOI ${n + 1}`;
    }
    return a;
  }

  function _refreshAnchorBadges() {
    document.querySelectorAll('[data-anchor-badge]').forEach(el => {
      const target = el.dataset.anchorBadge;
      const open = _all.filter(c => !c.deleted && !c.resolved && _anchorMatches(c.anchor_field, target)).length;
      el.textContent = open > 0 ? `💬 ${open}` : '';
      el.classList.toggle('anchor-badge-active', open > 0);
    });
  }

  function _anchorMatches(field, target) {
    const f = String(field || 'unit');
    if (target === f) return true;
    return f.split(':')[0] === target;
  }

  function _refreshTabBadge() {
    const tabBtn = document.getElementById('tab-btn-feedback');
    if (!tabBtn) return;
    const open = _all.filter(c => !c.deleted && !c.resolved).length;
    tabBtn.textContent = open > 0 ? `💬 팀 피드백 (${open})` : '💬 팀 피드백';
    tabBtn.classList.toggle('tab-badge-active', open > 0);
  }

  function _fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function _esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { init, load, submit, react, toggleResolve, remove, startEdit, syncAnchorOptions };
})();
