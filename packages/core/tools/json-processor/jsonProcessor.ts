export default async function jsonProcessor(params: {
  json: string;
  action: string;
  path?: string;
}) {
  const { json, action, path } = params;

  let parsedJson: any;

  // 🔒 Safe parsing
  try {
    parsedJson = JSON.parse(json);
  } catch (err) {
    return {
      valid: false,
      result: 'Invalid JSON',
    };
  }

  // 🧠 Helper for nested extraction
  function getValueByPath(obj: any, path: string) {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  switch (action) {
    case 'validate':
      return {
        valid: true,
        result: 'Valid JSON',
      };

    case 'pretty':
      return {
        valid: true,
        result: JSON.stringify(parsedJson, null, 2),
      };

    case 'minify':
      return {
        valid: true,
        result: JSON.stringify(parsedJson),
      };

    case 'keys':
      return {
        valid: true,
        keys: Object.keys(parsedJson),
      };

    case 'extract':
      if (!path) {
        return {
          valid: false,
          result: 'Path is required for extract action',
        };
      }

      const value = getValueByPath(parsedJson, path);

      return {
        valid: true,
        result: JSON.stringify(value),
      };

    default:
      return {
        valid: false,
        result: `Unknown action: ${action}`,
      };
  }
}