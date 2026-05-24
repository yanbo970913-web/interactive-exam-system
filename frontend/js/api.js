/**
 * API 客戶端 — 封裝所有後端請求
 */
const API = (() => {
  const BASE = '/api';

  function getToken() {
    return localStorage.getItem('exam_token');
  }

  async function request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    const res = await fetch(BASE + path, opts);
    const data = await res.json().catch(() => ({ error: '伺服器回應格式錯誤' }));

    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    // 認證
    auth: {
      login:          (u, p) => request('POST', '/auth/login', { username: u, password: p }),
      me:             ()     => request('GET',  '/auth/me'),
      changePassword: (curr, next) => request('POST', '/auth/change-password', { current_password: curr, new_password: next }),
      updateProfile:  (data) => request('POST', '/auth/update-profile', data),
    },
    // 使用者管理 (admin)
    users: {
      list:   ()       => request('GET',    '/users'),
      create: (data)   => request('POST',   '/users', data),
      update: (id, d)  => request('PUT',    `/users/${id}`, d),
      delete: (id)     => request('DELETE', `/users/${id}`),
      stats:  (id)     => request('GET',    `/users/${id}/stats`),
    },
    // 題目
    questions: {
      list:    (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request('GET', `/questions${qs ? '?' + qs : ''}`);
      },
      get:     (id)    => request('GET',    `/questions/${id}`),
      create:  (data)  => request('POST',   '/questions', data),
      update:  (id, d) => request('PUT',    `/questions/${id}`, d),
      delete:  (id)    => request('DELETE', `/questions/${id}`),
      toggle:  (id)    => request('PATCH',  `/questions/${id}/toggle`),
      subjects:()      => request('GET',    '/questions/subjects/list'),
    },
    // 考試
    exams: {
      list:       ()        => request('GET',  '/exams'),
      get:        (id)      => request('GET',  `/exams/${id}`),
      create:     (data)    => request('POST', '/exams', data),
      update:     (id, d)   => request('PUT',  `/exams/${id}`, d),
      delete:     (id)      => request('DELETE',`/exams/${id}`),
      start:      (id)      => request('POST', `/exams/${id}/start`),
      submit:     (attemptId, answers) => request('POST', `/exams/attempts/${attemptId}/submit`, { answers }),
      leaderboard:(id)      => request('GET',  `/exams/${id}/leaderboard`),
      myAttempts: (id)      => request('GET',  `/exams/${id}/my-attempts`),
      stats:      ()        => request('GET',  '/exams/stats/overview'),
    },
    // AI
    ai: {
      explain:    (data) => request('POST', '/ai/explain', data),
      quickHint:  (data) => request('POST', '/ai/quick-hint', data),
    },
    // 管理者錯題分析
    admin: {
      attempts: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request('GET', `/admin/attempts${qs ? '?' + qs : ''}`);
      },
      attemptDetail: (id) => request('GET', `/admin/attempts/${id}`),
      students:      ()   => request('GET', '/admin/students'),
      // 科目管理
      subjects:      ()           => request('GET',    '/admin/subjects'),
      createSubject: (data)       => request('POST',   '/admin/subjects', data),
      updateSubject: (id, data)   => request('PUT',    `/admin/subjects/${id}`, data),
      toggleSubject: (id)         => request('PATCH',  `/admin/subjects/${id}/toggle`),
      deleteSubject:   (id, cascade) => request('DELETE', `/admin/subjects/${id}${cascade ? '?cascade=true' : ''}`),
      syncVocabulary:  ()           => request('POST',   '/admin/sync-vocabulary'),
    },
    // 即時進度
    live: {
      heartbeat: (data) => request('POST', '/live/heartbeat', data),
      leave:     (data) => request('POST', '/live/leave', data),
    },
    // 健康
    health: () => request('GET', '/health'),
  };
})();
