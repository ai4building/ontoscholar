import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { startAgentRun, consumeRunStream, getRunStatus } from '../../shared/sciencepal.ts';

const MAX_KEYWORDS = 10;
const MAX_KEYWORD_LEN = 60;

// Pulls a JSON array (or {results: [...]}) out of the agent's free-text answer.
// Scans balanced brackets so prose around the JSON does not break parsing.
function jsonSlices(text: string): any[] {
  const out: any[] = [];
  for (let i = 0; i < text.length; i++) {
    const open = text[i];
    if (open !== '[' && open !== '{') continue;
    const close = open === '[' ? ']' : '}';
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) {
          try { out.push(JSON.parse(text.slice(i, j + 1))); } catch { /* skip malformed */ }
          break;
        }
      }
    }
  }
  return out;
}

function parseResults(text: string): any[] | null {
  const slices = jsonSlices(String(text || ''));
  for (let i = slices.length - 1; i >= 0; i--) {
    const v = slices[i];
    if (Array.isArray(v) && v.some((r) => r && typeof r === 'object' && 'keyword' in r)) return v;
    if (v && typeof v === 'object' && Array.isArray((v as any).results)) return (v as any).results;
  }
  return null;
}

function normaliseKeywords(raw: any): string[] {
  const list = Array.isArray(raw)
    ? raw
    : String(raw || '').split(/[,，;；\n]/);
  const out: string[] = [];
  for (const item of list) {
    const kw = String(item || '').trim().slice(0, MAX_KEYWORD_LEN);
    if (kw && !out.includes(kw)) out.push(kw);
  }
  return out.slice(0, MAX_KEYWORDS);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const questionId = String(body.question_id || '');
    const keywords = normaliseKeywords(body.keywords);
    if (!questionId) return Response.json({ error: 'question_id 为必填' }, { status: 400 });
    if (!keywords.length) return Response.json({ error: '请至少输入一个关键词' }, { status: 400 });

    let question: any = null;
    try {
      question = await base44.asServiceRole.entities.ResearchQuestion.get(questionId);
    } catch { question = null; }
    if (!question) return Response.json({ error: '研究问题不存在' }, { status: 404 });
    if (question.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: '无权访问该研究问题' }, { status: 403 });
    }

    const apiKey = secrets.get('SCIENCEPAL_API_KEY');
    if (!apiKey) return Response.json({ error: 'SCIENCEPAL_API_KEY is not set in app secrets' }, { status: 400 });
    const agentId = String(body.agent_id || '') || secrets.get('SCIENCEPAL_AGENT_ID') || '';
    if (!agentId) return Response.json({ error: '未配置 SciencePal Agent（SCIENCEPAL_AGENT_ID）' }, { status: 400 });

    const prompt = `你是科研知识库的核查助手。请仅依据你可检索的知识库内容，判断下列关键词是否在知识库中出现（包含同义表述、缩写展开均可视为命中）。

研究问题：「${question.text}」
待检查关键词：${keywords.map((k) => `「${k}」`).join('、')}

严格按以下 JSON 数组输出，不要任何解释或额外文字：
[{"keyword":"关键词原文","found":true或false,"evidence":"命中的原文证据片段（不超过120字，未命中则为空字符串）","source":"证据来源文献标题或章节（未命中则为空字符串）"}]`;

    const { runId } = await startAgentRun({ apiKey, agentId, prompt, threadId: null });
    const { text } = await consumeRunStream(runId, apiKey);
    const statusData: any = await getRunStatus(runId, apiKey);
    const status = statusData?.status || 'unknown';
    if (status === 'failed' || status === 'stopped' || statusData?.error) {
      return Response.json({ error: statusData?.error || `SciencePal 运行 ${status}` }, { status: 502 });
    }

    const parsed = parseResults(text);
    if (!parsed) {
      return Response.json({
        results: [],
        parse_error: true,
        raw: text || '(SciencePal 未返回内容)',
      });
    }

    const byKeyword = new Map<string, any>();
    for (const row of parsed) {
      if (row && typeof row === 'object') byKeyword.set(String(row.keyword || '').trim(), row);
    }
    const results = keywords.map((kw) => {
      const hit = byKeyword.get(kw) || parsed.find((r: any) => String(r?.keyword || '').includes(kw));
      return {
        keyword: kw,
        found: !!hit?.found,
        evidence: typeof hit?.evidence === 'string' ? hit.evidence : '',
        source: typeof hit?.source === 'string' ? hit.source : '',
      };
    });

    return Response.json({
      results,
      found_count: results.filter((r) => r.found).length,
      total: results.length,
      agent_run_id: runId,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}