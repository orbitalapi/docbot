import { Request } from 'express';
import { Platform, PlatformEvent, MRParams, MRResult } from '../../src/platform/interface';

/**
 * Mock Platform implementation for testing
 */
export class MockPlatform implements Platform {
  readonly name: 'gitlab' | 'github';

  // Track method calls for assertions
  public calls: {
    validateWebhook: number;
    parseWebhookEvent: number;
    getDiff: number;
    getFileContent: number;
    getAuthenticatedCloneUrl: number;
    postComment: number;
    openMR: number;
    branchExists: number;
  } = {
    validateWebhook: 0,
    parseWebhookEvent: 0,
    getDiff: 0,
    getFileContent: 0,
    getAuthenticatedCloneUrl: 0,
    postComment: 0,
    openMR: 0,
    branchExists: 0,
  };

  // Store data for assertions
  public postedComments: Array<{ project: string; mrId: string; body: string }> = [];
  public createdMRs: Array<{ project: string; params: MRParams }> = [];

  // Configure mock responses
  public mockDiff = '';
  public mockFileContent = '';
  public mockCloneUrl = 'https://mock-clone-url.git';
  public mockBranchExists = false;
  public mockWebhookEvent: PlatformEvent | null = null;
  public mockValidateWebhook = true;

  constructor(name: 'gitlab' | 'github' = 'gitlab') {
    this.name = name;
  }

  validateWebhook(_req: Request): boolean {
    this.calls.validateWebhook++;
    return this.mockValidateWebhook;
  }

  parseWebhookEvent(_req: Request): PlatformEvent | null {
    this.calls.parseWebhookEvent++;
    return this.mockWebhookEvent;
  }

  async getDiff(_project: string, _mrId: string): Promise<string> {
    this.calls.getDiff++;
    return this.mockDiff;
  }

  async getFileContent(_project: string, _path: string, _ref: string): Promise<string> {
    this.calls.getFileContent++;
    return this.mockFileContent;
  }

  async getAuthenticatedCloneUrl(_project: string): Promise<string> {
    this.calls.getAuthenticatedCloneUrl++;
    return this.mockCloneUrl;
  }

  async postComment(project: string, mrId: string, body: string): Promise<void> {
    this.calls.postComment++;
    this.postedComments.push({ project, mrId, body });
  }

  async openMR(project: string, params: MRParams): Promise<MRResult> {
    this.calls.openMR++;
    this.createdMRs.push({ project, params });
    return {
      mrId: '123',
      webUrl: `https://mock-platform.com/${project}/merge_requests/123`,
    };
  }

  async branchExists(_project: string, _branch: string): Promise<boolean> {
    this.calls.branchExists++;
    return this.mockBranchExists;
  }

  // Helper methods for testing
  reset(): void {
    Object.keys(this.calls).forEach((key) => {
      this.calls[key as keyof typeof this.calls] = 0;
    });
    this.postedComments = [];
    this.createdMRs = [];
  }

  getLastComment(): string | undefined {
    return this.postedComments[this.postedComments.length - 1]?.body;
  }
}
