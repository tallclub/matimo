/**
 * Enhanced Coverage Tests for Critical Modules
 * Targets: oauth2-provider-loader, tool-loader, schema, approval-handler
 * Focus: Branch coverage and edge cases
 */

import path from 'path';
import fs from 'fs/promises';
import { OAuth2ProviderLoader } from '../../src/auth/oauth2-provider-loader';
import { ToolLoader } from '../../src/core/tool-loader';
import { MatimoError } from '../../src/errors/matimo-error';
import os from 'os';

describe('Coverage Enhancement Tests', () => {
  describe('OAuth2ProviderLoader - Error Paths', () => {
    it('should throw MatimoError when tools directory does not exist', async () => {
      const nonExistentPath = path.join(os.tmpdir(), 'nonexistent-' + Date.now());
      const loader = new OAuth2ProviderLoader(nonExistentPath);

      await expect(loader.loadProviders()).rejects.toThrow(MatimoError);
    });

    it('should gracefully skip non-directory entries', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oauth2-test-'));
      try {
        // Create a file instead of directory
        await fs.writeFile(path.join(tempDir, 'not-a-directory.txt'), 'test');

        const loader = new OAuth2ProviderLoader(tempDir);
        const providers = await loader.loadProviders();

        // Should not crash, should return empty map
        expect(providers).toBeInstanceOf(Map);
        expect(providers.size).toBe(0);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it('should skip directories with missing definition.yaml', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oauth2-test-'));
      try {
        // Create directory without definition.yaml
        await fs.mkdir(path.join(tempDir, 'provider-without-def'));

        const loader = new OAuth2ProviderLoader(tempDir);
        const providers = await loader.loadProviders();

        // Should not crash, should return empty map
        expect(providers).toBeInstanceOf(Map);
        expect(providers.size).toBe(0);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it('should skip directories with invalid YAML', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oauth2-test-'));
      try {
        // Create directory with invalid YAML
        const providerDir = path.join(tempDir, 'invalid-provider');
        await fs.mkdir(providerDir);
        await fs.writeFile(path.join(providerDir, 'definition.yaml'), 'invalid: yaml: content: [');

        const loader = new OAuth2ProviderLoader(tempDir);
        const providers = await loader.loadProviders();

        // Should not crash
        expect(providers).toBeInstanceOf(Map);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it('should skip non-provider definitions', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oauth2-test-'));
      try {
        // Create directory with non-provider definition
        const toolDir = path.join(tempDir, 'some-tool');
        await fs.mkdir(toolDir);
        await fs.writeFile(
          path.join(toolDir, 'definition.yaml'),
          `name: some-tool
type: tool
description: A tool, not a provider`
        );

        const loader = new OAuth2ProviderLoader(tempDir);
        const providers = await loader.loadProviders();

        // Should not include this tool
        expect(providers.size).toBe(0);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });
  });

  describe('ToolLoader - Edge Cases', () => {
    it('should load tools from current working directory', async () => {
      const loader = new ToolLoader();
      const tools = await loader.loadToolsFromDirectory('./packages/core/tools');

      expect(tools).toBeInstanceOf(Map);
      // May be empty or have test tools, both are valid
    });

    it('should handle directory with no valid tools', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-loader-test-'));
      try {
        const loader = new ToolLoader();
        const tools = await loader.loadToolsFromDirectory(tempDir);

        expect(tools).toBeInstanceOf(Map);
        expect(tools.size).toBe(0);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it('should filter out non-YAML/JSON files', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-loader-test-filter-'));
      try {
        // Create various files
        await fs.writeFile(path.join(tempDir, 'readme.md'), '# README');
        await fs.writeFile(path.join(tempDir, 'config.txt'), 'config');

        const loader = new ToolLoader();
        const tools = await loader.loadToolsFromDirectory(tempDir);

        // Should ignore non-YAML/JSON files
        expect(tools).toBeInstanceOf(Map);
        expect(tools.size).toBe(0);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it('should skip invalid tool definitions gracefully', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-loader-test-'));
      try {
        // Create invalid tool YAML (missing required fields)
        await fs.writeFile(
          path.join(tempDir, 'bad-tool.yaml'),
          `name: bad-tool
description: Missing execution field`
        );

        const loader = new ToolLoader();
        const tools = await loader.loadToolsFromDirectory(tempDir);

        // Should skip invalid definition, return empty map
        expect(tools).toBeInstanceOf(Map);
        expect(tools.size).toBe(0);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });
  });

  describe('Approval Handler - Fallback Paths', () => {
    it('should use default keywords if YAML file not found', async () => {
      const { ApprovalHandler } = await import('../../src/approval/approval-handler');

      // Create handler in env where YAML won't be found
      const originalCwd = process.cwd();
      try {
        // Change to temp directory
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'approval-test-'));
        process.chdir(tempDir);

        const handler = new ApprovalHandler();

        // Should still detect destructive keywords from defaults
        expect(handler.requiresApproval(undefined, 'DELETE FROM users')).toBe(true);
        expect(handler.requiresApproval(undefined, 'CREATE TABLE test')).toBe(true);
        expect(handler.requiresApproval(undefined, 'SELECT * FROM users')).toBe(false);
      } finally {
        process.chdir(originalCwd);
        await fs.rm(path.join(os.tmpdir(), 'approval-test-*'), {
          recursive: true,
          force: true,
        });
      }
    });
  });

  describe('Cross-Module Integration', () => {
    it('should handle mixed valid and invalid tool definitions', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mixed-tools-'));
      try {
        // Create one valid tool
        const validToolDir = path.join(tempDir, 'valid-tool');
        await fs.mkdir(validToolDir);
        await fs.writeFile(
          path.join(validToolDir, 'definition.yaml'),
          `name: test-tool
version: "1.0.0"
description: "Test tool"
parameters: {}
execution:
  type: http
  method: GET
  url: "https://example.com/api"
output_schema:
  type: object
  properties:
    result:
      type: string`
        );

        // Create one invalid tool (directory without definition.yaml)
        await fs.mkdir(path.join(tempDir, 'no-definition'));

        const loader = new ToolLoader();
        const tools = await loader.loadToolsFromDirectory(tempDir);

        // Should load valid tool, skip invalid directory
        expect(tools).toBeInstanceOf(Map);
        expect(tools.size).toBeGreaterThanOrEqual(1);
        expect(tools.has('test-tool')).toBe(true);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });
  });

  describe('Concurrency and State', () => {
    it('should handle multiple concurrent provider loads', async () => {
      const toolsPath = path.resolve(__dirname, '../fixtures/tools');
      const loader1 = new OAuth2ProviderLoader(toolsPath);
      const loader2 = new OAuth2ProviderLoader(toolsPath);

      const [providers1, providers2] = await Promise.all([
        loader1.loadProviders(),
        loader2.loadProviders(),
      ]);

      expect(providers1.size).toBe(providers2.size);
      expect(Array.from(providers1.keys())).toEqual(Array.from(providers2.keys()));
    });

    it('should be idempotent - multiple loads give same result', async () => {
      const toolsPath = path.resolve(__dirname, '../fixtures/tools');
      const loader = new OAuth2ProviderLoader(toolsPath);

      const providers1 = await loader.loadProviders();
      const providers2 = await loader.loadProviders();

      expect(providers1.size).toBe(providers2.size);
      expect(Array.from(providers1.keys())).toEqual(Array.from(providers2.keys()));
    });
  });
});
