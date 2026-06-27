import { json } from './_lib.js';

// GET /api/geo — 접속 국가코드 반환 (Cloudflare가 무료로 제공)
export async function onRequestGet({ request }) {
  return json({ country: (request.cf && request.cf.country) || null });
}
