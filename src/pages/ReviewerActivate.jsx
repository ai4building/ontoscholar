import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, LogIn, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function ReviewerActivate() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlCode = urlParams.get("code") || "";

  const [user, setUser] = useState(undefined); // undefined = 检查登录中
  const [code, setCode] = useState(urlCode);
  const [status, setStatus] = useState("idle"); // idle | activating | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    base44.auth.me()
      .then((me) => { if (!cancelled) setUser(me); })
      .catch(() => { if (!cancelled) setUser(null); });
    return () => { cancelled = true; };
  }, []);

  const handleActivate = async () => {
    setStatus("activating");
    setMessage("");
    try {
      const response = await base44.functions.invoke('activateReviewer', { code });
      if (response.data?.ok) {
        setStatus("success");
        setMessage(response.data.message || "激活成功");
      } else {
        setStatus("error");
        setMessage(response.data?.error || "激活失败，请检查邀请码");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.error || err.message || "激活失败，请检查邀请码");
    }
  };

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <CardTitle className="text-xl">OntoScholar 评委入口</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            仅供受邀评审专家使用，激活后可查看全部研究问题与知识库（只读）
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>使用您的邮箱注册并登录本应用</li>
            <li>等待管理员批准您的访问申请</li>
            <li>输入邀请码，激活只读评审权限</li>
          </ol>

          {user === null ? (
            <Button className="w-full" onClick={() => base44.auth.redirectToLogin(window.location.href)}>
              <LogIn className="w-4 h-4 mr-2" />
              注册 / 登录
            </Button>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                当前登录：<span className="font-medium text-foreground">{user.email}</span>
              </div>
              {status === "success" ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">{message}</div>
                    <Link to="/" className="underline mt-1 inline-block">前往查看研究问题</Link>
                  </div>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="请输入邀请码"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && code.trim() && status !== "activating") handleActivate(); }}
                  />
                  {status === "error" && (
                    <div className="text-sm text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />{message}
                    </div>
                  )}
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={!code.trim() || status === "activating"}
                    onClick={handleActivate}
                  >
                    {status === "activating" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    激活评审权限
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}