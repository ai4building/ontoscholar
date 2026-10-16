import { Bot, Check } from "lucide-react";

export default function AgentPicker({ agents, agentId, onChange, defaultAgentId }) {
  if (!agents || agents.length === 0) return null;

  return (
    <div className="relative inline-flex items-center">
      <Bot className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={agentId || ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="max-w-[180px] appearance-none truncate rounded-lg border bg-background py-1.5 pl-8 pr-7 text-xs text-foreground outline-none transition hover:bg-accent focus:ring-1 focus:ring-ring"
      >
        {defaultAgentId && !agents.some((a) => a.id === defaultAgentId) && (
          <option value={defaultAgentId}>Default agent</option>
        )}
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <Check className="pointer-events-none absolute right-2 h-3 w-3 text-muted-foreground opacity-50" />
    </div>
  );
}