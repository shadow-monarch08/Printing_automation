# TASK: ENTERPRISE UI ARCHITECTURE REFACTOR — GLOBAL VALIDATED INPUT COMPONENT

## Context & Objective
You are an expert React, TypeScript, and UI/UX Architect. We are standardizing the data-entry architecture across the Print Spooler Admin Dashboard and Kiosk. 
Your objective is to replace all native `<input>` elements with a centralized, defensive, and accessible `ValidatedInput` component. This component must utilize strict dependency injection for sanitization and validation, decoupling the business logic from the UI.

---

## 🚫 STRICT ENGINEERING CONSTRAINTS (CRITICAL)

1. **NO UI/Component Libraries:** Do not import Material-UI, Chakra, Ant Design, or any external component libraries. You must build this using standard React and the project's existing styling system (e.g., Tailwind classes or native CSS).
2. **NO Hardcoded Styling Paradigms:** Do not invent new colors or spacing systems. You must inspect the surrounding forms and dynamically inherit the platform's current design system (focus rings, border radiuses, text colors, and error state transitions).
3. **NO Local `isValid` State in Forms:** You are strictly forbidden from using `const [isValid, setIsValid] = useState()` inside parent forms. Form validity MUST be calculated via **Derived State** on every render.
4. **NO `any` Types:** Strict TypeScript must be enforced. Use proper interfaces for all props and function signatures.
5. **NO Side Effects in Validation:** The `sanitizeFn` and `validateFn` must be pure functions. They take a string and return a string (or null). They must never trigger API calls or mutate external state.

---

## Phase 1: Build the Core Component (`components/ValidatedInput.tsx`)

Create a flexible, decoupled input component. It must strictly adhere to this logical blueprint:

### 1. TypeScript Interface
```typescript
export interface ValidatedInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password' | 'email' | 'number';
  placeholder?: string;
  disabled?: boolean;
  name?: string; // For accessibility and testing
  sanitizeFn?: (val: string) => string;
  validateFn?: (val: string) => string | null;
}

```

### 2. Internal Component Lifecycle

* **State:** Maintain `error` (string | null) and `touched` (boolean).
* **Active Interception (`onChange`):**
* Grab `e.target.value`.
* If `sanitizeFn` exists, pass the value through it to physically block/replace illegal characters BEFORE firing the parent's `onChange`.
* *UX Recovery:* If the field is `touched` and currently has an `error`, instantly evaluate the sanitized value against `validateFn`. If it passes, clear the `error` state so the user sees immediate success.


* **Passive Validation (`onBlur`):**
* Set `touched` to `true`.
* Execute `validateFn`. If an error string is returned, set it to the `error` state.



### 3. Accessibility (a11y) & Rendering

* The component must bind the `label` to the `input` using `htmlFor` and `id`.
* If an error is present, the input must have `aria-invalid="true"` and `aria-errormessage="error-id"`.
* The error message container must use a smooth CSS transition (e.g., `max-height` and `opacity`) so it slides in gracefully rather than jumping the layout.

---

## Phase 2: Centralize Validation Rules (`utils/validationRules.ts`)

Create a single utility file to house all platform validation and sanitization functions. These must be pure, exported functions.

### Hardware Naming Rules (Strict)

1. `sanitizeQueueName(val: string): string`
* Must actively replace all spaces with underscores (`_`).
* Must aggressively strip out all characters EXCEPT `a-z`, `A-Z`, `0-9`, `-`, and `_`.
* Must condense multiple underscores into a single underscore.


2. `validateQueueName(val: string, existingFleet: string[]): string | null`
* Fails if `val.length < 3` (Returns: "Queue name must be at least 3 characters.")
* Fails if `val.length > 50` (Returns: "Queue name is too long.")
* Fails if `existingFleet.includes(val)` (Returns: "This queue name is already in use.")



### Standard Form Rules

1. `validateEmail(val: string): string | null`
* Standard regex check. Returns error if invalid format.


2. `validateRequired(val: string, fieldName: string): string | null`
* Generic check to ensure the field is not empty.

---

## Phase 3: Global UI Refactor & Derived State Implementation

Sweep the codebase, targeting the **Printer Setup Form** and **Shop Owner Profile** components. Replace all native `<input>` tags with `<ValidatedInput>`.

### The Derived State Mandate

When refactoring the parent forms, you MUST protect the submit button using this exact architectural pattern:

1. **Calculate Validity:** Evaluate all fields on every render.
```typescript
// Example inside parent component
const isFormValid = 
  validateQueueName(queueName, fleet) === null && 
  validateEmail(email) === null;

```


2. **Protect the UI:** Bind the `disabled` prop of the Submit `<button>` directly to `!isFormValid`. Alter the button's opacity/cursor styling to visually indicate it is locked.
3. **Protect the Logic:** Inside your `handleSubmit(e)` function, the very first line after `e.preventDefault()` MUST be:
```typescript
if (!isFormValid) return; 

```

---

## Deliverables

1. The fully typed `ValidatedInput.tsx` component.
2. The `validationRules.ts` utility file.
3. The refactored `PrinterSetupForm` (or equivalent parent component) demonstrating the injected rules and the strict Derived State form submission pattern.