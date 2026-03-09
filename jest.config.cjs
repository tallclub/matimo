module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^matimo$': '<rootDir>/packages/core/src/index.ts',
    // Map relative .js imports to .ts files for ESM compatibility (only local imports)
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/index.ts'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    'packages/cli/src/bin.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 97,
      lines: 94,
      statements: 94
    }
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  // Force exit after all tests complete — integration tests can leave open TCP
  // connections (e.g. axios keep-alive sockets after real API calls) that prevent
  // the worker from exiting naturally.
  forceExit: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        target: 'ES2020',
        module: 'ES2020'
      }
    }]
  }
};
