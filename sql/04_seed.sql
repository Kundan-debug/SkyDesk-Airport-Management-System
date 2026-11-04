-- =====================================================================
-- SkyDesk AMS | 04_seed.sql | sample data (MySQL 8.0.19+ for VALUES ROW)
-- User accounts are created by scripts/setup-db.mjs because passwords must be hashed (bcrypt) in code.
-- =====================================================================
INSERT INTO role (role_name, description) VALUES
 ('ADMIN','Airport staff / administrator: flight operations, baggage, analytics, all bookings'),
 ('PASSENGER','Customer: search flights, book, pay, cancel, track own baggage');

INSERT INTO airport (airport_code, airport_name, city, country) VALUES
 ('BLR','Kempegowda International Airport','Bengaluru','India'),
 ('DEL','Indira Gandhi International Airport','New Delhi','India'),
 ('BOM','Chhatrapati Shivaji Maharaj International Airport','Mumbai','India'),
 ('MAA','Chennai International Airport','Chennai','India'),
 ('HYD','Rajiv Gandhi International Airport','Hyderabad','India'),
 ('DXB','Dubai International Airport','Dubai','United Arab Emirates'),
 ('SIN','Singapore Changi Airport','Singapore','Singapore');

INSERT INTO terminal (airport_id, terminal_name)
SELECT a.airport_id, v.t
FROM (VALUES ROW('BLR','T1'), ROW('BLR','T2'), ROW('DEL','T3'), ROW('BOM','T2'),
             ROW('MAA','T1'), ROW('HYD','T1'), ROW('DXB','T3'), ROW('SIN','T1')) AS v(code, t)
JOIN airport a ON a.airport_code = v.code;

INSERT INTO gate (terminal_id, gate_number, gate_status)
SELECT t.terminal_id, v.g, v.s
FROM (VALUES ROW('BLR','T1','A1','AVAILABLE'), ROW('BLR','T1','A2','AVAILABLE'), ROW('BLR','T1','A3','AVAILABLE'),
             ROW('BLR','T1','A4','MAINTENANCE'), ROW('BLR','T2','B1','AVAILABLE'), ROW('BLR','T2','B2','AVAILABLE'),
             ROW('DEL','T3','C1','AVAILABLE'), ROW('DEL','T3','C2','AVAILABLE'), ROW('DEL','T3','C3','AVAILABLE'),
             ROW('BOM','T2','D1','AVAILABLE'), ROW('BOM','T2','D2','AVAILABLE'),
             ROW('MAA','T1','E1','AVAILABLE'), ROW('HYD','T1','F1','AVAILABLE'),
             ROW('DXB','T3','G1','AVAILABLE'), ROW('SIN','T1','H1','AVAILABLE')) AS v(code, term, g, s)
JOIN airport a  ON a.airport_code = v.code
JOIN terminal t ON t.airport_id = a.airport_id AND t.terminal_name = v.term;

INSERT INTO airline (airline_code, airline_name, country) VALUES
 ('AI','Air India','India'), ('6E','IndiGo','India'), ('QP','Akasa Air','India'),
 ('SG','SpiceJet','India'), ('EK','Emirates','United Arab Emirates'), ('SQ','Singapore Airlines','Singapore');

-- Flights. Times are minutes from today's 00:00 (session time zone is UTC), so the demo is always "live".
-- 1800 = tomorrow 06:00,  -1080 = yesterday 06:00
INSERT INTO flight (flight_number, airline_id, departure_airport_id, arrival_airport_id, gate_id,
                    scheduled_departure, scheduled_arrival, flight_status)
SELECT v.fno, al.airline_id, dp.airport_id, ar.airport_id, g.gate_id,
       DATE_ADD(CAST(CURDATE() AS DATETIME), INTERVAL v.dep_min MINUTE),
       DATE_ADD(CAST(CURDATE() AS DATETIME), INTERVAL v.dep_min + v.dur_min MINUTE),
       v.st
FROM (VALUES
  ROW('AI501', 'AI','BLR','DEL','T1','A1', 1800, 165,'SCHEDULED'),
  ROW('6E204', '6E','BLR','BOM','T1','A2', 1890, 110,'SCHEDULED'),
  ROW('QP1103','QP','BLR','HYD','T2','B1', 1980,  70,'SCHEDULED'),
  ROW('EK565', 'EK','BLR','DXB','T2','B2', 1695, 270,'SCHEDULED'),
  ROW('SQ509', 'SQ','BLR','SIN','T1','A3', 2830, 255,'SCHEDULED'),
  ROW('AI808', 'AI','DEL','BLR','T3','C1', 2520, 170,'DELAYED'),
  ROW('6E611', '6E','BOM','BLR','T2','D1', 3480, 115,'SCHEDULED'),
  ROW('SG142', 'SG','MAA','BLR','T1','E1', 2160,  65,'SCHEDULED'),
  ROW('AI302', 'AI','HYD','DEL','T1','F1', 3810, 130,'SCHEDULED'),
  ROW('EK568', 'EK','DXB','BLR','T3','G1', 3060, 220,'SCHEDULED'),
  ROW('AI501', 'AI','BLR','DEL','T1','A1',-1080, 165,'ARRIVED'),
  ROW('6E204', '6E','BLR','BOM','T1','A2', -990, 110,'ARRIVED'),
  ROW('AI808', 'AI','DEL','BLR','T3','C1', -360, 170,'ARRIVED'),
  ROW('SQ509', 'SQ','BLR','SIN','T1','A3',  -50, 255,'CANCELLED'),
  ROW('SG142', 'SG','MAA','BLR','T1','E1', -720,  65,'ARRIVED')
) AS v(fno, al, dep, arr, term, gate, dep_min, dur_min, st)
JOIN airline al ON al.airline_code = v.al
JOIN airport dp ON dp.airport_code = v.dep
JOIN airport ar ON ar.airport_code = v.arr
JOIN terminal t ON t.airport_id = dp.airport_id AND t.terminal_name = v.term
JOIN gate g     ON g.terminal_id = t.terminal_id AND g.gate_number = v.gate;

INSERT INTO employee (airport_id, first_name, last_name, role_title, department, phone, email, hire_date)
SELECT a.airport_id, v.fn, v.ln, v.title, v.dept, v.ph, v.em, CAST(v.hd AS DATE)
FROM (VALUES
 ROW('BLR','Kavita','Sharma','Airport Operations Manager','Operations','+918012345601','kavita.sharma@skydesk.example','2016-04-11'),
 ROW('BLR','Suresh','Kumar','Gate Agent','Ground Operations','+918012345602','suresh.kumar@skydesk.example','2019-08-01'),
 ROW('BLR','Divya','Menon','Baggage Supervisor','Baggage Services','+918012345603','divya.menon@skydesk.example','2018-02-19'),
 ROW('DEL','Rohit','Das','Check-in Agent','Passenger Services','+911112345604','rohit.das@skydesk.example','2021-06-07'),
 ROW('BOM','Neha','Kapoor','Customer Care Executive','Passenger Services','+912212345605','neha.kapoor@skydesk.example','2022-01-17')
) AS v(code, fn, ln, title, dept, ph, em, hd)
JOIN airport a ON a.airport_code = v.code;

INSERT INTO passenger (first_name, last_name, date_of_birth, passport_number, phone, email) VALUES
 ('Arjun','Mehta','1990-03-14','N1234567','+919800000001','arjun.mehta@example.com'),
 ('Priya','Nair','1994-11-02','P2345678','+919800000002','priya.nair@example.com'),
 ('Rahul','Verma','1985-07-21','R3456789','+919800000003','rahul.verma@example.com'),
 ('Sneha','Iyer','1992-01-30','S4567890','+919800000004','sneha.iyer@example.com'),
 ('Vikram','Singh','1979-09-09','V5678901','+919800000005','vikram.singh@example.com'),
 ('Ananya','Rao','1998-05-25','A6789012','+919800000006','ananya.rao@example.com'),
 ('Karthik','Reddy','1988-12-12','K7890123','+919800000007','karthik.reddy@example.com'),
 ('Meera','Pillai','1996-08-18','M8901234','+919800000008','meera.pillai@example.com'),
 ('Ishaan','Gupta','2001-04-04','I9012345','+919800000009','ishaan.gupta@example.com');

-- Bookings go through the stored procedure sp_book_flight (atomic booking + payment).
-- This small helper looks up ids from an e-mail and a flight number first; it is dropped afterwards.
DROP PROCEDURE IF EXISTS sp_seed_booking;
DELIMITER $$
CREATE PROCEDURE sp_seed_booking(IN p_email VARCHAR(120), IN p_flight_no VARCHAR(8), IN p_seat VARCHAR(4),
                                 IN p_class VARCHAR(10), IN p_method VARCHAR(12), IN p_paid BOOLEAN)
BEGIN
    DECLARE v_pax INT;
    DECLARE v_flight INT;
    SELECT passenger_id INTO v_pax FROM passenger WHERE email = p_email;
    SELECT flight_id INTO v_flight FROM flight WHERE flight_number = p_flight_no AND scheduled_departure > NOW() LIMIT 1;
    CALL sp_book_flight(v_pax, v_flight, p_seat, p_class, p_method, p_paid);
END$$
DELIMITER ;

CALL sp_seed_booking('arjun.mehta@example.com',  'AI501',  '12A','ECONOMY', 'UPI',         TRUE);
CALL sp_seed_booking('priya.nair@example.com',   'AI501',  '12B','ECONOMY', 'CARD',        TRUE);
CALL sp_seed_booking('rahul.verma@example.com',  '6E204',  '5C', 'ECONOMY', 'UPI',         TRUE);
CALL sp_seed_booking('sneha.iyer@example.com',   'EK565',  '3A', 'BUSINESS','CARD',        TRUE);
CALL sp_seed_booking('vikram.singh@example.com', 'EK565',  '18C','ECONOMY', 'CARD',        TRUE);
CALL sp_seed_booking('ananya.rao@example.com',   'SQ509',  '2A', 'FIRST',   'CARD',        FALSE);
CALL sp_seed_booking('karthik.reddy@example.com','6E204',  '7D', 'ECONOMY', 'WALLET',      FALSE);
CALL sp_seed_booking('meera.pillai@example.com', 'AI808',  '9F', 'ECONOMY', 'UPI',         TRUE);
CALL sp_seed_booking('ishaan.gupta@example.com', 'QP1103', '14B','ECONOMY', 'NET_BANKING', TRUE);
CALL sp_seed_booking('arjun.mehta@example.com',  '6E611',  '22A','ECONOMY', 'UPI',         TRUE);

DROP PROCEDURE sp_seed_booking;

INSERT INTO baggage (passenger_id, flight_id, weight, baggage_status)
SELECT p.passenger_id, f.flight_id, v.w, v.st
FROM (VALUES
  ROW('arjun.mehta@example.com', 'AI501', 18.5, 'CHECKED_IN'),
  ROW('priya.nair@example.com',  'AI501', 22.0, 'SECURITY_SCREENED'),
  ROW('rahul.verma@example.com', '6E204', 15.0, 'LOADED'),
  ROW('sneha.iyer@example.com',  'EK565', 28.5, 'CHECKED_IN'),
  ROW('sneha.iyer@example.com',  'EK565',  9.0, 'CHECKED_IN'),
  ROW('vikram.singh@example.com','EK565', 25.0, 'SECURITY_SCREENED')
) AS v(email, fno, w, st)
JOIN passenger p ON p.email = v.email
JOIN flight f    ON f.flight_number = v.fno AND f.scheduled_departure > NOW();
