import path from 'path';
import fs from 'fs';
import type { CloudRegion, FileChange, RaindropOptions } from './types';
import clack from './clack';
import z from 'zod';
import { query } from './query';
import fg from 'fast-glob';
import { Integration } from '../lib/constants';
import { abort } from './clack-utils';
import { INTEGRATION_CONFIG } from '../lib/config';
import {
  baseFilterFilesPromptTemplate,
} from '../lib/prompts';

export async function getRelevantFilesForIntegration({
  installDir,
  integration,
}: Pick<RaindropOptions, 'installDir'> & {
  integration: Integration;
}) {
  const filterPatterns = INTEGRATION_CONFIG[integration].filterPatterns;
  const ignorePatterns = INTEGRATION_CONFIG[integration].ignorePatterns;

  const filteredFiles = await fg(filterPatterns, {
    cwd: installDir,
    ignore: ignorePatterns,
  });

  return filteredFiles;
}

export async function getFilesToChange({
  integration,
  relevantFiles,
  documentation,
  accessToken,
  cloudRegion,
  projectId,
}: {
  integration: Integration;
  relevantFiles: string[];
  documentation: string;
  accessToken: string;
  cloudRegion: CloudRegion;
  projectId: number;
}) {
  const filterFilesSpinner = clack.spinner();

  filterFilesSpinner.start('Selecting files to change...');

  const filterFilesResponseSchmea = z.object({
    files: z.array(z.string()),
  });

  const prompt = await baseFilterFilesPromptTemplate.format({
    documentation,
    file_list: relevantFiles.join('\n'),
    integration_name: integration,
    integration_rules: INTEGRATION_CONFIG[integration].filterFilesRules,
  });

  const filterFilesResponse = await query({
    message: prompt,
    schema: filterFilesResponseSchmea,
    accessToken,
    region: cloudRegion,
    projectId,
  });

  const filesToChange = filterFilesResponse.files;

  filterFilesSpinner.stop(`Found ${filesToChange.length} files to change`);

  return filesToChange;
}
