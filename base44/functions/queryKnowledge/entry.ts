import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Agent ⑦: 查询 Agent — 只读已审核知识，作答前回溯证据；无支撑证据则明确拒答
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const questionId = String(body.question_id || '');
    const query = String(body.query || '').trim();
    const paperFilter = String(body.paper_id || '');
    if (!questionId || !query) return Response.json({ error: 'question_id 和 query 均为必填' }, { status: 400 });

    let question: any = null;
    try {
      question = await base44.asServiceRole.entities.ResearchQuestion.get(questionId);
    } catch { question = null; }
    if (!question) return Response.json({ error: '研究问题不存在' }, { status: 404 });
    if (question.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: '无权访问该研究问题' }, { status: 403 });
    }

    const approved = await base44.asServiceRole.entities.Claim.filter(
      { question_id: questionId, review_status: 'approved' },
      { limit: 30 }
    );
    const scoped = paperFilter ? approved.items.filter((c: any) => c.paper_id === paperFilter) : approved.items;
    if (!scoped.length) {
      return Response.json({
        rejected: true,
        answer: paperFilter
          ? '该文献在知识库中没有已审核的主张可支撑该问题，按设计明确拒答：请先完成抽取并完成审核。'
          : '知识库中尚无已审核（approved）的主张可支撑该问题，按设计明确拒答：请先完成抽取并完成审核。',
      });
    }

    const papers = await base44.asServiceRole.entities.Paper.filter(
      { question_id: questionId },
      { limit: 20, fields: ['title', 'year', 'venue', 'url'] }
    );
    const paperTitle = new Map(papers.items.map((p: any) => [p.id, p]));
    const evidence = scoped.map((c: any, i: number) => {
      const p: any = paperTitle.get(c.paper_id) || {};
      return {
        n: i + 1,
        paper: `${p.title || '未知文献'}${p.year ? '（' + p.year + '）' : ''}`,
        url: p.url || '',
        method: c.method,
        metric: c.metric,
        metric_value: c.metric_value ? `${c.metric_value}${c.metric_unit || ''}` : '',
        condition_summary: c.condition_summary,
        evidence_text: c.evidence_text,
        evidence_source: c.evidence_source || '',
      };
    });

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `你是科研知识库的查询助手。仅依据以下已审核、带证据的主张回答问题；禁止使用任何外部知识或编造。
问题：「${query}」
可引用的主张（每条含编号、来源文献、结论与原文证据）：
${JSON.stringify(evidence, null, 1)}

要求：
1. 若证据不足以回答问题，输出「拒答：」并说明缺少什么证据；
2. 否则给出中文回答，每个结论后用 [n] 标注引用的主张编号。
直接输出回答文本。`,
    });

    const rejected = typeof llm === 'string' && llm.trim().startsWith('拒答');
    return Response.json({
      answer: typeof llm === 'string' ? llm : JSON.stringify(llm),
      rejected,
      sources: evidence,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}