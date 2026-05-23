/**
 * 即時作答進度 — Server-Sent Events (SSE)
 * GET  /api/live/stream      → 管理者訂閱 SSE 串流
 * POST /api/live/heartbeat   → 學生每次換題時呼叫（更新進度）
 * POST /api/live/leave       → 學生交卷/離開時呼叫
 */
const express = require('express');
const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

// ── 全域進度快照（重啟後清空，但這是預期行為）──
// Map<attemptId, progressObj>
const liveStore = new Map();

// SSE 客戶端列表（管理者連線）
const sseClients = new Set();

/* ── 廣播最新資料給所有 SSE 客戶端 ── */
function broadcast() {
  const payload = JSON.stringify(
    Array.from(liveStore.values()).sort((a, b) => b.startedAt - a.startedAt)
  );
  const msg = `data: ${payload}\n\n`;
  sseClients.forEach(client => {
    try { client.write(msg); } catch (_) { sseClients.delete(client); }
  });
}

/* ── GET /api/live/stream — 管理者 SSE 連線 ── */
router.get('/stream', requireStaff, (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx buffering 停用
  res.flushHeaders();

  sseClients.add(res);

  // 立即送出目前資料
  const payload = JSON.stringify(Array.from(liveStore.values()));
  res.write(`data: ${payload}\n\n`);

  // Keepalive ping（每 25 秒避免連線中斷）
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    sseClients.delete(res);
  });
});

/* ── POST /api/live/heartbeat — 學生換題更新進度 ── */
router.post('/heartbeat', requireAuth, (req, res) => {
  const { attempt_id, exam_id, exam_title, subject_name, subject_icon,
          current_index, total, answered_count } = req.body;

  if (!attempt_id) return res.status(400).json({ error: 'missing attempt_id' });

  const existing = liveStore.get(Number(attempt_id)) || {};
  liveStore.set(Number(attempt_id), {
    attempt_id:    Number(attempt_id),
    exam_id:       Number(exam_id),
    exam_title:    exam_title || existing.exam_title || '未知考試',
    subject_name:  subject_name || existing.subject_name || '',
    subject_icon:  subject_icon || existing.subject_icon || '📚',
    user_id:       req.user.id,
    display_name:  req.user.display_name || req.user.username,
    current_index: Number(current_index) || 0,
    total:         Number(total) || 0,
    answered_count:Number(answered_count) || 0,
    startedAt:     existing.startedAt || Date.now(),
    lastSeen:      Date.now()
  });

  broadcast();
  res.json({ ok: true });
});

/* ── POST /api/live/leave — 學生交卷/離開 ── */
router.post('/leave', requireAuth, (req, res) => {
  const { attempt_id } = req.body;
  if (attempt_id) liveStore.delete(Number(attempt_id));
  broadcast();
  res.json({ ok: true });
});

// 自動清除超過 3 小時的殭屍記錄（每 30 分鐘）
setInterval(() => {
  const cutoff = Date.now() - 3 * 60 * 60 * 1000;
  for (const [id, p] of liveStore) {
    if (p.lastSeen < cutoff) liveStore.delete(id);
  }
}, 30 * 60 * 1000);

module.exports = router;
