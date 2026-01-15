import { abortIfCancelled } from './utils/clack-utils';

import { runTypescriptWizardAgent } from './typescript/typescript-wizard';
import type { CloudRegion,  RaindropOptions} from './utils/types';

import {
  getIntegrationDescription,
  Integration,
} from './lib/constants';
import { readEnvironment } from './utils/environment';
import clack from './utils/clack';
import path from 'path';
import { INTEGRATION_CONFIG, INTEGRATION_ORDER } from './lib/config';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { RateLimitError } from './utils/errors';

EventEmitter.defaultMaxListeners = 50;

type Args = {
  integration?: Integration;
  debug?: boolean;
  forceInstall?: boolean;
  installDir?: string;
  region?: CloudRegion;
  default?: boolean;
  signup?: boolean;
  localMcp?: boolean;
  ci?: boolean;
  apiKey?: string;
};

export async function runWizard(argv: Args) {
  const finalArgs = {
    ...argv,
    ...readEnvironment(),
  };

  let resolvedInstallDir: string;
  if (finalArgs.installDir) {
    if (path.isAbsolute(finalArgs.installDir)) {
      resolvedInstallDir = finalArgs.installDir;
    } else {
      resolvedInstallDir = path.join(process.cwd(), finalArgs.installDir);
    }
  } else {
    resolvedInstallDir = process.cwd();
  }

  const wizardOptions: RaindropOptions = {
    debug: finalArgs.debug ?? false,
    forceInstall: finalArgs.forceInstall ?? false,
    installDir: resolvedInstallDir,
    default: finalArgs.default ?? false,
    signup: finalArgs.signup ?? false,
    apiKey: finalArgs.apiKey,
  };

  clack.intro(`Welcome to the Raindrop setup wizard ✨`);

  const integration =
    finalArgs.integration ?? (await getIntegrationForSetup(wizardOptions));


  try {
    switch (integration) {
      case Integration.typescript:
        await runTypescriptWizardAgent(wizardOptions);
        break;
      default:
        clack.log.error('No setup wizard selected!');
    }
  } catch (error) {

    if (error instanceof RateLimitError) {
      clack.log.error('Wizard usage limit reached. Please try again later.');
    } else {
      clack.log.error(
        `Something went wrong. You can read the documentation at ${chalk.cyan(
          `${INTEGRATION_CONFIG[integration].docsUrl}`,
        )} to set up PostHog manually.`,
      );
    }
    process.exit(1);
  }
}

async function detectIntegration(
  options: Pick<RaindropOptions, 'installDir'>,
): Promise<Integration | undefined> {
  const integrationConfigs = Object.entries(INTEGRATION_CONFIG).sort(
    ([a], [b]) =>
      INTEGRATION_ORDER.indexOf(a as Integration) -
      INTEGRATION_ORDER.indexOf(b as Integration),
  );

  for (const [integration, config] of integrationConfigs) {
    const detected = await config.detect(options);
    if (detected) {
      return integration as Integration;
    }
  }
}

async function getIntegrationForSetup(
  options: Pick<RaindropOptions, 'installDir'>,
) {
  const detectedIntegration = await detectIntegration(options);

  if (detectedIntegration) {
    clack.log.success(
      `Detected integration: ${getIntegrationDescription(detectedIntegration)}`,
    );
    return detectedIntegration;
  }

  const integration: Integration = await abortIfCancelled(
    clack.select({
      message: 'What do you want to set up?',
      options: [
        { value: Integration.typescript, label: 'Typescript' },
        { value: Integration.python, label: 'Python' },
        { value: Integration.http_api, label: 'HTTP API' },
        { value: Integration.vercel_ai_sdk, label: 'Vercel AI SDK' },
      ],
    }),
  );

  return integration;
}