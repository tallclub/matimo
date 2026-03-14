import { ToolIntegrityTracker } from '../../../src/policy/integrity-tracker';

describe('ToolIntegrityTracker', () => {
  let tracker: ToolIntegrityTracker;

  beforeEach(() => {
    tracker = new ToolIntegrityTracker();
  });

  describe('computeHash', () => {
    it('should return consistent SHA-256 hashes', () => {
      const content = 'name: test-tool\nversion: 1.0.0';
      const hash1 = tracker.computeHash(content);
      const hash2 = tracker.computeHash(content);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string
    });

    it('should return different hashes for different content', () => {
      const hash1 = tracker.computeHash('content-a');
      const hash2 = tracker.computeHash('content-b');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('onToolLoaded', () => {
    it('should return validate for new tools', () => {
      const result = tracker.onToolLoaded('new-tool', 'yaml-content', 'trusted');
      expect(result).toEqual({ action: 'validate', reason: 'new-tool' });
    });

    it('should return keep for unchanged tools', () => {
      const content = 'yaml-content';
      tracker.record('my-tool', content, 'trusted');

      const result = tracker.onToolLoaded('my-tool', content, 'trusted');
      expect(result).toEqual({ action: 'keep', reason: 'unchanged' });
    });

    it('should return revalidate for modified tools', () => {
      tracker.record('my-tool', 'original-content', 'trusted');

      const result = tracker.onToolLoaded('my-tool', 'modified-content', 'trusted');
      expect(result).toEqual({ action: 'revalidate', reason: 'content-modified' });
    });
  });

  describe('record', () => {
    it('should store tool hash and source', () => {
      tracker.record('my-tool', 'yaml-content', 'untrusted');

      const record = tracker.getRecord('my-tool');
      expect(record).toBeDefined();
      expect(record!.source).toBe('untrusted');
      expect(record!.hash).toBe(tracker.computeHash('yaml-content'));
      expect(record!.validatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getHash', () => {
    it('should return undefined for unknown tools', () => {
      expect(tracker.getHash('nonexistent')).toBeUndefined();
    });

    it('should return stored hash', () => {
      tracker.record('my-tool', 'content', 'trusted');
      expect(tracker.getHash('my-tool')).toBe(tracker.computeHash('content'));
    });
  });

  describe('removeEntry', () => {
    it('should remove an existing entry', () => {
      tracker.record('my-tool', 'content', 'trusted');
      expect(tracker.removeEntry('my-tool')).toBe(true);
      expect(tracker.getHash('my-tool')).toBeUndefined();
    });

    it('should return false for non-existent entry', () => {
      expect(tracker.removeEntry('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      tracker.record('tool-a', 'content-a', 'trusted');
      tracker.record('tool-b', 'content-b', 'untrusted');
      expect(tracker.size).toBe(2);

      tracker.clear();
      expect(tracker.size).toBe(0);
    });
  });

  describe('size', () => {
    it('should reflect the number of tracked tools', () => {
      expect(tracker.size).toBe(0);
      tracker.record('tool-a', 'content', 'trusted');
      expect(tracker.size).toBe(1);
    });
  });
});
