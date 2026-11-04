-- SkyDesk AMS | 01_schema.sql | MySQL 8.0.19+ (8.4 recommended)
-- DDL: CREATE / ALTER / DROP, primary & foreign keys, constraints, indexes
-- Safe to re-run: drops everything first.

-- DROP
DROP VIEW IF EXISTS v_dashboard_kpis;
DROP VIEW IF EXISTS v_airline_performance;
DROP VIEW IF EXISTS v_baggage_tracking;
DROP VIEW IF EXISTS v_booking_details;
DROP VIEW IF EXISTS v_flight_board;
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS user_account, employee, role, baggage, payment, booking, passenger, flight, airline, gate, terminal, airport;
SET FOREIGN_KEY_CHECKS = 1;

-- AIRPORT
CREATE TABLE airport (
    airport_id    INT AUTO_INCREMENT PRIMARY KEY,
    airport_code  CHAR(3)      NOT NULL UNIQUE,
    airport_name  VARCHAR(100) NOT NULL,
    city          VARCHAR(60)  NOT NULL,
    country       VARCHAR(60)  NOT NULL,
    CONSTRAINT ck_airport_code CHECK (REGEXP_LIKE(airport_code, '^[A-Z]{3}$', 'c')),
    FULLTEXT KEY ft_airport (airport_name, city)
) ENGINE=InnoDB;

-- TERMINAL (Airport 1 : M Terminal)
CREATE TABLE terminal (
    terminal_id   INT AUTO_INCREMENT PRIMARY KEY,
    airport_id    INT         NOT NULL,
    terminal_name VARCHAR(30) NOT NULL,
    CONSTRAINT uq_terminal_per_airport UNIQUE (airport_id, terminal_name),
    CONSTRAINT fk_terminal_airport FOREIGN KEY (airport_id) REFERENCES airport(airport_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- GATE (Terminal 1 : M Gate)
CREATE TABLE gate (
    gate_id      INT AUTO_INCREMENT PRIMARY KEY,
    terminal_id  INT         NOT NULL,
    gate_number  VARCHAR(10) NOT NULL,
    gate_status  VARCHAR(15) NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT ck_gate_status CHECK (gate_status IN ('AVAILABLE','OCCUPIED','MAINTENANCE','CLOSED')),
    CONSTRAINT uq_gate_per_terminal UNIQUE (terminal_id, gate_number),
    CONSTRAINT fk_gate_terminal FOREIGN KEY (terminal_id) REFERENCES terminal(terminal_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- AIRLINE
CREATE TABLE airline (
    airline_id    INT AUTO_INCREMENT PRIMARY KEY,
    airline_code  VARCHAR(3)  NOT NULL UNIQUE,
    airline_name  VARCHAR(80) NOT NULL UNIQUE,
    country       VARCHAR(60) NOT NULL,
    CONSTRAINT ck_airline_code CHECK (REGEXP_LIKE(airline_code, '^[A-Z0-9]{2,3}$', 'c'))
) ENGINE=InnoDB;

-- FLIGHT
CREATE TABLE flight (
    flight_id            INT AUTO_INCREMENT PRIMARY KEY,
    flight_number        VARCHAR(8) NOT NULL,
    airline_id           INT NOT NULL,
    departure_airport_id INT NOT NULL,
    arrival_airport_id   INT NOT NULL,
    gate_id              INT NULL,
    scheduled_departure  DATETIME NOT NULL,
    scheduled_arrival    DATETIME NOT NULL,
    flight_status        VARCHAR(12) NOT NULL DEFAULT 'SCHEDULED',
    CONSTRAINT ck_flight_number CHECK (REGEXP_LIKE(flight_number, '^[A-Z0-9]{2}[0-9]{1,4}$', 'c')),
    CONSTRAINT ck_flight_status CHECK (flight_status IN ('SCHEDULED','BOARDING','DEPARTED','ARRIVED','DELAYED','CANCELLED')),
    CONSTRAINT ck_flight_route  CHECK (departure_airport_id <> arrival_airport_id),
    CONSTRAINT ck_flight_times  CHECK (scheduled_arrival > scheduled_departure),
    CONSTRAINT uq_flight_instance UNIQUE (flight_number, scheduled_departure),
    CONSTRAINT fk_flight_airline FOREIGN KEY (airline_id)           REFERENCES airline(airline_id) ON DELETE RESTRICT,
    CONSTRAINT fk_flight_dep     FOREIGN KEY (departure_airport_id) REFERENCES airport(airport_id) ON DELETE RESTRICT,
    CONSTRAINT fk_flight_arr     FOREIGN KEY (arrival_airport_id)   REFERENCES airport(airport_id) ON DELETE RESTRICT,
    CONSTRAINT fk_flight_gate    FOREIGN KEY (gate_id)              REFERENCES gate(gate_id)       ON DELETE SET NULL
) ENGINE=InnoDB;

-- PASSENGER
CREATE TABLE passenger (
    passenger_id    INT AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(50)  NOT NULL,
    last_name       VARCHAR(50)  NOT NULL,
    date_of_birth   DATE         NOT NULL,
    passport_number VARCHAR(12)  NOT NULL UNIQUE,
    phone           VARCHAR(16)  NOT NULL,
    email           VARCHAR(120) NOT NULL UNIQUE,
    CONSTRAINT ck_pax_first CHECK (CHAR_LENGTH(TRIM(first_name)) > 0),
    CONSTRAINT ck_pax_last  CHECK (CHAR_LENGTH(TRIM(last_name)) > 0),
    CONSTRAINT ck_pax_dob   CHECK (date_of_birth > '1900-01-01'),
    CONSTRAINT ck_passport  CHECK (REGEXP_LIKE(passport_number, '^[A-Z0-9]{6,12}$', 'c')),
    CONSTRAINT ck_pax_phone CHECK (REGEXP_LIKE(phone, '^[+]?[0-9]{7,15}$')),
    CONSTRAINT ck_pax_email CHECK (REGEXP_LIKE(email, '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$'))
) ENGINE=InnoDB;

-- BOOKING (Passenger 1 : M Booking, Flight 1 : M Booking)
-- Columns are exactly the ER diagram. "One live booking per seat / per passenger per flight" is enforced
-- by trigger booking_validate (02_programmability.sql), which also locks the flight row so it is race-free.
CREATE TABLE booking (
    booking_id     INT AUTO_INCREMENT PRIMARY KEY,
    passenger_id   INT NOT NULL,
    flight_id      INT NOT NULL,
    booking_date   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    seat_number    VARCHAR(3)  NOT NULL,
    travel_class   VARCHAR(10) NOT NULL DEFAULT 'ECONOMY',
    booking_status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    CONSTRAINT ck_seat           CHECK (REGEXP_LIKE(seat_number, '^[0-9]{1,2}[A-F]$', 'c')),
    CONSTRAINT ck_class          CHECK (travel_class IN ('ECONOMY','BUSINESS','FIRST')),
    CONSTRAINT ck_booking_status CHECK (booking_status IN ('PENDING','CONFIRMED','CANCELLED')),
    CONSTRAINT fk_booking_passenger FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_flight    FOREIGN KEY (flight_id)    REFERENCES flight(flight_id)       ON DELETE RESTRICT
) ENGINE=InnoDB;

-- PAYMENT (Booking 1 : 1 Payment)
CREATE TABLE payment (
    payment_id            INT AUTO_INCREMENT PRIMARY KEY,
    booking_id            INT NOT NULL UNIQUE,
    amount                DECIMAL(10,2) NOT NULL,
    payment_method        VARCHAR(12) NOT NULL,
    payment_date          DATETIME NULL,
    payment_status        VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    transaction_reference VARCHAR(20) NOT NULL UNIQUE
                          DEFAULT (CONCAT('TXN', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 12)))),
    CONSTRAINT ck_pay_amount CHECK (amount > 0),
    CONSTRAINT ck_pay_method CHECK (payment_method IN ('CARD','UPI','NET_BANKING','CASH','WALLET')),
    CONSTRAINT ck_pay_status CHECK (payment_status IN ('PENDING','SUCCESS','FAILED','REFUNDED')),
    CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- BAGGAGE
CREATE TABLE baggage (
    baggage_id     INT AUTO_INCREMENT PRIMARY KEY,
    passenger_id   INT NOT NULL,
    flight_id      INT NOT NULL,
    baggage_tag    VARCHAR(12) NOT NULL UNIQUE DEFAULT (CONCAT('BG', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8)))),
    weight         DECIMAL(5,2) NOT NULL,
    baggage_status VARCHAR(18) NOT NULL DEFAULT 'CHECKED_IN',
    CONSTRAINT ck_bag_weight CHECK (weight > 0 AND weight <= 50),
    CONSTRAINT ck_bag_status CHECK (baggage_status IN ('CHECKED_IN','SECURITY_SCREENED','LOADED','IN_TRANSIT','ARRIVED','CLAIMED','LOST')),
    CONSTRAINT fk_bag_passenger FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id) ON DELETE RESTRICT,
    CONSTRAINT fk_bag_flight    FOREIGN KEY (flight_id)    REFERENCES flight(flight_id)       ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ROLE / EMPLOYEE / USER_ACCOUNT
CREATE TABLE role (
    role_id     INT AUTO_INCREMENT PRIMARY KEY,
    role_name   VARCHAR(20) NOT NULL UNIQUE,
    description VARCHAR(200),
    CONSTRAINT ck_role_name CHECK (role_name IN ('ADMIN','PASSENGER'))
) ENGINE=InnoDB;

CREATE TABLE employee (
    employee_id INT AUTO_INCREMENT PRIMARY KEY,
    airport_id  INT NOT NULL,
    first_name  VARCHAR(50) NOT NULL,
    last_name   VARCHAR(50) NOT NULL,
    role_title  VARCHAR(60) NOT NULL,
    department  VARCHAR(60) NOT NULL,
    phone       VARCHAR(16) NOT NULL,
    email       VARCHAR(120) NOT NULL UNIQUE,
    hire_date   DATE NOT NULL,
    CONSTRAINT ck_emp_phone CHECK (REGEXP_LIKE(phone, '^[+]?[0-9]{7,15}$')),
    CONSTRAINT ck_emp_email CHECK (REGEXP_LIKE(email, '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$')),
    CONSTRAINT ck_emp_hire  CHECK (hire_date > '1970-01-01'),
    CONSTRAINT fk_emp_airport FOREIGN KEY (airport_id) REFERENCES airport(airport_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE user_account (
    user_id        INT AUTO_INCREMENT PRIMARY KEY,
    role_id        INT NOT NULL,
    employee_id    INT NULL UNIQUE,
    passenger_id   INT NULL UNIQUE,
    username       VARCHAR(40)  NOT NULL UNIQUE,
    email          VARCHAR(120) NOT NULL UNIQUE,
    password_hash  VARCHAR(100) NOT NULL,
    account_status VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE',
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_user_name   CHECK (REGEXP_LIKE(username, '^[A-Za-z0-9_.]{4,40}$')),
    CONSTRAINT ck_user_email  CHECK (REGEXP_LIKE(email, '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$')),
    CONSTRAINT ck_user_status CHECK (account_status IN ('ACTIVE','LOCKED','DISABLED')),
    -- ER diagram: both links are 0..1, and an account belongs to exactly one kind of person
    CONSTRAINT ck_account_owner CHECK ((employee_id IS NULL) <> (passenger_id IS NULL)),
    CONSTRAINT fk_user_role      FOREIGN KEY (role_id)      REFERENCES role(role_id),
    CONSTRAINT fk_user_employee  FOREIGN KEY (employee_id)  REFERENCES employee(employee_id),
    CONSTRAINT fk_user_passenger FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id)
) ENGINE=InnoDB;

-- ALTER (adding rules after the first design)
-- The aircraft layout is 40 rows x 6 seats (A-F) = 240 seats; add the row limit as a constraint.
ALTER TABLE booking
    ADD CONSTRAINT ck_seat_row CHECK (CAST(SUBSTRING(seat_number, 1, CHAR_LENGTH(seat_number) - 1) AS UNSIGNED) BETWEEN 1 AND 40);

-- ALTER / DROP demonstration on a scratch table
CREATE TABLE scratch_demo (id INT PRIMARY KEY, note TEXT);
ALTER TABLE scratch_demo ADD COLUMN created_on DATE DEFAULT (CURDATE());
ALTER TABLE scratch_demo RENAME COLUMN note TO remark;
ALTER TABLE scratch_demo ADD CONSTRAINT ck_demo CHECK (id > 0);
ALTER TABLE scratch_demo DROP CHECK ck_demo;
ALTER TABLE scratch_demo DROP COLUMN created_on;
DROP TABLE scratch_demo;

-- INDEXES
CREATE INDEX idx_flight_route      ON flight (departure_airport_id, arrival_airport_id, scheduled_departure);
CREATE INDEX idx_flight_status     ON flight (flight_status);
CREATE INDEX idx_flight_gate_time  ON flight (gate_id, scheduled_departure);
CREATE INDEX idx_flight_airline    ON flight (airline_id);
CREATE INDEX idx_booking_passenger ON booking (passenger_id);
CREATE INDEX idx_booking_flight    ON booking (flight_id, booking_status);
CREATE INDEX idx_booking_seat      ON booking (flight_id, seat_number);
CREATE INDEX idx_baggage_flight    ON baggage (flight_id);
CREATE INDEX idx_baggage_passenger ON baggage (passenger_id);
CREATE INDEX idx_payment_status    ON payment (payment_status);
