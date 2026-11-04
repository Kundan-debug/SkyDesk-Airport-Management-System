-- =====================================================================
-- SkyDesk AMS | 02_programmability.sql | MySQL
-- Functions, stored procedures and triggers: business rules enforced IN the database.
-- (DELIMITER lines are understood by the mysql client, MySQL Workbench and scripts/setup-db.mjs)
-- =====================================================================

DROP FUNCTION  IF EXISTS fn_flight_capacity;
DROP FUNCTION  IF EXISTS fn_class_multiplier;
DROP FUNCTION  IF EXISTS fn_ticket_price;
DROP FUNCTION  IF EXISTS fn_available_seats;
DROP FUNCTION  IF EXISTS fn_baggage_allowance;
DROP PROCEDURE IF EXISTS sp_check_flight;
DROP PROCEDURE IF EXISTS sp_book_flight;
DROP PROCEDURE IF EXISTS sp_process_payment;
DROP PROCEDURE IF EXISTS sp_cancel_booking;

DELIMITER $$

-- ---------- FUNCTIONS -------------------------------------------------
-- Aircraft layout: 40 rows x 6 seats (A-F). Row limit is also a CHECK on booking.seat_number.
CREATE FUNCTION fn_flight_capacity() RETURNS INT DETERMINISTIC
BEGIN
    RETURN 240;
END$$

CREATE FUNCTION fn_class_multiplier(p_class VARCHAR(10)) RETURNS DECIMAL(4,1) DETERMINISTIC
BEGIN
    RETURN CASE p_class WHEN 'ECONOMY' THEN 1.0 WHEN 'BUSINESS' THEN 2.5 WHEN 'FIRST' THEN 4.0 END;
END$$

-- Fare is derived from the flight duration: Rs 500 + Rs 40 per minute, times the class multiplier.
-- (The ER diagram has no fare column, so nothing extra is stored.)
CREATE FUNCTION fn_ticket_price(p_flight_id INT, p_class VARCHAR(10)) RETURNS DECIMAL(10,2) READS SQL DATA
BEGIN
    DECLARE v_minutes INT;
    SELECT TIMESTAMPDIFF(MINUTE, scheduled_departure, scheduled_arrival) INTO v_minutes
      FROM flight WHERE flight_id = p_flight_id;
    RETURN ROUND((500 + v_minutes * 40) * fn_class_multiplier(p_class), 2);
END$$

CREATE FUNCTION fn_available_seats(p_flight_id INT) RETURNS INT READS SQL DATA
BEGIN
    DECLARE v_taken INT;
    SELECT COUNT(*) INTO v_taken FROM booking WHERE flight_id = p_flight_id AND booking_status <> 'CANCELLED';
    RETURN fn_flight_capacity() - v_taken;
END$$

CREATE FUNCTION fn_baggage_allowance(p_class VARCHAR(10)) RETURNS DECIMAL(5,1) DETERMINISTIC
BEGIN
    RETURN CASE p_class WHEN 'ECONOMY' THEN 30 WHEN 'BUSINESS' THEN 40 WHEN 'FIRST' THEN 50 END;
END$$

-- ---------- helper used by the two flight triggers --------------------
-- Gate must be at the departure airport and free for +-60 minutes.
CREATE PROCEDURE sp_check_flight(IN p_flight_id INT, IN p_gate_id INT, IN p_dep_airport INT,
                                 IN p_status VARCHAR(12), IN p_departure DATETIME)
BEGIN
    DECLARE v_gate_airport INT DEFAULT NULL;
    IF p_gate_id IS NOT NULL THEN
        SELECT t.airport_id INTO v_gate_airport
        FROM gate g JOIN terminal t ON t.terminal_id = g.terminal_id WHERE g.gate_id = p_gate_id;
        IF v_gate_airport <> p_dep_airport THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Gate is not located at the departure airport of this flight';
        END IF;
        IF p_status NOT IN ('CANCELLED','ARRIVED') AND EXISTS (
            SELECT 1 FROM flight f
            WHERE f.gate_id = p_gate_id
              AND (p_flight_id IS NULL OR f.flight_id <> p_flight_id)
              AND f.flight_status NOT IN ('CANCELLED','ARRIVED')
              AND ABS(TIMESTAMPDIFF(SECOND, f.scheduled_departure, p_departure)) < 3600
        ) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Gate already serves another flight within 60 minutes of this departure';
        END IF;
    END IF;
END$$

-- =====================================================================
-- TRIGGERS (8 trigger objects implementing 7 business rules)
-- =====================================================================

-- T1  FLIGHT gate rules (MySQL needs one trigger per event, so INSERT and UPDATE share the procedure above)
CREATE TRIGGER flight_validate_ins BEFORE INSERT ON flight FOR EACH ROW
BEGIN
    CALL sp_check_flight(NULL, NEW.gate_id, NEW.departure_airport_id, NEW.flight_status, NEW.scheduled_departure);
END$$

CREATE TRIGGER flight_validate_upd BEFORE UPDATE ON flight FOR EACH ROW
BEGIN
    CALL sp_check_flight(OLD.flight_id, NEW.gate_id, NEW.departure_airport_id, NEW.flight_status, NEW.scheduled_departure);
END$$

-- T2  BOOKING: flight open, not departed, not full, seat free, passenger not already booked.
--     FOR UPDATE locks the flight row, so two people cannot take the same seat or the last seat at once.
CREATE TRIGGER booking_validate BEFORE INSERT ON booking FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(12);
    DECLARE v_dep    DATETIME;
    DECLARE v_num    VARCHAR(8);
    DECLARE v_taken  INT;
    DECLARE v_msg    VARCHAR(128);
    SELECT flight_status, scheduled_departure, flight_number
      INTO v_status, v_dep, v_num
      FROM flight WHERE flight_id = NEW.flight_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Flight does not exist';
    END IF;
    IF v_status NOT IN ('SCHEDULED','DELAYED') THEN
        SET v_msg = CONCAT('Flight ', v_num, ' is ', v_status, ' and is closed for booking');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;
    IF v_dep <= NOW() THEN
        SET v_msg = CONCAT('Flight ', v_num, ' has already departed');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;
    -- SQLSTATE 45001 = conflict (the API turns it into HTTP 409)
    IF EXISTS (SELECT 1 FROM booking WHERE flight_id = NEW.flight_id AND seat_number = NEW.seat_number
                  AND booking_status <> 'CANCELLED') THEN
        SIGNAL SQLSTATE '45001' SET MESSAGE_TEXT = 'That seat is already taken. Pick another seat.';
    END IF;
    IF EXISTS (SELECT 1 FROM booking WHERE flight_id = NEW.flight_id AND passenger_id = NEW.passenger_id
                  AND booking_status <> 'CANCELLED') THEN
        SIGNAL SQLSTATE '45001' SET MESSAGE_TEXT = 'You already have an active booking on this flight.';
    END IF;
    SELECT COUNT(*) INTO v_taken FROM booking WHERE flight_id = NEW.flight_id AND booking_status <> 'CANCELLED';
    IF v_taken >= fn_flight_capacity() THEN
        SET v_msg = CONCAT('Flight ', v_num, ' is fully booked');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;
END$$

-- T3  PAYMENT succeeds -> booking becomes CONFIRMED
CREATE TRIGGER payment_after_update AFTER UPDATE ON payment FOR EACH ROW
BEGIN
    IF NEW.payment_status = 'SUCCESS' AND OLD.payment_status <> 'SUCCESS' THEN
        UPDATE booking SET booking_status = 'CONFIRMED' WHERE booking_id = NEW.booking_id AND booking_status = 'PENDING';
    END IF;
END$$

-- T4  BOOKING cancelled -> paid payment is REFUNDED, pending payment FAILED
CREATE TRIGGER booking_after_cancel AFTER UPDATE ON booking FOR EACH ROW
BEGIN
    IF NEW.booking_status = 'CANCELLED' AND OLD.booking_status <> 'CANCELLED' THEN
        UPDATE payment SET payment_status = 'REFUNDED' WHERE booking_id = NEW.booking_id AND payment_status = 'SUCCESS';
        UPDATE payment SET payment_status = 'FAILED'   WHERE booking_id = NEW.booking_id AND payment_status = 'PENDING';
    END IF;
END$$

-- T5  FLIGHT cancelled -> every live booking is cancelled (T4 then refunds them)
CREATE TRIGGER flight_cancel_cascade AFTER UPDATE ON flight FOR EACH ROW
BEGIN
    IF NEW.flight_status = 'CANCELLED' AND OLD.flight_status <> 'CANCELLED' THEN
        UPDATE booking SET booking_status = 'CANCELLED' WHERE flight_id = NEW.flight_id AND booking_status <> 'CANCELLED';
    END IF;
END$$

-- T6  BAGGAGE needs a CONFIRMED booking and must fit the class allowance (30 / 40 / 50 kg)
CREATE TRIGGER baggage_validate BEFORE INSERT ON baggage FOR EACH ROW
BEGIN
    DECLARE v_class    VARCHAR(10);
    DECLARE v_existing DECIMAL(8,2);
    DECLARE v_limit    DECIMAL(8,2);
    DECLARE v_msg      VARCHAR(128);
    SELECT travel_class INTO v_class FROM booking
     WHERE passenger_id = NEW.passenger_id AND flight_id = NEW.flight_id AND booking_status = 'CONFIRMED' LIMIT 1;
    IF v_class IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Passenger has no confirmed booking on this flight';
    END IF;
    SET v_limit = fn_baggage_allowance(v_class);
    SELECT COALESCE(SUM(weight), 0) INTO v_existing FROM baggage
     WHERE passenger_id = NEW.passenger_id AND flight_id = NEW.flight_id;
    IF v_existing + NEW.weight > v_limit THEN
        SET v_msg = CONCAT(v_class, ' allowance is ', v_limit, ' kg; this bag would make the total ', v_existing + NEW.weight, ' kg');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;
END$$

-- T7  PASSENGER date of birth cannot be in the future (CHECK constraints may not use CURDATE())
CREATE TRIGGER passenger_validate BEFORE INSERT ON passenger FOR EACH ROW
BEGIN
    IF NEW.date_of_birth > CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Date of birth cannot be in the future';
    END IF;
END$$

-- =====================================================================
-- STORED PROCEDURES
-- =====================================================================

-- Settle a pending payment (success confirms the booking through T3)
CREATE PROCEDURE sp_process_payment(IN p_booking_id INT, IN p_success BOOLEAN)
BEGIN
    UPDATE payment
       SET payment_status = IF(p_success, 'SUCCESS', 'FAILED'),
           payment_date   = IF(p_success, NOW(), NULL)
     WHERE booking_id = p_booking_id AND payment_status = 'PENDING';
    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This booking has no pending payment';
    END IF;
END$$

-- Book a seat + create the payment (+ optionally pay) as ONE transaction.
-- Any error (taken seat, full flight, bad fare...) rolls back everything. Returns the new booking_id.
-- Note: START TRANSACTION commits an already-open transaction, so call this on its own (autocommit on).
CREATE PROCEDURE sp_book_flight(IN p_passenger_id INT, IN p_flight_id INT, IN p_seat VARCHAR(4),
                                IN p_class VARCHAR(10), IN p_method VARCHAR(12), IN p_pay_now BOOLEAN)
BEGIN
    DECLARE v_price DECIMAL(10,2);
    DECLARE v_booking_id INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET v_price = fn_ticket_price(p_flight_id, p_class);
    IF v_price IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Flight does not exist or travel class is invalid';
    END IF;

    START TRANSACTION;
    INSERT INTO booking (passenger_id, flight_id, seat_number, travel_class)
    VALUES (p_passenger_id, p_flight_id, p_seat, p_class);
    SET v_booking_id = LAST_INSERT_ID();
    INSERT INTO payment (booking_id, amount, payment_method) VALUES (v_booking_id, v_price, p_method);
    IF p_pay_now THEN
        CALL sp_process_payment(v_booking_id, TRUE);
    END IF;
    COMMIT;

    SELECT v_booking_id AS booking_id;
END$$

-- Cancel a booking. When p_passenger_id is not NULL, ownership is enforced.
CREATE PROCEDURE sp_cancel_booking(IN p_booking_id INT, IN p_passenger_id INT)
BEGIN
    UPDATE booking SET booking_status = 'CANCELLED'
     WHERE booking_id = p_booking_id
       AND (p_passenger_id IS NULL OR passenger_id = p_passenger_id)
       AND booking_status <> 'CANCELLED';
    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Booking not found, not yours, or already cancelled';
    END IF;
END$$

DELIMITER ;
