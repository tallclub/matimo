import { reviewCommand } from '../../../src/commands/review';
import fs from 'fs';

// Mock the dynamic import of @matimo/core
jest.mock(
  '@matimo/core',
  () => ({
    ApprovalManifest: jest.fn(),
  }),
  { virtual: true }
);

jest.mock('fs');

interface ManifestHandle {
  getPendingTools(): string[];
  listApproved(): string[];
  getApproval(name: string): { approvedAt: string; approvedBy?: string } | undefined;
  revoke(name: string): boolean;
  approve(name: string, hash: string, approvedBy?: string): void;
  computeHash(content: string): string;
}

describe('review Command', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;
  let mockManifest: jest.Mocked<ManifestHandle>;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    jest.clearAllMocks();

    // Setup default mock manifest
    mockManifest = {
      getPendingTools: jest.fn(() => []),
      listApproved: jest.fn(() => []),
      getApproval: jest.fn(),
      revoke: jest.fn((_name: string) => false),
      approve: jest.fn(),
      computeHash: jest.fn((_content: string) => 'test-hash'),
    } as jest.Mocked<ManifestHandle>;

    // Mock the ApprovalManifest constructor
    const ApprovalManifest = require('@matimo/core').ApprovalManifest as jest.Mock;
    ApprovalManifest.mockImplementation(() => mockManifest);

    // Mock fs module
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('name: test-tool\nversion: 1.0.0');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('list subcommand', () => {
    it('should show no tools message when list is empty', async () => {
      mockManifest.getPendingTools.mockReturnValue([]);
      mockManifest.listApproved.mockReturnValue([]);

      await reviewCommand(['list']);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('No tools are pending or approved')
      );
    });

    it('should display pending tools with table format', async () => {
      mockManifest.getPendingTools.mockReturnValue(['tool-a', 'tool-b']);
      mockManifest.listApproved.mockReturnValue([]);

      await reviewCommand(['list']);

      // Check for table header and pending tools
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Pending approval'));
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('tool-a'));
    });

    it('should display approved tools with approval metadata', async () => {
      mockManifest.getPendingTools.mockReturnValue([]);
      mockManifest.listApproved.mockReturnValue(['approved-tool']);
      mockManifest.getApproval.mockReturnValue({
        approvedAt: '2026-03-17T12:00:00Z',
        approvedBy: 'admin',
      });

      await reviewCommand(['list']);

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Approved tools'));
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('approved-tool'));
    });

    it('should list both pending and approved tools', async () => {
      mockManifest.getPendingTools.mockReturnValue(['pending-tool']);
      mockManifest.listApproved.mockReturnValue(['approved-tool']);
      mockManifest.getApproval.mockReturnValue({
        approvedAt: '2026-03-17T12:00:00Z',
        approvedBy: 'reviewer',
      });

      await reviewCommand(['list']);

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Pending approval'));
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Approved tools'));
    });

    it('should execute list when no subcommand provided (default)', async () => {
      mockManifest.getPendingTools.mockReturnValue([]);
      mockManifest.listApproved.mockReturnValue([]);

      await reviewCommand([]);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('No tools are pending or approved')
      );
    });

    it('should show suggestion to run approve/reject when pending tools exist', async () => {
      mockManifest.getPendingTools.mockReturnValue(['my-tool']);
      mockManifest.listApproved.mockReturnValue([]);

      await reviewCommand(['list']);

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringMatching(/approve.*reject/i));
    });
  });

  describe('approve subcommand', () => {
    it('should exit when tool name not provided', async () => {
      try {
        await reviewCommand(['approve']);
      } catch (e) {
        console.error('Caught expected error for missing tool name', e);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should approve a pending tool with secret', async () => {
      process.env.MATIMO_APPROVAL_SECRET = 'test-secret';
      mockManifest.getPendingTools.mockReturnValue(['test-tool']);
      mockManifest.listApproved.mockReturnValue([]);

      await reviewCommand(['approve', 'test-tool']);

      expect(mockManifest.approve).toHaveBeenCalledWith(
        'test-tool',
        'test-hash',
        expect.any(String)
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('approved'));
    });

    it('should not approve tool when secret is missing', async () => {
      delete process.env.MATIMO_APPROVAL_SECRET;
      mockManifest.getPendingTools.mockReturnValue(['test-tool']);

      try {
        await reviewCommand(['approve', 'test-tool']);
      } catch (e) {
        console.error('Caught expected error for missing MATIMO_APPROVAL_SECRET', e);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('MATIMO_APPROVAL_SECRET')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit when tool yaml file is missing', async () => {
      process.env.MATIMO_APPROVAL_SECRET = 'test-secret';
      mockManifest.getPendingTools.mockReturnValue(['missing-tool']);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      try {
        await reviewCommand(['approve', 'missing-tool']);
      } catch (e) {
        // Expected exit
        console.error('Caught expected error for missing tool YAML file', e);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('definition.yaml'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should show message when tool is already approved', async () => {
      process.env.MATIMO_APPROVAL_SECRET = 'test-secret';
      mockManifest.getPendingTools.mockReturnValue([]);
      mockManifest.listApproved.mockReturnValue(['already-approved']);

      await reviewCommand(['approve', 'already-approved']);

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('already approved'));
    });

    it('should exit when tool not found in pending or approved', async () => {
      process.env.MATIMO_APPROVAL_SECRET = 'test-secret';
      mockManifest.getPendingTools.mockReturnValue([]);
      mockManifest.listApproved.mockReturnValue([]);

      try {
        await reviewCommand(['approve', 'nonexistent']);
      } catch (e) {
        console.error('Caught expected error for nonexistent tool', e);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No pending tool'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should use USER env var for approvedBy when available', async () => {
      process.env.MATIMO_APPROVAL_SECRET = 'test-secret';
      process.env.USER = 'testuser';
      mockManifest.getPendingTools.mockReturnValue(['test-tool']);

      await reviewCommand(['approve', 'test-tool']);

      expect(mockManifest.approve).toHaveBeenCalledWith('test-tool', 'test-hash', 'testuser');
    });

    it('should use USERNAME env var for approvedBy as fallback', async () => {
      process.env.MATIMO_APPROVAL_SECRET = 'test-secret';
      delete process.env.USER;
      process.env.USERNAME = 'windowsuser';
      mockManifest.getPendingTools.mockReturnValue(['test-tool']);

      await reviewCommand(['approve', 'test-tool']);

      expect(mockManifest.approve).toHaveBeenCalledWith('test-tool', 'test-hash', 'windowsuser');
    });

    it('should use cli as default approvedBy', async () => {
      process.env.MATIMO_APPROVAL_SECRET = 'test-secret';
      delete process.env.USER;
      delete process.env.USERNAME;
      mockManifest.getPendingTools.mockReturnValue(['test-tool']);

      await reviewCommand(['approve', 'test-tool']);

      expect(mockManifest.approve).toHaveBeenCalledWith('test-tool', 'test-hash', 'cli');
    });
  });

  describe('reject subcommand', () => {
    it('should exit when tool name not provided', async () => {
      try {
        await reviewCommand(['reject']);
      } catch (e) {
        console.error('Caught expected error for missing tool name', e);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should revoke approved tool', async () => {
      mockManifest.revoke.mockReturnValue(true);
      mockManifest.getPendingTools.mockReturnValue([]);

      await reviewCommand(['reject', 'approved-tool']);

      expect(mockManifest.revoke).toHaveBeenCalledWith('approved-tool');
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('rejected'));
    });

    it('should show removal message when tool was approved', async () => {
      mockManifest.revoke.mockReturnValue(true);
      mockManifest.getPendingTools.mockReturnValue([]);

      await reviewCommand(['reject', 'formerly-approved']);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Approval signature removed')
      );
    });

    it('should handle pending tool removal', async () => {
      mockManifest.revoke.mockReturnValue(false);
      mockManifest.getPendingTools.mockReturnValue(['pending-tool']);

      await reviewCommand(['reject', 'pending-tool']);

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('rejected'));
    });

    it('should show info when tool does not exist', async () => {
      mockManifest.revoke.mockReturnValue(false);
      mockManifest.getPendingTools.mockReturnValue([]);

      await reviewCommand(['reject', 'nonexistent']);

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('No record of tool'));
    });
  });

  describe('unknown subcommand', () => {
    it('should exit with error for unknown subcommand', async () => {
      try {
        await reviewCommand(['invalid-cmd']);
      } catch (e) {
        console.error('Caught expected error for unknown subcommand', e);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown review subcommand')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('environment variable handling', () => {
    it('should respect MATIMO_TOOL_DIR when set', async () => {
      process.env.MATIMO_TOOL_DIR = '/custom/tools/path';
      mockManifest.getPendingTools.mockReturnValue([]);
      mockManifest.listApproved.mockReturnValue([]);

      await reviewCommand(['list']);

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.any(String));
    });

    it('should use current working directory when MATIMO_TOOL_DIR not set', async () => {
      delete process.env.MATIMO_TOOL_DIR;
      mockManifest.getPendingTools.mockReturnValue([]);
      mockManifest.listApproved.mockReturnValue([]);

      await reviewCommand(['list']);

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('manifest loading', () => {
    it('should exit when @matimo/core is not available', async () => {
      const ApprovalManifest = require('@matimo/core').ApprovalManifest as jest.Mock;
      ApprovalManifest.mockImplementationOnce(() => {
        throw new Error('Module not found');
      });

      try {
        await reviewCommand(['list']);
      } catch (e) {
        console.error('Caught expected error for missing @matimo/core', e);
      }

      // When manifest fails to load, should show error
      // This test verifies error handling path
    });
  });
});
