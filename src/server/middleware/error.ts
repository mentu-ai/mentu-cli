import type { Context, Next } from 'hono';
import { MentuError } from '../../types.js';

type StatusCode = 400 | 401 | 403 | 404 | 409 | 500;

/**
 * Map error codes to HTTP status codes.
 */
function getStatusCode(errorCode: string): StatusCode {
  switch (errorCode) {
    case 'E_UNAUTHORIZED':
      return 401;
    case 'E_PERMISSION_DENIED':
    case 'E_CONSTRAINT_VIOLATED':
    case 'E_FORBIDDEN':
      return 403;
    case 'E_REF_NOT_FOUND':
    case 'E_NOT_FOUND':
      return 404;
    case 'E_INVALID_STATE':
    case 'E_EXTERNAL_REF_EXISTS':
    case 'E_ALREADY_CLOSED':
    case 'E_ALREADY_CLAIMED':
    case 'E_DUPLICATE_ID':
    case 'E_DUPLICATE_SOURCE_KEY':
      return 409;
    case 'E_MISSING_FIELD':
    case 'E_EMPTY_BODY':
    case 'E_INVALID_OP':
      return 400;
    case 'E_INTERNAL':
      return 500;
    default:
      return 400;
  }
}

/**
 * Error handling middleware.
 * Catches MentuError and returns appropriate JSON response.
 */
export function errorMiddleware() {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (err) {
      // Check by name and code property to handle ES module instanceof issues
      if (err instanceof MentuError || (err instanceof Error && err.name === 'MentuError' && 'code' in err)) {
        const mentuErr = err as MentuError;
        const status = getStatusCode(mentuErr.code);
        return new Response(JSON.stringify(mentuErr.toJSON()), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle JSON parse errors
      if (err instanceof SyntaxError && 'body' in err) {
        return new Response(
          JSON.stringify({
            error: 'E_INVALID_OP',
            message: 'Invalid JSON in request body',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      console.error('Unexpected error:', err);
      return new Response(
        JSON.stringify({
          error: 'E_INTERNAL',
          message: 'Internal server error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}
