// src/utils/validationRules.ts

/**
 * Sanitizes a queue name.
 * - Replaces all spaces with underscores (_).
 * - Strips out all characters EXCEPT a-z, A-Z, 0-9, -, and _.
 * - Condenses multiple underscores into a single underscore.
 */
export function sanitizeQueueName(val: string): string {
  if (!val) return '';
  return val
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .replace(/_+/g, '_');
}

/**
 * Validates a queue name against strict rules and an existing fleet.
 */
export function validateQueueName(val: string, existingFleet: string[]): string | null {
  if (!val || val.length < 3) return "Queue name must be at least 3 characters.";
  if (val.length > 50) return "Queue name is too long.";
  if (existingFleet.includes(val)) return "This queue name is already in use.";
  return null;
}

/**
 * Standard email format validation.
 */
export function validateEmail(val: string): string | null {
  if (!val) return "Email is required.";
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(val)) return "Invalid email format.";
  return null;
}

/**
 * Generic check to ensure the field is not empty.
 */
export function validateRequired(val: string, fieldName: string = "Field"): string | null {
  if (!val || val.trim() === '') return `${fieldName} is required.`;
  return null;
}
