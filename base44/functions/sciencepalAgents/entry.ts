import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { SCIENCEPAL_BASE_URL, sciencepalHeaders, sciencepalError } from '../../shared/sciencepal.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = secrets.get('SCIENCEPAL_API_KEY');
    if (!apiKey) return Response.json({ error: 'SCIENCEPAL_API_KEY is not set in app secrets' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const search = String(body.search || '');
    const page = Number(body.page || 1) || 1;
    const limit = Math.min(Number(body.limit || 100) || 100, 100);

    const url = `${SCIENCEPAL_BASE_URL}/agents?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`;
    const resp = await fetch(url, {
      headers: sciencepalHeaders(apiKey),
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw sciencepalError('agents list', resp.status, detail);
    }
    const data = await resp.json();
    const raw = Array.isArray(data) ? data : (data.agents || data.items || []);
    const defaultAgentId = secrets.get('SCIENCEPAL_AGENT_ID') || '';

    return Response.json({
      agents: raw.map((a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description || '',
      })),
      default_agent_id: defaultAgentId,
      pagination: data.pagination || null,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}