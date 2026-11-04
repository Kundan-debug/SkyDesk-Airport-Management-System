-- SkyDesk AMS | 05_queries.sql | important queries (run by hand in MySQL Workbench / mysql client)

-- Q1 JOIN + ORDER BY (view): search flights BLR -> DEL with seat availability
SELECT flight_number, airline_name, dep_code, arr_code, scheduled_departure, seats_available, base_fare
FROM v_flight_board
WHERE dep_code = 'BLR' AND arr_code = 'DEL' AND scheduled_departure >= NOW()
ORDER BY scheduled_departure;

-- Q2 GROUP BY + SUM + HAVING: airlines with more than Rs 10,000 in paid tickets
SELECT al.airline_name, COUNT(*) AS paid_tickets, SUM(py.amount) AS revenue
FROM payment py
JOIN booking bk ON bk.booking_id = py.booking_id
JOIN flight f   ON f.flight_id   = bk.flight_id
JOIN airline al ON al.airline_id = f.airline_id
WHERE py.payment_status = 'SUCCESS'
GROUP BY al.airline_name
HAVING SUM(py.amount) > 10000
ORDER BY revenue DESC;

-- Q3 Subquery: scheduled flights that are more than half empty
SELECT flight_number, dep_code, arr_code, seats_available, total_seats
FROM v_flight_board
WHERE flight_id IN (SELECT flight_id FROM flight WHERE flight_status = 'SCHEDULED')
  AND seats_available > total_seats * 0.5
ORDER BY seats_available DESC;

-- Q4 Correlated subquery: passengers who spent more than the average paying passenger
SELECT CONCAT(p.first_name, ' ', p.last_name) AS passenger,
       (SELECT SUM(py.amount) FROM booking b JOIN payment py ON py.booking_id = b.booking_id
        WHERE b.passenger_id = p.passenger_id AND py.payment_status = 'SUCCESS') AS spent
FROM passenger p
WHERE (SELECT SUM(py.amount) FROM booking b JOIN payment py ON py.booking_id = b.booking_id
       WHERE b.passenger_id = p.passenger_id AND py.payment_status = 'SUCCESS')
    > (SELECT AVG(t.total) FROM (SELECT SUM(py.amount) AS total FROM booking b
                                 JOIN payment py ON py.booking_id = b.booking_id
                                 WHERE py.payment_status = 'SUCCESS' GROUP BY b.passenger_id) t)
ORDER BY spent DESC;

-- Q5 LEFT JOIN + aggregates: baggage per flight (flights with no bags show 0)
SELECT f.flight_number, DATE(f.scheduled_departure) AS day,
       COUNT(bg.baggage_id) AS bags, COALESCE(SUM(bg.weight), 0) AS total_kg
FROM flight f LEFT JOIN baggage bg ON bg.flight_id = f.flight_id
GROUP BY f.flight_id, f.flight_number, f.scheduled_departure
ORDER BY total_kg DESC, f.flight_number;

-- Q6 CTE + window function: busiest routes by confirmed passengers
WITH route_load AS (
  SELECT CONCAT(dep_code, '->', arr_code) AS route, COUNT(*) AS passengers
  FROM v_booking_details WHERE booking_status = 'CONFIRMED' GROUP BY route)
SELECT route, passengers, ROUND(100.0 * passengers / SUM(passengers) OVER (), 1) AS pct
FROM route_load ORDER BY passengers DESC;

-- Q7 Full-text search over airports (uses the FULLTEXT index ft_airport)
SELECT airport_code, airport_name, city,
       MATCH(airport_name, city) AGAINST ('bengaluru' IN NATURAL LANGUAGE MODE) AS relevance
FROM airport
WHERE MATCH(airport_name, city) AGAINST ('bengaluru' IN NATURAL LANGUAGE MODE);

-- Q8 Views
SELECT * FROM v_dashboard_kpis;
SELECT * FROM v_airline_performance ORDER BY revenue DESC;

-- Q9 Stored functions: fare for business class on flight 1, free seats on flight 1
SELECT fn_ticket_price(1, 'BUSINESS') AS business_fare, fn_available_seats(1) AS free_seats;

-- Q10 EXPLAIN: show that the composite index is used for route search
EXPLAIN SELECT * FROM flight
WHERE departure_airport_id = 1 AND arrival_airport_id = 2 AND scheduled_departure >= NOW();

-- DML demos (INSERT / UPDATE / DELETE)
-- INSERT a flight (trigger T1 checks the gate):
--   INSERT INTO flight (flight_number, airline_id, departure_airport_id, arrival_airport_id, scheduled_departure, scheduled_arrival)
--   VALUES ('AI999', 1, 1, 2, NOW() + INTERVAL 3 DAY, NOW() + INTERVAL 3 DAY + INTERVAL 3 HOUR);
-- UPDATE: delay a flight
--   UPDATE flight SET flight_status = 'DELAYED' WHERE flight_number = 'AI501' AND scheduled_departure > NOW();
-- DELETE: remove the demo flight again
--   DELETE FROM flight WHERE flight_number = 'AI999';
