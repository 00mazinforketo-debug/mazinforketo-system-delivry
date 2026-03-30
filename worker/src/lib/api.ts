import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export const jsonSuccess = <T>(c: Context, data: T, status: ContentfulStatusCode = 200) =>
  c.json(
    {
      success: true as const,
      data,
    },
    { status },
  );

export const jsonError = (
  c: Context,
  message: string,
  status: ContentfulStatusCode = 400,
  details?: unknown,
) =>
  c.json(
    {
      success: false as const,
      error: {
        message,
        details,
      },
    },
    { status },
  );
