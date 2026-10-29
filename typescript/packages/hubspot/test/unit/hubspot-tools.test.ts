/**
 * Unit Tests for HubSpot Tool and Provider Definitions
 * Tests YAML structure of the provider definition and every tool definition.
 */

import * as fs from 'fs';
import * as path from 'path';

const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
const HUBSPOT_API_KEY_ENV = 'MATIMO_HUBSPOT_API_KEY';

describe('HubSpot provider definition', () => {
  let providerDef: Record<string, unknown>;

  beforeAll(() => {
    const providerPath = path.join(__dirname, '../../definition.yaml');
    const content = fs.readFileSync(providerPath, 'utf8');
    providerDef = require('js-yaml').load(content) as Record<string, unknown>;
  });

  it('should point tokenUrl at the HubSpot OAuth token endpoint', () => {
    const provider = providerDef.provider as { endpoints?: { tokenUrl?: string } };
    expect(provider.endpoints?.tokenUrl).toBe(HUBSPOT_TOKEN_URL);
  });
});

describe('HubSpot tool definitions', () => {
  const toolsDir = path.join(__dirname, '../../tools');
  const toolDirs = fs
    .readdirSync(toolsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  it('should discover every tool directory', () => {
    expect(toolDirs.length).toBeGreaterThan(0);
  });

  toolDirs.forEach((toolName) => {
    describe(toolName, () => {
      let toolDef: Record<string, unknown>;

      beforeAll(() => {
        const toolPath = path.join(toolsDir, toolName, 'definition.yaml');
        const content = fs.readFileSync(toolPath, 'utf8');
        toolDef = require('js-yaml').load(content) as Record<string, unknown>;
      });

      it('should declare the API key env var in authentication.notes', () => {
        const auth = toolDef.authentication as Record<string, unknown> | undefined;
        expect(auth).toBeDefined();
        expect(auth?.notes).toEqual({ env: HUBSPOT_API_KEY_ENV });
      });
    });
  });
});
