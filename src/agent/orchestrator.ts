import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../util/logger';
import { SYSTEM_PROMPT } from './prompts';
import { TOOL_DEFINITIONS, executeTool } from './tools';

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
  /** Files that were modified */
  modifiedFiles: string[];
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
   * @param enableTools Whether to enable file operation tools (default: false)
   * @returns Agent result
   */
  async run(
    taskPrompt: string,
    sessionId?: string,
    enableTools: boolean = false
  ): Promise<AgentResult> {
    logger.info({ sessionId, workDir: this.config.workDir, enableTools }, 'Running agent');

    // Build system prompt with optional style guide
    let systemPrompt = SYSTEM_PROMPT;
    if (this.config.styleGuide) {
      systemPrompt += `\n\n---\n\n# Project Style Guide\n\n${this.config.styleGuide}`;
    }

    if (enableTools) {
      systemPrompt += `\n\n---\n\nYou have access to file operation tools. Use them to read, edit, and search files in the working directory at: ${this.config.workDir}`;
    }

    const startTime = Date.now();
    let turns = 0;
    let totalCost = 0;
    const modifiedFiles = new Set<string>();

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: taskPrompt,
      },
    ];

    try {
      // Multi-turn interaction loop
      while (turns < this.config.maxTurns) {
        turns++;

        const requestParams: Anthropic.MessageCreateParamsNonStreaming = {
          model: this.config.model,
          max_tokens: 8192,
          system: systemPrompt,
          messages,
        };

        // Add tools if enabled
        if (enableTools) {
          requestParams.tools = TOOL_DEFINITIONS as any;
        }

        const response = await this.client.messages.create(requestParams);

        // Calculate cost
        totalCost += this.calculateCost(response.usage);

        // Check if we hit stop reason
        if (response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence') {
          // Extract final text response
          const responseText = response.content
            .filter((block) => block.type === 'text')
            .map((block) => ('text' in block ? block.text : ''))
            .join('\n');

          const elapsed = Date.now() - startTime;

          logger.info(
            {
              turns,
              cost: totalCost,
              elapsed,
              modifiedFiles: Array.from(modifiedFiles),
            },
            'Agent completed'
          );

          return {
            response: responseText,
            sessionId: sessionId || this.generateSessionId(),
            cost: totalCost,
            turns,
            modifiedFiles: Array.from(modifiedFiles),
          };
        }

        // Handle tool use
        if (response.stop_reason === 'tool_use') {
          // Add assistant's response to messages
          messages.push({
            role: 'assistant',
            content: response.content,
          });

          // Execute tools and collect results
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of response.content) {
            if (block.type === 'tool_use') {
              logger.debug({ toolName: block.name, toolInput: block.input }, 'Executing tool');

              const toolInput = block.input as Record<string, any>;
              const result = await executeTool(this.config.workDir, block.name, toolInput);

              // Track modified files
              if (block.name === 'write_file' && result.success && toolInput.file_path) {
                modifiedFiles.add(toolInput.file_path);
              }

              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: result.success
                  ? result.content || 'Success'
                  : `Error: ${result.error}`,
                is_error: !result.success,
              });
            }
          }

          // Add tool results to messages
          messages.push({
            role: 'user',
            content: toolResults,
          });

          // Continue loop for next turn
          continue;
        }

        // Max tokens reached - return partial result
        if (response.stop_reason === 'max_tokens') {
          logger.warn('Agent hit max_tokens limit');

          const responseText = response.content
            .filter((block) => block.type === 'text')
            .map((block) => ('text' in block ? block.text : ''))
            .join('\n');

          return {
            response: responseText + '\n\n[Response truncated - max tokens reached]',
            sessionId: sessionId || this.generateSessionId(),
            cost: totalCost,
            turns,
            modifiedFiles: Array.from(modifiedFiles),
          };
        }

        // Unexpected stop reason
        logger.warn({ stopReason: response.stop_reason }, 'Unexpected stop reason');
        break;
      }

      // Max turns reached
      logger.warn({ maxTurns: this.config.maxTurns }, 'Agent hit max turns limit');

      return {
        response: '[Max turns reached - agent stopped]',
        sessionId: sessionId || this.generateSessionId(),
        cost: totalCost,
        turns,
        modifiedFiles: Array.from(modifiedFiles),
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

