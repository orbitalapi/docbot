import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../util/logger';
import { SYSTEM_PROMPT } from './prompts';

export interface AgentConfig {
  /** Anthropic API key */
  apiKey: string;
  /** Model to use */
  model: string;
  /** Maximum turns (API calls) */
  maxTurns: number;
  /** Working directory for file operations */
  workDir: string;
  /** Optional style guide to append to system prompt */
  styleGuide?: string;
}

export interface AgentResult {
  /** Agent's response */
  response: string;
  /** Session ID for resumption */
  sessionId: string;
  /** Total cost in USD */
  cost: number;
  /** Number of turns taken */
  turns: number;
}

/**
 * Agent orchestrator
 * Manages Claude Agent SDK invocations
 */
export class AgentOrchestrator {
  private client: Anthropic;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  /**
   * Run the agent with a task prompt
   * @param taskPrompt The task-specific prompt
   * @param sessionId Optional session ID to resume
   * @returns Agent result
   */
  async run(taskPrompt: string, sessionId?: string): Promise<AgentResult> {
    logger.info({ sessionId, workDir: this.config.workDir }, 'Running agent');

    // Build system prompt with optional style guide
    let systemPrompt = SYSTEM_PROMPT;
    if (this.config.styleGuide) {
      systemPrompt += `\n\n---\n\n# Project Style Guide\n\n${this.config.styleGuide}`;
    }

    // For now, we'll implement a simple single-turn interaction
    // In a full implementation, this would use the Claude Agent SDK for multi-turn interactions
    // with tool use (Read, Edit, Glob, Grep, git commands)

    const startTime = Date.now();
    let turns = 0;
    let totalCost = 0;

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: taskPrompt,
          },
        ],
      });

      turns = 1;

      // Calculate cost (approximate)
      totalCost = this.calculateCost(response.usage);

      const responseText =
        response.content
          .filter((block) => block.type === 'text')
          .map((block) => ('text' in block ? block.text : ''))
          .join('\n') || '';

      const elapsed = Date.now() - startTime;

      logger.info(
        {
          turns,
          cost: totalCost,
          elapsed,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        'Agent completed'
      );

      return {
        response: responseText,
        sessionId: sessionId || this.generateSessionId(),
        cost: totalCost,
        turns,
      };
    } catch (error) {
      logger.error({ error }, 'Agent execution failed');
      throw error;
    }
  }

  /**
   * Calculate approximate cost based on token usage
   * Pricing as of Feb 2025:
   * - Sonnet 4.5: $3/MTok input, $15/MTok output
   * - Opus 4: $15/MTok input, $75/MTok output
   */
  private calculateCost(usage: { input_tokens: number; output_tokens: number }): number {
    const { input_tokens, output_tokens } = usage;

    // Determine pricing based on model
    let inputCostPerMTok = 3; // Sonnet default
    let outputCostPerMTok = 15;

    if (this.config.model.includes('opus')) {
      inputCostPerMTok = 15;
      outputCostPerMTok = 75;
    } else if (this.config.model.includes('haiku')) {
      inputCostPerMTok = 0.25;
      outputCostPerMTok = 1.25;
    }

    const inputCost = (input_tokens / 1_000_000) * inputCostPerMTok;
    const outputCost = (output_tokens / 1_000_000) * outputCostPerMTok;

    return inputCost + outputCost;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * NOTE: This is a simplified implementation.
 *
 * A production version would use the Claude Agent SDK (or similar) to:
 * 1. Enable multi-turn interactions with tool use
 * 2. Allow the agent to read/edit files in the working directory
 * 3. Support resuming sessions for the feedback loop
 * 4. Provide read-only git commands (diff, log, status)
 *
 * For the initial implementation, we're using a simple single-turn API call.
 * The agent will provide analysis and recommendations, but won't directly
 * modify files. The workflows will handle file modifications based on the
 * agent's recommendations.
 *
 * To upgrade to full agent capabilities:
 * - Integrate @anthropic-ai/claude-code or similar SDK
 * - Implement tool handlers for Read, Edit, Glob, Grep
 * - Add git command tools (read-only: diff, log, status)
 * - Implement proper session management for multi-turn interactions
 */
