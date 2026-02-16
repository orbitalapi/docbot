import { WorkflowContext, getAffectedDocTargets } from './common';
import { AgentOrchestrator } from '../agent/orchestrator';
import { buildReviewPrompt, parseAgentOutput } from '../agent/prompts';
import { logger } from '../util/logger';
import { SessionStore } from '../agent/session-store';

/**
 * Review workflow
 * Combines triage and update in one step
 */
export async function reviewWorkflow(
  ctx: WorkflowContext,
  apiKey: string,
  sessionStore: SessionStore
): Promise<void> {
  logger.info({ project: ctx.event.project, mrId: ctx.event.mrId }, 'Starting review workflow');

  // Check if any doc targets are affected
  const affectedTargets = getAffectedDocTargets(ctx);

  if (affectedTargets.length === 0) {
    await ctx.platform.postComment(
      ctx.event.project,
      ctx.event.mrId,
      '## Doc-Bot\n\nNo documentation targets are affected by these changes.'
    );
    return;
  }

  const agent = new AgentOrchestrator({
    apiKey,
    model: ctx.config.model,
    maxTurns: ctx.config.maxTurns,
    workDir: '/tmp',
    styleGuide: ctx.styleGuide,
  });

  const prompt = buildReviewPrompt(ctx.diff, affectedTargets, ctx.changedFiles, ctx.styleGuide);

  const result = await agent.run(prompt);

  // Parse output
  const output = parseAgentOutput(result.response);

  // Store session
  sessionStore.set(
    {
      platform: ctx.event.platform,
      project: ctx.event.project,
      mrId: ctx.event.mrId,
    },
    result.sessionId
  );

  // Post comprehensive review
  const comment = `## 📝 Doc-Bot Review

${result.response}

${output.commitMessage ? `\n**Suggested Commit Message:**\n\`\`\`\n${output.commitMessage}\n\`\`\`` : ''}

${output.mrDescription ? `\n**Suggested MR/PR Description:**\n\`\`\`\n${output.mrDescription}\n\`\`\`` : ''}

---
*Reply with \`/doc-bot revise <feedback>\` to refine these recommendations.*

<sub>Cost: $${result.cost.toFixed(4)} | Model: ${ctx.config.model} | Session: ${result.sessionId.substring(0, 12)}</sub>`;

  await ctx.platform.postComment(ctx.event.project, ctx.event.mrId, comment);

  logger.info({ cost: result.cost, sessionId: result.sessionId }, 'Review workflow completed');
}
