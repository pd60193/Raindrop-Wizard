import { getPackageDotJson } from '../utils/clack-utils';
import { hasPackageInstalled } from '../utils/package-json';
import type { RaindropOptions } from '../utils/types';
import { Integration } from './constants';

type IntegrationConfig = {
  name: string;
  filterPatterns: string[];
  ignorePatterns: string[];
  detect: (options: Pick<RaindropOptions, 'installDir'>) => Promise<boolean>;
  generateFilesRules: string;
  filterFilesRules: string;
  docsUrl: string;
};

export const INTEGRATION_CONFIG = {
  [Integration.typescript]: {
    name: 'Typescript',
    filterPatterns: ['**/*.{ts,tsx}'],
    ignorePatterns: [
      'node_modules',
      'dist',
      'build',
      'public',
      'static',
    ],
    detect: async (options) => {
      const packageJson = await getPackageDotJson(options);
      return hasPackageInstalled('next', packageJson);
    },
    generateFilesRules: '',
    filterFilesRules: '',
    docsUrl: 'https://www.raindrop.ai/docs/sdk/typescript',
  },
  [Integration.python]: {
    name: 'Python',
    filterPatterns: ['**/*.{py}'],
    ignorePatterns: [
      'node_modules',
      'dist',
      'build',
      'public',
      'static',
      'assets',
    ],
    detect: async (options) => {
      const packageJson = await getPackageDotJson(options);
      return hasPackageInstalled('react', packageJson);
    },
    generateFilesRules: '',
    filterFilesRules: '',
    docsUrl: 'https://www.raindrop.ai/docs/sdk/python',
  },
  [Integration.http_api]: {
    name: 'Svelte',
    filterPatterns: ['**/*.{svelte,ts,js,jsx,tsx}'],
    ignorePatterns: ['node_modules', 'dist', 'build', 'public', 'static'],
    detect: async (options) => {
      const packageJson = await getPackageDotJson(options);
      return hasPackageInstalled('@sveltejs/kit', packageJson);
    },
    generateFilesRules: '',
    filterFilesRules: '',
    docsUrl: 'https://www.raindrop.ai/docs/sdk/http-api',
  },
  [Integration.vercel_ai_sdk]: {
    name: 'Vercel AI SDK',
    filterPatterns: ['**/*.{ts,js,jsx,tsx}'],
    ignorePatterns: ['node_modules', 'dist', 'build', 'public', 'static'],
    detect: async (options) => {
      const packageJson = await getPackageDotJson(options);
      return hasPackageInstalled('react-native', packageJson);
    },
    generateFilesRules: '',
    filterFilesRules: '',
    docsUrl: 'https://www.raindrop.ai/docs/sdk/auto-vercel-ai',
  },
} as const satisfies Record<Integration, IntegrationConfig>;

export const INTEGRATION_ORDER = [
  Integration.typescript,
  Integration.python,
  Integration.http_api,
  Integration.vercel_ai_sdk,
] as const;