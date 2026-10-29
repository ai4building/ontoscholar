import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import {
  startAgentRun,
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

    const started = await startAgentRun({ apiKey, agentId, prompt, threadId });
    const { threadId: thread, runId } = started;

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