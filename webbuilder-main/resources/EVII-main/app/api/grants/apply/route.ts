import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { name, email, project, repo, summary } = data || {} as {
      name?: string;
      email?: string;
      project?: string;
      repo?: string;
      summary?: string;
    };

    if (!name || !email || !project || !summary) {
      return NextResponse.json({ ok: false, error: { message: 'Missing required fields' } }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: { message: 'Invalid email' } }, { status: 400 });
    }

    const ip = (typeof req.headers.get === 'function' && (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'))) || undefined;
    const ua = (typeof req.headers.get === 'function' && req.headers.get('user-agent')) || undefined;

    const payload = {
      name,
      email,
      project,
      repo: repo || null,
      summary,
      meta: { ip, ua, ts: new Date().toISOString() },
    };

    // Optional: forward to a webhook if configured
    const webhook = process.env.GRANTS_WEBHOOK_URL;
    if (webhook) {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'grant_application', data: payload }),
      }).catch(() => {});
    }

    // Log to server for visibility (can be replaced with DB persistence)
    console.log('[grants] application', payload);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: { message: e?.message || 'Failed to submit' } }, { status: 500 });
  }
}
