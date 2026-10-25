import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// 仅放行 http(s) 协议的文献链接，防止 javascript:/data: 等危险协议入库
const safeUrl = (u: string): string => {
  if (!u) return '';
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? u : '';
  } catch {
    return '';
  }
};

// Agent ①②③: 解析研究问题 + 检索真实文献 + 纳入/排除筛选（联网）
export default async function(req: Request): Promise<Response> {
  let questionId = '';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    questionId = String(body.question_id || '');
    if (!questionId) return Response.json({ error: 'question_id is required' }, { status: 400 });

    const question = await base44.asServiceRole.entities.ResearchQuestion.get(questionId);
    if (!question) return Response.json({ error: '研究问题不存在' }, { status: 404 });
    if (question.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: '无权操作该研究问题' }, { status: 403 });
    }

    await base44.asServiceRole.entities.ResearchQuestion.update(questionId, { status: 'screening' });

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `你是科研文献检索与筛选专家。研究问题：「${question.text}」。
请完成三步：
1. 解析该问题：研究对象(focus)、关注的方法(methods)、关注的指标(metrics)、涉及的实验条件(conditions)。
2. 通过网络检索真实发表、可查证的相关学术文献（优先建筑暖通空调 AI 节能控制领域），最多 6 篇。只使用你确信真实存在的文献。
3. 对每篇给出纳入(included)或排除(excluded)的决定与理由（例如与研究问题相关度、证据类型、可核实性）。
只输出 JSON。`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          focus: { type: 'string' },
          methods: { type: 'string' },
          metrics: { type: 'string' },
          conditions: { type: 'string' },
          papers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                authors: { type: 'string' },
                year: { type: 'string' },
                venue: { type: 'string' },
                url: { type: 'string' },
                decision: { type: 'string', enum: ['included', 'excluded'] },
                decision_reason: { type: 'string' },
              },
              required: ['title', 'decision', 'decision_reason'],
            },
          },
        },
        required: ['focus', 'methods', 'metrics', 'conditions', 'papers'],
      },
    });

    const papers = (llm.papers || []).slice(0, 6);
    const records = papers.map((p: any) => ({
      question_id: questionId,
      title: p.title || 'Untitled',
      authors: p.authors || '',
      year: p.year ? String(p.year) : '',
      venue: p.venue || '',
      url: safeUrl(p.url || ''),
      decision: p.decision === 'included' ? 'included' : 'excluded',
      decision_reason: p.decision_reason || '',
    }));
    if (records.length) await base44.asServiceRole.entities.Paper.bulkCreate(records);

    const parsed = {
      parsed_focus: llm.focus || '',
      parsed_methods: llm.methods || '',
      parsed_metrics: llm.metrics || '',
      parsed_conditions: llm.conditions || '',
      status: 'extracting',
    };
    await base44.asServiceRole.entities.ResearchQuestion.update(questionId, parsed);

    return Response.json({ papers: records.length, parsed });
  } catch (error: any) {
    try {
      if (questionId) {
        const svc = createClientFromRequest(req);
        await svc.asServiceRole.entities.ResearchQuestion.update(questionId, { status: 'failed' });
      }
    } catch { /* ignore */ }
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}