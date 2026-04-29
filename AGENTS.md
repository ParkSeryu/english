# Project Working Gate — /home/ubuntu/code/english

This repo follows the workspace-level OMX/autonomous-agent instructions. The following project-local gate is mandatory and exists because this app has repeatedly appeared "done" while the running Next dev server or live route was still broken.

## Scope discipline — do only what was asked

- Do not broaden a user request into adjacent UI, copy, behavior, schema, or test changes unless the user explicitly asks for that broader change.
- When the user asks to adjust one UI element, change only that element. Do not also change nearby controls, ordering, labels, colors, or layouts because they seem related.
- If a requested change reveals an adjacent issue, mention it separately instead of fixing it silently.
- Preserve existing behavior and placement by default; only alter behavior that is directly required by the latest user instruction.
- When correcting a mistaken change, restore the previous behavior exactly unless the user gives a new replacement direction.

## Working tree isolation on request

- If the user explicitly asks to proceed with a separated working tree, create or use a separate `git worktree` before making task changes.
- Do not mix that requested work with the current working tree's uncommitted edits; keep the isolated worktree on its own branch/path and report the path being used.
- If a separate worktree cannot be created or used, stop before task edits and report the blocker instead of continuing in the original tree.
- When integrating separated work, merge or raise the PR toward the `dev` branch by default. Do not target `main`, `origin/main`, or a release branch unless the user explicitly says so.
- Only target `main` when the user explicitly instructs to put the work on `main`; otherwise keep integration directed at `dev`.
- Before any merge/push handoff, state the source branch/worktree and confirm the target branch is `dev`.

## Local dev server access

- When the user asks to run, open, or restart the dev server, bind it to `0.0.0.0` unless they explicitly request localhost-only.
- Verify both local and external-IP access when possible: `http://127.0.0.1:3000/` and the machine's reachable LAN/WSL/container IP such as `http://172.22.48.149:3000/`.
- Do not report the server as open if it only listens on `127.0.0.1` and the user is expected to access it from an external IP.

## Mandatory end-of-task working gate

Before reporting any implementation, UI, route, server action, schema, or runtime-affecting task as complete:

1. **Verify the actual affected behavior, not only tests.**
   - Identify the route/action/screen changed by the task.
   - Exercise it with the running app when possible (`curl`, Playwright, or a browser-level/e2e check), including the exact route that the user is likely to open.
   - For UI queue/navigation work, verify the post-click state and the redirected/reloaded route.

2. **Check the running dev server health.**
   - If `.next` was deleted, `npm run clean:runtime` was run, `next build` was run, or chunks may have changed while `next dev` is still running, restart the dev server before final response.
   - Inspect the dev-server output for `InternalServerError`, `500`, `Cannot find module`, missing chunk errors, schema errors, or failed server actions.
   - Do not say the task is done while the user's visible app is returning Internal Server Error.

3. **Schema/migration gate.**
   - If code reads or writes a newly introduced database column/table/policy, verify the matching migration exists and state whether it has been applied to the target database.
   - If the target DB may not have the migration, treat that as a blocker or explicitly provide the migration/apply step; do not claim live behavior works from local memory-store tests alone.

4. **Evidence in final response.**
   - Final reports must include the commands/checks that prove the app actually ran for the affected path.
   - If live verification is impossible, say exactly what prevented it and what remains unverified.

Minimum expected verification for code changes remains: lint, typecheck, relevant tests, and build when relevant. This gate adds the extra requirement that the changed user-facing path must be exercised against a healthy running app before claiming completion.
