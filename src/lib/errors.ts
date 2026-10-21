/**
 * Error sanitization.
 *
 * Errors raised by the database or the auth provider carry internal detail:
 * table and column names, constraint names, and policy structure. None of that
 * belongs on screen. Every user-facing failure message goes through here: the
 * raw error is logged for debugging and a fixed, safe sentence is returned.
 */

export function logError(context: string, err: unknown) {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, err);
  }
}

/**
 * Returns the caller's safe fallback message, never the backend's own text.
 */
export function toUserMessage(context: string, err: unknown, fallback: string): string {
  logError(context, err);
  return fallback;
}

/**
 * A single message for every authentication failure, so the response cannot be
 * used to tell whether an email address already has an account.
 */
export const GENERIC_SIGNUP_ERROR =
  "We couldn't complete your sign up. Please check your email and password and try again. If you already have an account, sign in instead.";

export const GENERIC_SIGNIN_ERROR =
  "We couldn't sign you in. Please check your email and password and try again.";
