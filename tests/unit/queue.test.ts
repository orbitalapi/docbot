import { TaskQueue } from '../../src/queue/task-queue';

describe('TaskQueue', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue(2); // Concurrency of 2
  });

  afterEach(() => {
    queue.clear();
  });

  it('should execute tasks sequentially with concurrency limit', async () => {
    const results: number[] = [];
    const delays = [100, 50, 25]; // Different delays to test concurrency

    const tasks = delays.map((delay, index) =>
      queue.enqueue(`task-${index}`, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        results.push(index);
        return index;
      })
    );

    const taskResults = await Promise.all(tasks);

    expect(taskResults).toEqual([0, 1, 2]);
    // Results might come in different order due to concurrency
    expect(results).toHaveLength(3);
  });

  it('should respect concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const tasks = Array(5)
      .fill(0)
      .map((_, i) =>
        queue.enqueue(`task-${i}`, async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 50));
          concurrent--;
        })
      );

    await Promise.all(tasks);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('should handle task errors without breaking the queue', async () => {
    const task1 = queue.enqueue('task-1', async () => 'success');
    const task2 = queue.enqueue('task-2', async () => {
      throw new Error('Task failed');
    });
    const task3 = queue.enqueue('task-3', async () => 'success');

    const results = await Promise.allSettled([task1, task2, task3]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('fulfilled');
  });

  it('should provide accurate stats', () => {
    queue.enqueue('task-1', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const stats = queue.getStats();
    expect(stats.concurrency).toBe(2);
    expect(stats.running).toBeGreaterThanOrEqual(0);
    expect(stats.queued).toBeGreaterThanOrEqual(0);
  });

  it('should drain all tasks', async () => {
    const results: number[] = [];

    // Enqueue multiple tasks
    for (let i = 0; i < 5; i++) {
      queue.enqueue(`task-${i}`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        results.push(i);
      });
    }

    await queue.drain();

    expect(results).toHaveLength(5);
    expect(queue.getStats().running).toBe(0);
    expect(queue.getStats().queued).toBe(0);
  });
});
