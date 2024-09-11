export function validateHomeKitName(name: string) {
  // Remove leading and trailing whitespace
  name = name.trim();
  // Remove any characters that are not alphanumeric, whitespace, period, single quote, or hyphen
  name = name.replace(/[^A-Za-z0-9\s'.-]/g, '');
  // Remove leading non-alphanumeric characters
  name = name.replace(/^[^a-zA-Z0-9]*/g, '');
  // Remove trailing non-alphanumeric characters
  return name.replace(/[^a-zA-Z0-9]+$/g, '');
}