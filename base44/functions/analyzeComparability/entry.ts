import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// 条件感知的可比性判定：区分 真实矛盾 / 条件差异 / 研究空白
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const questionId = String(body.question_id || '');
    if (!questionId) return Response.json({ error: 'question_id is required' }, { status: 400 });

    let question: any = null;
    try {
      question = await base44.asServiceRole.entities.ResearchQuestion.get(questionId);
    } catch { question = null; }
    if (!question) return Response.json({ error: '研究问题不存在' }, { status: 404 });
    if (question.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: '无权访问该研究问题' }, { status: 403 });
    }

    const claims = await base44.asServiceRole.entities.Claim.filter(
      { question_id: questionId, review_status: { $in: ['approved', 'pending'] } },
      { limit: 12 }
    );
    if (claims.items.length < 2) {
      return Response.json({ pairs: 0, message: '主张数量不足，无法进行可比性判定' });
    }

    const brief = claims.items.map((c: any) => ({
      id: c.id,
      method: c.method,
      metric: c.metric,
      metric_value: c.metric_value ? `${c.metric_value}${c.metric_unit || ''}` : '',
      building_type: c.building_type,
      climate_zone: c.climate_zone,
      operating_condition: c.operating_condition,
      condition_summary: c.condition_summary,
      result_summary: c.result_summary,
    }));

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `你是科研结论可比性判定专家。以下是从文献抽取的研究主张（JSON 数组）：
${JSON.stringify(brief, null, 1)}

请判定：在比较两条主张的节能效果结论之前，先判断二者的实验条件（气候区、建筑类型、工况、数据集、指标口径）是否可比。
仅对「同一指标且条件可比」的主张对输出判定，结论分为三类：
- 真实矛盾：条件一致但结论方向相反；
- 条件差异：结论差异可由条件差异解释；
- 研究空白：尚无研究覆盖的条件组合（可选取一条主张作为参照，指出缺失的另一侧）。
每对输出：claim_a_id、claim_b_id、verdict（真实矛盾|条件差异|研究空白）、explanation（中文，说明依据的条件）。最多输出 8 对。只输出 JSON。`,
      response_json_schema: {
        type: 'object',
        properties: {
          pairs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                claim_a_id: { type: 'string' },
                claim_b_id: { type: 'string' },
                verdict: { type: 'string', enum: ['真实矛盾', '条件差异', '研究空白'] },
                explanation: { type: 'string' },
              },
              required: ['claim_a_id', 'claim_b_id', 'verdict', 'explanation'],
            },
          },
        },
        required: ['pairs'],
      },
    });

    const validIds = new Set(claims.items.map((c: any) => c.id));
    const pairs = (llm.pairs || [])
      .filter((p: any) => validIds.has(p.claim_a_id) && validIds.has(p.claim_b_id) && p.claim_a_id !== p.claim_b_id)
      .slice(0, 8)
      .map((p: any) => ({
        question_id: questionId,
        claim_a_id: p.claim_a_id,
        claim_b_id: p.claim_b_id,
        verdict: p.verdict,
        explanation: p.explanation || '',
        confirmed: false,
      }));

    if (pairs.length) await base44.asServiceRole.entities.ContradictionAnalysis.bulkCreate(pairs);
    return Response.json({ pairs: pairs.length });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}