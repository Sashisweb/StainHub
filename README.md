# Virtual Stain Hub Automation Framework

## Overview

This project automates the **Virtual Stain Hub** web application using **Playwright + TypeScript**. It covers UI, functional, and end-to-end scenarios across modules like **Login, Models, Uploads, Activity, and Reports**.

The framework is designed with modularity, scalability, and CI/CD compatibility in mind. It follows the **Page Object Model (POM)** pattern and supports both live and mocked API testing using Playwright’s **Network Interception**.

---

## 🧱 Project Structure

```
project-root/
├── pages/                     # Page Object Model (POM) classes
│   ├── login.page.ts
│   ├── models.page.ts
│   ├── uploads.page.ts
│   ├── activity.page.ts
│   └── reports.page.ts
│
├── tests/                     # Playwright test suites
│   ├──e2e.spec.ts   # End-to-end test covering full user flow
│   ├── model_spec.ts           # Model module-specific tests
│   ├── uploads_spec.ts         # Uploads module tests
│   ├── reports_spec.ts         # Reports module tests
│   └── activity_spec.ts        # Organization Activity tests
│
├── fixtures/                  # Reusable test setup and page fixtures
│   ├── base.fixture.ts
│   ├── uploads.fixture.ts
│   └── reports.fixture.ts
│
├── data/                      # Test data files
│   ├── e2eData.json
│   ├── uploadData.json
│   ├── activityData.json
│   └── reportsData.json
│
├── utils/                     # Shared utilities and helpers
│   ├── networkLogger.ts        # Captures and saves API traffic
│   ├── apiInterceptor.ts       # Optional API mocking and interception
│          # Generic toast/snackbar detection utility
│
├── playwright.config.ts        # Global configuration for Playwright
└── README.md                   # Project overview (this file)
```

---

## ⚙️ Setup Instructions

### Prerequisites

Ensure the following tools are installed:

* Node.js (>=18)
* npm or yarn
* Git
* Playwright (auto-installed via dependencies)

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
npx playwright test
```

### Run Tests in UI Mode

```bash
npx playwright test --ui
```

### Generate HTML Report

```bash
npx playwright show-report
```

---

## 🧠 Key Features

| Feature                  | Description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| **Page Object Model**    | Each page has dedicated class with locators and actions.               |
| **Fixtures**             | Shared setup logic for initializing pages and handling authentication. |
| **Network Logger**       | Captures and saves API traffic for debugging.                          |
| **Network Interception** | Allows mocking backend APIs for faster, isolated UI testing.           |
| **Data-Driven Testing**  | External JSON files store test data.                                   |
| **CI/CD Ready**          | Works in headless mode with reports and mock APIs.                     |

---

## 🧩 End-to-End Flow

The full E2E test covers:

1. **Login** — Authenticate and store session token.
2. **Model** — Load and validate available stains/models.
3. **Upload** — Upload slide files, apply stains, track progress.
4. **Activity** — Validate uploaded slides and stain usage summary.
5. **Reports** — Validate yearly and user-level reports.

Each step is independently reusable and modular.

---

## 🧰 Mocking and Interception

Mocking is supported for backend isolation:

* **/api/models** → Add or remove models dynamically.
* **/api/upload** → Simulate large uploads or failures.
* **/api/reports** → Return fake stain usage data.

This is controlled by the `apiInterceptor.ts` utility, which can be toggled using:

```bash
USE_API_MOCK=true npx playwright test
```

---

## 🧩 Example Commands

Run only the upload tests:

```bash
npx playwright test tests/uploads_spec.ts
```

Run E2E flow:

```bash
npx playwright test tests/e2e_full_flow_spec.ts
```

Run in headless CI mode:

```bash
npx playwright test --config=playwright.config.ts --reporter=html
```

---

## 📁 Test Artifacts

After execution, the following are generated:

| Artifact     | Location                        | Description                       |
| ------------ | ------------------------------- | --------------------------------- |
| Network Logs | `/network-logs/*.txt`           | Captured API requests/responses   |
| HTML Report  | `/playwright-report/index.html` | Detailed report with screenshots  |
| Screenshots  | `/test-results/`                | Failure screenshots for debugging |

---

## 🧩 Contributing

1. Follow the POM convention for new modules.
2. Add new locators and actions inside page classes only.
3. Add tests under `/tests` and update `/data` JSON files.
4. Ensure CI-friendly, deterministic tests (avoid hardcoded waits).

---

## 🧾 License

MIT License © 2025 — Automation Framework for Virtual Stain Hub by Sashi
