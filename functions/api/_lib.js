// 공통 유틸 — Pages Functions 전반에서 재사용

const SALT = 'lyr_v1_5f3a';

export async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function clientMeta(request) {
  const cf = request.cf || {};
  const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
  const asn = String(cf.asn || '0');
  const asOrg = String(cf.asOrganization || '').toLowerCase();
  return { ip, asn, asOrg };
}

export async function ipHash(ip) {
  return sha256('ip:' + ip + SALT);
}

export async function voterHash(ip, asn) {
  return sha256('v:' + ip + ':' + asn + SALT);
}

// 삭제 비밀번호 해시. salt는 Pages secret(PW_SALT) 우선, 미설정 시 코드 기본값.
// 공개 레포에서도 운영 인스턴스의 salt는 secret으로 가려진다.
export async function pwHash(pw, env) {
  const salt = (env && env.PW_SALT) || SALT;
  return sha256('pw:' + pw + salt);
}

// 데이터센터/VPN ASN 휴리스틱 — 무료 플랜엔 botManagement·threatScore가 없어
// asOrganization 문자열로 잘 알려진 호스팅·VPN 사업자를 근사 차단한다.
const DC_KEYWORDS = [
  'amazon', 'aws', 'google cloud', 'google llc', 'microsoft', 'azure',
  'digitalocean', 'linode', 'akamai', 'ovh', 'hetzner', 'contabo',
  'vultr', 'oracle cloud', 'leaseweb', 'm247', 'datacamp', 'data camp',
  'choopa', 'quadranet', 'colocrossing', 'psychz', 'hostwinds',
  'nordvpn', 'mullvad', 'expressvpn', 'privateinternetaccess', 'surfshark',
  'cyberghost', 'protonvpn', 'ipvanish', 'tor exit', 'tor-exit',
];
export function looksLikeDatacenter(asOrg) {
  if (!asOrg) return false;
  return DC_KEYWORDS.some(k => asOrg.includes(k));
}

export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // 사이트키 미발급 시 통과 (초기 운영)
  if (!token) return false;
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET);
  body.append('response', token);
  body.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  const d = await r.json();
  return !!d.success;
}
