const nodeCrypto = require('crypto');

if (typeof globalThis.crypto === 'undefined' && nodeCrypto.webcrypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: nodeCrypto.webcrypto,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

if (globalThis.crypto && typeof globalThis.crypto.randomUUID !== 'function' && nodeCrypto.randomUUID) {
  globalThis.crypto.randomUUID = nodeCrypto.randomUUID;
}
