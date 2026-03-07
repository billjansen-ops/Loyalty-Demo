-- Restore display_template_line to original values, then uppercase only the molecule keys
DELETE FROM display_template_line;

INSERT INTO display_template_line (line_id, template_id, line_number, template_string) VALUES
(45, 1, 10, '[T,"Carrier: "],[M,CARRIER,"Both"],[T,". Flight: "],[M,FLIGHT_NUMBER,"Code",5],[T," MQD: "],[M,MQD,"Code",8]'),
(46, 1, 20, '[T,"Origin: "],[M,ORIGIN,"Both",30],[T,"    Destination: "],[M,DESTINATION,"Both",20]'),
(47, 1, 30, '[T,"Aircraft Type: "],[M,AIRCRAFT_TYPE,"Both"],[T,"  Seat Type: "],[M,SEAT_TYPE,"Code"]'),
(6, 3, 10, '[M,REDEMPTION_TYPE,"Both"]'),
(48, 6, 10, '[M,NIGHTS,"Code"],[T," nights at "],[M,BRAND,"Code"],[T," "],[M,PROPERTY,"Description"],[T," - $"],[M,ELIGIBLE_SPEND,"Code"]'),
(49, 7, 10, '[T,"Brand: "],[M,BRAND,"Both"],[T,"    Property: "],[M,PROPERTY,"Both"]'),
(50, 7, 20, '[T,"Nights: "],[M,NIGHTS,"Code"],[T,"    Eligible Spend: $"],[M,ELIGIBLE_SPEND,"Code"]'),
(51, 7, 30, '[T,"Folio: "],[M,FOLIO,"Code"]'),
(38, 2, 10, '[T,"Carrier: "],[M,CARRIER,"Code",2],[T,"    Flight: "],[M,FLIGHT_NUMBER,"Code",5],[T,"   Class: "],[M,FARE_CLASS,"Code"],[T,"   Origin: "],[M,ORIGIN,"Code"],[T,"   Destination: "],[M,DESTINATION,"Code"],[T,"   MQD: "],[M,MQD,"Code",5]'),
(42, 4, 10, '[M,ADJUSTMENT,"Both"]'),
(43, 5, 10, '[M,ADJUSTMENT,"Both"]'),
(44, 5, 20, '[M,ACTIVITY_COMMENT,"Code"]');

-- Reset sequence
SELECT setval('display_template_line_line_id_seq', (SELECT MAX(line_id) FROM display_template_line));
