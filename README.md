# SkyDesk – Airport Management System

SkyDesk is an Airport Management System designed to bring essential airport operations into one centralized platform. It supports passenger-facing activities such as flight search, booking, simulated payment, cancellation, and baggage tracking, together with administrative activities such as flight and gate management, delay recording, and operational analytics.

The project uses a **Next.js** web application, **MySQL 8** for structured transactional data, and **MongoDB** for operational event history. MySQL constraints, triggers, stored procedures, views, and transactions enforce important business rules and maintain data consistency.

## Project team

- Kundan (PES1UG24CS243)
- Vikas (PES1UG24CS915)

**Course:** Database Management System

## Main features

- Passenger registration and authentication
- Flight search, filtering, and seat availability
- Flight booking, simulated payment, cancellation, and refund handling
- Administrative flight and gate management
- Flight delay recording and event logging
- Baggage check-in, scanning, and tracking history
- Role-based access for passengers and airport administrators
- Operational dashboards and analytics
- MySQL transaction processing and MongoDB event history

## Technology stack

| Layer | Technology |
|---|---|
| Web application | Next.js / React |
| Relational database | MySQL 8 (InnoDB) |
| Event/document database | MongoDB |
| Authentication | JWT-based session cookie and bcrypt password hashing |
| Data access | Parameterized SQL queries and MongoDB operations |
| Validation | Zod and database constraints/triggers |

## Project structure

```text
skydesk/
├── src/
│   ├── app/
│   │   ├── api/                 # Next.js API route handlers
│   │   │   ├── analytics/
│   │   │   ├── auth/            # Login, registration, logout, session
│   │   │   ├── baggage/         # Baggage operations and history
│   │   │   ├── bookings/        # Booking, cancellation, payment
│   │   │   ├── dashboard/
│   │   │   ├── flights/         # Flight listing and management
│   │   │   └── lookups/
│   │   ├── analytics/           # Analytics page
│   │   ├── baggage/             # Baggage tracking page
│   │   ├── bookings/            # Passenger bookings page
│   │   ├── dashboard/           # Dashboard page
│   │   ├── flights/              # Flight search/board page
│   │   ├── login/
│   │   ├── ops/                 # Airport operations page
│   │   ├── register/
│   │   ├── globals.css
│   │   ├── layout.js
│   │   └── page.js
│   ├── components/              # Shared navigation and UI components
│   ├── lib/                     # Authentication, DB, MongoDB, HTTP helpers
│   └── middleware.js             # Page-level authentication redirects
├── sql/
│   ├── 01_schema.sql            # Tables, keys, constraints, indexes
│   ├── 02_programmability.sql   # Procedures, functions, triggers
│   ├── 03_views.sql             # Database views
│   ├── 04_seed.sql              # Sample data
│   ├── 05_queries.sql            # Demonstration queries
│   └── 06_transaction_demos.sql # Transaction demonstrations
├── mongo/
│   └── queries.js               # MongoDB queries and aggregations
├── scripts/
│   ├── api-smoke-test.mjs       # API smoke tests
│   ├── setup-db.mjs             # MySQL setup helper
│   └── setup-mongo.mjs          # MongoDB setup helper
├── docs/
│   ├── DOCUMENTATION.md         # Project and database documentation
│   ├── TEST_CASES.md            # API and database test specifications
│   └── images/
│       ├── er-diagram.png
│       └── relational-schema.png
├── .env.example                 # Environment-variable template
├── .gitignore
├── docker-compose.yml           # Local database services
├── jsconfig.json
├── next.config.mjs
├── package.json
└── package-lock.json
```

Generated or machine-specific directories such as `node_modules/` and `.next/`, local secrets such as `.env`, and operating-system metadata are not part of the project source repository.

## Setup and execution

1. Install Node.js (LTS), MySQL 8, and MongoDB, or use the database services configured in `docker-compose.yml`.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in the local MySQL, MongoDB, and authentication values. Never commit `.env`.
4. Start the database services if using Docker Compose:

   ```bash
   docker compose up -d
   ```

5. Run the database setup scripts in the documented order. See `docs/DOCUMENTATION.md` and the scripts in `scripts/` for the project-specific setup flow.
6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open `http://localhost:3000` in a browser.

Use the actual environment values and database credentials configured on your machine. Do not publish secrets or real credentials.

## Documentation

- **[Project Documentation](docs/DOCUMENTATION.md):** problem statement, objectives, scope, requirements, ER model, relational schema, data dictionary, database design, implementation, and architecture.
- **[Test Cases](docs/TEST_CASES.md):** API and manual/database test specifications, expected outcomes, and result fields.

## Testing

The API smoke-test script is available at `scripts/api-smoke-test.mjs`. The test specifications are documented in `docs/TEST_CASES.md`. Record `Pass`, `Fail`, or `Not Run` only after executing each test in the configured project environment; expected outcomes are not evidence that a test has passed.

## Scope note

Payment is simulated within the application; no real payment gateway is integrated. Email/SMS notifications, immigration processing, and multi-leg itinerary management are outside the current scope.
