import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Agent ④⑤⑥: 结构化抽取 + 本体对齐 + 审校闸门（所有主张一律先入审核队列，人工确认后才发布入库）
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const questionId = String(body.question_id || '');
    if (!questionId) return Response.json({ error: 'question_id is required' }, { status: 400 });
    const question = await base44.asServiceRole.entities.ResearchQuestion.get(questionId);
    if (!question) return Response.json({ error: '研究问题不存在' }, { status: 404 });
    if (question.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: '无权操作该研究问题' }, { status: 403 });
    }

    const included = await base44.asServiceRole.entities.Paper.filter(
      { question_id: questionId, decision: 'included' },
      { limit: 6 }
    );
    if (!included.items.length) {
      return Response.json({ error: '没有已纳入的文献，请先运行文献检索' }, { status: 400 });
    }

    const concepts = await base44.asServiceRole.entities.OntologyConcept.filter(
      { status: 'approved' },
      { limit: 100, fields: ['name', 'domain'] }
    );
    const conceptNames = concepts.items.map((c: any) => c.name).join('、') || '（暂无）';

    const results = await Promise.allSettled(
      included.items.map((p: any) =>
        base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `你是结构化抽取专家。严格依据可查证的文献内容，抽取「研究主张」。禁止编造。
论文：《${p.title}》（${p.authors || ''} ${p.year || ''} ${p.venue || ''}）${p.url ? ' ' + p.url : ''}
请结合检索到的该论文真实内容（摘要/结论），抽取最多 3 条有据可查的研究结论。每条包含：
method（控制方法）、building_type（建筑类型）、climate_zone（气候区）、dataset（数据集）、metric（节能指标）、metric_value（数值，字符串）、metric_unit（单位）、operating_condition（工况）、result_summary（结论一句话，中文）、condition_summary（实验条件摘要，中文）、evidence_text（原文片段引用）、evidence_source（出处，如 Abstract / Section 4）、confidence（0-1 小数）、aligned_concepts（对应以下本体概念名，逗号分隔：${conceptNames}）。
若论文中出现种子概念列表无法覆盖且确有必要的新概念，写入 proposed_concepts（每项含 name、domain（Method/Equipment/Metric/Condition/BuildingType 之一）、definition、rationale）。
只抽取有证据支持的结论，无法核实的不要输出。只输出 JSON。`,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              claims: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    method: { type: 'string' },
                    building_type: { type: 'string' },
                    climate_zone: { type: 'string' },
                    dataset: { type: 'string' },
                    metric: { type: 'string' },
                    metric_value: { type: 'string' },
                    metric_unit: { type: 'string' },
                    operating_condition: { type: 'string' },
                    result_summary: { type: 'string' },
                    condition_summary: { type: 'string' },
                    evidence_text: { type: 'string' },
                    evidence_source: { type: 'string' },
                    confidence: { type: 'number' },
                    aligned_concepts: { type: 'string' },
                  },
                  required: ['result_summary', 'evidence_text', 'confidence'],
                },
              },
              proposed_concepts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    domain: { type: 'string' },
                    definition: { type: 'string' },
                    rationale: { type: 'string' },
                  },
                  required: ['name', 'rationale'],
                },
              },
            },
            required: ['claims'],
          },
        })
      )
    );

    const claimsToCreate: any[] = [];
    const proposals: any[] = [];
    const seenProposals = new Set<string>();
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const p: any = included.items[i];
      if (r.status !== 'fulfilled' || !p) continue;
      const data = r.value || {};
      for (const c of (data.claims || []).slice(0, 3)) {
        claimsToCreate.push({
          question_id: questionId,
          paper_id: p.id,
          method: c.method || '',
          building_type: c.building_type || '',
          climate_zone: c.climate_zone || '',
          dataset: c.dataset || '',
          metric: c.metric || '',
          metric_value: c.metric_value ? String(c.metric_value) : '',
          metric_unit: c.metric_unit || '',
          operating_condition: c.operating_condition || '',
          result_summary: c.result_summary || '',
          condition_summary: c.condition_summary || '',
          evidence_text: c.evidence_text || '',
          evidence_source: c.evidence_source || '',
          confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
          aligned_concepts: c.aligned_concepts || '',
          review_status: 'pending',
        });
      }
      for (const pc of (data.proposed_concepts || []).slice(0, 2)) {
        if (!pc.name || seenProposals.has(pc.name)) continue;
        seenProposals.add(pc.name);
        proposals.push({
          question_id: questionId,
          paper_id: p.id,
          name: pc.name,
          domain: pc.domain || 'Concept',
          definition: pc.definition || '',
          rationale: pc.rationale || '',
          status: 'pending',
        });
      }
    }

    if (claimsToCreate.length) await base44.asServiceRole.entities.Claim.bulkCreate(claimsToCreate);
    if (proposals.length) await base44.asServiceRole.entities.ConceptProposal.bulkCreate(proposals);
    await base44.asServiceRole.entities.ResearchQuestion.update(questionId, { status: 'ready' });

    return Response.json({
      claims: claimsToCreate.length,
      pending: claimsToCreate.filter((c) => c.review_status === 'pending').length,
      proposals: proposals.length,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}