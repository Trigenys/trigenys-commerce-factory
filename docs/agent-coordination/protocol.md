# Multi-agent coordination protocol (Cursor · Claude Code · Codex)

## Source of truth
Git branches, PRs, GitHub Issues and versioned documentation—not an assumed shared live agent memory. GitHub issues/PRs can coordinate across machines; local Markdown ownership registers are advisory and are **not atomic locks**.

## Task ownership
1. Give each task a unique ID, owner, defined scope, acceptance criteria and dependencies.
2. Before editing inspect `git status`, existing worktrees/branches, relevant issues and prior walkthroughs.
3. Parallel writes require disjoint files and stable interface contracts. Otherwise serialize or obtain owner handoff.
4. Assign one integrator responsible for merging branches; do not merge an agent's unreviewed work silently.
5. Use branches `agent/<provider>/<task-id>` and distinct Git worktrees for concurrent code changes.
6. Never force-push shared branches; preserve uncommitted user work.

## Walkthrough and handoff
Every nontrivial agent intervention writes its **own** file:
`docs/walkthrough/<task-id>/<UTC-timestamp>__<provider>__<role>.md`

Include owner, branch, scope, decisions, actual changed paths, research citations, tests (PASSED/FAILED/BLOCKED/N/A/NOT RUN), risks, status and next actions.

Agents must never overwrite someone else's walkthrough. For competing architecture proposals, create separate RFCs and record accepted outcomes via ADR after a human or authorized maintainer approves.

## Merge gates
- Trace impacted files and dependent contracts.
- Check for competing open branches/PRs and ownership conflicts.
- Run impacted quality gates plus cross-package contract tests.
- Review security risks and rollback for high-impact changes.
- Merge only with permitted repository policy and a designated integrator.

## Failure path
On detected ownership conflict: **stop editing**, document conflicts in `docs/agent-coordination/conflicts/` and request an explicit sequencing/ownership decision. No optimistic concurrency based solely on a Markdown table.
