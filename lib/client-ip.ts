import { isIP } from 'node:net';

export function clientIp(request: Request): string {
  let address: string | null = null;
  if (process.env.VERCEL === '1') {
    address = request.headers.get('x-vercel-forwarded-for');
  } else if (process.env.VANTA_TRUST_CADDY === '1') {
    address = request.headers.get('x-vanta-client-ip');
  }

  const ip = address?.trim();
  if (!ip || ip.includes('%')) return 'unknown';
  switch (isIP(ip)) {
    case 4: return ip;
    case 6: return new URL(`http://[${ip}]`).hostname.slice(1, -1);
    default: return 'unknown';
  }
}
