#!/usr/bin/env bash
set -euo pipefail

policy_file="infra/policy/iam-boundary.json"
report_file="/tmp/foodpanda-security-audit.txt"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --policy)
      policy_file="$2"
      shift 2
      ;;
    --report)
      report_file="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--policy <file>] [--report <file>]" >&2
      exit 1
      ;;
  esac
done

[[ -f "$policy_file" ]] || {
  echo "Policy file not found: $policy_file" >&2
  exit 1
}

node - "$policy_file" "$report_file" <<'NODE'
const fs = require('fs');

const policyPath = process.argv[2];
const reportPath = process.argv[3];
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const statements = Array.isArray(policy.Statement) ? policy.Statement : [];

const findings = [];
const hasDeny = statements.some((s) => s.Effect === 'Deny');
if (!hasDeny) {
  findings.push('Policy must include at least one explicit Deny statement.');
}

for (const statement of statements) {
  if (statement.Effect !== 'Allow') {
    continue;
  }

  const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
  const resources = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];

  for (const action of actions) {
    if (typeof action !== 'string') continue;

    const isReadOnly =
      action.endsWith(':Describe*') ||
      action.endsWith(':List*') ||
      action.endsWith(':Get*') ||
      action === 'logs:DescribeLogGroups' ||
      action === 'logs:DescribeLogStreams';

    if (action === '*' || (/^[a-z0-9-]+:\*$/i.test(action) && !isReadOnly)) {
      findings.push(`Non-read wildcard action is not allowed in Allow statement: ${action}`);
    }

    if (!isReadOnly && resources.includes('*')) {
      findings.push(`Non-read action must not use wildcard resource '*': ${action}`);
    }
  }
}

const status = findings.length === 0 ? 'SECURITY_AUDIT_PASS' : 'SECURITY_AUDIT_FAIL';
const lines = [
  '# Security Hardening Audit Report',
  '',
  `Status: ${status}`,
  '',
  '## least-privilege',
  'This audit validates IAM allow/deny posture and scoped resource access.',
  '',
  '## Findings',
  ...(findings.length === 0 ? ['- none'] : findings.map((item) => `- ${item}`)),
  '',
];

fs.writeFileSync(reportPath, lines.join('\n'));

if (findings.length > 0) {
  process.exit(2);
}
NODE

echo "Security hardening audit passed"
echo "Report: $report_file"
