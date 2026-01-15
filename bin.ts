#!/usr/bin/env node
import { satisfies } from 'semver';
import { red } from './src/utils/logging';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';

const NODE_VERSION_RANGE = '>=18.17.0';

// Have to run this above the other imports because they are importing clack that
// has the problematic imports.
if (!satisfies(process.version, NODE_VERSION_RANGE)) {
  red(
    `PostHog wizard requires Node.js ${NODE_VERSION_RANGE}. You are using Node.js ${process.version}. Please upgrade your Node.js version.`,
  );
  process.exit(1);
}

import type { RaindropOptions } from './src/utils/types';
import { runWizard } from './src/run';
import { isNonInteractiveEnvironment } from './src/utils/environment';
import clack from './src/utils/clack';

const yargInstance = yargs(hideBin(process.argv))
  .env('RAINDROP_WIZARD')
  // global options
  .options({
    debug: {
      default: false,
      describe: 'Enable verbose logging\nenv: RAINDROP_WIZARD_DEBUG',
      type: 'boolean',
    },
    default: {
      default: true,
      describe:
        'Use default options for all prompts\nenv: RAINDROP_WIZARD_DEFAULT',
      type: 'boolean',
    },
    signup: {
      default: false,
      describe:
        'Create a new Raindrop account during setup\nenv: RAINDROP_WIZARD_SIGNUP',
      type: 'boolean',
    },

    'api-key': {
      describe:
        'Raindrop personal API key (phx_xxx) for authentication\nenv: RAINDROP_WIZARD_API_KEY',
      type: 'string',
    },
  })
  .command(
    ['$0'],
    'Run the Raindrop setup wizard',
    (yargs) => {
      return yargs.options({
        'force-install': {
          default: false,
          describe:
            'Force install packages even if peer dependency checks fail\nenv: RAINDROP_WIZARD_FORCE_INSTALL',
          type: 'boolean',
        },
        'install-dir': {
          describe:
            'Directory to install Raindrop in\nenv: RAINDROP_WIZARD_INSTALL_DIR',
          type: 'string',
        },
        integration: {
          describe: 'Integration to set up',
          choices: ['nextjs', 'astro', 'react', 'svelte', 'react-native'],
          type: 'string',
        },
      });
    },
    (argv) => {
      const options = { ...argv };

      // CI mode validation and TTY check
      if (options.ci) {
        // Validate required CI flags
        if (!options.region) {
          clack.intro(chalk.inverse(`Raindrop Wizard`));
          clack.log.error('CI mode requires --region (us or eu)');
          process.exit(1);
        }
        if (!options.apiKey) {
          clack.intro(chalk.inverse(`Raindrop Wizard`));
          clack.log.error(
            'CI mode requires --api-key (personal API key phx_xxx)',
          );
          process.exit(1);
        }
        if (!options.installDir) {
          clack.intro(chalk.inverse(`Raindrop Wizard`));
          clack.log.error(
            'CI mode requires --install-dir (directory to install Raindrop in)',
          );
          process.exit(1);
        }
      } else if (isNonInteractiveEnvironment()) {
        // Original TTY error for non-CI mode
        clack.intro(chalk.inverse(`Raindrop Wizard`));
        clack.log.error(
          'This installer requires an interactive terminal (TTY) to run.\n' +
          'It appears you are running in a non-interactive environment.\n' +
          'Please run the wizard in an interactive terminal.\n\n' +
          'For CI/CD environments, use --ci mode:\n' +
          '  npx @posthog/wizard --ci --region us --api-key phx_xxx',
        );
        process.exit(1);
      }

      void runWizard(options as unknown as RaindropOptions);
    },
  ).help()
  .alias('help', 'h')
  .version()
  .alias('version', 'v');

  yargInstance.wrap(process.stdout.isTTY ? yargInstance.terminalWidth() : 80).argv;