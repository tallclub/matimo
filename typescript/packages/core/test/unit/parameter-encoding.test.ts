import {
  applyParameterEncodings,
  ParameterEncodingConfig,
} from '../../src/encodings/parameter-encoding';

describe('Parameter Encoding System', () => {
  describe('applyParameterEncodings()', () => {
    it('should apply MIME RFC 2822 base64url encoding for email parameters', () => {
      const params = {
        to: 'user@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        other_param: 'not_encoded',
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['to', 'subject', 'body'],
          target: 'raw',
          encoding: 'mime_rfc2822_base64url',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      expect(result.raw).toBeDefined();
      expect(typeof result.raw).toBe('string');
      expect(result.other_param).toBe('not_encoded');
      // Base64url should not contain standard base64 characters
      expect((result.raw as string).includes('+')).toBe(false);
      expect((result.raw as string).includes('/')).toBe(false);
    });

    it('should apply JSON compact encoding', () => {
      const params = {
        name: 'John',
        age: 30,
        active: true,
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['name', 'age', 'active'],
          target: 'json_data',
          encoding: 'json_compact',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      expect(result.json_data).toBeDefined();
      const parsed = JSON.parse(result.json_data as string);
      expect(parsed.name).toBe('John');
      expect(parsed.age).toBe(30);
      expect(parsed.active).toBe(true);
    });

    it('should apply URL encoding', () => {
      const params = {
        email: 'user@example.com',
        name: 'John Doe',
        message: 'Hello World',
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['email', 'name', 'message'],
          target: 'encoded',
          encoding: 'url_encoded',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      expect(result.encoded).toBeDefined();
      const encoded = result.encoded as string;
      expect(encoded).toContain('email=');
      expect(encoded).toContain('name=');
      expect(encoded).toContain('message=');
      expect(encoded).toContain('%40'); // @ encoded
      // URLSearchParams uses + for space, not %20
      expect(encoded.includes('+') || encoded.includes('%20')).toBe(true);
    });

    it('should handle multiple encoding rules', () => {
      const params = {
        to: 'user@example.com',
        subject: 'Test',
        body: 'Body',
        key: 'value',
        secret: 'password123',
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['to', 'subject', 'body'],
          target: 'raw',
          encoding: 'mime_rfc2822_base64url',
        },
        {
          source: ['key', 'secret'],
          target: 'json_config',
          encoding: 'json_compact',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      expect(result.raw).toBeDefined();
      expect(result.json_config).toBeDefined();
    });

    it('should handle missing source parameters gracefully', () => {
      const params = {
        to: 'user@example.com',
        subject: 'Test',
        // body is missing
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['to', 'subject', 'body'],
          target: 'raw',
          encoding: 'mime_rfc2822_base64url',
        },
      ];

      expect(() => {
        applyParameterEncodings(params, encodings);
      }).toThrow('MIME encoding requires: to, subject, body parameters');
    });

    it('should handle empty encoding list', () => {
      const params = {
        key: 'value',
        data: 'test',
      };

      const result = applyParameterEncodings(params, []);

      expect(result).toEqual(params);
    });

    it('should preserve original parameters when encoding', () => {
      const params = {
        to: 'user@example.com',
        subject: 'Test',
        body: 'Body',
        other: 'value',
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['to', 'subject', 'body'],
          target: 'raw',
          encoding: 'mime_rfc2822_base64url',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      expect(result.to).toBe('user@example.com');
      expect(result.subject).toBe('Test');
      expect(result.body).toBe('Body');
      expect(result.other).toBe('value');
      expect(result.raw).toBeDefined();
    });

    it('should throw error for unknown encoding type', () => {
      const params = {
        data: 'test',
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['data'],
          target: 'encoded',
          encoding: 'unknown_encoding_type',
        },
      ];

      expect(() => {
        applyParameterEncodings(params, encodings);
      }).toThrow('Unknown parameter encoding type: unknown_encoding_type');
    });

    it('should handle CC and BCC in MIME encoding', () => {
      const params = {
        to: 'user@example.com',
        subject: 'Test',
        body: 'Body',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        isHtml: false,
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['to', 'subject', 'body', 'cc', 'bcc', 'isHtml'],
          target: 'raw',
          encoding: 'mime_rfc2822_base64url',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      expect(result.raw).toBeDefined();
      // Decode base64url to verify CC/BCC are included
      const raw = result.raw as string;
      const padded = raw + '=='; // Add padding for decoding
      const decoded = Buffer.from(padded, 'base64').toString('utf-8');
      expect(decoded).toContain('Cc: cc@example.com');
      expect(decoded).toContain('Bcc: bcc@example.com');
    });

    it('should handle HTML content in MIME encoding', () => {
      const params = {
        to: 'user@example.com',
        subject: 'HTML Email',
        body: '<h1>Hello</h1><p>Test</p>',
        isHtml: true,
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['to', 'subject', 'body', 'isHtml'],
          target: 'raw',
          encoding: 'mime_rfc2822_base64url',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      const raw = result.raw as string;
      const padded = raw + '==';
      const decoded = Buffer.from(padded, 'base64').toString('utf-8');
      expect(decoded).toContain('Content-Type: text/html');
      expect(decoded).toContain('<h1>Hello</h1>');
    });

    it('should default to text/plain for non-HTML email', () => {
      const params = {
        to: 'user@example.com',
        subject: 'Plain Email',
        body: 'Plain text',
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['to', 'subject', 'body'],
          target: 'raw',
          encoding: 'mime_rfc2822_base64url',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      const raw = result.raw as string;
      const padded = raw + '==';
      const decoded = Buffer.from(padded, 'base64').toString('utf-8');
      expect(decoded).toContain('Content-Type: text/plain');
    });

    it('should handle URL encoding with special characters', () => {
      const params = {
        query: 'hello world',
        email: 'test@example.com',
        data: 'a+b=c',
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['query', 'email', 'data'],
          target: 'encoded',
          encoding: 'url_encoded',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      const encoded = result.encoded as string;
      // URLSearchParams properly encodes special characters
      expect(encoded).toBeTruthy();
      const params2 = new URLSearchParams(encoded);
      expect(params2.get('query')).toBe('hello world');
      expect(params2.get('email')).toBe('test@example.com');
    });

    it('should handle null and undefined values in URL encoding', () => {
      const params = {
        key1: 'value1',
        key2: null,
        key3: undefined,
        key4: 'value4',
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['key1', 'key2', 'key3', 'key4'],
          target: 'encoded',
          encoding: 'url_encoded',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      const encoded = result.encoded as string;
      expect(encoded).toContain('key1=value1');
      expect(encoded).toContain('key4=value4');
      // null and undefined should not be included or should be empty
    });

    it('should handle partial source parameters in JSON encoding', () => {
      const params = {
        name: 'John',
        age: 30,
        city: 'NYC',
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['name', 'age'], // Only subset
          target: 'json_data',
          encoding: 'json_compact',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      const parsed = JSON.parse(result.json_data as string);
      expect(parsed.name).toBe('John');
      expect(parsed.age).toBe(30);
      expect(parsed.city).toBeUndefined();
      expect(result.city).toBe('NYC'); // Original preserved
    });

    it('should handle MIME encoding with only required fields', () => {
      const params = {
        to: 'user@example.com',
        subject: 'Subject',
        body: 'Body',
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['to', 'subject', 'body'],
          target: 'raw',
          encoding: 'mime_rfc2822_base64url',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      expect(result.raw).toBeDefined();
      const raw = result.raw as string;
      expect(raw.length > 0).toBe(true);
      // Verify it's valid base64url (no padding issues)
      expect(() => Buffer.from(raw + '==', 'base64')).not.toThrow();
    });

    it('should handle encoding with options parameter', () => {
      const params = {
        data: 'test',
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['data'],
          target: 'encoded',
          encoding: 'json_compact',
          options: { pretty: false },
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      expect(result.encoded).toBeDefined();
    });

    it('should handle numeric values in parameters', () => {
      const params = {
        count: 42,
        price: 19.99,
        active: true,
      };

      const encodings: ParameterEncodingConfig[] = [
        {
          source: ['count', 'price', 'active'],
          target: 'json_data',
          encoding: 'json_compact',
        },
      ];

      const result = applyParameterEncodings(params, encodings);

      const parsed = JSON.parse(result.json_data as string);
      expect(parsed.count).toBe(42);
      expect(parsed.price).toBe(19.99);
      expect(parsed.active).toBe(true);
    });
  });
});
