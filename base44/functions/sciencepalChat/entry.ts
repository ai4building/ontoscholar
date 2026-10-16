import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import {
  SCIENCEPAL_BASE_URL,
  sciencepalHeaders,
  sciencepalError,
  consumeRunStream,
  getRunStatus,
} from '../../shared/sciencepal.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = secrets.get('SCIENCEPAL_API_KEY');
    if (!apiKey) return Response.json({ error: 'SCIENCEPAL_API_KEY is not set in app secrets' }, { status: 400 });
    const defaultAgentId = secrets.get('SCIENCEPAL_AGENT_ID') || '';

    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return Response.json({ error: 'prompt is required' }, { status: 400 });
    const threadId = body.thread_id ? String(body.thread_id) : null;
    const agentId = body.agent_id ? String(body.agent_id) : defaultAgentId;
    if (!threadId && !agentId) {
      return Response.json({ error: 'agent_id is required (or set the SCIENCEPAL_AGENT_ID secret)' }, { status: 400 });
    }

    let runId: string;
    let thread: string;

    if (threadId) {
      // Continue an existing thread: add message, then start a new run on it.
      const msgResp = await fetch(`${SCIENCEPAL_BASE_URL}/thread/${threadId}/messages`, {
        method: 'POST',
        headers: { ...sciencepalHeaders(apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: crypto.randomUUID(), content: prompt }),
        signal: AbortSignal.timeout(60000),
      });
      if (!msgResp.ok) {
        const detail = await msgResp.text().catch(() => '');
        throw sciencepalError('message', msgResp.status, detail);
      }
      const startResp = await fetch(`${SCIENCEPAL_BASE_URL}/thread/${threadId}/agent/start`, {
        method: 'POST',
        headers: { ...sciencepalHeaders(apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(60000),
      });
      if (!startResp.ok) {
        const detail = await startResp.text().catch(() => '');
        throw sciencepalError('thread start', startResp.status, detail);
      }
      const startData = await startResp.json();
      runId = startData.agent_run_id;
      thread = threadId;
      if (!runId) throw new Error('SciencePal did not return an agent_run_id when starting the thread.');
    } else {
      // New conversation: POST /agent/initiate (urlencoded, as documented).
      const form = new URLSearchParams({
        agent_id: agentId,
        prompt,
        stream: 'true',
        agent_select_type: 'manual',
      });
      const initResp = await fetch(`${SCIENCEPAL_BASE_URL}/agent/initiate`, {
        method: 'POST',
        headers: { ...sciencepalHeaders(apiKey), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal: AbortSignal.timeout(120000),
      });
      if (!initResp.ok) {
        const detail = await initResp.text().catch(() => '');
        throw sciencepalError('initiate', initResp.status, detail);
      }
      const run = await initResp.json();
      thread = run.thread_id;
      runId = run.agent_run_id;
      if (!runId) throw new Error('No agent run was created by SciencePal.');
    }

    const { text } = await consumeRunStream(runId, apiKey);
    const statusData: any = await getRunStatus(runId, apiKey);
    const finalStatus = statusData?.status || 'unknown';

    if (finalStatus === 'failed' || finalStatus === 'stopped' || statusData?.error) {
      return Response.json({
        error: statusData?.error || `Run ${finalStatus}`,
        thread_id: thread,
        agent_run_id: runId,
        status: finalStatus,
      }, { status: 502 });
    }

    return Response.json({
      thread_id: thread,
      agent_run_id: runId,
      status: finalStatus,
      reply: text || '(no text output was returned by the agent)',
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}