import axios from 'axios';
jest.mock('axios');

import * as path from 'path';
import { MatimoInstance } from '../../../core/src/matimo-instance';

describe('hubspot-delete-contact execution', () => {
  let matimo: MatimoInstance;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeAll(async () => {
    // Pre-approve destructive actions for tests
    process.env.MATIMO_AUTO_APPROVE = 'true';
    process.env.MATIMO_HUBSPOT_API_KEY = 'testkey';

    mockedAxios.request = jest.fn().mockResolvedValue({
      status: 204,
      data: { status: 'deleted' },
      headers: {},
    });

    const toolsPath = path.join(__dirname, '../../tools');
    matimo = await MatimoInstance.init(toolsPath);
  });

  afterAll(() => {
    jest.resetAllMocks();
    delete process.env.MATIMO_AUTO_APPROVE;
  });

  it('calls axios DELETE with correct url and Authorization header', async () => {
    const result = await matimo.execute('hubspot-delete-contact', { id: 'contact_delete_1' });

    expect(result).toBeDefined();
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);

    const callArg = mockedAxios.request.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.method).toBe('DELETE');
    expect(callArg.url).toBe('https://api.hubapi.com/crm/v3/objects/contacts/contact_delete_1');
    const headers = callArg.headers as Record<string, unknown>;
    expect(headers.Authorization).toBe('Bearer testkey');

    const data = result as Record<string, unknown>;
    expect((data.data as Record<string, unknown>).status).toBeDefined();
  });
});
