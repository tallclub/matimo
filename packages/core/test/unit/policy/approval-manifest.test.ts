import fs from 'fs';
import path from 'path';
import os from 'os';
import { ApprovalManifest } from '../../../src/policy/approval-manifest';

describe('ApprovalManifest', () => {
  let tmpDir: string;
  let manifest: ApprovalManifest;
  const TEST_SECRET = 'test-secret-key-for-hmac';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-approval-test-'));
    manifest = new ApprovalManifest(tmpDir, TEST_SECRET);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('approve and isApproved', () => {
    it('should approve a tool with valid HMAC', () => {
      const yamlHash = manifest.computeHash('name: my-tool\nversion: 1.0.0');
      manifest.approve('my-tool', yamlHash);

      expect(manifest.isApproved('my-tool', yamlHash)).toBe(true);
    });

    it('should reject unapproved tools', () => {
      const yamlHash = manifest.computeHash('name: unknown\nversion: 1.0.0');
      expect(manifest.isApproved('unknown', yamlHash)).toBe(false);
    });

    it('should reject if YAML hash changes (tool modified after approval)', () => {
      const originalHash = manifest.computeHash('name: my-tool\nversion: 1.0.0');
      manifest.approve('my-tool', originalHash);

      const modifiedHash = manifest.computeHash('name: my-tool\nversion: 2.0.0\nexecution: evil');
      expect(manifest.isApproved('my-tool', modifiedHash)).toBe(false);
    });

    it('should include approvedBy when provided', () => {
      const yamlHash = manifest.computeHash('content');
      manifest.approve('my-tool', yamlHash, 'admin@example.com');

      const record = manifest.getApproval('my-tool');
      expect(record?.approvedBy).toBe('admin@example.com');
    });
  });

  describe('HMAC tampering detection', () => {
    it('should reject if manifest file is tampered with', () => {
      const yamlHash = manifest.computeHash('content');
      manifest.approve('my-tool', yamlHash);

      // Tamper with the manifest file on disk
      const manifestPath = path.join(tmpDir, '.matimo-approvals.json');
      const rawData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      rawData.approvals[0].signature = 'tampered-signature';
      fs.writeFileSync(manifestPath, JSON.stringify(rawData));

      // Reload from disk (new instance)
      const reloaded = new ApprovalManifest(tmpDir, TEST_SECRET);
      expect(reloaded.isApproved('my-tool', yamlHash)).toBe(false);
    });

    it('should reject if a different secret is used', () => {
      const yamlHash = manifest.computeHash('content');
      manifest.approve('my-tool', yamlHash);

      // Load with different secret
      const differentSecret = new ApprovalManifest(tmpDir, 'different-secret');
      expect(differentSecret.isApproved('my-tool', yamlHash)).toBe(false);
    });
  });

  describe('revoke', () => {
    it('should revoke an approved tool', () => {
      const yamlHash = manifest.computeHash('content');
      manifest.approve('my-tool', yamlHash);
      expect(manifest.isApproved('my-tool', yamlHash)).toBe(true);

      expect(manifest.revoke('my-tool')).toBe(true);
      expect(manifest.isApproved('my-tool', yamlHash)).toBe(false);
    });

    it('should return false when revoking non-existent tool', () => {
      expect(manifest.revoke('nonexistent')).toBe(false);
    });

    it('should persist revocation to disk', () => {
      const yamlHash = manifest.computeHash('content');
      manifest.approve('my-tool', yamlHash);
      manifest.revoke('my-tool');

      const reloaded = new ApprovalManifest(tmpDir, TEST_SECRET);
      expect(reloaded.isApproved('my-tool', yamlHash)).toBe(false);
    });

    it('should remove tool from pendingSet when revoking', () => {
      const yamlHash = manifest.computeHash('content');
      // Mark as pending, then approve
      manifest.markPending('my-tool');
      manifest.approve('my-tool', yamlHash);
      expect(manifest.getPendingTools()).not.toContain('my-tool');

      // Revoke should remove from both cache and pendingSet
      manifest.revoke('my-tool');
      expect(manifest.isApproved('my-tool', yamlHash)).toBe(false);
      expect(manifest.getPendingTools()).not.toContain('my-tool');
    });

    it('should handle revoking a tool that is only in pendingSet', () => {
      manifest.markPending('my-tool');
      expect(manifest.getPendingTools()).toContain('my-tool');

      // Revoke removes from pendingSet
      expect(manifest.revoke('my-tool')).toBe(true);
      expect(manifest.getPendingTools()).not.toContain('my-tool');
    });
  });

  describe('listApproved', () => {
    it('should list all approved tool names', () => {
      manifest.approve('tool-a', manifest.computeHash('a'));
      manifest.approve('tool-b', manifest.computeHash('b'));

      const approved = manifest.listApproved();
      expect(approved).toContain('tool-a');
      expect(approved).toContain('tool-b');
      expect(approved).toHaveLength(2);
    });
  });

  describe('persistence', () => {
    it('should persist approvals across instances', () => {
      const yamlHash = manifest.computeHash('content');
      manifest.approve('my-tool', yamlHash);

      const reloaded = new ApprovalManifest(tmpDir, TEST_SECRET);
      expect(reloaded.isApproved('my-tool', yamlHash)).toBe(true);
    });

    it('should handle missing manifest file gracefully', () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-empty-'));
      const emptyManifest = new ApprovalManifest(emptyDir, TEST_SECRET);
      expect(emptyManifest.listApproved()).toHaveLength(0);
      fs.rmSync(emptyDir, { recursive: true, force: true });
    });

    it('should handle corrupted manifest file gracefully', () => {
      const manifestPath = path.join(tmpDir, '.matimo-approvals.json');
      fs.writeFileSync(manifestPath, 'not valid json');

      const corrupted = new ApprovalManifest(tmpDir, TEST_SECRET);
      expect(corrupted.listApproved()).toHaveLength(0);
    });
  });

  describe('auto-generate secret', () => {
    it('should auto-generate a secret when none provided', () => {
      // Temporarily clear the env var
      const original = process.env.MATIMO_APPROVAL_SECRET;
      delete process.env.MATIMO_APPROVAL_SECRET;

      const autoManifest = new ApprovalManifest(tmpDir);
      const yamlHash = autoManifest.computeHash('content');
      autoManifest.approve('auto-tool', yamlHash);
      expect(autoManifest.isApproved('auto-tool', yamlHash)).toBe(true);

      // Restore env
      if (original !== undefined) {
        process.env.MATIMO_APPROVAL_SECRET = original;
      }
    });

    it('should use env var secret when provided via env', () => {
      const original = process.env.MATIMO_APPROVAL_SECRET;
      process.env.MATIMO_APPROVAL_SECRET = 'env-secret';

      const envManifest = new ApprovalManifest(tmpDir);
      const yamlHash = envManifest.computeHash('content');
      envManifest.approve('env-tool', yamlHash);
      expect(envManifest.isApproved('env-tool', yamlHash)).toBe(true);

      if (original !== undefined) {
        process.env.MATIMO_APPROVAL_SECRET = original;
      } else {
        delete process.env.MATIMO_APPROVAL_SECRET;
      }
    });

    it('should prefer constructor secret over env var', () => {
      const original = process.env.MATIMO_APPROVAL_SECRET;
      process.env.MATIMO_APPROVAL_SECRET = 'env-secret';

      const constructorManifest = new ApprovalManifest(tmpDir, 'constructor-secret');
      const yamlHash = constructorManifest.computeHash('content');
      constructorManifest.approve('ctor-tool', yamlHash);
      expect(constructorManifest.isApproved('ctor-tool', yamlHash)).toBe(true);

      if (original !== undefined) {
        process.env.MATIMO_APPROVAL_SECRET = original;
      } else {
        delete process.env.MATIMO_APPROVAL_SECRET;
      }
    });
  });

  describe('pending tools', () => {
    it('should mark tools as pending', () => {
      manifest.markPending('pending-tool-1');
      manifest.markPending('pending-tool-2');

      const pending = manifest.getPendingTools();
      expect(pending).toContain('pending-tool-1');
      expect(pending).toContain('pending-tool-2');
    });

    it('should not return pending tools that are approved', () => {
      const yamlHash = manifest.computeHash('content');
      manifest.markPending('to-approve');
      manifest.approve('to-approve', yamlHash);

      const pending = manifest.getPendingTools();
      expect(pending).not.toContain('to-approve');
    });

    it('should persist pending list to disk', () => {
      manifest.markPending('pending-1');
      manifest.markPending('pending-2');

      const reloaded = new ApprovalManifest(tmpDir, TEST_SECRET);
      const pending = reloaded.getPendingTools();
      expect(pending).toContain('pending-1');
      expect(pending).toContain('pending-2');
    });
  });

  describe('directory creation', () => {
    it('should create manifest directory if it does not exist', () => {
      const nestedDir = path.join(tmpDir, 'nested', 'dir', 'tools');
      const nestedManifest = new ApprovalManifest(nestedDir, TEST_SECRET);

      const yamlHash = nestedManifest.computeHash('content');
      nestedManifest.approve('tool', yamlHash);

      expect(fs.existsSync(nestedDir)).toBe(true);
      const manifestPath = path.join(nestedDir, '.matimo-approvals.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      fs.rmSync(path.join(tmpDir, 'nested'), { recursive: true, force: true });
    });
  });

  describe('invalid manifest data', () => {
    it('should handle manifest with invalid structure', () => {
      const manifestPath = path.join(tmpDir, '.matimo-approvals.json');
      fs.writeFileSync(manifestPath, JSON.stringify({ version: '1', approvals: 'not-an-array' }));

      const invalid = new ApprovalManifest(tmpDir, TEST_SECRET);
      expect(invalid.listApproved()).toHaveLength(0);
    });

    it('should handle manifest with invalid approval records', () => {
      const manifestPath = path.join(tmpDir, '.matimo-approvals.json');
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({
          version: '1',
          approvals: [
            { name: 'valid-tool', hash: 'hash', signature: 'sig' },
            { name: 'incomplete' }, // missing hash and signature
            { hash: 'hash' }, // missing name
          ],
        })
      );

      const invalid = new ApprovalManifest(tmpDir, TEST_SECRET);
      // Should only load the valid record
      expect(invalid.listApproved()).toContain('valid-tool');
      expect(invalid.listApproved()).not.toContain('incomplete');
    });

    it('should handle manifest with invalid pending data', () => {
      const manifestPath = path.join(tmpDir, '.matimo-approvals.json');
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({
          version: '1',
          approvals: [],
          pending: ['valid-pending', 123, null, 'another-pending'], // mixed types
        })
      );

      const invalid = new ApprovalManifest(tmpDir, TEST_SECRET);
      const pending = invalid.getPendingTools();
      // Should only include string entries
      expect(pending).toContain('valid-pending');
      expect(pending).toContain('another-pending');
      expect(pending).toHaveLength(2);
    });
  });
});
