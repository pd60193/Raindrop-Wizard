export const query = async <S>({
  message,
  model = 'o4-mini',
  region,
  schema,
  accessToken,
  projectId: _, // TODO: Use this to switch the wizard query endpoint over to the new LLM Gateway
}: QueryOptions<S>): Promise<S> => {
  const fullSchema = zodToJsonSchema(schema, 'schema');
  const jsonSchema = fullSchema.definitions;

  debug('Full schema:', JSON.stringify(fullSchema, null, 2));
  debug('Query request:', {
    url: `${getCloudUrlFromRegion(region)}/api/wizard/query`,
    accessToken,
    message: message.substring(0, 100) + '...',
    json_schema: { ...jsonSchema, name: 'schema', strict: true },
  });

  const response = await axios
    .post<{ data: unknown }>(
      `${getCloudUrlFromRegion(region)}/api/wizard/query`,
      {
        message,
        model,
        json_schema: { ...jsonSchema, name: 'schema', strict: true },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-PostHog-Trace-Id': TRACE_ID,
          ...(process.env.RECORD_FIXTURES === 'true'
            ? { 'X-PostHog-Wizard-Fixture-Generation': true }
            : {}),
        },
      },
    )
    .catch((error) => {
      debug('Query error:', error);

      if (error instanceof AxiosError) {
        analytics.captureException(error, {
          response_status_code: error.response?.status,
          message,
          model,
          json_schema: jsonSchema,
          type: 'wizard_query_error',
        });

        if (error.response?.status === 429) {
          throw new RateLimitError();
        }
      }

      throw error;
    });

  debug('Query response:', {
    status: response.status,
    data: response.data,
  });

  const validation = schema.safeParse(response.data.data);

  if (!validation.success) {
    debug('Validation error:', validation.error);
    throw new Error(
      `Invalid response from wizard: ${validation.error.message}`,
    );
  }

  return validation.data;
};