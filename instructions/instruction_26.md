# System Role & Task
You are an Expert Frontend Engineer and UI/UX Architect. Your objective is to design and implement a dedicated, highly secure, theme-compliant **Onboarding & Network Recovery Layout** for our Print Kiosk platform. 

Currently, the Wi-Fi setup interface (Screen 3) is loosely coupled with the `HomeLayout` as a proxy. You will extract it, place it into a structural multi-step state machine, and conditionally render the UI based on the backend appliance's operational state.

---

# Phase 1: Architectural Discovery & Theme Sync

Before writing any new UI layout, you must conduct a thorough discovery sweep:
1. **Analyze Existing Wi-Fi Setup Code:** Locate where the current Screen 3 (Wi-Fi network selection and submission) is defined in the frontend. Analyze its exact state, form values, and hook mechanisms.
2. **Study the Platform Theme:** Open and analyze the global CSS configuration files, Tailwind configurations, or theme files (e.g., `theme.ts`, `tailwind.config.js`). You must strictly inherit the platform's exact color tokens, typography scales, card shadows, button states, and layout paddings. Do not introduce stray colors or arbitrary styles.
3. **Verify API Integrity:** Review the backend interaction model. The layout will fetch system status flags (`setup_mode: boolean`, `is_onboarded: boolean`) to evaluate its rendering context.

---

# Phase 2: Core State Engine & Conditional Flow

Implement a dedicated `OnboardingLayout` that functions as a stateful client-side router/stepper based on the backend configuration matrix. It must gracefully handle these three scenarios:

### 🚨 Scenario 1: Initial Onboarding (`setup_mode === true` && `is_onboarded === false`)
- **UI Footprint:** Full multi-step onboarding wizard.
- **Step 1 (Security):** Create 4-digit Admin PIN + PIN Confirmation fields.
- **Step 2 (Branding):** Input field for 'Shop Name'.
- **Step 3 (Network):** Seamlessly integrate the **pre-existing Screen 3** Wi-Fi selection widget here.
- **Step 4 (Provisioning/Success):** Full-screen loading states transitioning to a success checkmark displaying the persistent Cloudflare Dashboard URL.

### 🔒 Scenario 2: Network Recovery Mode (`setup_mode === true` && `is_onboarded === true`)
- **UI Footprint:** Security Lockdown Layout.
- **Step 1 (Authentication):** Renders a strict, focused Pin Pad Lock Screen asking for the existing Admin PIN. 
- **Step 2 (Network Reconfiguration):** Upon successful backend validation of the PIN, remove the lock screen and render **ONLY the pre-existing Screen 3** Wi-Fi component. Do not show branding or PIN creation screens.

### 🛠️ Scenario 3: Admin Panel Context (`setup_mode === false` && `is_onboarded === true`)
- Ensure the pre-existing Screen 3 Wi-Fi component is fully exportable so it can continue to render cleanly as an isolated widget inside the fully authenticated standard Admin Settings Dashboard.

---

# Phase 3: Phase-by-Phase Implementation Plan

Execute the integration cleanly following this sequence. Provide code files for each phase:

### 🏗️ Step 1: Layout Extraction & Responsive Theme Foundation
- Create `layouts/OnboardingLayout.tsx`.
- Implement an **Adaptive Mobile-Centric Blueprint**:
  - The core UI components must be optimized explicitly for a vertical touch target smartphone interface (since 90% of shop owners will use their mobile phones via Captive Portal).
  - **Desktop Adaptation:** Wrap the mobile interface inside a responsive wrapper. On large viewports (`md:` and up), do NOT stretch the form fields to full-screen width. Instead, restrict the content area using a fixed-width container maxing out around `max-w-md` or `max-w-lg` (e.g., standard smartphone dimensions).
  - Center this container perfectly on both axes (`min-h-screen flex items-center justify-center`) against a muted, theme-compliant background. Frame it inside a beautifully padded card with soft shadows, making it feel like a localized desktop app setup experience on big screens while native on mobile.
- Bind the design tightly to the platform's CSS theme tokens.

### ⚙️ Step 2: Form & Stepper Management
- Set up a consolidated form-state manager (e.g., React Context, `useState`, or Formik/React Hook Form matching the project standard) to gather `adminPin`, `shopName`, `wifiSsid`, and `wifiPassword`.
- Build smooth state transitions for the wizard steps.

### 🔌 Step 3: Screen 3 Injection & API Connection
- Migrate the pre-existing Screen 3 Wi-Fi component into the layout. Fix its relative state bindings to pipe its chosen SSID and Password into the unified setup submission payload.
- Connect form submissions to the orchestrating endpoint: `POST /api/setup/provision`.

### 🧪 Step 4: Edge-Case & Loading States
- Design explicit loading view overlays for the network transition process ("Swapping networks... Securing kiosk...").
- Implement inline error-handling blocks in case the backend returns a network connection failure (e.g., incorrect router password), allowing the user to return to the Wi-Fi step without dropping the portal session.

Please initiate Phase 1 by surfacing your analysis of the existing layout/theme design files, and provide the updated file structure for the new layout.