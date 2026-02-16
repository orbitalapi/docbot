import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  readFileTool,
  writeFileTool,
  globTool,
  grepTool,
  listDirectoryTool,
  executeTool,
} from '../../../src/agent/tools';

describe('Agent Tools', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'docbot-tools-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('readFileTool', () => {
    it('should read file contents', async () => {
      const filePath = 'test.txt';
      const content = 'Hello, World!';
      await writeFile(join(testDir, filePath), content);

      const result = await readFileTool(testDir, filePath);

      expect(result.success).toBe(true);
      expect(result.content).toBe(content);
    });

    it('should fail for non-existent file', async () => {
      const result = await readFileTool(testDir, 'nonexistent.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('should prevent path traversal', async () => {
      const result = await readFileTool(testDir, '../../../etc/passwd');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });

  describe('writeFileTool', () => {
    it('should write file contents', async () => {
      const filePath = 'output.txt';
      const content = 'Test content';

      const result = await writeFileTool(testDir, filePath, content);

      expect(result.success).toBe(true);

      // Verify file was written
      const readResult = await readFileTool(testDir, filePath);
      expect(readResult.content).toBe(content);
    });

    it('should prevent path traversal', async () => {
      const result = await writeFileTool(testDir, '../../../tmp/evil.txt', 'evil');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });

  describe('globTool', () => {
    beforeEach(async () => {
      // Create test file structure
      await writeFile(join(testDir, 'file1.ts'), '// file1');
      await writeFile(join(testDir, 'file2.ts'), '// file2');
      await writeFile(join(testDir, 'file3.js'), '// file3');
      await mkdir(join(testDir, 'src'));
      await writeFile(join(testDir, 'src', 'index.ts'), '// index');
    });

    it('should find files by pattern', async () => {
      const result = await globTool(testDir, '*.ts');

      expect(result.success).toBe(true);
      expect(result.content).toContain('file1.ts');
      expect(result.content).toContain('file2.ts');
      expect(result.content).not.toContain('file3.js');
    });

    it('should find files recursively', async () => {
      const result = await globTool(testDir, '**/*.ts');

      expect(result.success).toBe(true);
      expect(result.content).toContain('file1.ts');
      expect(result.content).toContain('src/index.ts');
    });
  });

  describe('grepTool', () => {
    beforeEach(async () => {
      await writeFile(join(testDir, 'file1.txt'), 'Hello\nWorld\nFoo Bar');
      await writeFile(join(testDir, 'file2.txt'), 'Foo\nBaz\nHello');
    });

    it('should search for pattern in all files', async () => {
      const result = await grepTool(testDir, 'Hello');

      expect(result.success).toBe(true);
      expect(result.content).toContain('file1.txt:1:Hello');
      expect(result.content).toContain('file2.txt:3:Hello');
    });

    it('should search with file pattern filter', async () => {
      const result = await grepTool(testDir, 'Foo', 'file1.txt');

      expect(result.success).toBe(true);
      expect(result.content).toContain('file1.txt:3:Foo Bar');
      expect(result.content).not.toContain('file2.txt');
    });

    it('should handle regex patterns', async () => {
      const result = await grepTool(testDir, 'F[oa][oz]');

      expect(result.success).toBe(true);
      expect(result.content).toContain('Foo');
    });
  });

  describe('listDirectoryTool', () => {
    beforeEach(async () => {
      await writeFile(join(testDir, 'file1.txt'), 'content');
      await mkdir(join(testDir, 'subdir'));
      await writeFile(join(testDir, 'subdir', 'file2.txt'), 'content');
    });

    it('should list directory contents', async () => {
      const result = await listDirectoryTool(testDir);

      expect(result.success).toBe(true);
      expect(result.content).toContain('[FILE] file1.txt');
      expect(result.content).toContain('[DIR] subdir');
    });

    it('should list subdirectory contents', async () => {
      const result = await listDirectoryTool(testDir, 'subdir');

      expect(result.success).toBe(true);
      expect(result.content).toContain('[FILE] file2.txt');
    });

    it('should prevent path traversal', async () => {
      const result = await listDirectoryTool(testDir, '../../../etc');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });

  describe('executeTool', () => {
    it('should execute read_file tool', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const result = await executeTool(testDir, 'read_file', { file_path: 'test.txt' });

      expect(result.success).toBe(true);
      expect(result.content).toBe('content');
    });

    it('should execute write_file tool', async () => {
      const result = await executeTool(testDir, 'write_file', {
        file_path: 'new.txt',
        content: 'new content',
      });

      expect(result.success).toBe(true);
    });

    it('should execute glob tool', async () => {
      await writeFile(join(testDir, 'test.ts'), 'content');

      const result = await executeTool(testDir, 'glob', { pattern: '*.ts' });

      expect(result.success).toBe(true);
      expect(result.content).toContain('test.ts');
    });

    it('should handle unknown tools', async () => {
      const result = await executeTool(testDir, 'unknown_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });
});
