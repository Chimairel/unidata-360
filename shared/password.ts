export interface PasswordCheckResult {
  valid: boolean;
  lengthOk: boolean;
  classesCount: number;
  complexityOk: boolean;
  noRepeatOk: boolean;
  noIdentityOk: boolean;
  message?: string;
}

export function evaluatePassword(
  password: string,
  forbiddenTokens: string[] = [],
): PasswordCheckResult {
  const lengthOk = password.length >= 12 && password.length <= 128;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const classesCount =
    Number(hasLower) + Number(hasUpper) + Number(hasDigit) + Number(hasSymbol);
  // Require at least 3 character classes, or a 16+ char passphrase with at least 2 classes.
  const complexityOk =
    classesCount >= 3 || (password.length >= 16 && classesCount >= 2);
  const noRepeatOk = password.length === 0 || !/^(.)\1+$/.test(password);

  const lower = password.toLowerCase();
  const noIdentityOk = forbiddenTokens
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 4)
    .every((token) => !lower.includes(token));

  let message: string | undefined;
  if (!lengthOk) {
    message = "Password must be 12–128 characters.";
  } else if (!noRepeatOk) {
    message = "Password cannot repeat a single character.";
  } else if (!complexityOk) {
    message =
      "Use at least 3 of: uppercase, lowercase, numbers, symbols (or a 16+ character passphrase with 2 types).";
  } else if (!noIdentityOk) {
    message = "Password cannot include your school ID or email name.";
  }

  return {
    valid: lengthOk && complexityOk && noRepeatOk && noIdentityOk,
    lengthOk,
    classesCount,
    complexityOk,
    noRepeatOk,
    noIdentityOk,
    message,
  };
}
