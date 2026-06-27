import { json, clientMeta, voterHash, looksLikeDatacenter } from './_lib.js';

// POST /api/vote  { id }
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: '잘못된 요청' }, 400); }
  const id = parseInt(body.id, 10);
  if (!id) return json({ error: 'id 누락' }, 400);

  const { ip, asn, asOrg } = clientMeta(request);

  // VPN·데이터센터 경유 추천 차단 (캐주얼 조작 방어)
  if (looksLikeDatacenter(asOrg))
    return json({ error: 'VPN·프록시에서는 추천할 수 없습니다' }, 403);

  const vh = await voterHash(ip, asn);
  const now = Date.now();

  const post = await env.DB.prepare(`SELECT id FROM presets WHERE id = ?`).bind(id).first();
  if (!post) return json({ error: '없는 프리셋' }, 404);

  // (post_id, voter_hash) PK → 중복 추천 시 INSERT 실패
  try {
    await env.DB.prepare(
      `INSERT INTO votes (post_id, voter_hash, created_at) VALUES (?, ?, ?)`
    ).bind(id, vh, now).run();
  } catch {
    return json({ error: '이미 추천했습니다' }, 409);
  }

  await env.DB.prepare(`UPDATE presets SET votes = votes + 1 WHERE id = ?`).bind(id).run();
  const row = await env.DB.prepare(`SELECT votes FROM presets WHERE id = ?`).bind(id).first();
  return json({ ok: true, votes: row.votes });
}
