import { json, pwHash } from './_lib.js';

// POST /api/delete  { id, pw }  또는  { id, adminKey }
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: '잘못된 요청' }, 400); }
  const id = parseInt(body.id, 10);
  if (!id) return json({ error: 'id 누락' }, 400);

  const post = await env.DB.prepare(`SELECT id, pw_hash FROM presets WHERE id = ?`).bind(id).first();
  if (!post) return json({ error: '없는 프리셋' }, 404);

  const isAdmin = env.ADMIN_KEY && body.adminKey && body.adminKey === env.ADMIN_KEY;

  if (!isAdmin) {
    const pw = String(body.pw || '');
    if (!pw) return json({ error: '비밀번호 필요' }, 400);
    const ph = await pwHash(pw, env);
    if (ph !== post.pw_hash) return json({ error: '비밀번호가 틀렸습니다' }, 403);
  }

  await env.DB.prepare(`DELETE FROM presets WHERE id = ?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM votes WHERE post_id = ?`).bind(id).run();
  return json({ ok: true });
}
