import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// 评委邀请码：持有该链接的评委激活后获得只读评审角色（reviewer）
const REVIEWER_INVITE_CODE = 'OS-REVIEWER-2026';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: '请先登录后再激活' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || '').trim();
    if (!code) return Response.json({ error: '请输入邀请码' }, { status: 400 });
    if (code !== REVIEWER_INVITE_CODE) {
      return Response.json({ error: '邀请码不正确' }, { status: 403 });
    }

    if (user.role === 'reviewer' || user.role === 'admin') {
      return Response.json({ ok: true, role: user.role, message: '该账号已具备评审权限' });
    }

    await base44.asServiceRole.entities.User.update(user.id, { role: 'reviewer' });
    return Response.json({ ok: true, role: 'reviewer', message: '激活成功，已获得只读评审权限' });
  } catch (error) {
    return Response.json({ error: error.message || '激活失败' }, { status: 500 });
  }
}