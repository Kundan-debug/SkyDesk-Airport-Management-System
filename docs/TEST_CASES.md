# SkyDesk – Test Cases

This document describes the planned API and database test cases for SkyDesk. The API smoke-test runner, application source code, and database scripts are included in this project repository.

**Execution note:** The Result column is intentionally blank. Enter `Pass`, `Fail`, or `Not Run` only after testing in the project environment. Do not treat the expected outcomes as completed test results.

| ID | Area | Steps | Expected | Result |
|---|---|---|---|---|
| TC-01 | Auth | GET /api/flights without cookie | 401 | |
| TC-02 | Auth | Login with wrong password | 401 | |
| TC-03 | Auth | Login as passenger and admin | cookie issued | |
| TC-04 | Roles | Passenger GET /api/analytics | 403 | |
| TC-05 | Roles | Admin GET /api/analytics | 200 | |
| TC-06 | Roles | Passenger POST /api/flights | 403 | |
| TC-07 | Search | Flights BLR→DEL | ≥1 result | |
| TC-08 | Ownership | Passenger lists bookings | only own rows | |
| TC-09 | Integrity | Book taken seat 14B on QP1103 | 409 "seat already taken" | |
| TC-10 | Validation | Seat `ZZ` | 400 | |
| TC-11 | Trigger T2/T3 | Book + pay seat 31F on 6E204 | CONFIRMED + SUCCESS | |
| TC-12 | Trigger T4 | Cancel that booking | CANCELLED + REFUNDED | |
| TC-13 | Integrity | Cancel again | 400 | |
| TC-14 | Trigger T6 | Add 10 kg to Vikram (25 kg, economy) | 400 allowance exceeded | |
| TC-15 | Trigger T1 | Assign a DEL gate to a BLR flight | 400 | |
| TC-16 | Search | Free-text search "hyderabad" | ≥1 flight | |
| TC-17 | CHECK | Book seat `41A` (row outside 1-40) | 400 | |

## Manual / database test cases
| ID | Steps | Expected |
|---|---|---|
| TC-18 | T1 then T2 (`CALL sp_book_flight`) | T1 creates a CONFIRMED booking; T2 (taken seat) errors and leaves no booking or payment row |
| TC-19 | T3 | ROLLBACK TO SAVEPOINT keeps the longer route, undoes the delay |
| TC-20 | T4: cancel flight EK565 in a transaction | bookings CANCELLED, payments REFUNDED |
| TC-21 | T6: two Workbench tabs run `SELECT … FOR UPDATE` on the same flight row | second tab waits for the first (the same lock stops overbooking) |
| TC-22 | Insert passenger with phone `123` (and one with a 2999 date of birth) | CHECK `ck_pax_phone` violation; trigger rejects future birth date |
| TC-23 | Book seat `3A` on a flight where it is already taken, directly through MySQL Workbench | The second attempt is rejected with the seat-conflict SQL error (SQLSTATE `45001`). |
| TC-24 | Register with a duplicate email | 409, and no orphan passenger row (transaction) |
| TC-25 | Admin records a 45-minute delay | Flight status becomes `DELAYED`, scheduled times are shifted, and a `DELAY` event is recorded in MongoDB. |
| TC-26 | Insert a MongoDB event with invalid `event_type: 'BANANA'` | MongoDB schema validation rejects the document. |


## Test summary

- API test cases: 17 (TC-01 to TC-17)
- Manual/database test cases: 9 (TC-18 to TC-26)
- Total planned test cases: 26

These are test specifications, not a claim that all tests have been executed successfully.
