import { logger } from '../util/logger';

/**
 * Task function type
 */
export type TaskFunction<T = unknown> = () => Promise<T>;

/**
 * Task metadata
 */
interface Task<T> {
  id: string;
  fn: TaskFunction<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * Bounded concurrency task queue
 * Ensures a maximum number of tasks run in parallel
 */
export class TaskQueue {
  private queue: Task<unknown>[] = [];
  private running = 0;
  private concurrency: number;

  constructor(concurrency: number = 3) {
    this.concurrency = concurrency;
  }

  /**
   * Add a task to the queue
   * @param id Unique task identifier
   * @param fn Task function
   * @returns Promise that resolves when the task completes
   */
  async enqueue<T>(id: string, fn: TaskFunction<T>): Promise<T> {
    logger.info({ taskId: id, queueSize: this.queue.length }, 'Enqueuing task');

    return new Promise<T>((resolve, reject) => {
      this.queue.push({ id, fn, resolve, reject } as Task<unknown>);
      this.processQueue();
    });
  }

  /**
   * Process the queue - start tasks up to concurrency limit
   */
  private processQueue(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        this.runTask(task);
      }
    }
  }

  /**
   * Run a single task
   */
  private async runTask<T>(task: Task<T>): Promise<void> {
    this.running++;

    logger.info(
      { taskId: task.id, running: this.running, queued: this.queue.length },
      'Starting task'
    );

    try {
      const result = await task.fn();
      task.resolve(result);

      logger.info({ taskId: task.id }, 'Task completed successfully');
    } catch (error) {
      task.reject(error as Error);

      logger.error({ taskId: task.id, error }, 'Task failed');
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  /**
   * Get current queue statistics
   */
  getStats(): { running: number; queued: number; concurrency: number } {
    return {
      running: this.running,
      queued: this.queue.length,
      concurrency: this.concurrency,
    };
  }

  /**
   * Wait for all tasks to complete
   */
  async drain(): Promise<void> {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Clear the queue (for testing/shutdown)
   */
  clear(): void {
    this.queue = [];
  }
}
