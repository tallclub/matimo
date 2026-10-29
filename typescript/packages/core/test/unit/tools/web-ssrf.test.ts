import axios from 'axios';
import webTool from '../../../tools/web/web';
import extractTool from '../../../tools/extract_from_file/extract_from_file';
import webScraperTool from '../../../tools/web_scraper/web_scraper';
import { MatimoError } from '../../../src/errors/matimo-error';
import { ssrfHttpAgent, ssrfHttpsAgent } from '../../../src/executors/ssrf-guard';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const BLOCKED_URLS = [
  'http://127.0.0.2/',
  'http://[::ffff:127.0.0.1]/',
  'http://[fd00:ec2::254]/',
  'http://100.64.0.1/',
  'http://localhost./',
];

describe('network tools refuse internal targets', () => {
  beforeEach(() => jest.resetAllMocks());

  it.each(BLOCKED_URLS)('web blocks %s without sending a request', async (url) => {
    await expect(webTool({ url })).rejects.toBeInstanceOf(MatimoError);
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it.each(BLOCKED_URLS)('extract_from_file blocks %s', async (fileUrl) => {
    await expect(extractTool({ fileUrl } as never)).rejects.toBeInstanceOf(MatimoError);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it.each(BLOCKED_URLS)('web_scraper blocks %s', async (url) => {
    await expect(webScraperTool({ url } as never)).rejects.toBeInstanceOf(MatimoError);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('web passes the SSRF agents and redirect hook to axios for public URLs', async () => {
    mockedAxios.request.mockResolvedValue({ status: 200, data: 'ok', headers: {} });
    await webTool({ url: 'https://example.com/' });
    const config = mockedAxios.request.mock.calls[0][0];
    expect(config.httpAgent).toBe(ssrfHttpAgent);
    expect(config.httpsAgent).toBe(ssrfHttpsAgent);
    expect(typeof config.beforeRedirect).toBe('function');
  });
});
