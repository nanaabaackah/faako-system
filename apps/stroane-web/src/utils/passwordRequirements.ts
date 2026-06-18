export const PASSWORD_MIN_LENGTH = 10;

export const PASSWORD_REQUIREMENTS = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: "number",
    label: "One number",
    test: (value: string) => /\d/.test(value),
  },
  {
    id: "symbol",
    label: "One symbol",
    test: (value: string) => /[^A-Za-z0-9\s]/.test(value),
  },
  {
    id: "spaces",
    label: "No spaces",
    test: (value: string) => value.length > 0 && !/\s/.test(value),
  },
] as const;

export const getPasswordRequirementStates = (password: string) =>
  PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }));

export const isStrongPassword = (password: string) =>
  getPasswordRequirementStates(password).every((requirement) => requirement.met);

export const getPasswordValidationMessage = (password: string) => {
  if (isStrongPassword(password)) return "";
  return "Password must meet every listed requirement.";
};
