import { json, sha256, clientMeta, ipHash, pwHash, verifyTurnstile } from './_lib.js';

// GET /api/presets?sort=new|top&offset=0&q=검색어
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') === 'top' ? 'top' : 'new';
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 50);
  const limit = 30;

  const order = sort === 'top'
    ? 'votes DESC, created_at DESC'
    : 'created_at DESC';

  const binds = [];
  let where = '';
  if (q) {
    // LIKE 와일드카드(%, _, \)는 이스케이프 후 ESCAPE 절로 처리 → 안전한 부분일치
    const like = '%' + q.replace(/[\\%_]/g, m => '\\' + m) + '%';
    where = `WHERE title LIKE ? ESCAPE '\\' OR nick LIKE ? ESCAPE '\\'`;
    binds.push(like, like);
  }
  binds.push(limit + 1, offset);

  const { results } = await env.DB.prepare(
    `SELECT id, title, nick, code, votes, created_at
       FROM presets ${where} ORDER BY ${order} LIMIT ? OFFSET ?`
  ).bind(...binds).all();

  const hasMore = results.length > limit;
  return json({ items: results.slice(0, limit), hasMore });
}

// POST /api/presets  { title, nick, code, pw, turnstileToken }
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: '잘못된 요청' }, 400); }

  const title = String(body.title || '').trim();
  const nick = String(body.nick || '').trim();
  const code = String(body.code || '').trim();
  const pw = String(body.pw || '');
  const token = body.turnstileToken;

  if (title.length < 1 || title.length > 40) return json({ error: '제목은 1~40자' }, 400);
  if (nick.length < 1 || nick.length > 16) return json({ error: '닉네임은 1~16자' }, 400);
  if (pw.length < 4) return json({ error: '비밀번호는 4자 이상' }, 400);
  if (!/^LR1:/.test(code)) return json({ error: 'LR1 프리셋 코드가 아닙니다' }, 400);
  if (code.length > 40000) return json({ error: '프리셋 코드가 너무 큽니다' }, 400);
  if (/https?:\/\/|www\.|\.com|\.net|텔레|카톡|문의|광고/i.test(title))
    return json({ error: '제목에 링크·홍보성 문구는 넣을 수 없습니다' }, 400);

  const { ip } = clientMeta(request);
  if (!(await verifyTurnstile(env, token, ip)))
    return json({ error: '봇 검증 실패. 새로고침 후 다시 시도하세요' }, 403);

  const iph = await ipHash(ip);
  const now = Date.now();

  // 등록 rate limit: 같은 IP 최근 10분 내 5건 초과 차단
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM presets WHERE ip_hash = ? AND created_at > ?`
  ).bind(iph, now - 600000).first();
  if (recent && recent.c >= 5)
    return json({ error: '잠시 후 다시 시도하세요 (등록 제한)' }, 429);

  const codeHash = await sha256(code);
  const dup = await env.DB.prepare(`SELECT id FROM presets WHERE code_hash = ?`).bind(codeHash).first();
  if (dup) return json({ error: '이미 등록된 프리셋입니다', id: dup.id }, 409);

  const ph = await pwHash(pw, env);
  const res = await env.DB.prepare(
    `INSERT INTO presets (title, nick, code, code_hash, pw_hash, votes, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(title, nick, code, codeHash, ph, iph, now).run();

  return json({ ok: true, id: res.meta.last_row_id });
}
