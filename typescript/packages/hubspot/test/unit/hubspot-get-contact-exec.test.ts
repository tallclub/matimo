import axios from 'axios';
jest.mock('axios');

import * as path from 'path';
import { MatimoInstance } from '../../../core/src/matimo-instance';

describe('hubspot-get-contact execution', () => {
  let matimo: MatimoInstance;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeAll(async () => {
    process.env.MATIMO_HUBSPOT_API_KEY = 'testkey';

    mockedAxios.request = jest.fn().mockResolvedValue({
      status: 200,
      data: {
        id: 'contact_456',
        properties: { email: 'get@example.com' },
        createdAt: '2025-01-02T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
        archived: false,
      },
      headers: {},
    });

    const toolsPath = path.join(__dirname, '../../tools');
    matimo = await MatimoInstance.init(toolsPath);
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('calls axios GET with correct url and Authorization header', async () => {
    const result = await matimo.execute('hubspot-get-contact', { id: 'contact_456' });

    expect(result).toBeDefined();
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);

    const callArg = mockedAxios.request.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.method).toBe('GET');
    // URL template includes {id}; expect it to be replaced
    expect(callArg.url).toContain('https://api.hubapi.com/crm/v3/objects/contacts/contact_456');
    const headers = callArg.headers as Record<string, unknown>;
    expect(headers.Authorization).toBe('Bearer testkey');

    const data = result as Record<string, unknown>;
    expect((data.data as Record<string, unknown>).id).toBe('contact_456');
  });
});
