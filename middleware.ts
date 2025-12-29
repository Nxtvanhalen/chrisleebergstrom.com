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
    '192.0.2.1', // M247 IP
    '192.0.2.1', // Korean XMLRPC attacker
    // Spoofed Mobile UA attackers (Dec 2025)
    '192.0.2.1',   // Spoofed Mobile UA
    '192.0.2.1', // Spoofed Mobile UA
    '192.0.2.1',   // Spoofed Mobile UA
    '192.0.2.1',  // Spoofed Mobile UA
    '192.0.2.1',// Spoofed Mobile UA
    '192.0.2.1',  // Spoofed Mobile UA
    '192.0.2.1',  // Spoofed Mobile UA
    '192.0.2.1',   // Spoofed Mobile UA
    '192.0.2.1',   // Spoofed Mobile UA
    '192.0.2.1',   // Spoofed Mobile UA
    '192.0.2.1', // Spoofed Mobile UA
    // Credential hunters (Dec 2025)
    '192.0.2.1', // wp-login.php credential hunter
    '192.0.2.1',   // CCleaner suspicious UA
    '192.0.2.1', // CRITICAL: wp-login.php credential hunting attack
    '192.0.2.1', // Spoofed Bot: Cloud IP impersonating iPhone
    '192.0.2.1', // Tencent Cloud spoofing iPhone UA
    // Dec 29 2025 - Web shell scanners & credential hunters
    '192.0.2.1',  // High volume web shell/script scanning (14 requests in 5s)
    '192.0.2.1', // Credential hunting attempt
    '192.0.2.1',   // Credential hunting attempt
    // MONITOR (not blocked yet): '192.0.2.1' - High traffic volume, rapid non-cached fetching - Dec 2025
];

// 2. THE BAD AGENTS
const BLOCKED_USER_AGENTS = [
    'VertexWP', 'Go-http-client', 'Python/3.10', 'aiohttp',
    'httpx', 'python-httpx', 'curl', 'wget', 'CCleaner',
];

// 3. BAD PATHS (New Strategy)
// If anyone asks for these, they are 100% a bot.
const BLOCKED_PATHS = [
    '/wp-admin',
    '/wp-login.php',
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
    '49.51.', '43.135.', '150.109.', '43.165.', '43.130.', '43.159.', // Dec 2025 additions
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

