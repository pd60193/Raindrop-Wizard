/* eslint-disable max-lines */

import type {RaindropOptions} from '../utils/types';
import {
  abort,
  askForAIConsent,
  installPackage,
  printWelcome,
  getPackageDotJson,
  ensurePackageIsInstalled,
  getOrAskForProjectData,
} from '../utils/clack-utils';
import { type PackageDotJson, hasPackageInstalled } from '../utils/package-json';
import { Integration } from '../lib/constants';
import { getRelevantFilesForIntegration, getFilesToChange} from '../utils/file-utils';


export async function runTypescriptWizardAgent(options: RaindropOptions): Promise<void> {
    printWelcome({
        wizardName: 'Raindrop Typescript wizard',
    });

    const aiConsent = await askForAIConsent(options);

    if (!aiConsent) {
        await abort(
            'The Typescript wizard requires AI to get setup right now. Please view the docs to setup Typescript manually instead: https://posthog.com/docs/libraries/react',
            0,
        );
    }

    const packageJson = await getPackageDotJson(options);
    await ensurePackageIsInstalled(packageJson, 'typescript', 'Typescript');

    const { projectApiKey} =
    await getOrAskForProjectData({
      ...options,
    });

    const sdkAlreadyInstalled = hasPackageInstalled('raindrop-ai', packageJson);
     const { packageManager: packageManagerFromInstallStep } =
    await installPackage({
      packageName: 'raindrop-ai',
      packageNameDisplayLabel: 'raindrop-ai',
      alreadyInstalled: !!packageJson?.dependencies?.['raindrop-ai'],
      forceInstall: options.forceInstall,
      askBeforeUpdating: false,
      installDir: options.installDir,
      integration: Integration.typescript,
    });

    const relevantFiles = await getRelevantFilesForIntegration({
        installDir: options.installDir,
        integration: Integration.typescript,
    });

    const envVarPrefix = await detectEnvVarPrefix(options);

    const installationDocumentation = getReactDocumentation({
        language: typeScriptDetected ? 'typescript' : 'javascript',
        envVarPrefix,
    });

    clack.log.info(`Reviewing PostHog documentation for React`);

    const filesToChange = await getFilesToChange({
        integration: Integration.react,
        relevantFiles,
        documentation: installationDocumentation,
        accessToken,
        cloudRegion,
        projectId,
    });


}