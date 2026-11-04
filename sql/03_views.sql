-- SkyDesk AMS | 03_views.sql | MySQL

-- Departure-board view with live seat availability
CREATE OR REPLACE VIEW v_flight_board AS
SELECT f.flight_id, f.flight_number, al.airline_id, al.airline_code, al.airline_name,
       dp.airport_id AS dep_airport_id, dp.airport_code AS dep_code, dp.city AS dep_city,
       ar.airport_id AS arr_airport_id, ar.airport_code AS arr_code, ar.city AS arr_city,
       f.gate_id, t.terminal_name, g.gate_number,
       f.scheduled_departure, f.scheduled_arrival, f.flight_status,
       fn_flight_capacity()                       AS total_seats,
       fn_ticket_price(f.flight_id, 'ECONOMY')    AS base_fare,
       COALESCE(b.booked, 0)                      AS seats_booked,
       fn_flight_capacity() - COALESCE(b.booked, 0) AS seats_available
FROM flight f
JOIN airline al ON al.airline_id = f.airline_id
JOIN airport dp ON dp.airport_id = f.departure_airport_id
JOIN airport ar ON ar.airport_id = f.arrival_airport_id
LEFT JOIN gate g     ON g.gate_id = f.gate_id
LEFT JOIN terminal t ON t.terminal_id = g.terminal_id
LEFT JOIN (SELECT flight_id, COUNT(*) AS booked
           FROM booking WHERE booking_status <> 'CANCELLED' GROUP BY flight_id) b
       ON b.flight_id = f.flight_id;

-- One row per booking with passenger, flight and payment details
CREATE OR REPLACE VIEW v_booking_details AS
SELECT bk.booking_id, bk.booking_date, bk.seat_number, bk.travel_class, bk.booking_status,
       p.passenger_id, CONCAT(p.first_name, ' ', p.last_name) AS passenger_name, p.email AS passenger_email,
       fb.flight_id, fb.flight_number, fb.airline_name, fb.dep_code, fb.arr_code,
       fb.scheduled_departure, fb.flight_status, fb.terminal_name, fb.gate_number,
       py.payment_id, py.amount, py.payment_method, py.payment_status, py.transaction_reference
FROM booking bk
JOIN passenger p       ON p.passenger_id = bk.passenger_id
JOIN v_flight_board fb ON fb.flight_id   = bk.flight_id
LEFT JOIN payment py   ON py.booking_id  = bk.booking_id;

-- Baggage with owner and route
CREATE OR REPLACE VIEW v_baggage_tracking AS
SELECT bg.baggage_id, bg.baggage_tag, bg.weight, bg.baggage_status,
       bg.passenger_id, CONCAT(p.first_name, ' ', p.last_name) AS passenger_name,
       bg.flight_id, fb.flight_number, fb.dep_code, fb.arr_code, fb.scheduled_departure
FROM baggage bg
JOIN passenger p       ON p.passenger_id = bg.passenger_id
JOIN v_flight_board fb ON fb.flight_id   = bg.flight_id;

-- Revenue and load per airline (aggregation view)
CREATE OR REPLACE VIEW v_airline_performance AS
SELECT al.airline_id, al.airline_code, al.airline_name,
       COUNT(DISTINCT f.flight_id)                                                 AS flights,
       COUNT(CASE WHEN bk.booking_status = 'CONFIRMED' THEN bk.booking_id END)     AS confirmed_bookings,
       COALESCE(SUM(CASE WHEN py.payment_status = 'SUCCESS' THEN py.amount END), 0) AS revenue,
       COUNT(DISTINCT CASE WHEN f.flight_status = 'DELAYED'   THEN f.flight_id END) AS delayed_flights,
       COUNT(DISTINCT CASE WHEN f.flight_status = 'CANCELLED' THEN f.flight_id END) AS cancelled_flights
FROM airline al
LEFT JOIN flight f   ON f.airline_id = al.airline_id
LEFT JOIN booking bk ON bk.flight_id = f.flight_id
LEFT JOIN payment py ON py.booking_id = bk.booking_id
GROUP BY al.airline_id, al.airline_code, al.airline_name;

-- Single-row KPI view for the dashboard
CREATE OR REPLACE VIEW v_dashboard_kpis AS
SELECT
  (SELECT COUNT(*) FROM flight WHERE scheduled_departure >= NOW() AND flight_status NOT IN ('CANCELLED','ARRIVED')) AS upcoming_flights,
  (SELECT COUNT(*) FROM flight WHERE flight_status = 'DELAYED')                                  AS delayed_flights,
  (SELECT COUNT(*) FROM booking WHERE booking_status = 'CONFIRMED')                              AS confirmed_bookings,
  (SELECT COUNT(*) FROM booking WHERE booking_status = 'PENDING')                                AS pending_bookings,
  (SELECT COALESCE(SUM(amount), 0) FROM payment WHERE payment_status = 'SUCCESS')                AS revenue,
  (SELECT COUNT(*) FROM baggage WHERE baggage_status = 'LOST')                                   AS lost_baggage,
  (SELECT COUNT(*) FROM baggage WHERE baggage_status NOT IN ('CLAIMED','LOST'))                  AS baggage_in_system;
