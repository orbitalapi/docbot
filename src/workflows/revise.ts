import { WorkflowContext } from './common';
import { AgentOrchestrator } from '../agent/orchestrator';
import { buildRevisePrompt, parseAgentOutput } from '../agent/prompts';
import { logger } from '../util/logger';
import { SessionStore } from '../agent/session-store';

/**
 * Revise workflow
 * Revises previously proposed changes based on user feedback
 */
export async function reviseWorkflow(
  ctx: WorkflowContext,
  apiKey: string,
  sessionStore: SessionStore,
  feedback: string
): Promise<void> {
  logger.info({ project: ctx.event.project, mrId: ctx.event.mrId }, 'Starting revise workflow');

  // Get existing session
  const sessionId = sessionStore.get({
    platform: ctx.event.platform,
    project: ctx.event.project,
    mrId: ctx.event.mrId,
  });

  if (!sessionId) {
    await ctx.platform.postComment(
      ctx.event.project,
      ctx.event.mrId,
      '## Doc-Bot\n\nNo previous session found for this MR/PR. Please run `/doc-bot update` first.'
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

  const prompt = buildRevisePrompt(feedback);

  // Resume the session
  const result = await agent.run(prompt, sessionId);

  // Parse output
  const output = parseAgentOutput(result.response);

  // Post revised recommendations
  const comment = `## 📝 Doc-Bot Revised Recommendations

${result.response}

${output.commitMessage ? `\n**Updated Commit Message:**\n\`\`\`\n${output.commitMessage}\n\`\`\`` : ''}

${output.mrDescription ? `\n**Updated MR/PR Description:**\n\`\`\`\n${output.mrDescription}\n\`\`\`` : ''}

---
<sub>Cost: $${result.cost.toFixed(4)} | Model: ${ctx.config.model} | Session: ${sessionId.substring(0, 12)}</sub>`;

  await ctx.platform.postComment(ctx.event.project, ctx.event.mrId, comment);

  logger.info({ cost: result.cost, sessionId }, 'Revise workflow completed');
}
