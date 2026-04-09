import axios from 'axios';
jest.mock('axios');

import * as path from 'path';
import { MatimoInstance } from '../../../core/src/matimo-instance';

describe('hubspot-create-contact execution', () => {
  let matimo: MatimoInstance;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeAll(async () => {
    // Ensure API key is present for templating
    process.env.MATIMO_HUBSPOT_API_KEY = 'testkey';

    // Mock axios.request to return a successful HubSpot-like response
    mockedAxios.request = jest.fn().mockResolvedValue({
      status: 201,
      data: {
        id: 'contact_123',
        properties: { email: 'test@example.com' },
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
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

  it('calls axios with correct method, url and Authorization header', async () => {
    const result = await matimo.execute('hubspot-create-contact', {
      email: 'test@example.com',
      firstname: 'Exec',
      lastname: 'Test',
      phone: '123-456-7890',
      company: 'Test Company',
    });

    expect(result).toBeDefined();
    // Axios.request should have been called once
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);

    const callArg = mockedAxios.request.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.method).toBe('POST');
    expect(callArg.url).toBe('https://api.hubapi.com/crm/v3/objects/contacts');
    const headers = callArg.headers as Record<string, unknown>;
    expect(headers.Authorization).toBe('Bearer testkey');

    // Verify returned data shape
    const data = result as Record<string, unknown>;
    expect(data).toBeDefined();
    expect((data.data as Record<string, unknown>).id).toBe('contact_123');
  });
});
