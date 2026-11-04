-- SkyDesk AMS | 06_transaction_demos.sql | run block by block in MySQL Workbench / mysql client

-- T1: sp_book_flight is ONE atomic transaction (booking + payment + payment success)
SET @pax    = (SELECT passenger_id FROM passenger WHERE email = 'meera.pillai@example.com');
SET @flight = (SELECT flight_id FROM flight WHERE flight_number = 'AI501' AND scheduled_departure > NOW());
CALL sp_book_flight(@pax, @flight, '14C', 'ECONOMY', 'UPI', TRUE);
SELECT booking_id, seat_number, booking_status, payment_status FROM v_booking_details WHERE passenger_email = 'meera.pillai@example.com';

-- T2: a failure rolls back EVERYTHING (seat 12A is already taken -> error from trigger booking_validate)
SET @pax2 = (SELECT passenger_id FROM passenger WHERE email = 'ishaan.gupta@example.com');
CALL sp_book_flight(@pax2, @flight, '12A', 'ECONOMY', 'CARD', TRUE);
SELECT COUNT(*) AS ishaan_bookings_on_AI501 FROM v_booking_details
WHERE passenger_email = 'ishaan.gupta@example.com' AND flight_number = 'AI501';

-- T3: manual transaction with SAVEPOINT (partial rollback). The fare comes from the flight duration.
START TRANSACTION;
  UPDATE flight SET scheduled_arrival = scheduled_arrival + INTERVAL 30 MINUTE WHERE flight_number = 'AI501' AND scheduled_departure > NOW();
  SAVEPOINT after_longer_route;
  UPDATE flight SET flight_status = 'DELAYED' WHERE flight_number = 'AI501' AND scheduled_departure > NOW();
  ROLLBACK TO SAVEPOINT after_longer_route;      -- undo the delay, keep the longer route
  SELECT flight_number, flight_status, fn_ticket_price(flight_id, 'ECONOMY') AS economy_fare
  FROM flight WHERE flight_number = 'AI501' AND scheduled_departure > NOW();
ROLLBACK;

-- T4: cancelling a flight cascades: bookings CANCELLED (T5) -> payments REFUNDED (T4)
START TRANSACTION;
  UPDATE flight SET flight_status = 'CANCELLED' WHERE flight_number = 'EK565' AND scheduled_departure > NOW();
  SELECT booking_id, booking_status, payment_status FROM v_booking_details WHERE flight_number = 'EK565';
ROLLBACK;

-- T5: integrity rules. Each statement below must FAIL with a clear message.
-- Overweight bag (economy allowance 30 kg; Vikram already has 25 kg):
--   INSERT INTO baggage (passenger_id, flight_id, weight) SELECT passenger_id, flight_id, 10 FROM booking WHERE seat_number = '18C';
-- Gate at the wrong airport (C1 is in Delhi):
--   UPDATE flight SET gate_id = (SELECT gate_id FROM gate WHERE gate_number = 'C1')
--   WHERE flight_number = '6E204' AND scheduled_departure > NOW();
-- Seat outside the 40-row layout (CHECK ck_seat_row):
--   INSERT INTO booking (passenger_id, flight_id, seat_number) VALUES (1, 1, '41A');
-- Bad data (CHECK constraint ck_pax_phone and trigger passenger_validate):
--   INSERT INTO passenger (first_name,last_name,date_of_birth,passport_number,phone,email) VALUES ('A','B','1990-01-01','X123456','123','bad@x.com');
--   INSERT INTO passenger (first_name,last_name,date_of_birth,passport_number,phone,email) VALUES ('A','B','2999-01-01','X123457','+919800000010','future@x.com');

-- T6: isolation / locking. Two sessions (two Workbench tabs):
--   Session A: START TRANSACTION; SELECT * FROM flight WHERE flight_id = 1 FOR UPDATE;   -- keeps the row locked
--   Session B: START TRANSACTION; SELECT * FROM flight WHERE flight_id = 1 FOR UPDATE;   -- waits until A commits or rolls back
--   (This is the same lock trigger booking_validate takes, so two people cannot grab the last seat together.)
