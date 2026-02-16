import { readFile, writeFile, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { glob as globSync } from 'glob';
import { promisify } from 'util';

const globAsync = promisify(globSync);

/**
 * File operation tools for Claude agent
 * These tools allow the agent to read, edit, and search files
 */

export interface ToolResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Read a file from the working directory
 */
export async function readFileTool(workDir: string, filePath: string): Promise<ToolResult> {
  try {
    const absolutePath = resolve(workDir, filePath);

    // Security: ensure path is within workDir
    if (!absolutePath.startsWith(resolve(workDir))) {
      return { success: false, error: 'Access denied: path outside working directory' };
    }

    const content = await readFile(absolutePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Write a file to the working directory
 */
export async function writeFileTool(
  workDir: string,
  filePath: string,
  content: string
): Promise<ToolResult> {
  try {
    const absolutePath = resolve(workDir, filePath);

    // Security: ensure path is within workDir
    if (!absolutePath.startsWith(resolve(workDir))) {
      return { success: false, error: 'Access denied: path outside working directory' };
    }

    await writeFile(absolutePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * List files matching a glob pattern
 */
export async function globTool(workDir: string, pattern: string): Promise<ToolResult> {
  try {
    const filesResult = await globAsync(pattern, {
      cwd: workDir,
      nodir: true,
      dot: false,
    });

    const files = Array.isArray(filesResult) ? filesResult : [];
    return { success: true, content: files.join('\n') };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Search file contents for a pattern (simple grep)
 */
export async function grepTool(
  workDir: string,
  pattern: string,
  filePattern?: string
): Promise<ToolResult> {
  try {
    // Get files to search
    const filesResult = filePattern
      ? await globAsync(filePattern, { cwd: workDir, nodir: true })
      : await globAsync('**/*', { cwd: workDir, nodir: true, dot: false });

    const files = Array.isArray(filesResult) ? filesResult : [];
    const regex = new RegExp(pattern, 'gi');
    const results: string[] = [];

    for (const file of files) {
      const absolutePath = join(workDir, file);
      try {
        const content = await readFile(absolutePath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          if (regex.test(line)) {
            results.push(`${file}:${idx + 1}:${line.trim()}`);
          }
        });
      } catch (error) {
        // Skip files that can't be read (binary, permissions, etc.)
        continue;
      }
    }

    return { success: true, content: results.join('\n') };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * List directory contents
 */
export async function listDirectoryTool(workDir: string, dirPath: string = '.'): Promise<ToolResult> {
  try {
    const absolutePath = resolve(workDir, dirPath);

    // Security: ensure path is within workDir
    if (!absolutePath.startsWith(resolve(workDir))) {
      return { success: false, error: 'Access denied: path outside working directory' };
    }

    const entries = await readdir(absolutePath, { withFileTypes: true });
    const formatted = entries.map((entry) => {
      const type = entry.isDirectory() ? 'DIR' : 'FILE';
      return `[${type}] ${entry.name}`;
    });

    return { success: true, content: formatted.join('\n') };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Tool definitions for Claude API
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'read_file',
    description: 'Read the contents of a file from the working directory',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file relative to the working directory',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the working directory',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file relative to the working directory',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    name: 'glob',
    description: 'Find files matching a glob pattern',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "src/**/*.ts", "*.md")',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'grep',
    description: 'Search file contents for a pattern',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regular expression pattern to search for',
        },
        file_pattern: {
          type: 'string',
          description: 'Optional glob pattern to limit which files to search',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'list_directory',
    description: 'List contents of a directory',
    input_schema: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: 'Directory path relative to working directory (default: ".")',
        },
      },
    },
  },
];

/**
 * Execute a tool call
 */
export async function executeTool(
  workDir: string,
  toolName: string,
  toolInput: Record<string, any>
): Promise<ToolResult> {
  switch (toolName) {
    case 'read_file':
      return readFileTool(workDir, toolInput.file_path);
    case 'write_file':
      return writeFileTool(workDir, toolInput.file_path, toolInput.content);
    case 'glob':
      return globTool(workDir, toolInput.pattern);
    case 'grep':
      return grepTool(workDir, toolInput.pattern, toolInput.file_pattern);
    case 'list_directory':
      return listDirectoryTool(workDir, toolInput.dir_path);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
