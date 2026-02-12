import { WorkflowContext, getAffectedDocTargets } from './common';
import { AgentOrchestrator } from '../agent/orchestrator';
import { buildUpdatePrompt, parseAgentOutput } from '../agent/prompts';
import { logger } from '../util/logger';
import { SessionStore } from '../agent/session-store';

/**
 * Update workflow
 * Proposes documentation changes via a new MR/PR
 */
export async function updateWorkflow(
  ctx: WorkflowContext,
  apiKey: string,
  sessionStore: SessionStore,
  userInstructions?: string
): Promise<void> {
  logger.info({ project: ctx.event.project, mrId: ctx.event.mrId }, 'Starting update workflow');

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

  // NOTE: This is a simplified implementation
  // A full implementation would:
  // 1. Clone the relevant repo(s) (source and/or docs repo)
  // 2. Let the agent read and edit files
  // 3. Collect the edited files
  // 4. Create a branch, commit, push, and open MR

  // For now, we'll just run the agent and post a comment with recommendations
  const agent = new AgentOrchestrator({
    apiKey,
    model: ctx.config.model,
    maxTurns: ctx.config.maxTurns,
    workDir: '/tmp',
    styleGuide: ctx.styleGuide,
  });

  const prompt = buildUpdatePrompt(
    ctx.diff,
    affectedTargets,
    ctx.changedFiles,
    ctx.styleGuide,
    userInstructions
  );

  const result = await agent.run(prompt);

  // Parse agent output
  const output = parseAgentOutput(result.response);

  // Store session for potential revisions
  sessionStore.set(
    {
      platform: ctx.event.platform,
      project: ctx.event.project,
      mrId: ctx.event.mrId,
    },
    result.sessionId
  );

  // Post comment with recommendations
  const comment = `## 📝 Doc-Bot Update Recommendations

${result.response}

${output.commitMessage ? `\n**Suggested Commit Message:**\n\`\`\`\n${output.commitMessage}\n\`\`\`` : ''}

${output.mrDescription ? `\n**Suggested MR/PR Description:**\n\`\`\`\n${output.mrDescription}\n\`\`\`` : ''}

---
*Reply with \`/doc-bot revise <feedback>\` to refine these recommendations.*

<sub>Cost: $${result.cost.toFixed(4)} | Model: ${ctx.config.model} | Session: ${result.sessionId.substring(0, 12)}</sub>`;

  await ctx.platform.postComment(ctx.event.project, ctx.event.mrId, comment);

  logger.info({ cost: result.cost, sessionId: result.sessionId }, 'Update workflow completed');

  logger.warn(
    'NOTE: Full file editing and MR creation not yet implemented. ' +
      'This is a simplified version that provides recommendations only.'
  );
}
