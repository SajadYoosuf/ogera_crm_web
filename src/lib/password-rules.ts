// Mirrors the server rules in routes/password_reset.py. The server checks again, including
// that the new password differs from the current one, which only it can know.
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 15;

export type PasswordErrors = { password?: string; confirm?: string };

/** Returns the message for each field that is wrong. An empty object means the form can be sent. */
export function validateNewPassword(password: string, confirm: string): PasswordErrors {
  const errors: PasswordErrors = {};
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (confirm.length > 0 && confirm !== password) {
    errors.confirm = "Passwords don't match.";
  }
  return errors;
}
