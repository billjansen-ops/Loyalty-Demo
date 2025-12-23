--
-- PostgreSQL database dump
--

\restrict fRahUqYv4cNaVZLHkHkG1soIkaKGVPQPPekbfHPu3sPXFnH3g4Y7vREf3fRjChU

-- Dumped from database version 14.19 (Homebrew)
-- Dumped by pg_dump version 14.19 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: tenant; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenant (tenant_id, tenant_key, name, industry, is_active, created_at) FROM stdin;
1	delta	Delta Air Lines	airline	t	2025-10-22 21:56:17.309363-05
2	united	United Airlines	airline	t	2025-11-02 21:22:42.622005-06
3	marriott	Marriott Hotels	hotel	t	2025-11-02 21:22:42.622005-06
4	ferrari	Ferrari	automotive	t	2025-11-02 21:22:42.622005-06
\.


--
-- Data for Name: member; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member (member_id, tenant_id, fname, lname, middle_initial, address1, address2, city, state, zip, phone, email, is_active, membership_number, zip_plus4) FROM stdin;
1001	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	1001	\N
1002	1	Eva	Longoria	\N	\N	\N	\N	\N	\N	\N	\N	t	1002	\N
1003	1	Ava	Longoria	\N	\N	\N	\N	\N	\N	\N	\N	t	1003	\N
2153442807	1	William	Jansen	1	5	6	7	MN	\N	3	2	t	2153442807	\N
\.


--
-- Data for Name: point_lot; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_lot (lot_id, member_id, point_type, expire_date, accrued, redeemed, expiration_rule_id) FROM stdin;
1	1002	miles	2027-12-31	6000	0	\N
\.


--
-- Data for Name: activity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity (activity_id, member_id, activity_date, post_date, activity_type, point_amount, lot_id, mqd) FROM stdin;
1	1002	2025-11-01	2025-11-23	A	2500	1	0
2	1002	2025-11-21	2025-11-23	A	3300	1	0
\.


--
-- Data for Name: activity_bonus; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_bonus (activity_bonus_id, activity_id, bonus_id, bonus_points, created_at, lot_id) FROM stdin;
1	1	8	100	2025-11-23 05:46:08.830487-06	\N
2	2	8	100	2025-11-23 06:15:29.782157-06	\N
\.


--
-- Data for Name: molecule_def; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_def (molecule_key, label, value_kind, scalar_type, lookup_table_key, created_at, tenant_id, context, is_static, is_permanent, is_required, is_active, foreign_schema, description, display_order, updated_at, molecule_id, sample_code, sample_description, decimal_places, ref_table_name, ref_field_name, ref_function_name, parent_molecule_key, parent_fk_field) FROM stdin;
currency_label_singular	Currency Label (Singular)	scalar	text	\N	2025-11-03 23:30:34.974851	1	tenant	t	t	f	t	\N	Singular form of points/miles (e.g., "mile", "point")	0	2025-11-03 23:30:34.974851	6	\N	\N	0	\N	\N	\N	\N	\N
last_member_number	Last Member Number	scalar	numeric	\N	2025-11-03 23:30:34.983988	1	tenant	t	t	f	t	\N	Counter for generating new member numbers	0	2025-11-03 23:30:34.983988	10	\N	\N	0	\N	\N	\N	\N	\N
flight_number	Flight Number	scalar	numeric	\N	2025-11-02 14:59:06.943288	1	activity	f	t	f	t	\N	Flight number	0	2025-11-03 23:30:14.497538	5	1	2	0	\N	\N	\N	\N	\N
sysparm	System Parameters	embedded_list	\N	\N	2025-11-08 12:42:00.302382	1	system	f	f	f	t	\N	\N	0	2025-11-08 12:42:00.302382	16	\N	\N	0	\N	\N	\N	\N	\N
retro_days_allowed	Retroactive Days Allowed	scalar	numeric	\N	2025-11-03 23:30:34.981322	1	program	t	f	f	f	\N	Number of days back activities can be entered	0	2025-11-19 20:49:13.235187	8			0	\N	\N	\N	\N	\N
activity_display	Activity Display Config	embedded_list	\N	\N	2025-11-10 13:45:30.507304	1	activity	f	f	f	t	\N	\N	0	2025-11-10 13:45:30.507304	20	\N	\N	0	\N	\N	\N	\N	\N
max_tier_qualification_days	Max Tier Qualification Days	scalar	numeric	\N	2025-11-03 23:30:34.983221	1	tenant	t	f	f	f	\N	Maximum days to qualify for tier status	0	2025-11-19 20:49:13.240612	9	\N	\N	0	\N	\N	\N	\N	\N
Bill	Bills stuff to remember	list	\N	\N	2025-11-10 14:50:52.144009	1	tenant	f	f	f	t	\N	This is my area to keep stuff	0	2025-11-10 14:50:52.144009	22			0	\N	\N	\N	\N	\N
currency_label	Currency Label 	scalar	text	\N	2025-11-03 23:30:34.980451	1	tenant	t	t	f	t	\N	Label used in Platform 	0	2025-11-03 23:30:34.980451	7			0	\N	\N	\N	\N	\N
member_promotion	Member Promotion Enrollment	lookup	\N	member_promotion	2025-11-23 04:52:31.714682	1	activity	f	f	f	t	\N	Link to specific member promotion enrollment that spawned reward	100	2025-11-23 04:52:31.714682	33	\N	\N	0	\N	\N	\N	\N	\N
promotion	Promotion	lookup	\N	promotion	2025-11-23 04:52:31.720575	1	activity	f	f	f	t	\N	Link to promotion rule for code and description	101	2025-11-23 04:52:31.720575	34	\N	\N	0	\N	\N	\N	\N	\N
origin	Origin	lookup	\N	airport	2025-11-02 14:34:58.060642	1	activity	f	t	f	t	\N	Origin airport code	0	2025-11-03 23:30:14.497538	3	MSP	Minneapolis sample	0	\N	\N	\N	\N	\N
fare_class	Fare Class	list	string	\N	2025-11-02 14:59:06.942022	1	activity	f	t	f	t	\N	Flight cabin class of service	0	2025-11-03 23:30:14.497538	4	F	First Class	0	\N	\N	\N	\N	\N
redemption_type	Redemption Type	lookup	\N	\N	2025-11-10 14:24:46.675076	1	activity	f	f	f	t	\N		0	2025-11-10 14:24:46.675076	21	RDM3333	Redemption Sample	0	\N	\N	\N	\N	\N
color	color test	scalar	text	\N	2025-11-05 14:46:38.056564	1	activity	f	f	f	t	\N	testing	2	2025-11-05 14:46:38.056564	11	\N	\N	0	\N	\N	\N	\N	\N
activity_type	Activity Type	list	\N	\N	2025-11-05 22:10:00.494317	1	system	t	t	t	t	\N	Type of activity: Base (core business), Partner (non-core), Adjustment (manual), or Redemption (spend)	1	2025-11-05 22:10:00.494317	12	\N	\N	0	\N	\N	\N	\N	\N
activity_type_label	What accrual Stuff is Called	scalar	text	\N	2025-11-06 13:56:39.020923	1	tenant	t	f	t	t	\N	Core unit - Airline = Flight, etc	0	2025-11-06 13:56:39.020923	13			0	\N	\N	\N	\N	\N
error_messages	Error Messages	list	\N	\N	2025-11-06 17:01:23.080662	1	system	f	f	f	t	\N	System error messages	1	2025-11-06 17:01:23.080662	14			0	\N	\N	\N	\N	\N
tier	Member Tier	lookup	\N	tier_definition	2025-11-11 21:29:07.857256	1	member	f	f	f	t	\N	Member tier level (Basic, Silver, Gold, Platinum)	100	2025-11-11 21:29:07.857256	23	\N	\N	0	\N	\N	\N	\N	\N
carrier	Carrier Code	lookup	\N	carriers	2025-11-02 11:30:31.882012	1	activity	f	t	f	t	\N	Airline carrier code	0	2025-11-03 23:30:14.497538	1	NW	Red Tail Airline	0	\N	\N	\N	\N	\N
destination	Destination	lookup	\N	airport	2025-11-02 11:50:00.068044	1	activity	f	t	f	t	\N	Destination airport code	0	2025-11-03 23:30:14.497538	2	MSP	Minneapolis- test	0	\N	\N	\N	\N	\N
member_fname	Member First Name	reference	\N	\N	2025-11-13 22:14:50.585467	1	member	f	f	f	t	\N	Member First Name Reference	0	2025-11-13 22:14:50.585467	24	\N	\N	0	member	fname	\N	\N	\N
member_tier_on_date	Member Tier (on date)	reference	\N	\N	2025-11-14 15:28:49.015323	1	member	f	f	f	t	\N	\N	0	2025-11-14 15:28:49.015323	26	\N	\N	0	\N	\N	get_member_tier_on_date	\N	\N
state	State/Province	list	\N	\N	2025-11-15 10:08:53.135583	1	tenant	f	f	f	t	\N	US states and territories	0	2025-11-15 10:08:53.135583	27	\N	\N	0	\N	\N	\N	\N	\N
member_state	Member State	reference	\N	\N	2025-11-16 00:17:27.344434	1	member	f	f	f	t	\N	Member State for Bonus / Promotion Rules	0	2025-11-16 00:17:27.344434	29	\N	\N	0	member	state	\N	\N	\N
partner	Partner	lookup	\N	partner	2025-11-17 20:42:20.404696	1	program	f	f	f	t	\N	Earning partner for non-core activities (car rental, hotels, credit cards)	50	2025-11-17 20:42:20.404696	30	\N	\N	0	\N	\N	\N	\N	\N
partner_program	Partner Program	lookup	\N	partner_program	2025-11-17 20:42:20.404696	1	program	f	f	f	t	\N	Specific earning program within a partner (e.g., Hertz Luxury Cars, Marriott Gold)	51	2025-11-17 20:42:20.404696	31	\N	\N	0	\N	\N	\N	partner	partner_id
adjustment	Adjustment	lookup	\N	adjustment	2025-11-18 03:53:51.545845	1	program	f	f	f	t	\N	Manual point adjustment for customer service and corrections	52	2025-11-18 03:53:51.545845	32	\N	\N	0	\N	\N	\N	\N	\N
\.


--
-- Data for Name: activity_detail; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_detail (activity_id, molecule_id, v_ref_id) FROM stdin;
1	1	2
1	3	1
1	2	2
1	4	9
1	5	887
2	1	2
2	3	11
2	2	2
2	4	9
2	5	332
\.


--
-- Data for Name: adjustment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.adjustment (adjustment_id, tenant_id, adjustment_code, adjustment_name, adjustment_type, fixed_points, is_active) FROM stdin;
1	1	CS-500	Customer Service Credit - 500	F	500	t
2	1	CS-1000	Customer Service Credit - 1000	F	1000	t
3	1	CS-2500	Customer Service Credit - 2500	F	2500	t
4	1	CS-VAR	Customer Service Credit - Variable	V	\N	t
5	1	PROMO	Promotional Credit	V	\N	t
6	1	CORRECT	Points Correction	V	\N	t
7	1	GOODWILL	Goodwill Gesture - 1000	F	1000	t
\.


--
-- Data for Name: airports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.airports (airport_id, code, name, city, country, is_active, created_at, updated_at) FROM stdin;
1	MSP	Minneapolis-St. Paul International Airport	Minneapolis	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
2	BOS	Boston Logan International Airport	Boston	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
3	DEN	Denver International Airport	Denver	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
4	LGA	LaGuardia Airport	New York	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
5	ATL	Hartsfield-Jackson Atlanta International Airport	Atlanta	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
6	ORD	O'Hare International Airport	Chicago	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
7	LAX	Los Angeles International Airport	Los Angeles	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
8	SFO	San Francisco International Airport	San Francisco	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
9	JFK	John F. Kennedy International Airport	New York	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
10	SEA	Seattle-Tacoma International Airport	Seattle	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
11	MIA	Miami International Airport	Miami	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
12	PHX	Phoenix Sky Harbor International Airport	Phoenix	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
13	DFW	Dallas/Fort Worth International Airport	Dallas	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
14	IAH	George Bush Intercontinental Airport	Houston	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
15	LAS	Harry Reid International Airport	Las Vegas	USA	t	2025-11-01 12:54:55.983956	2025-11-01 12:54:55.983956
\.


--
-- Data for Name: rule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rule (rule_id, created_at, updated_at) FROM stdin;
1	2025-11-02 10:46:14.833337	2025-11-02 10:46:14.833337
2	2025-11-04 15:06:15.283913	2025-11-04 15:06:15.283913
3	2025-11-06 21:26:35.315738	2025-11-06 21:26:35.315738
\.


--
-- Data for Name: tier_definition; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tier_definition (tier_id, tier_code, tier_description, tier_ranking, is_active, created_at, updated_at, tenant_id) FROM stdin;
1	B	Basic	1	t	2025-10-30 21:20:37.280205	2025-10-30 21:20:37.280205	1
2	S	Silver	3	t	2025-10-30 21:20:37.280205	2025-10-30 21:20:37.280205	1
3	G	Gold	5	t	2025-10-30 21:20:37.280205	2025-10-30 21:20:37.280205	1
4	P	Platinum	7	t	2025-10-30 21:20:37.280205	2025-10-30 21:20:37.280205	1
\.


--
-- Data for Name: bonus; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bonus (bonus_id, bonus_code, bonus_description, start_date, end_date, is_active, bonus_type, bonus_amount, created_at, updated_at, rule_id, tenant_id, apply_sunday, apply_monday, apply_tuesday, apply_wednesday, apply_thursday, apply_friday, apply_saturday, required_tier_id) FROM stdin;
10	MAR	Marriott Bonus 1	2025-01-01	0025-12-31	t	fixed	100	2025-11-03 08:54:23.352962	2025-11-03 08:54:23.352962	\N	3	t	t	t	t	t	t	t	\N
6	BILLSTEST	bills test bonus	2025-01-01	2025-12-30	t	fixed	200	2025-11-01 14:48:53.752797	2025-11-16 00:39:00.194514	1	1	t	t	t	t	t	t	t	\N
8	TEST2	First Class Test	2024-12-31	2025-12-30	t	fixed	100	2025-11-03 07:45:24.684836	2025-11-22 05:51:39.930617	3	1	t	t	t	t	t	t	t	\N
\.


--
-- Data for Name: carriers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.carriers (carrier_id, code, name, alliance, country, is_active, created_at, updated_at, tenant_id) FROM stdin;
1	BJ	Blue Jets Airways	\N	USA	t	2025-11-01 12:54:55.991069	2025-11-01 12:54:55.991069	1
2	DL	Delta Air Lines	SkyTeam	USA	t	2025-11-01 12:54:55.991069	2025-11-01 12:54:55.991069	1
3	AA	American Airlines	Oneworld	USA	t	2025-11-01 12:54:55.991069	2025-11-01 12:54:55.991069	1
4	UA	United Airlines	Star Alliance	USA	t	2025-11-01 12:54:55.991069	2025-11-01 12:54:55.991069	1
5	WN	Southwest Airlines	\N	USA	t	2025-11-01 12:54:55.991069	2025-11-01 12:54:55.991069	1
6	B6	JetBlue Airways	\N	USA	t	2025-11-01 12:54:55.991069	2025-11-01 12:54:55.991069	1
7	AS	Alaska Airlines	Oneworld	USA	t	2025-11-01 12:54:55.991069	2025-11-01 12:54:55.991069	1
8	NK	Spirit Airlines	\N	USA	t	2025-11-01 12:54:55.991069	2025-11-01 12:54:55.991069	1
9	F9	Frontier Airlines	\N	USA	t	2025-11-01 12:54:55.991069	2025-11-01 12:54:55.991069	1
10	G4	Allegiant Air	\N	USA	t	2025-11-01 12:54:55.991069	2025-11-01 12:54:55.991069	1
\.


--
-- Data for Name: display_template; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.display_template (template_id, tenant_id, template_name, template_type, is_active, created_at, updated_at, activity_type) FROM stdin;
1	1	Default Verbose	V	t	2025-11-07 11:36:41.997258	2025-11-07 11:36:41.997258	A
3	1	Redemption Default Efficient	E	t	2025-11-11 00:26:46.749921	2025-11-11 00:26:46.749921	R
2	1	Default Efficient	E	t	2025-11-07 11:36:41.999208	2025-11-07 11:36:41.999208	A
\.


--
-- Data for Name: display_template_line; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.display_template_line (line_id, template_id, line_number, template_string) FROM stdin;
1	1	10	[M,origin,"Code"],[T," to "],[M,destination,"Code"]
2	1	20	[M,carrier,"Description",20],[T," • "],[M,flight_number,"Code"]
3	1	30	[M,fare_class,"Description"]
6	3	10	[M,redemption_type,"Both"]
11	2	10	[T,"Carrier: "],[M,carrier,"Code",2],[T,"            Flight: "],[M,flight_number,"Code",5],[T,"   Class: "],[M,fare_class,"Code"],[T,"   Origin: "],[M,origin,"Code"],[T,"   Destination: "],[M,destination,"Code"],[T," • "],[M,carrier,"Code"],[T," • "]
\.


--
-- Data for Name: promotion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotion (promotion_id, tenant_id, promotion_code, promotion_name, promotion_description, start_date, end_date, is_active, enrollment_type, allow_member_enrollment, rule_id, count_type, goal_amount, reward_type, reward_amount, reward_tier_id, reward_promotion_id, process_limit_count, duration_type, duration_end_date, duration_days) FROM stdin;
1	1	FLY3-5K	Fly 3 Flights, Get 5,000 Miles	Take 3 qualifying flights and receive a bonus of 5,000 miles	2025-01-01	2025-12-31	t	A	f	\N	flights	3	points	5000	\N	\N	\N	\N	\N	\N
2	1	SILVER-20K	Silver Tier - 20K Miles	Earn 20,000 miles to achieve Silver tier status	2025-01-01	2025-12-31	t	A	f	\N	miles	20000	tier	\N	2	\N	1	calendar	2025-12-31	\N
3	1	VIP-DIAMOND	VIP Diamond Winback	Exclusive offer: Take one flight to reclaim Diamond status	2025-11-01	2025-12-31	t	R	f	\N	flights	1	tier	\N	4	\N	1	calendar	2026-01-31	\N
\.


--
-- Data for Name: member_promotion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_promotion (member_promotion_id, member_id, promotion_id, tenant_id, enrolled_date, qualify_date, process_date, progress_counter, enrolled_by_user_id, qualified_by_user_id, goal_amount, qualified_by_promotion_id) FROM stdin;
1	1002	1	1	2025-11-23	\N	\N	2	\N	\N	3	\N
2	1002	2	1	2025-11-23	\N	\N	5800	\N	\N	20000	\N
\.


--
-- Data for Name: member_promotion_detail; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_promotion_detail (detail_id, member_promotion_id, activity_id, contribution_amount, enrolled_member_id) FROM stdin;
1	1	1	1	\N
2	2	1	2500	\N
3	1	2	1	\N
4	2	2	3300	\N
\.


--
-- Data for Name: member_tier; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_tier (member_tier_id, member_id, tier_id, start_date, end_date) FROM stdin;
4	2153442807	4	2025-09-01	2025-12-31
1	2153442807	3	2024-07-01	2025-12-31
5	2153442807	2	2025-04-01	2025-12-31
6	2153442807	1	2025-01-01	2025-12-31
\.


--
-- Data for Name: molecule_text_pool; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_text_pool (text_id, text_value, usage_count, first_used) FROM stdin;
\.


--
-- Data for Name: molecule_value_boolean; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_boolean (value_id, molecule_id, bool_value, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: molecule_value_date; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_date (value_id, molecule_id, date_value, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: molecule_value_embedded_list; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_embedded_list (embedded_value_id, molecule_id, tenant_id, category, code, description, sort_order, is_active, created_at, updated_at) FROM stdin;
1	16	1	redemption_type	F	Fixed Point Redemption	10	t	2025-11-08 12:39:02.021263	2025-11-08 12:39:02.021263
2	16	1	redemption_type	V	Variable Point Redemption	20	t	2025-11-08 12:39:02.021263	2025-11-08 12:39:02.021263
3	16	1	activity_type	A	Base Activity	10	t	2025-11-08 12:39:02.021263	2025-11-08 12:39:02.021263
4	16	1	activity_type	P	Partner Activity	20	t	2025-11-08 12:39:02.021263	2025-11-08 12:39:02.021263
5	16	1	activity_type	R	Redemption	30	t	2025-11-08 12:39:02.021263	2025-11-08 12:39:02.021263
6	16	1	activity_type	X	Adjustment	40	t	2025-11-08 12:39:02.021263	2025-11-08 12:39:02.021263
7	16	1	redemption_status	A	Active	10	t	2025-11-08 12:39:02.021263	2025-11-08 12:39:02.021263
8	16	1	redemption_status	I	Inactive	20	t	2025-11-08 12:39:02.021263	2025-11-08 12:39:02.021263
9	16	1	molecule_types	scalar-text	Single Value - Text	10	t	2025-11-08 14:16:43.48114	2025-11-08 14:16:43.48114
10	16	1	molecule_types	scalar-numeric	Single Value - Numeric	20	t	2025-11-08 14:16:43.48114	2025-11-08 14:16:43.48114
11	16	1	molecule_types	scalar-date	Single Value - Date	30	t	2025-11-08 14:16:43.48114	2025-11-08 14:16:43.48114
12	16	1	molecule_types	scalar-boolean	Single Value - Boolean	40	t	2025-11-08 14:16:43.48114	2025-11-08 14:16:43.48114
13	16	1	molecule_types	list	List	50	t	2025-11-08 14:16:43.48114	2025-11-08 14:16:43.48114
14	16	1	molecule_types	embedded_list	Embedded List (Categorized)	60	t	2025-11-08 14:16:43.48114	2025-11-08 14:16:43.48114
15	16	1	molecule_types	lookup	Lookup	70	t	2025-11-08 14:16:43.48114	2025-11-08 14:16:43.48114
16	16	1	redemption_status	b	billy	10	t	2025-11-08 20:52:57.034566	2025-11-08 20:52:57.034566
19	20	1	A	icon	✈️	1	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
20	20	1	A	color	#059669	2	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
21	20	1	A	bg_color	#f0fdf4	3	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
22	20	1	A	border_color	#059669	4	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
23	20	1	A	show_bonuses	true	5	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
24	20	1	A	action_verb	Added	6	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
25	20	1	R	label	Redemption	1	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
26	20	1	R	icon	🎁	2	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
27	20	1	R	color	#dc2626	3	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
28	20	1	R	bg_color	#fee2e2	4	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
29	20	1	R	border_color	#dc2626	5	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
30	20	1	R	show_bonuses	false	6	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
31	20	1	R	action_verb	Redeemed	7	t	2025-11-10 13:45:30.509432	2025-11-10 13:45:30.509432
33	20	1	P	label	Partner	1	t	2025-11-16 01:25:47.95968	2025-11-16 01:25:47.95968
34	20	1	P	icon	🤝	2	t	2025-11-16 01:25:47.96434	2025-11-16 01:25:47.96434
35	20	1	P	color	#0891b2	3	t	2025-11-16 01:25:47.964891	2025-11-16 01:25:47.964891
36	20	1	P	bg_color	#ecfeff	4	t	2025-11-16 01:25:47.965377	2025-11-16 01:25:47.965377
37	20	1	P	border_color	#0891b2	5	t	2025-11-16 01:25:47.965828	2025-11-16 01:25:47.965828
38	20	1	P	show_bonuses	false	6	t	2025-11-16 01:25:47.966663	2025-11-16 01:25:47.966663
39	20	1	P	action_verb	Added	7	t	2025-11-16 01:25:47.967006	2025-11-16 01:25:47.967006
40	20	1	J	label	Adjustment	1	t	2025-11-16 18:19:05.710795	2025-11-16 18:19:05.710795
41	20	1	J	icon	⚖️	2	t	2025-11-16 18:19:05.736327	2025-11-16 18:19:05.736327
42	20	1	J	color	#7c3aed	3	t	2025-11-16 18:19:05.737008	2025-11-16 18:19:05.737008
43	20	1	J	bg_color	#faf5ff	4	t	2025-11-16 18:19:05.737505	2025-11-16 18:19:05.737505
44	20	1	J	border_color	#7c3aed	5	t	2025-11-16 18:19:05.73796	2025-11-16 18:19:05.73796
45	20	1	J	show_bonuses	false	6	t	2025-11-16 18:19:05.738432	2025-11-16 18:19:05.738432
46	20	1	J	action_verb	Adjusted	7	t	2025-11-16 18:19:05.738884	2025-11-16 18:19:05.738884
47	20	1	M	label	Promotion	1	t	2025-11-18 10:24:41.091992	2025-11-18 10:24:41.091992
48	20	1	M	icon	🎯	2	t	2025-11-18 10:24:41.094834	2025-11-18 10:24:41.094834
49	20	1	M	color	#f59e0b	3	t	2025-11-18 10:24:41.095025	2025-11-18 10:24:41.095025
50	20	1	M	bg_color	#fef3c7	4	t	2025-11-18 10:24:41.095209	2025-11-18 10:24:41.095209
51	20	1	M	border_color	#f59e0b	5	t	2025-11-18 10:24:41.095442	2025-11-18 10:24:41.095442
52	20	1	M	show_bonuses	false	6	t	2025-11-18 10:24:41.095635	2025-11-18 10:24:41.095635
53	20	1	M	action_verb	Awarded	7	t	2025-11-18 10:24:41.095814	2025-11-18 10:24:41.095814
55	16	1	retro	days_allowed	90	20	t	2025-11-19 20:45:01.338872	2025-11-19 20:45:01.338872
56	16	1	tier	max_qualification_days	365	30	t	2025-11-19 20:45:01.339529	2025-11-19 20:45:01.339529
54	16	1	debug	enabled	Y	10	t	2025-11-19 20:45:01.328148	2025-11-19 21:13:50.147998
\.


--
-- Data for Name: molecule_value_lookup; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_lookup (lookup_id, molecule_id, table_name, id_column, code_column, label_column, maintenance_page, maintenance_description, created_at, updated_at, is_tenant_specific) FROM stdin;
1	1	carriers	carrier_id	code	name	admin_carriers.html	Carrier values are maintained in the <a href="admin_carriers.html">Carrier Management</a> page.	2025-11-04 16:37:45.988289	2025-11-07 14:27:08.341742	t
3	2	airports	airport_id	code	name	admin_airports.html	Airport values are maintained in the <a href="admin_airports.html">Airport Management</a> page.	2025-11-04 17:07:44.06634	2025-11-07 17:05:31.328398	f
2	3	airports	airport_id	code	name	admin_airports.html	Airport values are maintained in the <a href="admin_airports.html">Airport Management</a> page.	2025-11-04 17:07:44.061786	2025-11-10 22:59:54.160518	f
4	21	redemption_rule	redemption_id	redemption_code	redemption_description	\N	\N	2025-11-10 14:24:46.678375	2025-11-10 23:51:52.274755	t
5	23	tier_definition	tier_id	tier_code	tier_description	\N	\N	2025-11-11 21:50:39.223922	2025-11-11 21:50:39.223922	t
6	23	tier_definition	tier_id	tier_code	tier_description	\N	\N	2025-11-11 21:51:17.000318	2025-11-11 21:51:17.000318	t
7	30	partner	partner_id	partner_code	partner_name	\N	\N	2025-11-18 02:11:27.091777	2025-11-18 02:11:27.091777	t
8	31	partner_program	program_id	program_code	program_name	\N	\N	2025-11-18 02:11:27.091777	2025-11-18 02:11:27.091777	t
9	32	adjustment	adjustment_id	adjustment_code	adjustment_name	\N	\N	2025-11-18 03:53:51.545845	2025-11-18 03:53:51.545845	t
10	33	member_promotion	member_promotion_id	member_promotion_id	member_promotion_id	\N	\N	2025-11-23 04:56:33.675451	2025-11-23 04:56:33.675451	t
11	34	promotion	promotion_id	promotion_code	promotion_name	admin_promotions.html	Promotion values are maintained in the <a href="admin_promotions.html">Promotion Management</a> page.	2025-11-23 04:56:33.678872	2025-11-23 04:56:33.678872	t
\.


--
-- Data for Name: molecule_value_numeric; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_numeric (value_id, molecule_id, numeric_value, is_active, created_at, updated_at) FROM stdin;
2	9	365	t	2025-11-03 23:30:34.983597	2025-11-03 23:30:34.983597
3	10	10000	t	2025-11-03 23:30:34.984261	2025-11-03 23:30:34.984261
1	8	365	t	2025-11-03 23:30:34.98166	2025-11-03 23:30:34.98166
\.


--
-- Data for Name: molecule_value_ref; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_ref (value_id, molecule_id, ref_id, display_label, sort_order, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: molecule_value_text; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_text (value_id, molecule_id, text_value, display_label, sort_order, is_active, created_at, updated_at) FROM stdin;
5	4	Y	Economy	3	t	2025-11-03 23:30:34.984843	2025-11-03 23:30:34.984843
1	6	Kilometer	\N	0	t	2025-11-03 23:30:34.978117	2025-11-03 23:30:34.978117
6	1	AA	American Airlines	1	t	2025-11-04 16:06:18.474302	2025-11-04 16:06:18.474302
7	1	DL	Delta Air Lines	2	t	2025-11-04 16:06:31.511816	2025-11-04 16:06:31.511816
8	1	UA	United Airlines	3	t	2025-11-04 16:06:51.810071	2025-11-04 16:06:51.810071
9	4	F	First Class	1	t	2025-11-04 21:46:54.574391	2025-11-04 21:46:54.574391
10	4	c	Business Class	4	t	2025-11-04 21:47:39.155417	2025-11-04 21:47:39.155417
12	12	P	Partner Activity - Non-core partner transactions	2	t	2025-11-05 22:12:23.705763	2025-11-05 22:12:23.705763
14	12	R	Redemption - Member spending points for awards	4	t	2025-11-05 22:12:23.705763	2025-11-05 22:12:23.705763
13	12	M	Adjustment - Manual corrections by CSR	3	t	2025-11-05 22:12:23.705763	2025-11-05 22:12:23.705763
11	12	A	Base Activity - Core business transactions	1	t	2025-11-05 22:12:23.705763	2025-11-05 22:12:23.705763
15	13	Flight	\N	0	t	2025-11-06 13:57:01.884681	2025-11-06 13:57:01.884681
17	14	E002	Expiration Rule Not Found	2	t	2025-11-06 17:19:34.243782	2025-11-06 17:19:34.243782
16	14	E001	Activity too old	1	t	2025-11-06 17:02:38.163794	2025-11-06 17:02:38.163794
18	14	E003	Insufficient {{M,currency_label,value,,L}} for this Redemption	3	t	2025-11-09 20:50:34.973491	2025-11-09 20:50:34.973491
19	22	SQL_SAMPLE	cd ~/Projects/Loyalty-Demo && psql -h localhost -U billjansen -d loyalty -f sql/create_activity_display_molecule.sql	1	t	2025-11-10 14:53:01.412377	2025-11-10 14:53:01.412377
20	22	SERVER_START	~/Projects/Loyalty-Demo/bootstrap/start.sh	2	t	2025-11-10 14:57:10.214069	2025-11-10 14:57:10.214069
21	22	CREATE_HANDOFF	bash ~/Projects/Loyalty-Demo/bootstrap/NewChat/create_handoff_package.sh	3	t	2025-11-10 14:58:01.52401	2025-11-10 14:58:01.52401
23	22	DELETE_ALL	psql -h localhost -U billjansen -d loyalty -c "DELETE FROM redemption_detail; DELETE FROM activity_bonus; DELETE FROM activity_detail; DELETE FROM activity; DELETE FROM point_lot;"	4	t	2025-11-10 15:34:21.503481	2025-11-10 15:34:21.503481
2	7	Kilometers	\N	0	t	2025-11-03 23:30:34.980816	2025-11-03 23:30:34.980816
24	27	AL	Alabama	1	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
25	27	AK	Alaska	2	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
26	27	AZ	Arizona	3	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
27	27	AR	Arkansas	4	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
28	27	CA	California	5	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
29	27	CO	Colorado	6	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
30	27	CT	Connecticut	7	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
31	27	DE	Delaware	8	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
32	27	DC	District of Columbia	9	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
33	27	FL	Florida	10	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
34	27	GA	Georgia	11	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
35	27	HI	Hawaii	12	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
36	27	ID	Idaho	13	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
37	27	IL	Illinois	14	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
38	27	IN	Indiana	15	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
39	27	IA	Iowa	16	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
40	27	KS	Kansas	17	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
41	27	KY	Kentucky	18	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
42	27	LA	Louisiana	19	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
43	27	ME	Maine	20	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
44	27	MD	Maryland	21	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
45	27	MA	Massachusetts	22	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
46	27	MI	Michigan	23	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
47	27	MN	Minnesota	24	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
48	27	MS	Mississippi	25	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
49	27	MO	Missouri	26	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
50	27	MT	Montana	27	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
51	27	NE	Nebraska	28	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
52	27	NV	Nevada	29	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
53	27	NH	New Hampshire	30	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
54	27	NJ	New Jersey	31	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
55	27	NM	New Mexico	32	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
56	27	NY	New York	33	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
57	27	NC	North Carolina	34	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
58	27	ND	North Dakota	35	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
59	27	OH	Ohio	36	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
60	27	OK	Oklahoma	37	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
61	27	OR	Oregon	38	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
62	27	PA	Pennsylvania	39	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
63	27	RI	Rhode Island	40	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
64	27	SC	South Carolina	41	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
65	27	SD	South Dakota	42	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
66	27	TN	Tennessee	43	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
67	27	TX	Texas	44	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
68	27	UT	Utah	45	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
69	27	VT	Vermont	46	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
70	27	VA	Virginia	47	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
71	27	WA	Washington	48	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
72	27	WV	West Virginia	49	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
73	27	WI	Wisconsin	50	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
74	27	WY	Wyoming	51	t	2025-11-15 10:12:39.413371	2025-11-15 10:12:39.413371
\.


--
-- Data for Name: partner; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.partner (partner_id, tenant_id, partner_code, partner_name, is_active) FROM stdin;
1	1	HERTZ	Hertz Rent A Car	t
2	1	MARRIOTT	Marriott Hotels	t
3	1	AMEX	American Express	t
\.


--
-- Data for Name: partner_program; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.partner_program (program_id, partner_id, tenant_id, program_code, program_name, earning_type, fixed_points, is_active) FROM stdin;
1	1	1	HERTZ-LUX	Luxury Car Rental	F	500	t
2	1	1	HERTZ-ECO	Economy Car Rental	F	250	t
3	1	1	HERTZ-TRUCK	Truck Rental	F	300	t
4	2	1	MAR-GOLD	Bonvoy Gold Stays	F	1000	t
5	2	1	MAR-PLAT	Bonvoy Platinum Stays	F	1500	t
6	3	1	AMEX-PLAT	Platinum Card Spend	V	\N	t
7	3	1	AMEX-GOLD	Gold Card Spend	V	\N	t
\.


--
-- Data for Name: point_expiration_rule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_expiration_rule (rule_key, start_date, end_date, expiration_date, description) FROM stdin;
R2024	2024-01-01	2024-12-31	2026-12-31	\N
R2025	2025-01-01	2025-12-31	2027-12-31	\N
2023_RULE	2023-01-01	2023-12-31	2024-12-31	\N
2024_RULE	2024-01-01	2024-12-31	2025-12-31	\N
2025_RULE	2025-01-01	2025-12-31	2026-12-31	\N
2026_RULE	2026-01-01	2026-12-31	2027-12-31	\N
\.


--
-- Data for Name: point_type; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_type (tenant_id, point_type, name, expires_days, is_active) FROM stdin;
1	B	Base Miles	365	t
\.


--
-- Data for Name: redemption_detail; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.redemption_detail (redemption_detail_id, activity_id, lot_id, points_used, created_at) FROM stdin;
\.


--
-- Data for Name: redemption_rule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.redemption_rule (redemption_id, tenant_id, redemption_code, redemption_description, status, start_date, end_date, redemption_type, points_required, created_at, updated_at) FROM stdin;
1	1	RED10K	10 K test	A	2025-01-01	2025-12-31	F	10000	2025-11-08 21:27:05.993074	2025-11-08 21:27:05.993074
\.


--
-- Data for Name: rule_criteria; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rule_criteria (criteria_id, rule_id, molecule_key, operator, value, label, joiner, sort_order, created_at) FROM stdin;
5	2	carrier	equals	"DL"	Delta test	\N	1	2025-11-04 15:06:15.288026
2	1	destination	equals	"BOS"	Fly into Boston	AND	2	2025-11-02 11:50:00.073716
11	1	member_state	equals	"MN"	Lives in Minnesota	\N	3	2025-11-16 00:18:32.877367
8	3	fare_class	equals	"F"	Fly First	\N	1	2025-11-11 16:08:51.176539
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settings (key, value) FROM stdin;
company_name	Delta
program_name	SkyMiles
unit_label	Kiicks
\.


--
-- Data for Name: x_tenant_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.x_tenant_settings (tenant_id, display_unit_singular, display_unit_plural, airline_fields, updated_at) FROM stdin;
1	mile	miles	{"origin": true, "fare_class": true, "destination": true, "carrier_code": true}	2025-10-22 21:56:17.309363-05
\.


--
-- Data for Name: x_tenant_terms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.x_tenant_terms (tenant_id, term_key, term_value) FROM stdin;
1	points_label	Miles
1	tier_label	Medallion Status
1	status_label	Elite Status
\.


--
-- Data for Name: activity_attr; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.activity_attr (activity_id, key, value_text, updated_at) FROM stdin;
\.


--
-- Data for Name: airports; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.airports (iata, icao, name, city, country, lat, lon, tz, is_active, updated_at) FROM stdin;
MSP	KMSP	Minneapolis–Saint Paul Intl	Minneapolis	US	44.881900	-93.221800	America/Chicago	t	2025-10-23 10:10:45.180028-05
LGA	KLGA	LaGuardia	New York	US	40.776900	-73.874000	America/New_York	t	2025-10-23 10:10:45.180028-05
ATL	KATL	Hartsfield–Jackson Atlanta Intl	Atlanta	US	33.640700	-84.427700	America/New_York	t	2025-10-23 10:10:45.180028-05
SEA	KSEA	Seattle–Tacoma Intl	Seattle	US	47.450200	-122.308800	America/Los_Angeles	t	2025-10-23 10:10:45.180028-05
LAX	KLAX	Los Angeles Intl	Los Angeles	US	33.941600	-118.408500	America/Los_Angeles	t	2025-10-23 10:10:45.180028-05
\.


--
-- Data for Name: airports_stage; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.airports_stage (iata, icao, name, city, country, lat, lon, tz, is_active) FROM stdin;
\.


--
-- Data for Name: attr_def; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.attr_def (attr_id, target, key, data_type, required, min_value, max_value, regex, enum_values, unit, updated_at) FROM stdin;
\.


--
-- Data for Name: carriers; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.carriers (code, name, alliance, country, is_active, updated_at) FROM stdin;
DL	Delta Air Lines	SkyTeam	US	t	2025-10-23 10:10:45.180028-05
AA	American Airlines	oneworld	US	t	2025-10-23 10:10:45.180028-05
UA	United Airlines	Star Alliance	US	t	2025-10-23 10:10:45.180028-05
BJ	Bills airline	Sky	YS	t	2025-10-23 12:05:19.401053-05
\.


--
-- Data for Name: extensions_hooks; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.extensions_hooks (name, enabled, handler_type, handler_target, last_success_at, last_error_at, notes) FROM stdin;
before_rule_eval	f	webhook	\N	\N	\N	Last-minute payload tweak before rule engine evaluates
after_reward_issue	f	webhook	\N	\N	\N	Notify downstream after reward issuance
modify_distance	t	webhook	https://your-webhook-endpoint.example/echo	\N	\N	Adjust computed distance if needed (e.g., +6% for specific tenant)
\.


--
-- Data for Name: label_map; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.label_map (context, field_id, label, aliases, help_text, updated_at) FROM stdin;
activity	origin_airport_code	Origin	["From", "Departure Airport"]	\N	2025-10-23 10:10:45.180028-05
activity	destination_airport_code	Destination	["To", "Arrival Airport"]	\N	2025-10-23 10:10:45.180028-05
\.


--
-- Data for Name: member_attr; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.member_attr (member_id, key, value_text, updated_at) FROM stdin;
\.


--
-- Data for Name: theme; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.theme (theme_id, tokens, assets, updated_at) FROM stdin;
1	{"bg": "#FFFFFF", "text": "#111111", "brand": "#0B5FFF", "error": "#EF4444", "muted": "#6B7280", "radius": "10px", "density": "comfy", "success": "#10B981", "surface": "#F7F7F8", "warning": "#F59E0B", "fontFamily": "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif", "brandContrast": "#FFFFFF"}	{"logoUrl": "/assets/tenants/default-logo.png", "faviconUrl": "/assets/tenants/default-favicon.ico"}	2025-10-23 10:21:19.589589-05
\.


--
-- Data for Name: tier_levels; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.tier_levels (tier_code, name, rank_order, is_active, updated_at) FROM stdin;
BRONZE	Bronze	1	t	2025-10-23 10:10:45.180028-05
SILVER	Silver	2	t	2025-10-23 10:10:45.180028-05
GOLD	Gold	3	t	2025-10-23 10:10:45.180028-05
PLATINUM	Platinum	4	t	2025-10-23 10:10:45.180028-05
Green	Green tier	11	t	2025-10-23 12:07:15.137404-05
\.


--
-- Data for Name: activity_attr; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.activity_attr (activity_id, key, value_text, updated_at) FROM stdin;
\.


--
-- Data for Name: airports; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.airports (iata, icao, name, city, country, lat, lon, tz, is_active, updated_at) FROM stdin;
MSP	KMSP	Minneapolis–Saint Paul Intl	Minneapolis	US	44.881900	-93.221800	America/Chicago	t	2025-10-28 15:06:02.957223-05
LGA	KLGA	LaGuardia	New York	US	40.776900	-73.874000	America/New_York	t	2025-10-28 15:06:02.957223-05
ATL	KATL	Hartsfield–Jackson Atlanta Intl	Atlanta	US	33.640700	-84.427700	America/New_York	t	2025-10-28 15:06:02.957223-05
SEA	KSEA	Seattle–Tacoma Intl	Seattle	US	47.450200	-122.308800	America/Los_Angeles	t	2025-10-28 15:06:02.957223-05
LAX	KLAX	Los Angeles Intl	Los Angeles	US	33.941600	-118.408500	America/Los_Angeles	t	2025-10-28 15:06:02.957223-05
\.


--
-- Data for Name: attr_def; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.attr_def (attr_id, target, key, data_type, required, min_value, max_value, regex, enum_values, unit, updated_at) FROM stdin;
\.


--
-- Data for Name: carriers; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.carriers (code, name, alliance, country, is_active, updated_at) FROM stdin;
DL	Delta Air Lines	SkyTeam	US	t	2025-10-28 15:06:02.957223-05
AA	American Airlines	oneworld	US	t	2025-10-28 15:06:02.957223-05
UA	United Airlines	Star Alliance	US	t	2025-10-28 15:06:02.957223-05
\.


--
-- Data for Name: extensions_hooks; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.extensions_hooks (name, enabled, handler_type, handler_target, last_success_at, last_error_at, notes) FROM stdin;
\.


--
-- Data for Name: label_map; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.label_map (context, field_id, label, aliases, help_text, updated_at) FROM stdin;
activity	origin_airport_code	Origin	["From", "Departure Airport"]	\N	2025-10-28 15:06:02.957223-05
activity	destination_airport_code	Destination	["To", "Arrival Airport"]	\N	2025-10-28 15:06:02.957223-05
\.


--
-- Data for Name: member_attr; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.member_attr (member_id, key, value_text, updated_at) FROM stdin;
\.


--
-- Data for Name: theme; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.theme (theme_id, tokens, assets, updated_at) FROM stdin;
\.


--
-- Data for Name: tier_levels; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.tier_levels (tier_code, name, rank_order, is_active, updated_at) FROM stdin;
BRONZE	Bronze	1	t	2025-10-28 15:06:02.957223-05
SILVER	Silver	2	t	2025-10-28 15:06:02.957223-05
GOLD	Gold	3	t	2025-10-28 15:06:02.957223-05
PLATINUM	Platinum	4	t	2025-10-28 15:06:02.957223-05
\.


--
-- Name: activity_activity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_activity_id_seq', 2, true);


--
-- Name: activity_bonus_activity_bonus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_bonus_activity_bonus_id_seq', 2, true);


--
-- Name: adjustment_adjustment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.adjustment_adjustment_id_seq', 7, true);


--
-- Name: airports_airport_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.airports_airport_id_seq', 15, true);


--
-- Name: bonus_bonus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bonus_bonus_id_seq', 11, true);


--
-- Name: carriers_carrier_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.carriers_carrier_id_seq', 11, true);


--
-- Name: display_template_line_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.display_template_line_line_id_seq', 11, true);


--
-- Name: display_template_template_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.display_template_template_id_seq', 3, true);


--
-- Name: member_promotion_detail_detail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.member_promotion_detail_detail_id_seq', 4, true);


--
-- Name: member_promotion_member_promotion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.member_promotion_member_promotion_id_seq', 2, true);


--
-- Name: member_tier_member_tier_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.member_tier_member_tier_id_seq', 6, true);


--
-- Name: molecule_def_molecule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.molecule_def_molecule_id_seq', 36, true);


--
-- Name: molecule_text_pool_text_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.molecule_text_pool_text_id_seq', 2, true);


--
-- Name: molecule_value_boolean_value_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.molecule_value_boolean_value_id_seq', 1, false);


--
-- Name: molecule_value_date_value_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.molecule_value_date_value_id_seq', 1, false);


--
-- Name: molecule_value_embedded_list_embedded_value_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.molecule_value_embedded_list_embedded_value_id_seq', 56, true);


--
-- Name: molecule_value_lookup_lookup_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.molecule_value_lookup_lookup_id_seq', 11, true);


--
-- Name: molecule_value_numeric_value_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.molecule_value_numeric_value_id_seq', 3, true);


--
-- Name: molecule_value_ref_value_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.molecule_value_ref_value_id_seq', 1, false);


--
-- Name: molecule_value_text_value_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.molecule_value_text_value_id_seq', 74, true);


--
-- Name: partner_partner_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.partner_partner_id_seq', 3, true);


--
-- Name: partner_program_program_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.partner_program_program_id_seq', 7, true);


--
-- Name: point_lot_lot_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.point_lot_lot_id_seq', 1, true);


--
-- Name: promotion_promotion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.promotion_promotion_id_seq', 3, true);


--
-- Name: redemption_detail_redemption_detail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.redemption_detail_redemption_detail_id_seq', 1, false);


--
-- Name: redemption_rule_redemption_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.redemption_rule_redemption_id_seq', 1, true);


--
-- Name: rule_criteria_criteria_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rule_criteria_criteria_id_seq', 11, true);


--
-- Name: rule_rule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rule_rule_id_seq', 3, true);


--
-- Name: tenant_tenant_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tenant_tenant_id_seq', 1, true);


--
-- Name: tier_definition_tier_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tier_definition_tier_id_seq', 5, true);


--
-- Name: attr_def_attr_id_seq; Type: SEQUENCE SET; Schema: t_delta; Owner: -
--

SELECT pg_catalog.setval('t_delta.attr_def_attr_id_seq', 1, false);


--
-- Name: theme_theme_id_seq; Type: SEQUENCE SET; Schema: t_delta; Owner: -
--

SELECT pg_catalog.setval('t_delta.theme_theme_id_seq', 1, true);


--
-- Name: attr_def_attr_id_seq; Type: SEQUENCE SET; Schema: t_demo; Owner: -
--

SELECT pg_catalog.setval('t_demo.attr_def_attr_id_seq', 1, false);


--
-- Name: theme_theme_id_seq; Type: SEQUENCE SET; Schema: t_demo; Owner: -
--

SELECT pg_catalog.setval('t_demo.theme_theme_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict fRahUqYv4cNaVZLHkHkG1soIkaKGVPQPPekbfHPu3sPXFnH3g4Y7vREf3fRjChU

