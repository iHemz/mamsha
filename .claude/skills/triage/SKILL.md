---
name: triage
description: Intake desk - turn a raw complaint, bug, question, or reviewer/tester report about the demo into a classified, tracked, and actioned item, with a reply Williams can relay back.
argument-hint: "[paste the report - yours, or a reviewer's/tester's message]"
---

# The Triage Desk

This is the **inbound** side of `/principal`. Williams pastes in a report: his own friction, or feedback from someone who tried the demo. You classify it, log it, act on it, and draft a reply he can send.

Not every complaint is a bug. Part of the job is saying so, with a reason.

## What you receive

`$ARGUMENTS` is a raw report. If it's empty or unclear, ask Williams to paste it, with context: who sent it, what they were doing, what they expected, which voice mode the badge showed, and which browser. Don't guess a report into existence.

## The loop

### 1. Classify (honestly, as one of these)

| Type | Meaning | Label |
|---|---|---|
| **Bug** | Broken compared with intended behaviour | `bug` |
| **UX friction** | Works, but confuses or frustrates | `ux` |
| **Grounding issue** | The agent stated something not in `data/route.json`, or something wrong | `grounding` |
| **Question** | Nothing is broken, the person just doesn't understand | `question` |
| **Feature request** | Doesn't exist yet | `enhancement` |
| **Praise / signal** | Positive feedback or buying interest | `signal` |
| **Can't reproduce** | Not enough to act on | `needs-info` |

If a report bundles several things, split it into one item per problem. **Grounding issues are always high priority.** Real pilgrims may rely on this demo.

### 2. Log it

If the repo has a GitHub remote, open an issue with `gh issue create --title "..." --label "<label>" --body "..."`. Search first with `gh issue list --search`. If it's a duplicate, comment on the existing issue instead. If there's no remote yet, add the item to a `## Triage` list in `docs/PROGRESS.md` under today's date. Keep the reporter's own words. They are the evidence.

### 3. Route it

- **Bug** → run `/bugs`. If the fix is small and safe, fix it, then `/ship`. If it's large or risky, write up the finding and check with Williams first.
- **Grounding issue** → find where the claim came from (prompt builder, `route.json`, or the model ignoring the rule). Never "fix" it by inventing a fact. A new fact needs a `verified_from` value that Williams confirms.
- **UX friction** → who is the user (wheelchair family or young couple), what did they expect, where is the gap? Then fix it like any other change. Captions, keyboard access and reduced motion are requirements, not extras.
- **Question** → answer it plainly so Williams can relay it. Note any UI fix the question points to.
- **Feature request** → compare it with `docs/BUILD_PLAN.md` scope and its "out of scope" list. Recommend do now, after the demo, or decline with a reason. **Don't quietly change scope.**
- **Praise / signal** → record it, and flag any buying interest explicitly to Williams.
- **Can't reproduce** → list exactly what's needed to reproduce it.

### 4. Draft a reply Williams can relay

Write it in his voice: warm, plain, no jargon, no issue numbers. For example: "Good catch, fixed, please refresh and try again." Or: "That's intended: <reason>. Is it getting in your way?"

### 5. Report back

Give a compact summary: what came in, its classification, what you did (issue, commit or PR), and the reply to relay. Use a table if several items came in.

## Guardrails

- Every fix goes through `/ship` and `make check`.
- Large, irreversible or spending moves go to Williams first.
- Ground every claim in the code with `file:line`. The reporter's theory is a lead, not a diagnosis.
- Be honest rather than agreeable.
