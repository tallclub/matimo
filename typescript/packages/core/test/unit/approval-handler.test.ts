import {
  ApprovalHandler,
  getGlobalApprovalHandler,
  type ApprovalRequest,
} from '../../src/approval/approval-handler';
import { MatimoError, ErrorCode } from '../../src/errors/matimo-error';

describe('ApprovalHandler', () => {
  let handler: ApprovalHandler;

  beforeEach(() => {
    // Reset environment variables
    delete process.env.MATIMO_AUTO_APPROVE;
    delete process.env.MATIMO_APPROVED_PATTERNS;

    // Create fresh instance
    handler = new ApprovalHandler();
  });

  describe('destructive keyword loading', () => {
    it('should load destructive keywords from YAML file', () => {
      // Create a new handler to ensure keywords are loaded
      const handler = new ApprovalHandler();

      // Test that common destructive keywords are detected
      const destructiveOperations = [
        'CREATE TABLE users',
        'DELETE FROM users',
        'DROP TABLE logs',
        'ALTER TABLE schema',
        'TRUNCATE logs',
        'UPDATE users SET active = false',
        'INSERT INTO logs VALUES (1)',
        'GRANT permissions',
        'REVOKE access',
        'REMOVE file',
        'EXECUTE script',
      ];

      destructiveOperations.forEach((sql) => {
        const result = handler.requiresApproval(undefined, sql);
        expect(result).toBe(true);
      });
    });

    it('should handle case-insensitive keyword detection', () => {
      const handler = new ApprovalHandler();

      const operations = ['create table users', 'DELETE FROM users', 'drop TABLE logs'];

      operations.forEach((sql) => {
        const result = handler.requiresApproval(undefined, sql);
        expect(result).toBe(true);
      });
    });

    it('should have fallback keywords if YAML file is missing', () => {
      const handler = new ApprovalHandler();
      // Should still detect basic destructive operations
      expect(handler.requiresApproval(undefined, 'DELETE FROM users')).toBe(true);
      expect(handler.requiresApproval(undefined, 'CREATE TABLE test')).toBe(true);
    });
  });

  describe('requiresApproval', () => {
    it('should return true when requires_approval is true in YAML', () => {
      const result = handler.requiresApproval(true);
      expect(result).toBe(true);
    });

    it('should return false when requires_approval is false in YAML', () => {
      const result = handler.requiresApproval(false);
      expect(result).toBe(false);
    });

    it('should return false when requires_approval is undefined and no SQL', () => {
      const result = handler.requiresApproval(undefined);
      expect(result).toBe(false);
    });

    it('should detect DELETE keyword in SQL', () => {
      const result = handler.requiresApproval(undefined, 'DELETE FROM users WHERE id = 1');
      expect(result).toBe(true);
    });

    it('should detect DROP keyword in SQL', () => {
      const result = handler.requiresApproval(undefined, 'DROP TABLE users;');
      expect(result).toBe(true);
    });

    it('should detect CREATE keyword in SQL', () => {
      const result = handler.requiresApproval(undefined, 'CREATE TABLE users (id INT);');
      expect(result).toBe(true);
    });

    it('should detect ALTER keyword in SQL', () => {
      const result = handler.requiresApproval(undefined, 'ALTER TABLE users ADD COLUMN age INT;');
      expect(result).toBe(true);
    });

    it('should detect TRUNCATE keyword in SQL', () => {
      const result = handler.requiresApproval(undefined, 'TRUNCATE TABLE logs;');
      expect(result).toBe(true);
    });

    it('should detect UPDATE keyword in SQL', () => {
      const result = handler.requiresApproval(undefined, 'UPDATE users SET active = true;');
      expect(result).toBe(true);
    });

    it('should be case-insensitive for destructive keywords', () => {
      const result = handler.requiresApproval(undefined, 'delete from users');
      expect(result).toBe(true);
    });

    it('should return false for SELECT queries', () => {
      const result = handler.requiresApproval(undefined, 'SELECT * FROM users');
      expect(result).toBe(false);
    });

    it('should return true for INSERT queries (data modification)', () => {
      const result = handler.requiresApproval(undefined, 'INSERT INTO logs VALUES (1)');
      expect(result).toBe(true);
    });

    it('should detect SQL destructive keywords even when requires_approval is false', () => {
      const result = handler.requiresApproval(false, 'DELETE FROM users');
      expect(result).toBe(true);
    });

    it('should not require approval when requires_approval is false and no SQL', () => {
      const result = handler.requiresApproval(false);
      expect(result).toBe(false);
    });
  });

  describe('isPreApproved', () => {
    it('should return true when MATIMO_AUTO_APPROVE is true', () => {
      process.env.MATIMO_AUTO_APPROVE = 'true';
      const freshHandler = new ApprovalHandler();
      const result = freshHandler.isPreApproved('any-tool');
      expect(result).toBe(true);
    });

    it('should return false when MATIMO_AUTO_APPROVE is false', () => {
      process.env.MATIMO_AUTO_APPROVE = 'false';
      const freshHandler = new ApprovalHandler();
      const result = freshHandler.isPreApproved('any-tool');
      expect(result).toBe(false);
    });

    it('should return true when tool name matches approved pattern', () => {
      process.env.MATIMO_APPROVED_PATTERNS = 'slack-*';
      const freshHandler = new ApprovalHandler();
      const result = freshHandler.isPreApproved('slack-send-message');
      expect(result).toBe(true);
    });

    it('should return false when tool name does not match any pattern', () => {
      process.env.MATIMO_APPROVED_PATTERNS = 'slack-*';
      const freshHandler = new ApprovalHandler();
      const result = freshHandler.isPreApproved('github-create-issue');
      expect(result).toBe(false);
    });

    it('should support multiple comma-separated patterns', () => {
      process.env.MATIMO_APPROVED_PATTERNS = 'slack-*,github-search*,postgres-read-*';
      const freshHandler = new ApprovalHandler();

      expect(freshHandler.isPreApproved('slack-send-message')).toBe(true);
      expect(freshHandler.isPreApproved('github-search-repos')).toBe(true);
      expect(freshHandler.isPreApproved('postgres-read-users')).toBe(true);
      expect(freshHandler.isPreApproved('github-delete-repo')).toBe(false);
    });

    it('should be case-insensitive for pattern matching', () => {
      process.env.MATIMO_APPROVED_PATTERNS = 'Slack-*';
      const freshHandler = new ApprovalHandler();
      const result = freshHandler.isPreApproved('slack-send-message');
      expect(result).toBe(true);
    });

    it('should handle wildcard-only patterns', () => {
      process.env.MATIMO_APPROVED_PATTERNS = '*';
      const freshHandler = new ApprovalHandler();
      expect(freshHandler.isPreApproved('any-tool')).toBe(true);
    });

    it('should handle empty pattern string', () => {
      process.env.MATIMO_APPROVED_PATTERNS = '';
      const freshHandler = new ApprovalHandler();
      const result = freshHandler.isPreApproved('any-tool');
      expect(result).toBe(false);
    });

    it('should trim whitespace from patterns', () => {
      process.env.MATIMO_APPROVED_PATTERNS = '  slack-*  , github-* ';
      const freshHandler = new ApprovalHandler();

      expect(freshHandler.isPreApproved('slack-test')).toBe(true);
      expect(freshHandler.isPreApproved('github-test')).toBe(true);
    });
  });

  describe('requestApproval', () => {
    it('should throw when no callback is set', async () => {
      const request: ApprovalRequest = {
        toolName: 'test-tool',
        description: 'Test operation',
        params: {},
      };

      await expect(handler.requestApproval(request)).rejects.toThrow(MatimoError);
    });

    it('should call approval callback when set', async () => {
      const mockCallback = jest.fn().mockResolvedValue(true);
      handler.setApprovalCallback(mockCallback);

      const request: ApprovalRequest = {
        toolName: 'test-tool',
        description: 'Test operation',
        params: { prop: 'value' },
      };

      await handler.requestApproval(request);
      expect(mockCallback).toHaveBeenCalledWith(request);
    });

    it('should throw MatimoError when callback returns false', async () => {
      const mockCallback = jest.fn().mockResolvedValue(false);
      handler.setApprovalCallback(mockCallback);

      const request: ApprovalRequest = {
        toolName: 'test-tool',
        description: 'Test operation',
        params: {},
      };

      await expect(handler.requestApproval(request)).rejects.toThrow(MatimoError);
    });

    it('should pass all request details to callback', async () => {
      const mockCallback = jest.fn().mockResolvedValue(true);
      handler.setApprovalCallback(mockCallback);

      const request: ApprovalRequest = {
        toolName: 'delete-user',
        description: 'Delete a user from database',
        params: { userId: 'user123', force: true },
      };

      await handler.requestApproval(request);

      expect(mockCallback).toHaveBeenCalledWith({
        toolName: 'delete-user',
        description: 'Delete a user from database',
        params: { userId: 'user123', force: true },
      });
    });

    it('should throw error with helpful hint when no callback', async () => {
      const request: ApprovalRequest = {
        toolName: 'test-tool',
        description: 'Test operation',
        params: {},
      };

      try {
        await handler.requestApproval(request);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MatimoError);
        const matimoError = error as MatimoError;
        expect(matimoError.code).toBe(ErrorCode.EXECUTION_FAILED);
        expect(String(matimoError.details?.hint)).toContain('MATIMO_AUTO_APPROVE');
      }
    });
  });

  describe('setApprovalCallback', () => {
    it('should update the approval callback', async () => {
      const callback1 = jest.fn().mockResolvedValue(true);
      const callback2 = jest.fn().mockResolvedValue(false);

      handler.setApprovalCallback(callback1);

      const request: ApprovalRequest = {
        toolName: 'test',
        params: {},
      };

      await handler.requestApproval(request);
      expect(callback1).toHaveBeenCalled();

      // Update callback
      handler.setApprovalCallback(callback2);

      await expect(handler.requestApproval(request)).rejects.toThrow();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('global handler', () => {
    it('should return same instance on multiple calls', () => {
      const handler1 = getGlobalApprovalHandler();
      const handler2 = getGlobalApprovalHandler();
      expect(handler1).toBe(handler2);
    });

    it('should be an instance of ApprovalHandler', () => {
      const handler = getGlobalApprovalHandler();
      expect(handler).toBeInstanceOf(ApprovalHandler);
    });
  });

  describe('integration scenarios', () => {
    it('should handle approval flow: auto-approve', async () => {
      process.env.MATIMO_AUTO_APPROVE = 'true';
      const handler = new ApprovalHandler();

      const request: ApprovalRequest = {
        toolName: 'delete-user',
        description: 'Delete a user',
        params: { id: '123' },
      };

      const requiresApproval = handler.requiresApproval(true);
      expect(requiresApproval).toBe(true);

      const isPreApproved = handler.isPreApproved('delete-user');
      expect(isPreApproved).toBe(true);

      // Should not throw because pre-approved
      if (requiresApproval && !isPreApproved) {
        await handler.requestApproval(request);
      }
    });

    it('should handle approval flow: pattern-based approval', async () => {
      process.env.MATIMO_APPROVED_PATTERNS = 'delete-*';
      const handler = new ApprovalHandler();

      const request: ApprovalRequest = {
        toolName: 'delete-user',
        description: 'Delete a user',
        params: { id: '123' },
      };

      const requiresApproval = handler.requiresApproval(true);
      expect(requiresApproval).toBe(true);

      const isPreApproved = handler.isPreApproved('delete-user');
      expect(isPreApproved).toBe(true);

      // Should not throw because matches pattern
      if (requiresApproval && !isPreApproved) {
        await handler.requestApproval(request);
      }
    });

    it('should handle approval flow: interactive callback', async () => {
      const handler = new ApprovalHandler();
      const mockCallback = jest.fn().mockResolvedValue(true);
      handler.setApprovalCallback(mockCallback);

      const request: ApprovalRequest = {
        toolName: 'delete-user',
        description: 'Delete a user',
        params: { id: '123' },
      };

      const requiresApproval = handler.requiresApproval(true);
      expect(requiresApproval).toBe(true);

      const isPreApproved = handler.isPreApproved('delete-user');
      expect(isPreApproved).toBe(false);

      // Should call callback because not pre-approved
      if (requiresApproval && !isPreApproved) {
        await handler.requestApproval(request);
      }

      expect(mockCallback).toHaveBeenCalled();
    });

    it('should detect destructive SQL and require approval', () => {
      const handler = new ApprovalHandler();

      const sqlOperations = [
        'DELETE FROM users WHERE id = 1',
        'DROP TABLE logs',
        'CREATE TABLE new_table (id INT)',
        'ALTER TABLE users ADD age INT',
        'TRUNCATE users',
        'UPDATE users SET active = false',
      ];

      sqlOperations.forEach((sql) => {
        const result = handler.requiresApproval(undefined, sql);
        expect(result).toBe(true);
      });

      const safeSql = 'SELECT * FROM users';
      expect(handler.requiresApproval(undefined, safeSql)).toBe(false);
    });
  });
});
