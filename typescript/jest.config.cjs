module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^matimo$': '<rootDir>/packages/core/src/index.ts',
    '^@matimo/core$': '<rootDir>/packages/core/src/index.ts',
    '^@matimo/core/runtime$': '<rootDir>/packages/core/src/runtime/index.ts',
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
      branches: 87,
      functions: 97,
      lines: 95,
      statements: 95
    }
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        target: 'ES2020',
        module: 'ES2020',
        baseUrl: '.',
        paths: {
          '@matimo/core': ['packages/core/src/index.ts'],
          '@matimo/core/runtime': ['packages/core/src/runtime/index.ts'],
          'matimo': ['packages/core/src/index.ts']
        }
      }
    }]
  }
};
