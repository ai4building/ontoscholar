import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// 将科研知识库的统计汇总与内容一键导出为 Google 文档报告
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // 导出的是全应用知识库数据，仅限管理员执行
    if (user.role !== 'admin') {
      return Response.json({ error: '导出整个知识库需要管理员权限' }, { status: 403 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledocs');
    if (!accessToken) {
      return Response.json({ error: 'Google Docs 尚未连接，请先授权 Google 账号' }, { status: 400 });
    }

    const [qs, cs, ps, prs, claims, papers, concepts, props] = await Promise.all([
      base44.asServiceRole.entities.ResearchQuestion.aggregate({ groupBy: 'status' }),
      base44.asServiceRole.entities.Claim.aggregate({ groupBy: 'review_status' }),
      base44.asServiceRole.entities.Paper.aggregate({ groupBy: 'decision' }),
      base44.asServiceRole.entities.ConceptProposal.aggregate({ groupBy: 'status' }),
      base44.asServiceRole.entities.Claim.filter(
        { review_status: 'approved' },
        { sort: '-created_date', limit: 30, fields: ['result_summary', 'method', 'metric', 'metric_value', 'metric_unit'] }
      ),
      base44.asServiceRole.entities.Paper.filter(
        { decision: 'included' },
        { sort: '-created_date', limit: 30, fields: ['title', 'authors', 'year', 'venue', 'url'] }
      ),
      base44.asServiceRole.entities.OntologyConcept.filter(
        { status: 'approved' },
        { limit: 100, fields: ['name', 'domain', 'version'] }
      ),
      base44.asServiceRole.entities.ConceptProposal.filter(
        { status: 'pending' },
        { sort: '-created_date', limit: 20, fields: ['name', 'domain', 'rationale'] }
      ),
    ]);

    const countOf = (rows: any[], key: string) => rows?.find((r: any) => r[key])?.count || 0;
    const qTotal = qs.rows.reduce((s: number, r: any) => s + r.count, 0);
    const cTotal = cs.rows.reduce((s: number, r: any) => s + r.count, 0);

    const lines: string[] = [];
    lines.push('OntoScholar 科研知识库导出报告');
    lines.push(`生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    lines.push('');
    lines.push('一、总体统计');
    lines.push(`研究问题：共 ${qTotal}（` + qs.rows.map((r: any) => `${r.status} ${r.count}`).join(' / ') + '）');
    lines.push(`文献：已纳入 ${countOf(ps.rows, 'included')} / 已排除 ${countOf(ps.rows, 'excluded')}`);
    lines.push(`科研主张：共 ${cTotal}（待审核 ${countOf(cs.rows, 'pending')} / 已入库 ${countOf(cs.rows, 'approved')} / 已拒绝 ${countOf(cs.rows, 'rejected')}）`);
    lines.push(`本体概念：已发布 ${concepts.items.length}；待处理提议 ${props.items.length}`);
    lines.push('');
    lines.push('二、已纳入文献（最近 30 条）');
    papers.items.forEach((p: any, i: number) => {
      lines.push(`[${i + 1}] ${p.title}（${p.authors || '佚名'}，${p.year || '年份不详'}，${p.venue || ''}）${p.url || ''}`);
    });
    if (!papers.items.length) lines.push('（暂无已纳入文献）');
    lines.push('');
    lines.push('三、已入库科研主张（最近 30 条）');
    claims.items.forEach((c: any, i: number) => {
      const metric = c.metric ? `，${c.metric}=${c.metric_value || '?'}${c.metric_unit || ''}` : '';
      lines.push(`[${i + 1}] ${c.result_summary}${metric}（方法：${c.method || '未标注'}）`);
    });
    if (!claims.items.length) lines.push('（暂无已入库主张）');
    lines.push('');
    lines.push('四、已发布本体概念');
    concepts.items.forEach((c: any) => {
      lines.push(`- ${c.name}（${c.domain}，v${c.version || '1.0'}）`);
    });
    if (!concepts.items.length) lines.push('（暂无已发布概念）');
    lines.push('');
    lines.push('五、待处理概念提议');
    props.items.forEach((p: any) => {
      lines.push(`- ${p.name}（${p.domain || 'Concept'}）：${p.rationale || ''}`);
    });
    if (!props.items.length) lines.push('（暂无待处理提议）');
    const text = lines.join('\n');

    const docTitle = `OntoScholar 知识库报告 ${new Date().toISOString().slice(0, 10)}`;
    const docRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: docTitle }),
      signal: AbortSignal.timeout(10000),
    });
    const doc = await docRes.json();
    if (!docRes.ok) {
      return Response.json({ error: doc?.error?.message || '创建 Google 文档失败' }, { status: 502 });
    }

    const updRes = await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text } }] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!updRes.ok) {
      const err = await updRes.json().catch(() => ({}));
      return Response.json({ error: err?.error?.message || '写入文档内容失败' }, { status: 502 });
    }

    return Response.json({
      title: docTitle,
      documentId: doc.documentId,
      url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
      counts: { questions: qTotal, claims: cTotal, papers: papers.items.length, concepts: concepts.items.length, proposals: props.items.length },
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}