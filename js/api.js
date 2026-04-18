// GAS Web App 호출 공통 래퍼

const API = (() => {
  async function get(action, params = {}) {
    const url = new URL(CONFIG.GAS_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('Authorization', `Bearer ${Auth.getToken()}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), { redirect: 'follow' });
    return _parse(res);
  }

  async function post(action, body = {}) {
    const url = new URL(CONFIG.GAS_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('Authorization', `Bearer ${Auth.getToken()}`);

    const res = await fetch(url.toString(), {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });
    return _parse(res);
  }

  async function _parse(res) {
    const json = await res.json();
    if (!json.ok) {
      const err = new Error(json.error?.message || '알 수 없는 오류');
      err.code = json.error?.code;
      throw err;
    }
    return json.data;
  }

  return { get, post };
})();
