import { AgentOrchestrator, AgentConfig, AgentResult } from '../../src/agent/orchestrator';

/**
 * Mock Agent Orchestrator for testing
 */
export class MockAgentOrchestrator extends AgentOrchestrator {
  // Track method calls
  public runCalls: Array<{ taskPrompt: string; sessionId?: string }> = [];

  // Configure mock response
  public mockResponse = 'Mock agent response';
  public mockSessionId = 'mock-session-123';
  public mockCost = 0.05;
  public mockTurns = 1;

  constructor(config: AgentConfig) {
    super(config);
  }

  async run(taskPrompt: string, sessionId?: string): Promise<AgentResult> {
    this.runCalls.push({ taskPrompt, sessionId });

    return {
      response: this.mockResponse,
      sessionId: sessionId || this.mockSessionId,
      cost: this.mockCost,
      turns: this.mockTurns,
    };
  }

  // Helper methods for testing
  reset(): void {
    this.runCalls = [];
  }

  getLastPrompt(): string | undefined {
    return this.runCalls[this.runCalls.length - 1]?.taskPrompt;
  }
}
