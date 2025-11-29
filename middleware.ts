import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 1. THE BLACKLIST: Known Bad IPs
const BLOCKED_IPS = [
    '192.0.2.1',  // The "Env File" Hacker (Original Attacker)
    '192.0.2.1',   // The "Cloud Hunter" (OVH/Canada - python-httpx)
    '192.0.2.1',  // Tencent Cloud "Fake iPhone"
    '192.0.2.1',  // Tencent Cloud "Fake iPhone"
    '192.0.2.1', // Spam Data Center
    '192.0.2.1',  // The Aggressive WordPress Bot
    '192.0.2.1', // Russian Data Center Scraper
    '192.0.2.1', // <--- Add the new M247 IP
    '192.0.2.1', // <--- Add the Korean XMLRPC attacker
];

// 2. THE BAD AGENTS
const BLOCKED_USER_AGENTS = [
    'VertexWP', 'Go-http-client', 'Python/3.10', 'aiohttp',
    'httpx', 'python-httpx', 'curl', 'wget',
];

// 3. BAD PATHS (New Strategy)
// If anyone asks for these, they are 100% a bot.
const BLOCKED_PATHS = [
    '/wp-admin',
    '/wp-includes',
    '/wp-content',
    '/xmlrpc.php',
    '/wlwmanifest.xml',
    '/.env',
    '/.git',
    '/phpinfo',
];

// 4. KNOWN CLOUD SUBNETS
const DATA_CENTER_RANGES = [
    '43.131.', '43.156.', '170.106.', '45.148.', '99.79.', '110.166.',
];

export function middleware(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const url = request.nextUrl.pathname;

    // --- CHECK 1: Explicit IP Blocks ---
    if (BLOCKED_IPS.includes(ip)) {
        return new NextResponse(JSON.stringify({ error: 'Access Denied' }), { status: 403 });
    }

    // --- CHECK 2: Bad User Agents ---
    if (BLOCKED_USER_AGENTS.some(ua => userAgent.includes(ua))) {
        return new NextResponse(JSON.stringify({ error: 'Bot Detected' }), { status: 403 });
    }

    // --- CHECK 3: Bad Paths (The New Rule) ---
    if (BLOCKED_PATHS.some(path => url.startsWith(path) || url.includes(path))) {
        console.log(`[BLOCKED] Bad Path Requested: ${url} from ${ip}`);
        return new NextResponse(JSON.stringify({ error: 'Invalid Request' }), { status: 403 });
    }

    // --- CHECK 4: Fake Mobile Detector ---
    const isClaimingToBeMobile = userAgent.includes('iPhone') || userAgent.includes('Android');
    const isFromDataCenter = DATA_CENTER_RANGES.some(range => ip.startsWith(range));

    if (isClaimingToBeMobile && isFromDataCenter) {
        return new NextResponse(JSON.stringify({ error: 'VPN/Proxy Detected' }), { status: 403 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

