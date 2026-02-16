import { WorkflowContext, getAffectedDocTargets } from './common';
import { AgentOrchestrator } from '../agent/orchestrator';
import { buildTriagePrompt } from '../agent/prompts';
import { logger } from '../util/logger';

/**
 * Triage workflow
 * Analyzes code changes and comments on which docs need updating
 */
export async function triageWorkflow(ctx: WorkflowContext, apiKey: string): Promise<void> {
  logger.info({ project: ctx.event.project, mrId: ctx.event.mrId }, 'Starting triage workflow');

  // Check if any doc targets are affected
  const affectedTargets = getAffectedDocTargets(ctx);

  if (affectedTargets.length === 0) {
    logger.info('No documentation targets affected, skipping triage');
    return;
  }

  // Create agent orchestrator
  const agent = new AgentOrchestrator({
    apiKey,
    model: ctx.config.model,
    maxTurns: ctx.config.maxTurns,
    workDir: '/tmp', // Not used for triage (no file operations)
    styleGuide: ctx.styleGuide,
  });

  // Build triage prompt
  const prompt = buildTriagePrompt(ctx.diff, affectedTargets, ctx.changedFiles);

  // Run agent
  const result = await agent.run(prompt);

  // Post analysis as comment
  const comment = `## 📝 Doc-Bot Analysis

${result.response}

---
*Reply with \`/doc-bot update\` to have me propose these changes.*
*Reply with \`/doc-bot review\` to analyze and update in one step.*

<sub>Cost: $${result.cost.toFixed(4)} | Model: ${ctx.config.model}</sub>`;

  await ctx.platform.postComment(ctx.event.project, ctx.event.mrId, comment);

  logger.info({ cost: result.cost, turns: result.turns }, 'Triage workflow completed');
}
