import * as childProcess from 'node:child_process';
import clack from './clack';
import {
  type PackageManager,
  detectAllPackageManagers,
  packageManagers,
  NPM as npm,
} from './package-manager';
import type { RaindropOptions } from '../utils/types';
import { fulfillsVersionRange } from './semver';
import { type PackageDotJson, hasPackageInstalled } from './package-json';
import { getPackageVersion } from './package-json';
import { basename, isAbsolute, join, relative } from 'node:path';
import chalk from 'chalk';
import {
  DEFAULT_HOST_URL,
  DUMMY_PROJECT_API_KEY,
  ISSUES_URL,
  type Integration,
} from '../lib/constants';
import * as fs from 'node:fs';
import { INTEGRATION_CONFIG } from '../lib/config';


export async function abort(message?: string, status?: number): Promise<never> {
  clack.outro(message ?? 'Wizard setup cancelled.');
  return process.exit(status ?? 1);
}

export async function abortIfCancelled<T>(
  input: T | Promise<T>,
  integration?: Integration,
): Promise<Exclude<T, symbol>> {
  const resolvedInput = await input;

  if (
    clack.isCancel(resolvedInput) ||
    (typeof resolvedInput === 'symbol' &&
      resolvedInput.description === 'clack:cancel')
  ) {
    const docsUrl = integration
      ? INTEGRATION_CONFIG[integration].docsUrl
      : 'https://raindrop.ai/docs';

    clack.cancel(
      `Wizard setup cancelled. You can read the documentation for ${
        integration ?? 'Raindrop'
      } at ${chalk.cyan(docsUrl)} to continue with the setup manually.`,
    );
    process.exit(0);
  } else {
    return input as Exclude<T, symbol>;
  }
}

export async function getPackageDotJson({
  installDir,
}: Pick<RaindropOptions, 'installDir'>): Promise<PackageDotJson> {
  const packageJsonFileContents = await fs.promises
    .readFile(join(installDir, 'package.json'), 'utf8')
    .catch(() => {
      clack.log.error(
        'Could not find package.json. Make sure to run the wizard in the root of your app!',
      );
      return abort();
    });

  let packageJson: PackageDotJson | undefined = undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    packageJson = JSON.parse(packageJsonFileContents);
  } catch {
    clack.log.error(
      `Unable to parse your ${chalk.cyan(
        'package.json',
      )}. Make sure it has a valid format!`,
    );

    await abort();
  }

  return packageJson || {};
}

export function printWelcome(options: {
  wizardName: string;
  message?: string;
}): void {
  // eslint-disable-next-line no-console
  console.log('');
  clack.intro(chalk.inverse(` ${options.wizardName} `));

  const welcomeText =
    options.message ||
    `The ${options.wizardName} will help you set up Raindrop for your application.\nThank you for using Raindrop :)`;

  clack.note(welcomeText);
}

export async function askForAIConsent(
  options: RaindropOptions,
) {
  const aiConsent =
      options.default
        ? true
        : await abortIfCancelled(
            clack.select({
              message:
                'This setup wizard uses AI, are you happy to continue? ✨',
              options: [
                {
                  label: 'Yes',
                  value: true,
                  hint: 'We will use AI to help you setup PostHog quickly',
                },
                {
                  label: 'No',
                  value: false,
                  hint: "I don't like AI",
                },
              ],
              initialValue: true,
            }),
          );

    return aiConsent;
}

/**
 * Checks if @param packageId is listed as a dependency in @param packageJson.
 * If not, it will ask users if they want to continue without the package.
 *
 * Use this function to check if e.g. a the framework of the SDK is installed
 *
 * @param packageJson the package.json object
 * @param packageId the npm name of the package
 * @param packageName a human readable name of the package
 */
export async function ensurePackageIsInstalled(
  packageJson: PackageDotJson,
  packageId: string,
  packageName: string,
): Promise<void> {
    if (!hasPackageInstalled(packageId, packageJson)) {
        const continueWithoutPackage = await abortIfCancelled(
        clack.confirm({
            message: `${packageName} does not seem to be installed. Do you still want to continue?`,
            initialValue: false,
        }),
        );

        if (!continueWithoutPackage) {
        await abort(undefined, 0);
        }
    }
}

/**
 *
 * Use this function to get project data for the wizard.
 *
 * @param options wizard options
 * @returns project data (token, url)
 */
export async function getOrAskForProjectData(
  _options: Pick<RaindropOptions, 'signup' | 'apiKey'> 
): Promise<{
  projectApiKey: string;
}> {

  // CI mode: bypass OAuth, use personal API key for LLM gateway
  if (_options.apiKey) {
    clack.log.info('Using provided API key (OAuth bypassed)');
    return {
      projectApiKey: _options.apiKey, // Project API key for SDK config
    };
  }
  const projectApiKey = await abortIfCancelled(
    clack.text({
      message:
        'Enter your project API key: ',
      placeholder: 'xxxx', 
    }),
  );

  if (!projectApiKey) {
    clack.log.error(`Didn't receive a project API key. This shouldn't happen :(

Please let us know if you think this is a bug in the wizard:
${chalk.cyan(ISSUES_URL)}`);

    clack.log
      .info(`In the meantime, we'll add a dummy project API key (${chalk.cyan(
      `"${DUMMY_PROJECT_API_KEY}"`,
    )}) for you to replace later.
You can find your Project API key here:
${chalk.cyan(`/settings/project#variables`)}`);
  }

  return {
    projectApiKey: projectApiKey || DUMMY_PROJECT_API_KEY,
  };
}

export async function getPackageManager(
  options: Pick<RaindropOptions, 'installDir'> & { ci?: boolean },
): Promise<PackageManager> {
  const detectedPackageManagers = detectAllPackageManagers({
    installDir: options.installDir,
  });

  // If exactly one package manager detected, use it automatically
  if (detectedPackageManagers.length === 1) {
    const detectedPackageManager = detectedPackageManagers[0]!;
    return detectedPackageManager;
  }

  // CI mode: auto-select first detected or npm
  if (options.ci) {
    const selectedPackageManager =
      detectedPackageManagers.length > 0 ? detectedPackageManagers[0]! : npm;
    clack.log.info(
      `CI mode: auto-selected package manager: ${selectedPackageManager.label}`,
    );
    return selectedPackageManager;
  }

  // If multiple or no package managers detected, prompt user to select
  const pkgOptions =
    detectedPackageManagers.length > 0
      ? detectedPackageManagers
      : packageManagers;

  const message =
    detectedPackageManagers.length > 1
      ? 'Multiple package managers detected. Please select one:'
      : 'Please select your package manager.';

  const selectedPackageManager: PackageManager | symbol =
    await abortIfCancelled(
      clack.select({
        message,
        options: pkgOptions.map((packageManager) => ({
          value: packageManager,
          label: packageManager.label,
        })),
      }),
    );
  return selectedPackageManager;
}

export async function isTypescriptInstalled({
  installDir,
}: Pick<RaindropOptions, 'installDir'>): Promise<boolean> {
  try {
    const packageJson = await getPackageDotJson({ installDir });
    const typescriptVersion = getPackageVersion('typescript', packageJson);

    if (!typescriptVersion) {
      return false;
    }

    return fulfillsVersionRange({
      version: typescriptVersion,
      acceptableVersions: '>=19.0.0',
      canBeLatest: true,
    });
  } catch (error) {
    return false;
  }
}

/**
 * Installs or updates a package with the user's package manager.
 *
 * IMPORTANT: This function modifies the `package.json`! Be sure to re-read
 * it if you make additional modifications to it after calling this function!
 */
export async function installPackage({
  packageName,
  alreadyInstalled,
  askBeforeUpdating = true,
  packageNameDisplayLabel,
  packageManager,
  forceInstall = false,
  integration,
  installDir,
}: {
  /** The string that is passed to the package manager CLI as identifier to install (e.g. `posthog-js`, or `posthog-js@^1.100.0`) */
  packageName: string;
  alreadyInstalled: boolean;
  askBeforeUpdating?: boolean;
  /** Overrides what is shown in the installation logs in place of the `packageName` option. Useful if the `packageName` is ugly */
  packageNameDisplayLabel?: string;
  packageManager?: PackageManager;
  /** Add force install flag to command to skip install precondition fails */
  forceInstall?: boolean;
  /** The integration that is being used */
  integration?: string;
  /** The directory to install the package in */
  installDir: string;
}): Promise<{ packageManager?: PackageManager }> {
    if (alreadyInstalled && askBeforeUpdating) {
    const shouldUpdatePackage = await abortIfCancelled(
      clack.confirm({
        message: `The ${chalk.bold.cyan(
          packageNameDisplayLabel ?? packageName,
        )} package is already installed. Do you want to update it to the latest version?`,
      }),
    );

    if (!shouldUpdatePackage) {
      return {};
    }
  }

  const sdkInstallSpinner = clack.spinner();

  const pkgManager =
    packageManager || (await getPackageManager({ installDir }));

  // Most packages aren't compatible with React 19 yet, skip strict peer dependency checks if needed.
  const isInstalled = await isTypescriptInstalled({ installDir });
  const legacyPeerDepsFlag =
    isInstalled && pkgManager.name === 'npm' ? '--legacy-peer-deps' : '';

  sdkInstallSpinner.start(
    `${alreadyInstalled ? 'Updating' : 'Installing'} ${chalk.bold.cyan(
      packageNameDisplayLabel ?? packageName,
    )} with ${chalk.bold(pkgManager.label)}.`,
  );

  try {
    await new Promise<void>((resolve, reject) => {
      childProcess.exec(
        `${pkgManager.installCommand} ${packageName} ${pkgManager.flags} ${
          forceInstall ? pkgManager.forceInstallFlag : ''
        } ${legacyPeerDepsFlag}`.trim(),
        { cwd: installDir },
        (err, stdout, stderr) => {
          if (err) {
            // Write a log file so we can better troubleshoot issues
            fs.writeFileSync(
              join(
                process.cwd(),
                `raindrop-wizard-installation-error-${Date.now()}.log`,
              ),
              JSON.stringify({
                stdout,
                stderr,
              }),
              { encoding: 'utf8' },
            );

            reject(err);
          } else {
            resolve();
          }
        },
      );
    });
  } catch (e) {
    sdkInstallSpinner.stop('Installation failed.');
    clack.log.error(
      `${chalk.red(
        'Encountered the following error during installation:',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      )}\n\n${e}\n\n${chalk.dim(
        `The wizard has created a \`raindrop-wizard-installation-error-*.log\` file. If you think this issue is caused by the Raindrop wizard, create an issue on GitHub and include the log file's content:\n${ISSUES_URL}`,
      )}`,
    );
    await abort();
  }

  sdkInstallSpinner.stop(
    `${alreadyInstalled ? 'Updated' : 'Installed'} ${chalk.bold.cyan(
      packageNameDisplayLabel ?? packageName,
    )} with ${chalk.bold(pkgManager.label)}.`,
  );

  return { packageManager: pkgManager };
}

export async function updatePackageDotJson(
  packageDotJson: PackageDotJson,
  { installDir }: Pick<RaindropOptions, 'installDir'>,
): Promise<void> {
  try {
    await fs.promises.writeFile(
      join(installDir, 'package.json'),
      // TODO: maybe figure out the original indentation
      JSON.stringify(packageDotJson, null, 2),
      {
        encoding: 'utf8',
        flag: 'w',
      },
    );
  } catch {
    clack.log.error(`Unable to update your ${chalk.cyan('package.json')}.`);

    await abort();
  }
}
