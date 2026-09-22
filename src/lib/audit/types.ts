export type Severity = "critical" | "high" | "medium" | "low";

export type FindingStatus = "open" | "investigating" | "resolved" | "dismissed";

export type AuditRule = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  severity: Severity;
  enabled: boolean;
  threshold: Record<string, number | string | boolean>;
  created_at: string;
  updated_at: string;
};

export type AuditFinding = {
  id: string;
  rule_key: string;
  severity: Severity;
  status: FindingStatus;
  title: string;
  summary: string | null;
  entity_type: string | null;
  entity_id: string | null;
  evidence: Record<string, unknown>;
  detected_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution: string | null;
  assigned_to: string | null;
  auto_closed: boolean;
  rule_name?: string;
};

export type AuditComment = {
  id: string;
  finding_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author_email?: string | null;
};

export type RuleViolation = {
  entity_type: string;
  entity_id: string;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
};

export type RuleContext = {
  threshold: Record<string, any>;
  client: any;
};

export type Rule = {
  key: string;
  run: (ctx: RuleContext) => Promise<RuleViolation[]>;
};
