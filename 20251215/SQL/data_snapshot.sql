--
-- PostgreSQL database dump
--

\restrict RdzY693Qh8nHBVOjhLncKA3guOrg7VNYiA9PcYyGx9xdT06AcZGKGERLPfcEyfv

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
-- Data for Name: activity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity (activity_id, activity_date, post_date, activity_type, link, p_link) FROM stdin;
11	2025-12-04	2025-12-05	A		
12	2025-12-04	2025-12-04	N		
\.


--
-- Data for Name: molecule_def; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_def (molecule_key, label, value_kind, scalar_type, lookup_table_key, tenant_id, context, is_static, is_permanent, is_required, is_active, foreign_schema, description, display_order, molecule_id, sample_code, sample_description, decimal_places, ref_table_name, ref_field_name, ref_function_name, parent_molecule_key, parent_fk_field, can_be_promotion_counter, display_width, list_context, system_required, input_type, molecule_type, value_structure, storage_size, value_type) FROM stdin;
sysparm	System Parameters	\N	\N	\N	1	system	f	f	f	t	\N	\N	0	16	\N	\N	0	\N	\N	\N	\N	\N	f	\N	\N	f	P	S	embedded	\N	\N
currency_label_singular	Currency Label (Singular)	value	text	\N	1	tenant	t	t	f	t	\N	Singular form of points/miles (e.g., "mile", "point")	0	6	\N	\N	0	\N	\N	\N	\N	\N	f	\N	\N	f	P	S	single	\N	\N
last_member_number	Last Member Number	value	numeric	\N	1	tenant	t	t	f	t	\N	Counter for generating new member numbers	0	10	\N	\N	0	\N	\N	\N	\N	\N	f	\N	\N	f	P	S	single	\N	\N
retro_days_allowed	Retroactive Days Allowed	value	numeric	\N	1	program	t	f	f	f	\N	Number of days back activities can be entered	0	8			0	\N	\N	\N	\N	\N	f	\N	\N	f	P	S	single	\N	\N
max_tier_qualification_days	Max Tier Qualification Days	value	numeric	\N	1	tenant	t	f	f	f	\N	Maximum days to qualify for tier status	0	9	\N	\N	0	\N	\N	\N	\N	\N	f	\N	\N	f	P	S	single	\N	\N
Bill	Bills stuff to remember	internal_list	\N	\N	1	tenant	f	f	f	t	\N	This is my area to keep stuff	0	22			0	\N	\N	\N	\N	\N	f	\N	\N	f	P	S	single	\N	\N
currency_label	Currency Label 	value	text	\N	1	tenant	t	t	f	t	\N	Label used in Platform 	0	7			0	\N	\N	\N	\N	\N	f	\N	\N	f	P	S	single	\N	\N
activity_type_label	What accrual Stuff is Called	value	text	\N	1	tenant	t	f	t	t	\N	Core unit - Airline = Flight, etc	0	13			0	\N	\N	\N	\N	\N	f	\N	\N	f	P	S	single	\N	\N
error_messages	Error Messages	internal_list	\N	\N	1	system	f	f	f	t	\N	System error messages	1	14			0	\N	\N	\N	\N	\N	f	\N	\N	f	P	S	single	\N	\N
member_fname	Member First Name	reference	\N	\N	1	member	f	f	f	t	\N	Member First Name Reference	0	24	\N	\N	0	member	fname	\N	\N	\N	f	\N	\N	f	P	R	\N	\N	\N
member_tier_on_date	Member Tier (on date)	reference	\N	\N	1	member	f	f	f	t	\N	\N	0	26	\N	\N	0	\N	\N	get_member_tier_on_date	\N	\N	f	\N	\N	f	P	R	\N	\N	\N
color	color test	value	text	\N	1	activity	f	f	f	t	\N	testing	2	11	\N	\N	0	\N	\N	\N	\N	\N	f	\N	activity	f	P	D	single	\N	\N
tier	Member Tier	external_list	\N	tier_definition	1	member	f	f	f	t	\N	Member tier level (Basic, Silver, Gold, Platinum)	100	23	\N	\N	0	\N	\N	\N	\N	\N	f	\N	\N	f	P	D	single	1	key
bonus_activity_link	Bonus Activity Link	value	char	\N	1	activity	f	f	f	t	\N	\N	0	43	\N	\N	0	\N	\N	\N	\N	\N	f	\N	\N	f	P	D	single	5	link
flight_number	Flight Number	value	numeric	\N	1	activity	f	t	f	t	\N	Flight number	0	5	1	2	0	\N	\N	\N	\N	\N	f	4	activity	f	P	D	single	2	code
mqd	MQD	value	numeric	\N	1	activity	f	f	f	t	\N	Medallion Qualifying Dollars	0	37	\N	\N	0	\N	\N	\N	\N	\N	t	8	activity	f	P	D	single	4	numeric
bonus_activity_id	Bonus Activity	value	numeric	\N	1	activity	f	t	f	t	\N	Required for bonus processing - links parent activity to bonus activities	0	38	\N	\N	0	\N	\N	\N	\N	\N	f	\N	activity	f	P	D	single	5	link
bonus_rule_id	Bonus Rule	value	numeric	\N	1	activity	f	t	f	t	\N	Required for bonus processing - links bonus activity to the rule that awarded it	0	40	\N	\N	0	\N	\N	\N	\N	\N	f	\N	activity	f	P	D	single	2	key
partner	Partner	external_list	\N	partner	1	activity	f	f	f	t	\N	Earning partner for non-core activities (car rental, hotels, credit cards)	50	30	\N	\N	0	\N	\N	\N	\N	\N	f	\N	activity	f	P	D	single	2	key
partner_program	Partner Program	external_list	\N	partner_program	1	activity	f	f	f	t	\N	Specific earning program within a partner (e.g., Hertz Luxury Cars, Marriott Gold)	51	31	\N	\N	0	\N	\N	\N	partner	partner_id	f	\N	activity	f	P	D	single	2	key
adjustment	Adjustment	external_list	\N	adjustment	1	activity	f	f	f	t	\N	Manual point adjustment for customer service and corrections	52	32	\N	\N	0	\N	\N	\N	\N	\N	f	\N	activity	f	P	D	single	2	key
member_promotion	Member Promotion Enrollment	external_list	\N	member_promotion	1	activity	f	f	f	t	\N	Link to specific member promotion enrollment that spawned reward	100	33	\N	\N	0	\N	\N	\N	\N	\N	f	\N	activity	f	P	D	single	4	key
promotion	Promotion	external_list	\N	promotion	1	activity	f	f	f	t	\N	Link to promotion rule for code and description	101	34	\N	\N	0	\N	\N	\N	\N	\N	f	\N	activity	f	P	D	single	2	key
redemption_type	Redemption Type	external_list	\N	\N	1	activity	f	f	f	t	\N		0	21	RDM3333	Redemption Sample	0	\N	\N	\N	\N	\N	f	\N	activity	f	P	D	single	2	key
member_points	Points	\N	\N	\N	1	activity	f	f	f	t	\N	Links activity to point bucket with amount (replaces lot_id, point_amount)	0	42	\N	\N	0	\N	\N	\N	\N	\N	f	\N	activity	t	P	D	embedded	54	composite
carrier	Carrier Code	external_list	\N	carriers	1	activity	f	t	f	t	\N	Airline carrier code	0	1	NW	Red Tail Airline	0	\N	\N	\N	\N	\N	f	2	activity	f	P	D	single	1	key
fare_class	Fare Class	internal_list	\N	\N	1	activity	f	t	f	t	\N	Flight cabin class of service	0	4	F	First Class	0	\N	\N	\N	\N	\N	f	2	activity	f	P	D	single	1	key
destination	Destination	external_list	\N	airports	1	activity	f	t	f	t	\N	Destination airport code	0	2	MSP	Minneapolis- test	0	\N	\N	\N	\N	\N	f	4	activity	f	T	D	single	2	key
origin	Origin	external_list	\N	airports	1	activity	f	t	f	t	\N	Origin airport code	0	3	MSP	Minneapolis sample	0	\N	\N	\N	\N	\N	f	4	activity	f	T	D	single	2	key
activity_display	Activity Display Config	\N	\N	\N	1	activity	t	f	f	t	\N	\N	0	20	\N	\N	0	\N	\N	\N	\N	\N	f	\N	activity	f	P	S	embedded	\N	\N
member_state	Member State	reference	\N	\N	1	member	f	f	f	t	\N	Member State for Bonus / Promotion Rules	0	29	\N	\N	0	member	state	\N	\N	\N	f	\N	\N	f	P	R	\N	\N	\N
activity_type	Activity Type	internal_list	\N	\N	1	system	t	t	t	f	\N	Type of activity: Base (core business), Partner (non-core), Adjustment (manual), or Redemption (spend)	1	12	\N	\N	0	\N	\N	\N	\N	\N	f	\N	\N	f	P	S	single	\N	\N
member_point_bucket	Point Bucket	value	text	\N	1	member	f	f	f	t	\N	Tracks point balance by expiration rule (replaces point_lot)	0	41	\N	\N	0	\N	\N	\N	\N	\N	f	\N	member	t	P	D	single	2244	key
state	State/Province	internal_list	\N	\N	1	tenant	t	f	f	t	\N	US states and territories	0	27	\N	\N	0	\N	\N	\N	\N	\N	f	\N	\N	f	P	S	single	\N	\N
\.


--
-- Data for Name: activity_detail; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_detail (molecule_id, v_ref_id, p_link) FROM stdin;
\.


--
-- Data for Name: activity_detail_1; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_detail_1 (p_link, molecule_id, c1) FROM stdin;
	1	
	4	\n
\.


--
-- Data for Name: activity_detail_2; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_detail_2 (p_link, molecule_id, n1) FROM stdin;
	3	-31179
	2	-31962
	5	-32745
	40	-32760
\.


--
-- Data for Name: activity_detail_3; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_detail_3 (p_link, molecule_id, c1) FROM stdin;
\.


--
-- Data for Name: activity_detail_4; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_detail_4 (p_link, molecule_id, n1) FROM stdin;
	37	3933
\.


--
-- Data for Name: activity_detail_5; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_detail_5 (p_link, molecule_id, c1) FROM stdin;
	43	
\.


--
-- Data for Name: activity_detail_54; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_detail_54 (p_link, molecule_id, c1, n1) FROM stdin;
	42		1492
	42		100
\.


--
-- Data for Name: activity_detail_list; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_detail_list (detail_list_id, activity_id, molecule_id, v1, v2, created_at) FROM stdin;
1	1	1	2	\N	2025-11-29 13:23:50.967189
2	1	3	1	\N	2025-11-29 13:23:50.967189
3	1	2	2	\N	2025-11-29 13:23:50.967189
4	1	4	9	\N	2025-11-29 13:23:50.967189
5	1	5	887	\N	2025-11-29 13:23:50.967189
6	2	1	2	\N	2025-11-29 13:23:50.967189
7	2	3	11	\N	2025-11-29 13:23:50.967189
8	2	2	2	\N	2025-11-29 13:23:50.967189
9	2	4	9	\N	2025-11-29 13:23:50.967189
10	2	5	332	\N	2025-11-29 13:23:50.967189
11	3	1	3	\N	2025-11-29 13:23:50.967189
12	3	3	1	\N	2025-11-29 13:23:50.967189
13	3	2	13	\N	2025-11-29 13:23:50.967189
14	4	1	8	\N	2025-11-29 13:23:50.967189
15	4	3	4	\N	2025-11-29 13:23:50.967189
16	4	2	1	\N	2025-11-29 13:23:50.967189
17	5	1	6	\N	2025-11-29 13:23:50.967189
18	5	3	13	\N	2025-11-29 13:23:50.967189
19	5	2	12	\N	2025-11-29 13:23:50.967189
20	6	1	5	\N	2025-11-29 13:23:50.967189
21	6	3	13	\N	2025-11-29 13:23:50.967189
22	6	2	9	\N	2025-11-29 13:23:50.967189
23	7	1	9	\N	2025-11-29 13:23:50.967189
24	7	3	10	\N	2025-11-29 13:23:50.967189
25	7	2	10	\N	2025-11-29 13:23:50.967189
26	8	1	3	\N	2025-11-29 13:23:50.967189
27	8	3	7	\N	2025-11-29 13:23:50.967189
28	8	2	1	\N	2025-11-29 13:23:50.967189
29	9	1	5	\N	2025-11-29 13:23:50.967189
30	9	3	4	\N	2025-11-29 13:23:50.967189
31	9	2	2	\N	2025-11-29 13:23:50.967189
32	10	1	6	\N	2025-11-29 13:23:50.967189
33	10	3	1	\N	2025-11-29 13:23:50.967189
34	10	2	10	\N	2025-11-29 13:23:50.967189
35	11	1	7	\N	2025-11-29 13:23:50.967189
36	11	3	10	\N	2025-11-29 13:23:50.967189
37	11	2	12	\N	2025-11-29 13:23:50.967189
38	12	1	2	\N	2025-11-29 13:23:50.967189
39	12	3	9	\N	2025-11-29 13:23:50.967189
40	12	2	5	\N	2025-11-29 13:23:50.967189
41	13	1	3	\N	2025-11-29 13:23:50.967189
42	13	3	11	\N	2025-11-29 13:23:50.967189
43	13	2	6	\N	2025-11-29 13:23:50.967189
44	14	1	3	\N	2025-11-29 13:23:50.967189
45	14	3	4	\N	2025-11-29 13:23:50.967189
46	14	2	7	\N	2025-11-29 13:23:50.967189
47	15	1	8	\N	2025-11-29 13:23:50.967189
48	15	3	8	\N	2025-11-29 13:23:50.967189
49	15	2	10	\N	2025-11-29 13:23:50.967189
50	16	1	2	\N	2025-11-29 13:23:50.967189
51	16	3	14	\N	2025-11-29 13:23:50.967189
52	16	2	5	\N	2025-11-29 13:23:50.967189
53	17	1	6	\N	2025-11-29 13:23:50.967189
54	17	3	4	\N	2025-11-29 13:23:50.967189
55	17	2	2	\N	2025-11-29 13:23:50.967189
56	18	1	5	\N	2025-11-29 13:23:50.967189
57	18	3	9	\N	2025-11-29 13:23:50.967189
58	18	2	12	\N	2025-11-29 13:23:50.967189
59	19	1	8	\N	2025-11-29 13:23:50.967189
60	19	3	9	\N	2025-11-29 13:23:50.967189
61	19	2	11	\N	2025-11-29 13:23:50.967189
62	20	1	8	\N	2025-11-29 13:23:50.967189
63	20	3	13	\N	2025-11-29 13:23:50.967189
64	20	2	1	\N	2025-11-29 13:23:50.967189
65	21	1	3	\N	2025-11-29 13:23:50.967189
66	21	3	14	\N	2025-11-29 13:23:50.967189
67	21	2	13	\N	2025-11-29 13:23:50.967189
68	22	1	10	\N	2025-11-29 13:23:50.967189
69	22	3	10	\N	2025-11-29 13:23:50.967189
70	22	2	13	\N	2025-11-29 13:23:50.967189
71	23	1	6	\N	2025-11-29 13:23:50.967189
72	23	3	6	\N	2025-11-29 13:23:50.967189
73	23	2	2	\N	2025-11-29 13:23:50.967189
74	24	1	5	\N	2025-11-29 13:23:50.967189
75	24	3	4	\N	2025-11-29 13:23:50.967189
76	24	2	2	\N	2025-11-29 13:23:50.967189
77	25	1	3	\N	2025-11-29 13:23:50.967189
78	25	3	4	\N	2025-11-29 13:23:50.967189
79	25	2	1	\N	2025-11-29 13:23:50.967189
80	26	1	10	\N	2025-11-29 13:23:50.967189
81	26	3	4	\N	2025-11-29 13:23:50.967189
82	26	2	12	\N	2025-11-29 13:23:50.967189
83	27	1	1	\N	2025-11-29 13:23:50.967189
84	27	3	1	\N	2025-11-29 13:23:50.967189
85	27	2	13	\N	2025-11-29 13:23:50.967189
86	28	1	4	\N	2025-11-29 13:23:50.967189
87	28	3	4	\N	2025-11-29 13:23:50.967189
88	28	2	5	\N	2025-11-29 13:23:50.967189
89	29	1	5	\N	2025-11-29 13:23:50.967189
90	29	3	14	\N	2025-11-29 13:23:50.967189
91	29	2	15	\N	2025-11-29 13:23:50.967189
92	30	1	5	\N	2025-11-29 13:23:50.967189
93	30	3	4	\N	2025-11-29 13:23:50.967189
94	30	2	2	\N	2025-11-29 13:23:50.967189
95	31	1	1	\N	2025-11-29 13:23:50.967189
96	31	3	9	\N	2025-11-29 13:23:50.967189
97	31	2	5	\N	2025-11-29 13:23:50.967189
98	32	1	1	\N	2025-11-29 13:23:50.967189
99	32	3	1	\N	2025-11-29 13:23:50.967189
100	32	2	12	\N	2025-11-29 13:23:50.967189
101	33	1	10	\N	2025-11-29 13:23:50.967189
102	33	3	7	\N	2025-11-29 13:23:50.967189
103	33	2	5	\N	2025-11-29 13:23:50.967189
104	34	1	10	\N	2025-11-29 13:23:50.967189
105	34	3	5	\N	2025-11-29 13:23:50.967189
106	34	2	15	\N	2025-11-29 13:23:50.967189
107	35	1	10	\N	2025-11-29 13:23:50.967189
108	35	3	3	\N	2025-11-29 13:23:50.967189
109	35	2	11	\N	2025-11-29 13:23:50.967189
110	36	1	6	\N	2025-11-29 13:23:50.967189
111	36	3	6	\N	2025-11-29 13:23:50.967189
112	36	2	7	\N	2025-11-29 13:23:50.967189
113	37	1	2	\N	2025-11-29 13:23:50.967189
114	37	3	13	\N	2025-11-29 13:23:50.967189
115	37	2	10	\N	2025-11-29 13:23:50.967189
116	38	1	4	\N	2025-11-29 13:23:50.967189
117	38	3	9	\N	2025-11-29 13:23:50.967189
118	38	2	8	\N	2025-11-29 13:23:50.967189
119	39	1	1	\N	2025-11-29 13:23:50.967189
120	39	3	4	\N	2025-11-29 13:23:50.967189
121	39	2	13	\N	2025-11-29 13:23:50.967189
122	40	1	6	\N	2025-11-29 13:23:50.967189
123	40	3	8	\N	2025-11-29 13:23:50.967189
124	40	2	9	\N	2025-11-29 13:23:50.967189
125	41	1	9	\N	2025-11-29 13:23:50.967189
126	41	3	8	\N	2025-11-29 13:23:50.967189
127	41	2	9	\N	2025-11-29 13:23:50.967189
128	42	1	3	\N	2025-11-29 13:23:50.967189
129	42	3	10	\N	2025-11-29 13:23:50.967189
130	42	2	4	\N	2025-11-29 13:23:50.967189
131	43	1	7	\N	2025-11-29 13:23:50.967189
132	43	3	8	\N	2025-11-29 13:23:50.967189
133	43	2	10	\N	2025-11-29 13:23:50.967189
134	44	1	2	\N	2025-11-29 13:23:50.967189
135	44	3	10	\N	2025-11-29 13:23:50.967189
136	44	2	10	\N	2025-11-29 13:23:50.967189
137	45	1	2	\N	2025-11-29 13:23:50.967189
138	45	3	2	\N	2025-11-29 13:23:50.967189
139	45	2	4	\N	2025-11-29 13:23:50.967189
140	46	1	5	\N	2025-11-29 13:23:50.967189
141	46	3	2	\N	2025-11-29 13:23:50.967189
142	46	2	6	\N	2025-11-29 13:23:50.967189
143	47	1	8	\N	2025-11-29 13:23:50.967189
144	47	3	9	\N	2025-11-29 13:23:50.967189
145	47	2	15	\N	2025-11-29 13:23:50.967189
146	48	1	5	\N	2025-11-29 13:23:50.967189
147	48	3	6	\N	2025-11-29 13:23:50.967189
148	48	2	3	\N	2025-11-29 13:23:50.967189
149	49	1	3	\N	2025-11-29 13:23:50.967189
150	49	3	1	\N	2025-11-29 13:23:50.967189
151	49	2	11	\N	2025-11-29 13:23:50.967189
152	50	1	3	\N	2025-11-29 13:23:50.967189
153	50	3	12	\N	2025-11-29 13:23:50.967189
154	50	2	7	\N	2025-11-29 13:23:50.967189
155	51	1	6	\N	2025-11-29 13:23:50.967189
156	51	3	13	\N	2025-11-29 13:23:50.967189
157	51	2	4	\N	2025-11-29 13:23:50.967189
158	52	1	8	\N	2025-11-29 13:23:50.967189
159	52	3	4	\N	2025-11-29 13:23:50.967189
160	52	2	14	\N	2025-11-29 13:23:50.967189
161	53	1	10	\N	2025-11-29 13:23:50.967189
162	53	3	9	\N	2025-11-29 13:23:50.967189
163	53	2	2	\N	2025-11-29 13:23:50.967189
164	54	1	5	\N	2025-11-29 13:23:50.967189
165	54	3	13	\N	2025-11-29 13:23:50.967189
166	54	2	4	\N	2025-11-29 13:23:50.967189
167	55	1	3	\N	2025-11-29 13:23:50.967189
168	55	3	10	\N	2025-11-29 13:23:50.967189
169	55	2	10	\N	2025-11-29 13:23:50.967189
170	56	1	2	\N	2025-11-29 13:23:50.967189
171	56	3	6	\N	2025-11-29 13:23:50.967189
172	56	2	12	\N	2025-11-29 13:23:50.967189
173	57	1	8	\N	2025-11-29 13:23:50.967189
174	57	3	5	\N	2025-11-29 13:23:50.967189
175	57	2	5	\N	2025-11-29 13:23:50.967189
176	58	1	4	\N	2025-11-29 13:23:50.967189
177	58	3	3	\N	2025-11-29 13:23:50.967189
178	58	2	1	\N	2025-11-29 13:23:50.967189
179	59	1	1	\N	2025-11-29 13:23:50.967189
180	59	3	1	\N	2025-11-29 13:23:50.967189
181	59	2	12	\N	2025-11-29 13:23:50.967189
182	60	1	9	\N	2025-11-29 13:23:50.967189
183	60	3	5	\N	2025-11-29 13:23:50.967189
184	60	2	10	\N	2025-11-29 13:23:50.967189
185	61	1	5	\N	2025-11-29 13:23:50.967189
186	61	3	4	\N	2025-11-29 13:23:50.967189
187	61	2	3	\N	2025-11-29 13:23:50.967189
188	62	1	9	\N	2025-11-29 13:23:50.967189
189	62	3	4	\N	2025-11-29 13:23:50.967189
190	62	2	4	\N	2025-11-29 13:23:50.967189
191	63	1	1	\N	2025-11-29 13:23:50.967189
192	63	3	14	\N	2025-11-29 13:23:50.967189
193	63	2	13	\N	2025-11-29 13:23:50.967189
194	64	1	2	\N	2025-11-29 13:23:50.967189
195	64	3	10	\N	2025-11-29 13:23:50.967189
196	64	2	2	\N	2025-11-29 13:23:50.967189
197	65	1	6	\N	2025-11-29 13:23:50.967189
198	65	3	5	\N	2025-11-29 13:23:50.967189
199	65	2	12	\N	2025-11-29 13:23:50.967189
200	66	1	10	\N	2025-11-29 13:23:50.967189
201	66	3	12	\N	2025-11-29 13:23:50.967189
202	66	2	6	\N	2025-11-29 13:23:50.967189
203	67	1	2	\N	2025-11-29 13:23:50.967189
204	67	3	4	\N	2025-11-29 13:23:50.967189
205	67	2	11	\N	2025-11-29 13:23:50.967189
206	68	1	5	\N	2025-11-29 13:23:50.967189
207	68	3	13	\N	2025-11-29 13:23:50.967189
208	68	2	8	\N	2025-11-29 13:23:50.967189
209	69	1	7	\N	2025-11-29 13:23:50.967189
210	69	3	14	\N	2025-11-29 13:23:50.967189
211	69	2	5	\N	2025-11-29 13:23:50.967189
212	70	1	8	\N	2025-11-29 13:23:50.967189
213	70	3	4	\N	2025-11-29 13:23:50.967189
214	70	2	8	\N	2025-11-29 13:23:50.967189
215	71	1	6	\N	2025-11-29 13:23:50.967189
216	71	3	14	\N	2025-11-29 13:23:50.967189
217	71	2	2	\N	2025-11-29 13:23:50.967189
218	72	1	6	\N	2025-11-29 13:23:50.967189
219	72	3	2	\N	2025-11-29 13:23:50.967189
220	72	2	12	\N	2025-11-29 13:23:50.967189
221	73	1	9	\N	2025-11-29 13:23:50.967189
222	73	3	9	\N	2025-11-29 13:23:50.967189
223	73	2	4	\N	2025-11-29 13:23:50.967189
224	74	1	5	\N	2025-11-29 13:23:50.967189
225	74	3	7	\N	2025-11-29 13:23:50.967189
226	74	2	14	\N	2025-11-29 13:23:50.967189
227	75	1	10	\N	2025-11-29 13:23:50.967189
228	75	3	15	\N	2025-11-29 13:23:50.967189
229	75	2	8	\N	2025-11-29 13:23:50.967189
230	76	1	5	\N	2025-11-29 13:23:50.967189
231	76	3	4	\N	2025-11-29 13:23:50.967189
232	76	2	5	\N	2025-11-29 13:23:50.967189
233	77	1	10	\N	2025-11-29 13:23:50.967189
234	77	3	14	\N	2025-11-29 13:23:50.967189
235	77	2	6	\N	2025-11-29 13:23:50.967189
236	78	1	5	\N	2025-11-29 13:23:50.967189
237	78	3	2	\N	2025-11-29 13:23:50.967189
238	78	2	11	\N	2025-11-29 13:23:50.967189
239	79	1	5	\N	2025-11-29 13:23:50.967189
240	79	3	11	\N	2025-11-29 13:23:50.967189
241	79	2	15	\N	2025-11-29 13:23:50.967189
242	80	1	10	\N	2025-11-29 13:23:50.967189
243	80	3	4	\N	2025-11-29 13:23:50.967189
244	80	2	11	\N	2025-11-29 13:23:50.967189
245	81	1	1	\N	2025-11-29 13:23:50.967189
246	81	3	10	\N	2025-11-29 13:23:50.967189
247	81	2	12	\N	2025-11-29 13:23:50.967189
248	82	1	4	\N	2025-11-29 13:23:50.967189
249	82	3	6	\N	2025-11-29 13:23:50.967189
250	82	2	7	\N	2025-11-29 13:23:50.967189
251	83	1	3	\N	2025-11-29 13:23:50.967189
252	83	3	3	\N	2025-11-29 13:23:50.967189
253	83	2	8	\N	2025-11-29 13:23:50.967189
254	84	1	6	\N	2025-11-29 13:23:50.967189
255	84	3	2	\N	2025-11-29 13:23:50.967189
256	84	2	7	\N	2025-11-29 13:23:50.967189
257	85	1	6	\N	2025-11-29 13:23:50.967189
258	85	3	10	\N	2025-11-29 13:23:50.967189
259	85	2	11	\N	2025-11-29 13:23:50.967189
260	86	1	3	\N	2025-11-29 13:23:50.967189
261	86	3	8	\N	2025-11-29 13:23:50.967189
262	86	2	9	\N	2025-11-29 13:23:50.967189
263	87	1	3	\N	2025-11-29 13:23:50.967189
264	87	3	8	\N	2025-11-29 13:23:50.967189
265	87	2	11	\N	2025-11-29 13:23:50.967189
266	88	1	6	\N	2025-11-29 13:23:50.967189
267	88	3	15	\N	2025-11-29 13:23:50.967189
268	88	2	1	\N	2025-11-29 13:23:50.967189
269	89	1	2	\N	2025-11-29 13:23:50.967189
270	89	3	15	\N	2025-11-29 13:23:50.967189
271	89	2	13	\N	2025-11-29 13:23:50.967189
272	90	1	2	\N	2025-11-29 13:23:50.967189
273	90	3	11	\N	2025-11-29 13:23:50.967189
274	90	2	1	\N	2025-11-29 13:23:50.967189
275	91	1	3	\N	2025-11-29 13:23:50.967189
276	91	3	7	\N	2025-11-29 13:23:50.967189
277	91	2	9	\N	2025-11-29 13:23:50.967189
278	92	1	9	\N	2025-11-29 13:23:50.967189
279	92	3	9	\N	2025-11-29 13:23:50.967189
280	92	2	3	\N	2025-11-29 13:23:50.967189
281	93	1	1	\N	2025-11-29 13:23:50.967189
282	93	3	7	\N	2025-11-29 13:23:50.967189
283	93	2	1	\N	2025-11-29 13:23:50.967189
284	94	1	9	\N	2025-11-29 13:23:50.967189
285	94	3	10	\N	2025-11-29 13:23:50.967189
286	94	2	8	\N	2025-11-29 13:23:50.967189
287	95	1	3	\N	2025-11-29 13:23:50.967189
288	95	3	10	\N	2025-11-29 13:23:50.967189
289	95	2	10	\N	2025-11-29 13:23:50.967189
290	96	1	2	\N	2025-11-29 13:23:50.967189
291	96	3	1	\N	2025-11-29 13:23:50.967189
292	96	2	9	\N	2025-11-29 13:23:50.967189
293	97	1	1	\N	2025-11-29 13:23:50.967189
294	97	3	9	\N	2025-11-29 13:23:50.967189
295	97	2	13	\N	2025-11-29 13:23:50.967189
296	98	1	10	\N	2025-11-29 13:23:50.967189
297	98	3	2	\N	2025-11-29 13:23:50.967189
298	98	2	1	\N	2025-11-29 13:23:50.967189
299	99	1	4	\N	2025-11-29 13:23:50.967189
300	99	3	3	\N	2025-11-29 13:23:50.967189
301	99	2	6	\N	2025-11-29 13:23:50.967189
302	100	1	7	\N	2025-11-29 13:23:50.967189
303	100	3	14	\N	2025-11-29 13:23:50.967189
304	100	2	9	\N	2025-11-29 13:23:50.967189
305	101	1	7	\N	2025-11-29 13:23:50.967189
306	101	3	14	\N	2025-11-29 13:23:50.967189
307	101	2	2	\N	2025-11-29 13:23:50.967189
308	102	1	3	\N	2025-11-29 13:23:50.967189
309	102	3	5	\N	2025-11-29 13:23:50.967189
310	102	2	6	\N	2025-11-29 13:23:50.967189
311	103	1	2	\N	2025-11-29 13:23:50.967189
312	103	3	4	\N	2025-11-29 13:23:50.967189
313	103	2	3	\N	2025-11-29 13:23:50.967189
314	104	1	1	\N	2025-11-29 13:23:50.967189
315	104	3	10	\N	2025-11-29 13:23:50.967189
316	104	2	2	\N	2025-11-29 13:23:50.967189
317	105	1	5	\N	2025-11-29 13:23:50.967189
318	105	3	10	\N	2025-11-29 13:23:50.967189
319	105	2	3	\N	2025-11-29 13:23:50.967189
320	106	1	3	\N	2025-11-29 13:23:50.967189
321	106	3	12	\N	2025-11-29 13:23:50.967189
322	106	2	10	\N	2025-11-29 13:23:50.967189
323	107	1	3	\N	2025-11-29 13:23:50.967189
324	107	3	15	\N	2025-11-29 13:23:50.967189
325	107	2	7	\N	2025-11-29 13:23:50.967189
326	108	1	6	\N	2025-11-29 13:23:50.967189
327	108	3	3	\N	2025-11-29 13:23:50.967189
328	108	2	10	\N	2025-11-29 13:23:50.967189
329	109	1	3	\N	2025-11-29 13:23:50.967189
330	109	3	6	\N	2025-11-29 13:23:50.967189
331	109	2	8	\N	2025-11-29 13:23:50.967189
332	110	1	8	\N	2025-11-29 13:23:50.967189
333	110	3	15	\N	2025-11-29 13:23:50.967189
334	110	2	8	\N	2025-11-29 13:23:50.967189
335	111	1	2	\N	2025-11-29 13:23:50.967189
336	111	3	3	\N	2025-11-29 13:23:50.967189
337	111	2	1	\N	2025-11-29 13:23:50.967189
338	112	1	5	\N	2025-11-29 13:23:50.967189
339	112	3	1	\N	2025-11-29 13:23:50.967189
340	112	2	10	\N	2025-11-29 13:23:50.967189
341	113	1	2	\N	2025-11-29 13:23:50.967189
342	113	3	12	\N	2025-11-29 13:23:50.967189
343	113	2	8	\N	2025-11-29 13:23:50.967189
344	114	1	4	\N	2025-11-29 13:23:50.967189
345	114	3	2	\N	2025-11-29 13:23:50.967189
346	114	2	12	\N	2025-11-29 13:23:50.967189
347	115	1	2	\N	2025-11-29 13:23:50.967189
348	115	3	5	\N	2025-11-29 13:23:50.967189
349	115	2	2	\N	2025-11-29 13:23:50.967189
350	116	1	9	\N	2025-11-29 13:23:50.967189
351	116	3	10	\N	2025-11-29 13:23:50.967189
352	116	2	15	\N	2025-11-29 13:23:50.967189
353	117	1	1	\N	2025-11-29 13:23:50.967189
354	117	3	4	\N	2025-11-29 13:23:50.967189
355	117	2	15	\N	2025-11-29 13:23:50.967189
356	118	1	6	\N	2025-11-29 13:23:50.967189
357	118	3	14	\N	2025-11-29 13:23:50.967189
358	118	2	6	\N	2025-11-29 13:23:50.967189
359	119	1	10	\N	2025-11-29 13:23:50.967189
360	119	3	10	\N	2025-11-29 13:23:50.967189
361	119	2	6	\N	2025-11-29 13:23:50.967189
362	120	1	7	\N	2025-11-29 13:23:50.967189
363	120	3	8	\N	2025-11-29 13:23:50.967189
364	120	2	9	\N	2025-11-29 13:23:50.967189
365	121	1	5	\N	2025-11-29 13:23:50.967189
366	121	3	14	\N	2025-11-29 13:23:50.967189
367	121	2	8	\N	2025-11-29 13:23:50.967189
368	122	1	9	\N	2025-11-29 13:23:50.967189
369	122	3	3	\N	2025-11-29 13:23:50.967189
370	122	2	1	\N	2025-11-29 13:23:50.967189
371	123	1	3	\N	2025-11-29 13:23:50.967189
372	123	3	13	\N	2025-11-29 13:23:50.967189
373	123	2	14	\N	2025-11-29 13:23:50.967189
374	124	1	3	\N	2025-11-29 13:23:50.967189
375	124	3	6	\N	2025-11-29 13:23:50.967189
376	124	2	3	\N	2025-11-29 13:23:50.967189
377	125	1	7	\N	2025-11-29 13:23:50.967189
378	125	3	13	\N	2025-11-29 13:23:50.967189
379	125	2	8	\N	2025-11-29 13:23:50.967189
380	126	1	7	\N	2025-11-29 13:23:50.967189
381	126	3	3	\N	2025-11-29 13:23:50.967189
382	126	2	5	\N	2025-11-29 13:23:50.967189
383	127	1	4	\N	2025-11-29 13:23:50.967189
384	127	3	4	\N	2025-11-29 13:23:50.967189
385	127	2	11	\N	2025-11-29 13:23:50.967189
386	128	1	4	\N	2025-11-29 13:23:50.967189
387	128	3	11	\N	2025-11-29 13:23:50.967189
388	128	2	3	\N	2025-11-29 13:23:50.967189
389	129	1	1	\N	2025-11-29 13:23:50.967189
390	129	3	1	\N	2025-11-29 13:23:50.967189
391	129	2	10	\N	2025-11-29 13:23:50.967189
392	130	1	6	\N	2025-11-29 13:23:50.967189
393	130	3	15	\N	2025-11-29 13:23:50.967189
394	130	2	12	\N	2025-11-29 13:23:50.967189
395	131	1	8	\N	2025-11-29 13:23:50.967189
396	131	3	8	\N	2025-11-29 13:23:50.967189
397	131	2	8	\N	2025-11-29 13:23:50.967189
398	132	1	9	\N	2025-11-29 13:23:50.967189
399	132	3	14	\N	2025-11-29 13:23:50.967189
400	132	2	15	\N	2025-11-29 13:23:50.967189
401	133	1	2	\N	2025-11-29 13:23:50.967189
402	133	3	15	\N	2025-11-29 13:23:50.967189
403	133	2	9	\N	2025-11-29 13:23:50.967189
404	134	1	6	\N	2025-11-29 13:23:50.967189
405	134	3	1	\N	2025-11-29 13:23:50.967189
406	134	2	15	\N	2025-11-29 13:23:50.967189
407	135	1	4	\N	2025-11-29 13:23:50.967189
408	135	3	10	\N	2025-11-29 13:23:50.967189
409	135	2	5	\N	2025-11-29 13:23:50.967189
410	136	1	2	\N	2025-11-29 13:23:50.967189
411	136	3	9	\N	2025-11-29 13:23:50.967189
412	136	2	4	\N	2025-11-29 13:23:50.967189
413	137	1	6	\N	2025-11-29 13:23:50.967189
414	137	3	11	\N	2025-11-29 13:23:50.967189
415	137	2	3	\N	2025-11-29 13:23:50.967189
416	138	1	6	\N	2025-11-29 13:23:50.967189
417	138	3	6	\N	2025-11-29 13:23:50.967189
418	138	2	10	\N	2025-11-29 13:23:50.967189
419	139	1	2	\N	2025-11-29 13:23:50.967189
420	139	3	10	\N	2025-11-29 13:23:50.967189
421	139	2	9	\N	2025-11-29 13:23:50.967189
422	140	1	9	\N	2025-11-29 13:23:50.967189
423	140	3	8	\N	2025-11-29 13:23:50.967189
424	140	2	6	\N	2025-11-29 13:23:50.967189
425	141	1	5	\N	2025-11-29 13:23:50.967189
426	141	3	5	\N	2025-11-29 13:23:50.967189
427	141	2	12	\N	2025-11-29 13:23:50.967189
428	142	1	3	\N	2025-11-29 13:23:50.967189
429	142	3	11	\N	2025-11-29 13:23:50.967189
430	142	2	4	\N	2025-11-29 13:23:50.967189
431	143	1	9	\N	2025-11-29 13:23:50.967189
432	143	3	5	\N	2025-11-29 13:23:50.967189
433	143	2	4	\N	2025-11-29 13:23:50.967189
434	144	1	5	\N	2025-11-29 13:23:50.967189
435	144	3	7	\N	2025-11-29 13:23:50.967189
436	144	2	14	\N	2025-11-29 13:23:50.967189
437	145	1	2	\N	2025-11-29 13:23:50.967189
438	145	3	10	\N	2025-11-29 13:23:50.967189
439	145	2	5	\N	2025-11-29 13:23:50.967189
440	146	1	10	\N	2025-11-29 13:23:50.967189
441	146	3	12	\N	2025-11-29 13:23:50.967189
442	146	2	14	\N	2025-11-29 13:23:50.967189
443	147	1	6	\N	2025-11-29 13:23:50.967189
444	147	3	3	\N	2025-11-29 13:23:50.967189
445	147	2	6	\N	2025-11-29 13:23:50.967189
446	148	1	3	\N	2025-11-29 13:23:50.967189
447	148	3	4	\N	2025-11-29 13:23:50.967189
448	148	2	11	\N	2025-11-29 13:23:50.967189
\.


--
-- Data for Name: tenant; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenant (tenant_id, tenant_key, name, industry, is_active) FROM stdin;
1	delta	Delta Air Lines	airline	t
2	united	United Airlines	airline	t
3	marriott	Marriott Hotels	hotel	t
4	ferrari	Ferrari	automotive	t
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

COPY public.airports (airport_id, code, name, city, country, is_active, lat, long) FROM stdin;
16	AAC	El Arish	Al Arish	Egypt	t	31.076667	33.831667
17	AAE	El Mellah	Annaba	Algeria	t	36.821667	7.810000
18	AAH	Aachen	Aachen Maastricht	Germany	t	50.825000	6.183333
19	AAL	Aalborg	Aalborg	Denmark	t	57.093333	9.850000
20	AAN	Al Ain Intl	Al Ain	United Arab Emi	t	24.261667	55.608333
21	AAQ	Vityazevo	Anapa	Russia	t	45.001667	37.348333
22	AAR	Tirstrup	Aarhus	Denmark	t	56.300000	10.620000
23	ABA	Abakan	Abakan	E Ural Russia	t	53.741667	91.385000
24	ABE	Lehigh Valley Intl	Allentown Bthlem	USA	t	40.651667	-75.440000
25	ABI	Abilene Regl	Abilene	USA	t	32.410000	-99.681667
26	ABJ	Felix Houphouet-Boigny	Abidjan	Ivory Coast	t	5.250000	-3.928333
27	ABQ	Albuquerque Intl Sunport	Albuquerque	USA	t	35.040000	-106.608333
28	ABR	Aberdeen Regl	Aberdeen Sd	USA	t	45.448333	-98.421667
29	ABS	Abu Simbel	Abu Simbel	Egypt	t	22.371667	31.608333
30	ABT	Al Baha	Al Baha	Saudi Arabia	t	20.295000	41.633333
31	ABV	Abuja	Abuja	Nigeria	t	9.003333	7.258333
32	ABX	Albury	Albury	Australia	t	-36.068333	146.953333
33	ABY	Southwest Georgia Regl	Albany Ga	USA	t	31.535000	-84.193333
34	ABZ	Dyce	Aberdeen Scot	United Kingdom	t	57.203333	-2.198333
35	ACA	Acapulco/Mex	Acapulco	Mexico	t	16.755000	-99.753333
36	ACB	Antrim Co	Bellaire	USA	t	44.988333	-85.198333
37	ACC	Kotoka Intl	Accra	Ghana	t	5.595000	-0.170000
38	ACE	Lanzarote	Lanzarote	Spain	t	28.943333	-13.603333
39	ACK	Nantucket Meml	Nantucket	USA	t	41.251667	-70.060000
40	ACT	Waco Regl	Waco	USA	t	31.610000	-97.230000
41	ACV	Arcata	Eureka Arcata	USA	t	40.976667	-124.108333
42	ACY	Atlantic City Intl	Atlantic City Acy	USA	t	39.456667	-74.576667
43	ADA	Adana	Adana	Turkey	t	36.983333	35.280000
44	ADB	Adnan Menderes	Izmir	Turkey	t	38.295000	27.158333
45	ADD	Bole Intl	Addis Ababa	Ethiopia	t	8.975000	38.796667
46	ADE	Aden Intl	Aden	Yemen Republic	t	12.826667	45.030000
47	ADJ	Marka Intl	Civil Amman	Jordan	t	31.971667	35.990000
48	ADK	Adak Naf	Adak Island	USA	t	51.880000	-176.646667
49	ADL	Adelaide Intl	Adelaide	Australia	t	-34.945000	138.530000
50	ADM	Ardmore Mun	Ardmore Ok	USA	t	34.303333	-97.020000
51	ADN	Incirlik Ab	Andes	Colombia	t	36.996667	35.425000
52	ADQ	Kodiak	Kodiak	USA	t	57.748333	-152.493333
53	ADS	Addison	Dallas Addison	USA	t	32.968333	-96.835000
54	ADW	Andrews Afb/Naf	Camp Springs	USA	t	38.810000	-76.866667
55	ADX	Leuchars Ab, Uk	St Andrews	United Kingdom	t	56.373333	-2.868333
56	ADZ	Gustavo Rojas Pinilla	San Andres I	Colombia	t	12.588333	-81.708333
57	AEH	Abeche	Abecher	Chad	t	13.850000	20.850000
58	AEP	Jorge Newbery	Buenos Aires Aep	Argentina	t	-34.565000	-58.405000
59	AES	Vigra	Aalesund	Norway	t	62.560000	6.113333
60	AEX	Alexandria Intl	Alexandria La	USA	t	31.326667	-92.548333
61	AEY	Akureyri	Akureyri	Iceland	t	65.655000	-18.075000
62	AFA	San Rafael	San Rafael	Argentina	t	-34.596667	-68.390000
63	AFL	Alta Floresta	Alta Floresta	Brazil	t	-9.866667	-56.105000
64	AFW	Ft Worth Alliance	Alliance Ft Worth	USA	t	32.986667	-97.318333
65	AFY	Afyon Ab	Afyon	Turkey	t	38.735000	30.595000
66	AGA	Al-Massira	Agadir	Morocco	t	30.325000	-9.411667
67	AGB	Augsburg	Augsburg	Germany	t	48.425000	10.931667
68	AGC	Allegheny Co	Allegheny	USA	t	40.353333	-79.930000
69	AGF	La Garenne	Agen	France	t	44.175000	0.591667
70	AGH	Angelholm Ab	Helsingborg Agh	Sweden	t	56.290000	12.856667
71	AGP	Malaga	Malaga	Spain	t	36.675000	-4.496667
72	AGR	Agra Ab	Agra	India	t	27.155000	77.956667
73	AGS	Bush	Augusta Ga	USA	t	33.368333	-81.963333
74	AGT	Ciudad Del Este Paraguay	Ciudad Del Este	Paraguay	t	-25.455000	-54.843333
75	AGU	Jesus Teran Intl	Aguascalientes	Mexico	t	21.703333	-102.316667
76	AGV	Oswaldo Guevara Mujica	Acarigua	Venezuela	t	9.550000	-69.233333
77	AHB	Abha	Abha	Saudi Arabia	t	18.240000	42.655000
78	AHJ	Ayr Hill Jamaica	Not In Tbl	\N	t	18.226667	-77.223333
79	AHN	Athens/Epps	Athens Ga	USA	t	33.948333	-83.325000
80	AHO	Fertilia	Alghero	Italy	t	40.630000	8.288333
81	AHU	Cherif Al Idrissi	Al Hoceima	Morocco	t	35.183333	-3.833333
82	AIA	Alliance Mun	Alliance	USA	t	42.051667	-102.803333
83	AID	Anderson Mun-Darlington	Anderson In	USA	t	40.108333	-85.611667
84	AIK	Aiken Mun	Aiken	USA	t	33.648333	-81.683333
85	AIZ	Fine Meml	Lk Of The Ozarks	USA	t	38.095000	-92.548333
86	AJA	Campo Dell Oro	Ajaccio	France	t	41.925000	8.803333
87	AJR	Arvidsjaur	Arvidsjaur	Sweden	t	65.590000	19.285000
88	AJU	Santa Maria	Aracaju	Brazil	t	-10.985000	-37.073333
89	AJY	Agades South	Agades	Niger	t	16.961667	7.985000
90	AKF	Kufra	Kufrah	Libya	t	24.176667	23.315000
91	AKJ	Asahikawa	Asahikawa	Japan	t	43.668333	142.450000
92	AKL	Auckland Intl	Auckland	New Zealand	t	-37.006667	174.791667
93	AKN	King Salmon	King Salmon	USA	t	58.676667	-156.648333
94	AKT	Akrotiri Ab	Akrotiri Raf Cy	Cyprus	t	34.590000	32.986667
95	AKX	Aktyubinsk	Aktyubinsk	Kazakhstan	t	50.245000	57.203333
96	ALA	Almaty	Alma Ata	Kazakhstan	t	43.351667	77.038333
97	ALB	Albany Co	Albany Schenctady	USA	t	42.746667	-73.801667
98	ALC	Alicante	Alicante	Spain	t	38.283333	-0.558333
99	ALE	Alpine-Casparis Mun	Alpine	USA	t	30.383333	-103.681667
100	ALF	Alta	Alta	Norway	t	69.975000	23.370000
101	ALG	Houari Boumediene	Algiers	Algeria	t	36.693333	3.216667
102	ALI	Alice Intl	Alice	USA	t	27.740000	-98.026667
103	ALJ	Alexander Bay	Alexander Bay	Namibia	t	-28.571667	16.535000
104	ALM	Alamogordo-White Sands Regl	Alamogordo	USA	t	32.838333	-105.990000
105	ALN	St Louis Regl	Alton	USA	t	38.890000	-90.045000
106	ALO	Waterloo Mun	Waterloo Ia	USA	t	42.556667	-92.400000
107	ALP	Aleppo Intl	Aleppo	Syria	t	36.178333	37.225000
108	ALS	San Luis Valley Regl/Bergman	Alamosa	USA	t	37.433333	-105.866667
109	ALW	Walla Walla Regl	Walla Walla	USA	t	46.093333	-118.286667
110	ALY	Alexandria	Alexandria Eg	Egypt	t	31.183333	29.946667
111	AMA	Amarillo Intl	Amarillo	USA	t	35.218333	-101.705000
112	AMB	Amberley	Ambilobe	Madagascar	t	-27.641667	152.711667
113	AMD	Ahmedabad	Ahmedabad	India	t	23.070000	72.626667
114	AMM	Queen Alia Intl	Amman	Jordan	t	31.721667	35.993333
115	AMN	Gratiot Community	Not In Tbl	\N	t	43.321667	-84.686667
116	AMQ	Pattimura	Ambon	Indonesia	t	-3.706667	128.088333
117	AMS	Schiphol	Amsterdam	Netherlands	t	52.306667	4.763333
118	AMW	Ames Mun	Ames	USA	t	41.991667	-93.621667
119	ANB	Anniston Metro	Anniston	USA	t	33.586667	-85.856667
120	ANC	Anchorage Intl	Anchorage	USA	t	61.173333	-149.995000
121	AND	Anderson Co	Anderson	USA	t	34.493333	-82.708333
122	ANF	Cerro Moreno Intl	Antofagasta	Chile	t	-23.440000	-70.441667
123	ANG	Brie-Champniers	Angouleme	France	t	45.730000	0.220000
124	ANK	Etimesgut Ab	Ankara Etimesgut	Turkey	t	39.950000	32.686667
125	ANR	Deurne	Antwerp	Belgium	t	51.190000	4.461667
126	ANU	V.c.bird Intl	Antigua	Antigua	t	17.140000	-61.785000
127	AOH	Lima Allen Co	Lima Oh	USA	t	40.708333	-84.025000
128	AOI	Falconara Mil	Ancona	Italy	t	43.615000	13.361667
129	AOJ	Aomori	Aomori	Japan	t	40.731667	140.693333
130	AOK	Karpathos	Karpathos	Greece	t	35.416667	27.150000
131	AOL	Paso De Los Libres	Paso Libres	Argentina	t	-29.688333	-57.151667
132	AOO	Altoona-Blair Co	Altoona	USA	t	40.295000	-78.320000
133	AOR	Sultan Abdul Halim	Alor Setar	Malaysia	t	6.193333	100.403333
134	APA	Centennial	Arapahoe	USA	t	39.570000	-104.848333
135	APC	Napa County	Napa	USA	t	38.211667	-122.280000
136	APF	Naples Mun	Naples Fl	USA	t	26.151667	-81.775000
137	APG	Phillips Aaf	Aberdeen Md	USA	t	39.465000	-76.168333
138	APL	Nampula	Nampula	Mozambique	t	-15.100000	39.283333
139	APN	Alpena Co Regl	Alpena	USA	t	45.076667	-83.560000
140	APT	Marion Co-Brown	Not In Tbl	\N	t	35.060000	-85.585000
141	APW	Faleolo Intl	Apia Faleolo	Western Samoa	t	-13.815000	-171.998333
142	AQI	Hafr Al-Batin	Qaisumah	Saudi Arabia	t	28.333333	46.123333
143	AQJ	Aqaba Intl	Aqaba	Jordan	t	29.611667	35.016667
144	AQP	Rodriguez Ballon	Arequipa	Peru	t	-16.336667	-71.568333
145	ARA	Acadiana Regl	New Iberia	USA	t	30.036667	-91.883333
146	ARG	Walnut Ridge Regl	Walnut Ridge	USA	t	36.125000	-90.923333
147	ARH	Talagi	Arkhangelsk	Russia	t	64.600000	40.718333
148	ARI	Chacalluta Intl	Arica	Chile	t	-18.345000	-70.335000
149	ARN	Arlanda	Stockholm Arlanda	Sweden	t	59.651667	17.918333
150	ART	Watertown Intl	Watertown Ny	USA	t	43.991667	-76.021667
151	ARV	Lakeland/Lee Meml	Minocqua	USA	t	45.926667	-89.730000
152	ARW	Arad	Arad	Romania	t	46.176667	21.263333
153	ASB	Ashkhabad	Ashkhabad	Turkmenistan	t	37.981667	58.360000
154	ASC	Ascension De Guarayos	Ascension	Bolivia	t	-15.720000	-63.093333
155	ASE	Aspen-Pitkin Co/Sardy	Aspen	USA	t	39.221667	-106.868333
156	ASH	Boire	Nashua	USA	t	42.781667	-71.513333
157	ASI	Ascension Aux Ab	Georgetown	St Helena	t	-7.970000	-14.393333
158	ASJ	Amami	Amani O Shima	Japan	t	28.426667	129.713333
159	ASK	Yamoussoukro	Yamoussourro	Ivory Coast	t	6.906667	-5.363333
160	ASL	Harrison Co	Marshall Tx	USA	t	32.521667	-94.306667
161	ASM	Asmara Intl	Asmara	Eritrea	t	15.285000	38.901667
162	ASN	Talladega Mun	Not In Tbl	\N	t	33.568333	-86.050000
163	ASP	Alice Springs	Alice Springs	Australia	t	-23.806667	133.901667
164	ASR	Erkilet Ab	Kayseri	Turkey	t	38.771667	35.493333
165	AST	Astoria Regl	Astoria	USA	t	46.156667	-123.878333
166	ASU	Silvio Pettirossi Int	Asuncion	Paraguay	t	-25.238333	-57.518333
167	ASW	Aswan	Aswan	Egypt	t	23.963333	32.820000
168	ASX	Kennedy Meml	Ashland Wi	USA	t	46.548333	-90.918333
169	ATH	Athens	Athens	Greece	t	37.895000	23.726667
170	ATL	Hartsfield Atlanta Intl	Atlanta	USA	t	33.640000	-84.426667
171	ATM	Altamira	Altimira	Brazil	t	-3.250000	-52.251667
172	ATQ	Amritsar	Amritsar	India	t	31.703333	74.801667
173	ATS	Artesia Mun	Artesia	USA	t	32.851667	-104.466667
174	ATW	Outagamie Co	Appleton	USA	t	44.256667	-88.518333
175	ATY	Watertown Mun	Watertown Sd	USA	t	44.913333	-97.153333
176	AUA	Beatrix Intl	Aruba	Aruba	t	12.503333	-70.011667
177	AUC	Santiago Perez	Arauca	Colombia	t	7.085000	-70.743333
178	AUG	Augusta State	Augusta Me	USA	t	44.320000	-69.796667
179	AUH	Abu Dhabi Intl	Abu Dhabi Intl	United Arab Emi	t	24.431667	54.650000
180	AUR	Aurillac	Aurillac	France	t	44.898333	2.418333
181	AUS	Mueller Mun	Austin Tx	USA	t	30.298333	-97.701667
182	AUZ	Aurora Mun	Aurora	USA	t	41.770000	-88.471667
183	AVB	Aviano Mil	Aviano	Italy	t	46.033333	12.601667
184	AVI	Maximo Gomez Intl	Ciego De Avila	Cuba	t	22.025000	-78.790000
185	AVL	Asheville Regl	Asheville Hndrsnv	USA	t	35.435000	-82.541667
186	AVN	Caumont	Avignon	France	t	43.906667	4.901667
187	AVP	Wilkes-Barre-Scranton Intl	Scrantn Wilkesbre	USA	t	41.336667	-75.723333
188	AVV	Avalon	Avalon Au	Australia	t	-38.038333	144.468333
189	AVX	Catalina	Catalina Avalon	USA	t	33.403333	-118.415000
190	AWK	Wake I Aaf	Wake Island	Us Pacific Is	t	19.280000	166.641667
191	AWM	West Memphis Mun	Not In Tbl	\N	t	35.135000	-90.233333
192	AWZ	Ahwaz	Ahwaz	Iran	t	31.336667	48.760000
193	AXA	Wallblake	Anguilla	Anguilla	t	18.210000	-63.051667
194	AXD	Dimokritos	Alexandroupolis	Greece	t	40.856667	25.956667
195	AXG	Algona Mun	Not In Tbl	\N	t	43.076667	-94.271667
196	AXH	Houston-Southwest	Not In Tbl	\N	t	29.505000	-95.476667
197	AXM	El Aden	Armenia	Colombia	t	4.456667	-75.770000
198	AXP	Spring Point	Spring Point	Bahamas	t	22.445000	-73.975000
199	AXS	Altus Mun	Altus	USA	t	34.696667	-99.338333
200	AXT	Akita	Akita	Japan	t	39.611667	140.221667
201	AXV	Armstrong	Not In Tbl	\N	t	40.493333	-84.298333
202	AYQ	Ayers Rock	Ayers Rock	Australia	t	-25.186667	130.973333
203	AYS	Waycross-Ware Co	Waycross	USA	t	31.248333	-82.395000
204	AYT	Antalya	Antalya	Turkey	t	36.900000	30.793333
205	AZD	Yazd	Yazd	Iran	t	31.905000	54.275000
206	AZI	Bateen	Abu Dhabi Bateen	United Arab Emi	t	24.428333	54.456667
207	AZO	Kalamazoo/Battle Creek Intl	Kalamazoo	USA	t	42.233333	-85.551667
208	AZR	Adrar	Adrar	Algeria	t	27.840000	-0.185000
209	AZY	Used By Jnh For Computer Stora	Not In Tbl	\N	t	36.000000	-97.000000
210	BAB	Beale Afb	Ba Automated Svcs	USA	t	39.135000	-121.435000
211	BAD	Barksdale Afb	Barksdale Afb	USA	t	32.501667	-93.661667
212	BAF	Barnes Mun	Westfield	USA	t	42.156667	-72.715000
213	BAH	Bahrain Intl	Bahrain	Bahrain	t	26.270000	50.633333
214	BAK	Bina	Baku	Azerbaijan	t	40.466667	50.050000
215	BAL	Batman Ab	Batman	Turkey	t	37.931667	41.118333
216	BAM	Battle Mountain	Battle Mountain	USA	t	40.598333	-116.873333
217	BAQ	Ernesto Cortissoz	Barranquilla	Colombia	t	10.893333	-74.783333
218	BAU	Bauru	Bauru	Brazil	t	-22.341667	-49.053333
219	BAY	Tautii-Magheraus	Baia Mape	Romania	t	47.658333	23.468333
220	BBB	Benson Mun	Not In Tbl	\N	t	45.331667	-95.650000
221	BBI	Bhubaneswar	Bhubaneswar	India	t	20.245000	85.820000
222	BBU	Baneasa	Bucharest Baneasa	Romania	t	44.503333	26.103333
223	BCD	Bacolod	Bacolod	Philippines	t	10.645000	122.921667
224	BCN	El Prat	Barcelona	Spain	t	41.298333	2.078333
225	BCV	Chievres Ab	Belmopan	Belize	t	50.576667	3.836667
226	BDA	Bermuda Intl	Bermuda	Bermuda	t	32.365000	-64.678333
227	BDG	Blanding Mun	Blanding	USA	t	37.581667	-109.481667
228	BDH	Bandar Lengeh	Bandar Lengeh	Iran	t	26.531667	54.830000
229	BDJ	Syamsudin Noor	Banjarmarsin	Indonesia	t	-3.440000	114.751667
230	BDL	Bradley Intl	Hartford Sprngfld	USA	t	41.938333	-72.681667
231	BDM	Bandirma Ab	Bandirma	Turkey	t	40.315000	27.978333
232	BDO	Husein Sastranegara	Bandung	Indonesia	t	-6.901667	107.575000
233	BDQ	Vadodara	Vadodara	India	t	22.328333	73.218333
234	BDR	Sikorsky Meml	Bridgeport	USA	t	41.163333	-73.125000
235	BDS	Casale Mil	Brindisi	Italy	t	40.656667	17.946667
236	BDT	Gbadolite	Gbadolite	Zaire Republic	t	4.250000	20.966667
237	BDU	Bardufoss Ab	Bardufoss	Norway	t	69.055000	18.541667
238	BEB	Benbecula	Benbecula	United Kingdom	t	57.476667	-7.365000
239	BEC	Beech Factory	Not In Tbl	\N	t	37.685000	-97.220000
240	BED	Hanscom	Bedford	USA	t	42.468333	-71.288333
241	BEF	Bluefields,nicaragua	Bluefields	Nicaragua	t	11.991667	-83.773333
242	BEG	Belgrade	Belgrade Beg	Yugoslavia	t	44.818333	20.311667
243	BEH	Southwest Michigan Regl	Benton Harbor	USA	t	42.128333	-86.428333
244	BEL	Val De Caes	Belem	Brazil	t	-1.383333	-48.478333
245	BEN	Benina	Benghazi	Libya	t	32.096667	20.270000
246	BES	Guipavas	Brest	France	t	48.446667	-4.420000
247	BET	Bethel	Bethel	USA	t	60.778333	-161.836667
248	BEW	Beira	Beira	Mozambique	t	-19.793333	34.898333
249	BEX	Benson Ab	Not In Tbl	\N	t	51.615000	-1.093333
250	BEY	Beirut Intl	Beirut	Lebanon	t	33.820000	35.488333
251	BFD	Bradford Regl	Bradford Pa	USA	t	41.801667	-78.640000
252	BFF	Heilig	Scottsbluff	USA	t	41.873333	-103.595000
253	BFI	Boeing Field/King Co Intl	Seattle Boeing	USA	t	47.530000	-122.301667
254	BFL	Meadows	Bakersfield	USA	t	35.433333	-119.056667
255	BFM	Mobile Downtown	Mob Aerospace Al	USA	t	30.625000	-88.066667
256	BFN	Bloemfontein	Bloemfontein	South Africa	t	-29.093333	26.303333
257	BFO	Buffalo Range	Buffalo Range	Zimbabwe	t	-21.008333	31.578333
258	BFS	Aldergrove	Belfast Intl	United Kingdom	t	54.656667	-6.215000
259	BGA	Palonegro	Bucaramanga	Colombia	t	7.130000	-73.188333
260	BGD	Hutchinson Co	Borger	USA	t	35.700000	-101.393333
261	BGE	Decatur Co Industrial	Bainbridge	USA	t	30.970000	-84.636667
262	BGF	M Poko	Bangui	Central Africa	t	4.395000	18.520000
263	BGI	Grantley Adams Intl	Barbados	Barbados	t	13.071667	-59.491667
264	BGM	Binghamton Regl/Link	Binghamton	USA	t	42.208333	-75.978333
265	BGN	Bruggen Ab	Bruggen	Germany	t	51.200000	6.133333
266	BGO	Flesland	Bergen	Norway	t	60.293333	5.218333
267	BGR	Bangor Intl	Bangor	USA	t	44.806667	-68.826667
268	BGS	Mcmahon-Wrinkle Big Springs	Big Spring Webb	USA	t	32.211667	-101.521667
269	BGY	Orio Al Serio	Bergamo	Italy	t	45.668333	9.700000
270	BHB	Hancock Co-Bar Harbor	Bar Harbor	USA	t	44.448333	-68.360000
271	BHD	Belfast City	Belfast City	United Kingdom	t	54.616667	-5.870000
272	BHH	Bisha	Bisha	Saudi Arabia	t	19.983333	42.621667
273	BHI	Comandante Espora Nas	Bahia Blanca	Argentina	t	-38.720000	-62.156667
274	BHJ	Bhuj	Bhuj	India	t	23.286667	69.670000
275	BHM	Birmingham Intl	Birmingham Al	USA	t	33.561667	-86.753333
276	BHO	Bhopal	Bhopal	India	t	23.285000	77.336667
277	BHV	Bahawalpur	Bahawalpur	Pakistan	t	29.343333	71.711667
278	BHX	Birmingham	Birmingham Uk	United Kingdom	t	52.453333	-1.745000
279	BHZ	Pampulha	Belo Horizonte	Brazil	t	-19.851667	-43.950000
280	BIA	Poretta	Bastia	France	t	42.550000	9.485000
281	BIF	Biggs Aaf	Biggs Aaf Tx	USA	t	31.850000	-106.380000
282	BIG	Fort Greely	Big Delta	USA	t	63.995000	-145.721667
283	BIH	Bishop	Bishop	USA	t	37.371667	-118.363333
284	BIK	Frans Kaisiepo	Biak	Indonesia	t	-1.191667	136.110000
285	BIL	Billings Logan Intl	Billings	USA	t	45.808333	-108.543333
286	BIO	Bilbao	Bilbao	Spain	t	43.301667	-2.908333
287	BIQ	Bayonne-Anglet	Biarritz	France	t	43.468333	-1.530000
288	BIS	Bismarck Mun	Bismarck	USA	t	46.773333	-100.746667
289	BIX	Keesler Afb	Biloxi	USA	t	30.410000	-88.923333
290	BIY	Bisho	Bisho	South Africa	t	-32.428333	27.283333
291	BJA	Soummam	Bejaia	Algeria	t	36.716667	5.066667
292	BJC	Jeffco	Broomfield	USA	t	39.908333	-105.116667
293	BJH	Bjh Test Arpt	Bajhang	Nepal	t	45.000000	-100.000000
294	BJL	Yundum Intl	Banjul	Gambia	t	13.341667	-16.658333
295	BJM	Bujumbura Intl	Bujumbura	Burundi	t	-3.316667	29.316667
296	BJO	Bermejo	Bermejo	Bolivia	t	-22.770000	-64.315000
297	BJX	De Guanajuato Intl	Leon	Mexico	t	20.990000	-101.480000
298	BJZ	Talavera La Real Ab	Badajoz	Spain	t	38.891667	-6.820000
299	BKE	Baker City Mun	Baker	USA	t	44.836667	-117.808333
300	BKF	Buckley Angb	Brooks Camp	USA	t	39.701667	-104.751667
301	BKK	Bangkok Intl	Bangkok	Thailand	t	13.913333	100.608333
302	BKL	Burke Lakefront	Clevelnd Lakefrnt	USA	t	41.516667	-81.683333
303	BKO	Senou	Bamako	Mali	t	12.538333	-7.945000
304	BKQ	Blackall	Blackall	Australia	t	-24.426667	145.423333
305	BKW	Raleigh Co Meml	Beckley	USA	t	37.786667	-81.123333
306	BLA	Gen. Jose Antonio Anzoategui	Barcelona Ve	Venezuela	t	10.110000	-64.686667
307	BLD	Boulder City Muni	Boulder City	USA	t	35.948333	-114.861667
308	BLE	Borlange Ab	Borlange	Sweden	t	60.421667	15.513333
309	BLF	Mercer Co	Bluefield Princtn	USA	t	37.295000	-81.206667
310	BLH	Blythe	Blythe	USA	t	33.618333	-114.716667
311	BLI	Bellingham Intl	Bellingham	USA	t	48.791667	-122.536667
312	BLK	Blackpool	Blackpool	United Kingdom	t	53.770000	-3.026667
313	BLL	Billund	Billund	Denmark	t	55.740000	9.151667
314	BLM	Allaire	Belmar	USA	t	40.186667	-74.123333
315	BLQ	Borgo Panigale	Bologna	Italy	t	44.530000	11.291667
316	BLR	Bangalore	Bangalore	India	t	12.950000	77.665000
317	BLV	Scott Afb	Scott Afb Il	USA	t	38.541667	-89.850000
318	BLZ	Chileka	Blantyre	Malawi	t	-15.678333	34.968333
319	BMA	Bromma	Stockholm Bromma	Sweden	t	59.353333	17.941667
320	BMC	Brigham City	Brigham City	USA	t	41.551667	-112.061667
321	BMG	Monroe Co	Bloomington In	USA	t	39.145000	-86.616667
322	BMI	Central Ill Regl	Bloomington Il	USA	t	40.478333	-88.918333
323	BML	Berlin Mun	Berlin Nh	USA	t	44.575000	-71.175000
324	BNA	Nashville Intl	Nashville	USA	t	36.123333	-86.676667
325	BND	Bandar A. Intl	Bandar Abbas	Iran	t	27.218333	56.376667
326	BNE	Brisbane Intl	Brisbane	Australia	t	-27.386667	153.116667
327	BNL	Barnwell Co	Not In Tbl	\N	t	33.256667	-81.388333
328	BNO	Burns Mun	Burns	USA	t	43.591667	-118.953333
329	BNP	Bannu	Bannu	Pakistan	t	32.966667	70.533333
330	BNS	Barinas	Barinas	Venezuela	t	8.616667	-70.216667
331	BNU	Blumenau	Blumenau	Brazil	t	-26.831667	-49.093333
332	BNX	Banja Luka	Banja Luka	Bosnia	t	44.940000	17.301667
333	BOC	Bocas Del Toro Intl	Bocas Del Toro	Panama	t	9.340000	-82.250000
334	BOD	Merignac	Bordeaux	France	t	44.828333	-0.713333
335	BOG	Eldorado Intl	Bogota	Colombia	t	4.705000	-74.141667
336	BOH	Bournemouth	Bournemouth	United Kingdom	t	50.778333	-1.840000
337	BOI	Boise Air Term	Boise	USA	t	43.565000	-116.225000
338	BOJ	Burgas	Bourgas	Bulgaria	t	42.566667	27.516667
339	BOM	Mumbai	Mumbai	India	t	19.090000	72.866667
340	BON	Flamingo	Bonaire	Netherlands An	t	12.138333	-68.276667
341	BOO	Bodo	Bodo	Norway	t	67.268333	14.366667
342	BOS	Logan Intl	Boston	USA	t	42.363333	-71.005000
343	BOU	Bourges	Bourges	France	t	47.065000	2.380000
344	BOW	Bartow Mun	Bartow	USA	t	27.943333	-81.783333
345	BOX	Borroloola	Borroloola	Australia	t	-16.075000	136.301667
346	BOY	Bobo-Dioulasso	Bobo Dioulasso	Burkina Faso	t	11.166667	-4.320000
347	BPI	Big Piney-Marbleton	Big Piney	USA	t	42.585000	-110.110000
348	BPN	Sepinggan	Balikpapan	Indonesia	t	-1.266667	116.893333
349	BPT	Jefferson Co	Beaumont Pt Arthr	USA	t	29.950000	-94.020000
350	BQK	Glynco Jetport	Brunswick Ga	USA	t	31.258333	-81.465000
351	BQN	Rafael Hernandez	Aguadilla	Puerto Rico	t	18.493333	-67.128333
352	BRC	S C De Bariloche	San Carlos De Bar	Argentina	t	-41.150000	-71.160000
353	BRD	Brainerd-Crow Wing Co Regl	Brainerd	USA	t	46.396667	-94.136667
354	BRE	Bremen	Bremen	Germany	t	53.046667	8.786667
355	BRI	Palese Macchie	Bari	Italy	t	41.136667	16.765000
356	BRL	Burlington Regl	Burlington Ia	USA	t	40.781667	-91.125000
357	BRM	Barquisimeto	Barquisimeto	Venezuela	t	10.041667	-69.360000
358	BRO	Brownsville/South Padre I Intl	Brownsville	USA	t	25.906667	-97.425000
359	BRQ	Turany	Brno	Czech Republic	t	49.150000	16.693333
360	BRS	Bristol	Bristol	United Kingdom	t	51.381667	-2.716667
361	BRU	Brussels National	Brussels	Belgium	t	50.901667	4.485000
362	BRV	Am Luneort	Bremerhaven	Germany	t	53.506667	8.576667
363	BRW	Wiley Post-Will Rogers Meml	Barrow	USA	t	71.285000	-156.765000
364	BRX	Maria Montez Intl .	Barahona	Dominican Rep	t	18.251667	-71.121667
365	BSB	Brasilia Intl	Brasilia	Brazil	t	-15.861667	-47.911667
366	BSL	Basle-Mulhouse	Basel Mulhouse	Switzerland	t	47.590000	7.530000
367	BSM	Austin Bergstrom Intl	Not In Tbl	\N	t	30.196667	-97.678333
368	BSR	Basrah Intl	Basra Internatl	Iraq	t	30.545000	47.665000
369	BTH	Hang Nadim	Batam Batu Besar	Indonesia	t	1.118333	104.113333
370	BTK	Bratsk	Bratsk	E Ural Russia	t	56.370000	101.698333
371	BTL	Kellogg	Battle Creek	USA	t	42.306667	-85.250000
372	BTM	Mooney	Butte	USA	t	45.953333	-112.496667
373	BTN	Marlboro Co	Bennettsville	USA	t	34.621667	-79.733333
374	BTR	Baton Rouge Metro-Ryan	Baton Rouge	USA	t	30.531667	-91.148333
375	BTS	M.r. Stefanik	Bratislava	Slovakia	t	48.170000	17.213333
376	BTV	Burlington Intl	Burlington Vt	USA	t	44.470000	-73.151667
377	BUD	Ferihegy	Budapest	Hungary	t	47.438333	19.263333
378	BUF	Greater Buffalo Intl	Buffalo	USA	t	42.940000	-78.731667
379	BUM	Butler Meml	Not In Tbl	\N	t	38.288333	-94.340000
380	BUQ	Bulawayo	Bulawayo	Zimbabwe	t	-20.016667	28.625000
381	BUR	Burbank-Glendale-Pasadena	Burbank	USA	t	34.200000	-118.358333
382	BUZ	Bushehr	Bushehr	Iran	t	28.948333	50.830000
383	BVA	Tille	Beauvais	France	t	49.455000	2.113333
384	BVB	Boa Vista Intl	Boa Vista Br	Brazil	t	2.841667	-60.691667
385	BVE	La Roche	Brive La Gaillard	France	t	45.151667	1.475000
386	BVH	Vilhena	Vilhena	Brazil	t	-12.700000	-60.091667
387	BVO	Bartlesville Mun	Bartlesville	USA	t	36.761667	-96.010000
388	BVX	Batesville Regl	Batesville	USA	t	35.725000	-91.646667
389	BVY	Beverly Mun	Beverly	USA	t	42.583333	-70.915000
390	BWD	Brownwood Regl	Brownwood	USA	t	31.793333	-98.955000
391	BWE	Braunschweig	Braunschweig	Germany	t	52.318333	10.555000
392	BWG	Bowling Green-Warren Co Regl	Bowling Green	USA	t	36.963333	-86.418333
393	BWI	Baltimore-Washington Intl	Baltimore Washntn	USA	t	39.175000	-76.666667
394	BWN	Brunei Intl	Bandar Seri Begwn	Brunei	t	4.943333	114.925000
395	BXA	Carr Meml	Not In Tbl	\N	t	30.813333	-89.863333
396	BYC	Yacuiba, Bol	Yacuiba	Bolivia	t	-21.958333	-63.651667
397	BYG	Johnson Co	Buffalo Wy	USA	t	44.380000	-106.721667
398	BYH	Blytheville Mun	Not In Tbl	\N	t	35.963333	-89.943333
399	BYK	Bouake	Bouake	Ivory Coast	t	7.751667	-5.066667
400	BYM	Bayamo	Bayamo	Cuba	t	20.396667	-76.618333
401	BZE	Bze/Arp Philip S W Goldson	Belize City Bze	Belize	t	17.538333	-88.305000
402	BZI	Balikesir Ab	Balikesir	Turkey	t	39.618333	27.925000
403	BZN	Gallatin	Bozeman	USA	t	45.776667	-111.151667
404	BZR	Vias	Beziers	France	t	43.323333	3.353333
405	BZU	Buta-Zega	Buta	Zaire Republic	t	2.816667	24.783333
406	BZV	Maya-Maya	Brazzaville	Congo Republic	t	-4.255000	15.248333
407	BZZ	Brize Norton Ab	Brize Norton	United Kingdom	t	51.748333	-1.581667
408	CAD	Wexford Co	Cadillac	USA	t	44.275000	-85.418333
409	CAE	Columbia Metro	Columbia Sc	USA	t	33.938333	-81.118333
410	CAG	Elmas Mil	Cagliari	Italy	t	39.245000	9.056667
411	CAI	Cairo Intl	Cairo	Egypt	t	30.121667	31.405000
412	CAJ	Canaima	Canaima	Venezuela	t	6.200000	-62.850000
413	CAK	Akron-Canton Regl	Akron Canton	USA	t	40.915000	-81.441667
414	CAM	Camiri Bolivia	Camiri	Bolivia	t	-20.003333	-63.525000
415	CAN	Baiyun	Guangzhou	China	t	23.183333	113.265000
416	CAP	Cap Haitien Intl	Cap Haitien	Haiti	t	19.733333	-72.200000
417	CAS	Anfa	Casablanca Cas	Morocco	t	33.555000	-7.661667
418	CAW	Bartolomeu Lisandro	Campos	Brazil	t	-21.700000	-41.306667
419	CAX	Carlisle	Carlisle	United Kingdom	t	54.936667	-2.806667
420	CAY	Rochambeau	Cayenne	French Guiana	t	4.818333	-52.361667
421	CBB	Jorge Wilsterman	Cochabamba	Bolivia	t	-17.415000	-66.173333
422	CBE	Greater Cumberland Regl	Cumberland	USA	t	39.615000	-78.760000
423	CBG	Cambridge	Cambridge Uk	United Kingdom	t	52.203333	0.176667
424	CBL	Ciudad Bolivar	Ciudad Bolivar	Venezuela	t	8.133333	-63.535000
425	CBM	Columbus Afb	Not In Tbl	\N	t	33.645000	-88.445000
426	CBQ	Calabar	Calabar	Nigeria	t	4.975000	8.346667
427	CBR	Canberra	Canberra	Australia	t	-35.306667	149.195000
428	CCB	Cable	Upland	USA	t	34.110000	-117.686667
429	CCF	Salvaza	Carcassonne	France	t	43.216667	2.308333
430	CCK	Cocos I Intl	Cocos Islands	Australia	t	-12.188333	96.833333
431	CCP	Carriel Sur Intl	Concepcion Cl	Chile	t	-36.773333	-73.060000
432	CCR	Buchanan	Concord Ca	USA	t	37.988333	-122.056667
433	CCS	Simon Bolivar Intl	Caracas	Venezuela	t	10.606667	-66.990000
434	CCU	Netaji Subhas Chandra Bose Int	Calcutta	India	t	22.651667	88.448333
435	CDB	Cold Bay	Cold Bay	USA	t	55.205000	-162.723333
436	CDC	Cedar City Mun	Cedar City	USA	t	37.700000	-113.098333
437	CDG	Charles-De-Gaulle	Paris De Gaulle	France	t	49.008333	2.548333
438	CDH	Harrell	Camden Ar	USA	t	33.621667	-92.763333
439	CDJ	Conceicao Do Araguaia	Conceicao	Brazil	t	-8.348333	-49.301667
440	CDS	Childress Mun	Childress	USA	t	34.433333	-100.286667
441	CDV	Cordova-Smith	Cordova Mile 13	USA	t	60.491667	-145.476667
442	CEB	Cebu	Cebu	Philippines	t	10.333333	123.900000
443	CEC	Jack Mcnamara Fld	Crescent City	USA	t	41.780000	-124.235000
444	CEF	Westover Arb/Metro	Chicopee	USA	t	42.198333	-72.533333
445	CEN	Ciudad Obregon Intl	Ciudad Obregon	Mexico	t	27.391667	-109.831667
446	CEP	Concepcion Bol	Concepcion Bo	Bolivia	t	-16.140000	-62.025000
447	CEQ	Cannes Fr	Cannes	France	t	43.560000	6.870000
448	CER	Maupertus	Cherbourg	France	t	49.651667	-1.473333
449	CEV	Mettel	Not In Tbl	\N	t	39.698333	-85.130000
450	CEW	Sikes	Crestview	USA	t	30.778333	-86.521667
451	CEY	Kyle-Oakley	Murray	USA	t	36.665000	-88.370000
452	CEZ	Cortez Mun	Cortez	USA	t	37.301667	-108.626667
453	CFE	Aulnat	Clermnt Ferrand	France	t	45.786667	3.163333
454	CFG	Cienfuegos	Cienfuegos	Cuba	t	22.156667	-80.411667
455	CFR	Carpiquet	Caen	France	t	49.173333	-0.448333
456	CFS	Coffs Harbour	Coffs Harbour	Australia	t	-30.318333	153.121667
457	CFU	Ioannis Kapodistrias	Corfu	Greece	t	39.601667	19.911667
458	CGB	Marechal Rondon Intl	Cuiaba	Brazil	t	-15.648333	-56.116667
459	CGF	Cuyahoga Co	Clevelnd Cuyahoga	USA	t	41.565000	-81.485000
460	CGH	Congonhas Intl	Sao Paulo Cgh	Brazil	t	-23.625000	-46.655000
461	CGI	Cape Girardeau Regl	Cape Girardeau	USA	t	37.225000	-89.570000
462	CGK	Soekarno-Hatta Intl	Jakarta Cgk	Indonesia	t	-6.125000	106.656667
463	CGN	Cologne-Bonn	Cologne	Germany	t	50.865000	7.141667
464	CGP	Chittagong	Chittagong	Bangladesh	t	22.255000	91.825000
465	CGQ	Dafangshen	Changchun	China	t	43.905000	125.198333
466	CGR	Campo Grande Intl	Campo Grande	Brazil	t	-20.468333	-54.668333
467	CGU	Manuel Carlos Piar	Ciudad Guayana	Venezuela	t	8.300000	-62.733333
468	CGX	Merrill C. Meigs Field	Chicago Meigs	USA	t	41.865000	-87.613333
469	CGY	Cagayan De Oro	Cagayan De Oro	Philippines	t	8.425000	124.613333
470	CGZ	Casa Grande Mun	Casa Grande	USA	t	32.953333	-111.766667
471	CHA	Lovell	Chattanooga	USA	t	35.035000	-85.203333
472	CHC	Christchurch Intl	Christchurch	New Zealand	t	-43.486667	172.533333
473	CHD	Williams Afb	Chandler	USA	t	33.313333	-111.656667
474	CHK	Chickasha Mun	Not In Tbl	\N	t	35.095000	-97.965000
475	CHO	Charlottesville-Albemarle	Charlottesville	USA	t	38.138333	-78.451667
476	CHQ	Souda Ab	Chania	Greece	t	35.531667	24.151667
477	CHR	Deols	Chateauroux	France	t	46.861667	1.721667
478	CHS	Charleston Afb/Intl	Charleston Sc	USA	t	32.898333	-80.040000
479	CIA	Ciampino	Rome Ciampino	Italy	t	41.798333	12.595000
480	CIC	Chico Mun	Chico	USA	t	39.795000	-121.858333
481	CID	Cedar Rapids Mun	Cedr Rpds Iowa Cy	USA	t	41.883333	-91.710000
482	CIJ	Cobija Bol	Cobija	Bolivia	t	-11.028333	-68.780000
483	CIU	Chippewa Co Intl	Sault Ste Marie	USA	t	46.246667	-84.470000
484	CIX	Jose Abelardo Quinones Gonzale	Chiclayo	Peru	t	-6.783333	-79.825000
485	CJB	Coimbatore	Coimbatore	India	t	11.028333	77.041667
486	CJC	El Loa	Calama	Chile	t	-22.493333	-68.901667
487	CJS	Abraham Gonzalez Intl	Ciudad Juarez	Mexico	t	31.635000	-106.426667
488	CJU	Cheju Intl	Cheju	South Korea	t	33.506667	126.495000
489	CKB	Benedum	Clarksburg	USA	t	39.293333	-80.228333
490	CKG	Jiangbei	Chongqing	China	t	29.716667	106.640000
491	CKM	Fletcher	Not In Tbl	\N	t	34.298333	-90.511667
492	CKS	Carajas	Carajas	Brazil	t	-6.118333	-50.003333
493	CKV	Outlaw	Clarksville	USA	t	36.621667	-87.413333
494	CKY	Gbessia	Conakry	Guinea	t	9.566667	-13.618333
495	CLD	Mc Clellan-Palomar	Carlsbad Palomar	USA	t	33.126667	-117.280000
496	CLE	Cleveland-Hopkins Intl	Cleveland	USA	t	41.410000	-81.848333
497	CLF	Coltishall Ab	Coltishall	United Kingdom	t	52.753333	1.358333
498	CLJ	Someseni	Cluj	Romania	t	46.785000	23.686667
499	CLL	Easterwood	College Station	USA	t	30.588333	-96.363333
500	CLM	Fairchild Intl	Port Angeles	USA	t	48.120000	-123.498333
501	CLN	Carolina	Carolina	Brazil	t	-7.333333	-47.433333
502	CLO	Alfonso Bonilla Aragon Intl	Cali	Colombia	t	3.546667	-76.385000
503	CLQ	Colima	Colima	Mexico	t	19.273333	-103.576667
504	CLT	Charlotte/Douglas Intl	Charlotte	USA	t	35.213333	-80.941667
505	CLU	Columbus Mun	Columbus In	USA	t	39.261667	-85.895000
506	CLY	St Catherine	Calvi	France	t	42.520000	8.793333
507	CMA	Camarillo	Cunnamulla	Australia	t	34.213333	-119.093333
508	CMB	Bandaranaike Intl	Colombo	Sri Lanka	t	7.178333	79.881667
509	CME	Ciudad Del Carmen	Ciudad Del Carmen	Mexico	t	18.651667	-91.800000
510	CMF	Aix-Les-Bains	Chambery	France	t	45.640000	5.880000
511	CMG	Corumba Intl	Corumba	Brazil	t	-19.010000	-57.670000
512	CMH	Port Columbus Intl	Columbus Oh	USA	t	39.995000	-82.888333
513	CMI	Univ Of Illinois-Willard	Champaign	USA	t	40.038333	-88.276667
514	CMN	Mohamed V	Casablanca Cmn	Morocco	t	33.366667	-7.583333
515	CMR	Houssen	Colmar	France	t	48.110000	7.360000
516	CMW	Camaguey	Camaguey	Cuba	t	21.418333	-77.846667
517	CMX	Houghton Co Meml	Hancock	USA	t	47.168333	-88.488333
518	CND	M. Kogalniceanu	Constanta	Romania	t	44.361667	28.488333
519	CNF	Tancredo Neves Intl	Belo Horizonte	Brazil	t	-19.623333	-43.970000
520	CNG	Chateaubernard Ab	Cognac	France	t	45.656667	-0.316667
521	CNM	Cavern City	Carlsbad Nm	USA	t	32.336667	-104.261667
522	CNO	Chino	Chino	USA	t	33.973333	-117.635000
523	CNQ	Corrientes	Corrientes	Argentina	t	-27.438333	-58.766667
524	CNS	Cairns Intl	Cairns	Australia	t	-16.886667	145.755000
525	CNW	Tstc Waco	Waco Connall	USA	t	31.636667	-97.073333
526	CNX	Chiang Mai Intl	Chiang Mai	Thailand	t	18.771667	98.965000
527	CNY	Canyonlands	Moab	USA	t	38.755000	-109.753333
528	COA	Columbia	Columbia Ca	USA	t	38.030000	-120.413333
529	COC	Comodoro Pierrestegui	Concordia Ar	Argentina	t	-31.303333	-58.006667
530	COD	Yellowstone Regl	Cody Yellowstone	USA	t	44.520000	-109.023333
531	COE	Coeur D Alene	Coeur D Alene	USA	t	47.773333	-116.818333
532	COF	Patrick Afb	Cocoa Beach	USA	t	28.235000	-80.608333
533	CON	Concord Mun	Concord Nh	USA	t	43.203333	-71.501667
534	COO	Cadjehoun	Cotonou	Benin	t	6.353333	2.385000
535	COR	Ing Aeron Ambrosio Lv Taravell	Cordoba Ar	Argentina	t	-31.315000	-64.210000
536	COS	City Of Colorado Springs Mun	Colorado Springs	USA	t	38.805000	-104.700000
537	COT	Cotulla-La Salle Co	Not In Tbl	\N	t	28.458333	-99.220000
538	COU	Columbia Regl	Columbia Jeff Cty	USA	t	38.816667	-92.218333
539	CPE	Alberto Acuna Ongay	Campeche	Mexico	t	19.815000	-90.500000
540	CPH	Kastrup	Copenhagen	Denmark	t	55.618333	12.656667
541	CPQ	Amarais	Campinas	Brazil	t	-22.860000	-47.108333
542	CPR	Natrona Co Intl	Casper	USA	t	42.906667	-106.463333
543	CPS	St Louis Downtown-Parks	Bi State Parks	USA	t	38.570000	-90.155000
544	CPT	Cape Town Intl	Capetown	South Africa	t	-33.966667	18.605000
545	CPV	Joao Suassuna	Campina Grande	Brazil	t	-7.268333	-35.893333
546	CQF	Calais-Dunkerque	Calais	France	t	50.961667	1.951667
547	CRC	Santa Ana	Cartago	USA	t	4.756667	-75.955000
548	CRD	Gen.mosconi Intl Apt	Como Rivadavia	Argentina	t	-45.783333	-67.466667
549	CRE	Grand Strand	Myrtle Beach	USA	t	33.811667	-78.723333
550	CRG	Craig Mun	Jacksonville Crg	USA	t	30.335000	-81.513333
551	CRK	Clark Intl	Luzon Clark Field	Philippines	t	15.188333	120.555000
552	CRL	Brussels South	Charleroi	Belgium	t	50.460000	4.453333
553	CRP	Corpus Christi Intl	Corpus Christi	USA	t	27.770000	-97.500000
554	CRQ	Mc Clellan-Palomar	Caravelas	Brazil	t	33.126667	-117.280000
555	CRS	Campbell-Corsicana Mun	Corsicana	USA	t	32.026667	-96.396667
556	CRT	Stell	Condo Resorts	USA	t	33.178333	-91.880000
557	CRV	Crotone	Crotone	Italy	t	38.995000	17.078333
558	CRW	Yeager	Charleston Wv	USA	t	38.371667	-81.591667
559	CRX	Turner	Corinth	USA	t	34.913333	-88.603333
560	CSF	Creil Ab	Not In Tbl	\N	t	49.253333	2.520000
561	CSG	Columbus Metro	Columbus Ga	USA	t	32.515000	-84.938333
562	CSM	Clinton-Sherman	Commercial Sabre	USA	t	35.338333	-99.200000
563	CSV	Crossville Meml	Crossville	USA	t	35.950000	-85.083333
564	CSX	Huanghua	Changsha	China	t	28.186667	113.221667
565	CTA	Fontanarossa	Catania	Italy	t	37.465000	15.063333
566	CTB	Cut Bank Mun	Coritgo Blanco	United Kingdom	t	48.608333	-112.375000
567	CTC	Catamarca	Catamarca	Argentina	t	-28.585000	-65.753333
568	CTG	Rafael Nunez	Cartagena	Colombia	t	10.445000	-75.515000
569	CTM	Chetumal Intl	Chetumal	Mexico	t	18.500000	-88.316667
570	CTS	New Chitose	Sapporo Chitose	Japan	t	42.771667	141.695000
571	CTY	Cross City	Not In Tbl	\N	t	29.635000	-83.103333
572	CUC	Camilo Daza	Cucuta	Colombia	t	7.930000	-72.515000
573	CUE	Mariscal Lamar	Cuenca	Ecuador	t	-2.885000	-78.983333
574	CUH	Cushing Mun	Not In Tbl	\N	t	35.948333	-96.771667
575	CUL	Culiacan Intl	Culiacan	Mexico	t	24.763333	-107.473333
576	CUM	Antonio Jose De Sucre	Cumana	Venezuela	t	10.453333	-64.130000
577	CUN	Cancun Intl	Cancun	Mexico	t	21.036667	-86.883333
578	CUP	Gen.jose F. Bermudez	Carupano	Venezuela	t	10.666667	-63.250000
579	CUR	Aeropuerto Hato	Curacao	Netherlands An	t	12.191667	-68.956667
580	CUU	Gen Div P A Roberto Fierro	Chihuahua	Mexico	t	28.701667	-105.963333
581	CUZ	Reyes - Velazco Astete	Cuzco	Peru	t	-13.531667	-71.936667
582	CVG	Cincinnati/Northern Ky Intl	Cincinnati	USA	t	39.045000	-84.661667
583	CVJ	Cuernavaca	Cuernavaca	Mexico	t	18.835000	-99.261667
584	CVM	Ciudad Victoria	Ciudad Victoria	Mexico	t	23.701667	-98.955000
585	CVN	Clovis Mun	Clovis Municipal	USA	t	34.425000	-103.078333
586	CVO	Corvallis Mun	Corvallis	USA	t	44.496667	-123.288333
587	CVS	Cannon Afb	Clovis Cannon	USA	t	34.381667	-103.321667
588	CVT	Coventry	Coventry	United Kingdom	t	52.368333	-1.476667
589	CWA	Central Wisconsin	Central Wisc Arpt	USA	t	44.778333	-89.665000
590	CWB	Afonso Pena Intl	Curitiba Cwb	Brazil	t	-25.526667	-49.171667
591	CWI	Clinton Mun	Clinton Ia	USA	t	41.830000	-90.328333
592	CWL	Cardiff	Cardiff	United Kingdom	t	51.395000	-3.341667
593	CXB	Cox S Bazar	Coxs Bazar	Bangladesh	t	21.433333	91.966667
594	CXI	Cassidy Intl	Christmas Island	Kiribati	t	1.990000	-157.358333
595	CXJ	Campo Dos Bugres	Caxias	Brazil	t	-29.195000	-51.188333
596	CXO	Montgomery Co	Conroe	USA	t	30.351667	-95.413333
597	CXX	Cachimbo	Not In Tbl	\N	t	-9.335000	-54.965000
598	CXY	Capital City	Cat Cay	Bahamas	t	40.216667	-76.850000
599	CYB	Gerrard-Smith Intnl	Cayman Brac	Cayman Islands	t	19.686667	-79.885000
600	CYI	Chiayi Aero	Chiayi	Taiwan	t	23.466667	120.383333
601	CYO	Cayo Largo Del Sur	Cayo Largo Del Sr	Cuba	t	21.615000	-81.545000
602	CYS	Cheyenne	Cheyenne	USA	t	41.155000	-104.811667
603	CZE	Jose L Chirinos Intl	Coro	Venezuela	t	11.416667	-69.666667
604	CZM	Cozumel Intl	Cozumel	Mexico	t	20.523333	-86.925000
605	CZS	Cruzeiro Do Sul-Intl	Cruziero Do Sul	Brazil	t	-7.598333	-72.768333
606	DAB	Daytona Beach Intl	Daytona Beach	USA	t	29.178333	-81.056667
607	DAC	Zia Intl	Dhaka	Bangladesh	t	23.841667	90.400000
608	DAD	Danang Intl	Da Nang	Vietnam	t	16.041667	108.205000
609	DAG	Barstow-Daggett	Daggett	USA	t	34.853333	-116.786667
610	DAL	Dallas Love	Dallas Love Field	USA	t	32.846667	-96.851667
611	DAM	Damascus Intl	Damascus	Syria	t	33.410000	36.513333
612	DAN	Danville Regl	Danville Va	USA	t	36.573333	-79.335000
613	DAR	Dar-Es-Salaam Intl	Dar Es Salaam	Tanzania	t	-6.875000	39.201667
614	DAS	Great Bear Lake	Great Bear Lake	Canada	t	66.703333	-119.703333
615	DAV	Enrique Malek Intl	David	Panama	t	8.390000	-82.433333
616	DAY	Cox-Dayton Intl	Dayton	USA	t	39.901667	-84.218333
617	DBA	Dalbandin	Dalbandin	Pakistan	t	28.878333	64.403333
618	DBN	Barron	Dublin Ga	USA	t	32.563333	-82.985000
619	DBQ	Dubuque Regl	Dubuque	USA	t	42.401667	-90.708333
620	DBT	Oak Harbor Air Park	Debre Tabor	Ethiopia	t	48.251667	-122.280000
621	DBV	Cilipi	Dubrovnik	Croatia	t	42.560000	18.273333
622	DCA	Washington National	Washington Natl	USA	t	38.851667	-77.036667
623	DCI	Decimomannu Mil	Not In Tbl	\N	t	39.355000	8.971667
624	DCM	Castres-Mazamet	Castres	France	t	43.555000	2.291667
625	DCU	Pryor Regl	Decatur Al	USA	t	34.651667	-86.945000
626	DDC	Dodge City Regl	Dodge City	USA	t	37.761667	-99.965000
627	DEC	Decatur	Decatur Il	USA	t	39.833333	-88.865000
628	DEL	Indira Gandhi Intl	Delhi	India	t	28.568333	77.113333
629	DEN	Denver Intl	Denver	USA	t	39.858333	-104.666667
630	DET	Detroit City	Detroit City Arpt	USA	t	42.408333	-83.008333
631	DEZ	Deir Zzor	Deirezzor	Syria	t	35.283333	40.166667
632	DFI	Defiance Meml	Not In Tbl	\N	t	41.336667	-84.428333
633	DFW	Dallas-Ft Worth Intl	Dallas Ft Worth	USA	t	32.895000	-97.036667
634	DGO	Durango	Durango Mx	Mexico	t	24.125000	-104.526667
635	DGW	Converse Co	Douglas Wy	USA	t	42.796667	-105.385000
636	DHA	Dhahran Intl	Dhahran	Saudi Arabia	t	26.263333	50.151667
637	DHC	Bullhead Laughlin	Not In Tbl	\N	t	35.165000	-114.565000
638	DHN	Dothan	Dothan	USA	t	31.320000	-85.448333
639	DHT	Dalhart Mun	Dalhart	USA	t	36.023333	-102.546667
640	DIB	Dibrugarh	Dibrugarh	India	t	27.480000	95.021667
641	DIJ	Longvic Ab	Dijon	France	t	47.265000	5.095000
642	DIK	Dickinson Mun	Dickinson	USA	t	46.796667	-102.800000
643	DIR	A.t.d. Yilma Intl	Dire Dawa	Ethiopia	t	9.633333	41.866667
644	DIY	Diyarbakir	Diyarbakir	Turkey	t	37.893333	40.200000
645	DJE	Zarzis	Djerba	Tunisia	t	33.873333	10.780000
646	DJG	Tiska	Djanet	Algeria	t	24.268333	9.451667
647	DJJ	Sentani	Jayapura	Indonesia	t	-2.571667	140.510000
648	DKK	Chautauqua Co/Dunkirk	Not In Tbl	\N	t	42.493333	-79.271667
649	DKR	Leopold Sedar Senghor	Dakar	Senegal	t	14.743333	-17.498333
650	DLA	Douala	Douala	Cameroon	t	4.013333	9.708333
651	DLC	Zhoushuizi	Dalian	China	t	38.960000	121.530000
652	DLD	Dagali	Geilo	Norway	t	60.416667	8.513333
653	DLE	Tavaux	Dole	France	t	47.041667	5.435000
654	DLF	Laughlin Afb	Laughlin Afb Tx	USA	t	29.358333	-100.776667
655	DLG	Dillingham	Dillingham	USA	t	59.045000	-158.503333
656	DLH	Duluth Intl	Duluth	USA	t	46.841667	-92.193333
657	DLM	Dalaman	Dalaman	Turkey	t	36.715000	28.793333
658	DLN	Dillon	Not In Tbl	\N	t	45.255000	-112.551667
659	DLS	Columbia Gorge Regl/The Dalles	The Dalles	USA	t	45.618333	-121.166667
660	DMA	Davis-Monthan Afb	Davis Monthan Afb	USA	t	32.165000	-110.881667
661	DMN	Deming Mun	Not In Tbl	\N	t	32.261667	-107.720000
662	DNA	Kadena Ab	Kadena Afb	Japan	t	26.351667	127.768333
663	DNN	Dalton Mun	Dalton	USA	t	34.721667	-84.868333
664	DNR	Pleurtuit-St Malo	Dinard	France	t	48.588333	-2.078333
665	DNV	Vermilion Co	Danville Il	USA	t	40.198333	-87.595000
666	DNZ	Cardak Ab	Denizli	Turkey	t	37.788333	29.705000
667	DOD	Dodoma	Dodoma	Tanzania	t	-6.166667	35.748333
668	DOH	Doha Intl	Doha	Qatar	t	25.260000	51.565000
669	DOL	St Gatien	Deauville	France	t	49.361667	0.165000
670	DOM	Melville Hall,dominica	Dominica	Dominica	t	15.543333	-61.308333
671	DOV	Dover Afb	Dover Afb	USA	t	39.128333	-75.465000
672	DPG	Michael Aaf	Not In Tbl	\N	t	40.198333	-112.936667
673	DPS	Bali Intl	Denpasar Bali	Indonesia	t	-8.746667	115.168333
674	DRB	Derby	Derby	Australia	t	-17.370000	123.660000
675	DRI	Beauregard Parish	De Ridder	USA	t	30.830000	-93.338333
676	DRO	Durango-La Plata Co	Durango Co	USA	t	37.150000	-107.753333
677	DRS	Dresden	Dresden	Germany	t	51.131667	13.766667
678	DRT	Del Rio Intl	Del Rio	USA	t	29.371667	-100.921667
679	DRW	Darwin	Darwin	Australia	t	-12.413333	130.876667
680	DSK	Dera Ismail Khan	Dera Ismail	Pakistan	t	31.908333	70.896667
681	DSM	Des Moines Intl	Des Moines	USA	t	41.533333	-93.660000
682	DTA	Delta Mun	Delta	USA	t	39.381667	-112.508333
683	DTO	Denton Mun	Not In Tbl	\N	t	33.201667	-97.196667
684	DTW	Detroit Metro Wayne Co	Detroit Metro	USA	t	42.211667	-83.348333
685	DUA	Eaker	Durant	USA	t	33.941667	-96.393333
686	DUB	Dublin	Dublin	Ireland	t	53.430000	-6.253333
687	DUC	Halliburton	Duncan	USA	t	34.471667	-97.958333
688	DUD	Dunedin	Dunedin	New Zealand	t	-45.930000	170.198333
689	DUG	Bisbee Douglas Intl	Douglas Bisbee	USA	t	31.468333	-109.603333
690	DUJ	Du Bois-Jefferson Co	Du Bois	USA	t	41.176667	-78.898333
691	DUR	Durban Intl	Durban	South Africa	t	-29.970000	30.951667
692	DUS	Dusseldorf	Duesseldorf	Germany	t	51.280000	6.756667
693	DUT	Unalaska	Dutch Harbor	USA	t	53.905000	-166.548333
694	DVO	Bangoy Intl	Davao	Philippines	t	7.128333	125.646667
695	DVX	New Denver Intl	Dover Del Airpark	USA	t	39.850000	-104.650000
696	DWH	Hooks Meml	Not In Tbl	\N	t	30.061667	-95.551667
697	DXB	Dubai Intl	Dubai	United Arab Emi	t	25.250000	55.360000
698	DYR	Vityazevo	Anadyr	Russia	t	64.735000	177.738333
699	DYS	Dyess Afb	Abilene Dyess	USA	t	32.420000	-99.856667
700	DZA	Pamandzi	Dzaoudzi	Mayotte	t	-12.806667	45.280000
701	DZO	Santa Bernardina Intl	Durazno	Uruguay	t	-33.355000	-56.495000
702	EAM	Nejran	Nejran	Saudi Arabia	t	17.611667	44.420000
703	EAS	Hondarribia	San Sebastian	Spain	t	43.356667	-1.790000
704	EAT	Pangborn Meml	Wenatchee	USA	t	47.398333	-120.206667
705	EAU	Chippewa Valley Regl	Eau Claire	USA	t	44.865000	-91.485000
706	EBB	Entebbe Intl	Entebbe	Uganda	t	0.041667	32.436667
707	EBD	El Obeid	El Obeid	Sudan	t	13.158333	30.241667
708	EBJ	Esbjerg	Esbjerg	Denmark	t	55.525000	8.551667
709	EBU	Boutheon	St Etienne	France	t	45.535000	4.298333
710	ECG	Elizabeth City Cgas/Mun	Elizabeth City	USA	t	36.260000	-76.173333
711	ECS	Mondell	Newcastle Wy	USA	t	43.885000	-104.316667
712	EDE	Northeastern Regl	Edenton	USA	t	36.026667	-76.566667
713	EDF	Elmendorf Afb	Elmendorf Afb	USA	t	61.251667	-149.793333
714	EDI	Edinburgh	Edinburgh	United Kingdom	t	55.951667	-3.360000
715	EDM	Les Ajoncs	La Roche	France	t	46.703333	-1.380000
716	EDW	Edwards Afb	Edwards Afb	USA	t	34.905000	-117.883333
717	EED	Needles	Not In Tbl	\N	t	34.765000	-114.621667
718	EEN	Dillant-Hopkins	Keene	USA	t	42.898333	-72.270000
719	EFD	Ellington	Ellington Field	USA	t	29.606667	-95.158333
720	EFL	Kefallinia	Kefalonia	Greece	t	38.120000	20.500000
721	EGC	Roumaniere	Bergerac	France	t	44.825000	0.521667
722	EGE	Eagle Co Regl	Vail Eagle	USA	t	39.641667	-106.916667
723	EGN	Geneina	El Geneina	Sudan	t	13.488333	22.450000
724	EGS	Egilsstadir	Egilsstadir	Iceland	t	65.281667	-14.401667
725	EGV	Eagle River Union	Eagle River	USA	t	45.931667	-89.268333
726	EIL	Eielson Afb	Eielson Afb Ak	USA	t	64.663333	-147.098333
727	EIN	Eindhoven Ab	Eindhoven	Netherlands	t	51.450000	5.373333
728	EIS	Beef I Intl	Tortola Beef Is	British Virgin	t	18.450000	-64.541667
729	EJA	Yariguies	Barrancabermeja	Colombia	t	7.023333	-73.775000
730	EJH	Wejh	Wedjh	Saudi Arabia	t	26.198333	36.475000
731	EKA	Murray	Eureka Murray Fld	USA	t	40.803333	-124.113333
732	EKI	Elkhart Mun	Elkhart	USA	t	41.718333	-86.001667
733	EKN	Elkins-Randolph Co	Elkins	USA	t	38.888333	-79.856667
734	EKO	Elko Mun-Harris	Elko	USA	t	40.825000	-115.790000
735	EKT	Eskilstuna Ab	Eskilstuna	Sweden	t	59.351667	16.708333
736	EKX	Addington	Elizbthtwn Ft Knx	USA	t	37.686667	-85.923333
737	ELD	South Arkansas Regl At Goodwin	El Dorado Ar	USA	t	33.220000	-92.811667
738	ELG	El Golea	El Golea	Algeria	t	30.566667	2.866667
739	ELH	North Eleuthera	North Eleuthera	Bahamas	t	25.483333	-76.683333
740	ELM	Elmira/Corning Regl	Elmira Corning	USA	t	42.158333	-76.890000
741	ELN	Bowers	Ellensburg	USA	t	47.031667	-120.530000
742	ELP	El Paso Intl	El Paso	USA	t	31.806667	-106.376667
743	ELQ	Gassim	Gassim	Saudi Arabia	t	26.301667	43.773333
744	ELS	East London	East London	South Africa	t	-33.033333	27.821667
745	ELU	Guemar	El Oued	Algeria	t	33.516667	6.783333
746	ELY	Ely	Ely Nv	USA	t	39.298333	-114.841667
747	ELZ	Wellsville Mun/Tarantine	Not In Tbl	\N	t	42.108333	-77.991667
748	EMA	East Midlands	East Midlands	United Kingdom	t	52.830000	-1.323333
749	ENA	Kenai Mun	Kenai	USA	t	60.570000	-151.246667
750	ENC	Essey	Nancy	France	t	48.691667	6.226667
751	ENI	Yenisehir Ab	Not In Tbl	\N	t	40.255000	29.563333
752	ENL	Centralia Mun	Centralia Il	USA	t	38.513333	-89.091667
753	ENQ	Col Enrique Soto Cano Ab	Not In Tbl	\N	t	14.381667	-87.620000
754	ENS	Twenthe Ab	Enschede	Netherlands	t	52.275000	6.888333
755	ENU	Enugu	Enugu	Nigeria	t	6.466667	7.558333
756	ENV	Wendover	Wendover	USA	t	40.718333	-114.031667
757	ENW	Kenosha Regl	Kenosha	USA	t	42.595000	-87.926667
758	EPH	Ephrata Mun	Ephrata	USA	t	47.303333	-119.513333
759	EPL	Mirecourt	Epinal	France	t	48.321667	6.065000
760	EQS	Esquel	Esquel	Argentina	t	-42.906667	-71.143333
761	ERC	Erzincan	Erzincan	Turkey	t	39.713333	39.520000
762	ERF	Erfurt	Erfurt	Germany	t	50.978333	10.956667
763	ERH	Moulay Ali Cherif	Errachidla	Morocco	t	31.950000	-4.400000
764	ERI	Erie Intl	Erie	USA	t	42.081667	-80.175000
765	ERV	Kerrville Mun-Schreiner	Kerrville	USA	t	29.976667	-99.085000
766	ERZ	Erzurum	Erzurum	Turkey	t	39.955000	41.168333
767	ESB	Esenboga	Ankara Esenboga	Turkey	t	40.126667	32.995000
768	ESC	Delta Co	Escanaba	USA	t	45.721667	-87.093333
769	ESF	Alexandria Esler Regl	Alexandria La	USA	t	31.393333	-92.295000
770	ESK	Eskisehir	Eskisehir	Turkey	t	39.785000	30.583333
771	ESM	General Rivadeneira Apt.	Esmeraldas	Ecuador	t	0.981667	-79.625000
772	ESN	Easton/Newnam	Easton	USA	t	38.803333	-76.068333
773	EST	Estherville Mun	Estherville	USA	t	43.406667	-94.745000
774	ETZ	Metz-Nancy/Lorraine	Metz Nancy Lorrne	France	t	48.978333	6.246667
775	EUF	Weedon	Eufaula	USA	t	31.950000	-85.128333
776	EUG	Mahlon Sweet	Eugene	USA	t	44.121667	-123.218333
777	EUN	Laayoune Hassan I	Laayoune	Morocco	t	27.166667	-13.216667
778	EVE	Evenes	Evenes	Norway	t	68.491667	16.678333
779	EVG	Sveg	Sveg	Sweden	t	62.048333	14.426667
780	EVV	Evansville Regl	Evansville	USA	t	38.036667	-87.530000
781	EVW	Evanston-Uinta Co Burns	Evanston	USA	t	41.273333	-111.031667
782	EVX	Fauville Ab	Evreux	France	t	49.028333	1.220000
783	EWB	New Bedford Regl	New Bedford	USA	t	41.675000	-70.956667
784	EWK	Newton City Co	Not In Tbl	\N	t	38.056667	-97.275000
785	EWN	Craven Co Regl	New Bern	USA	t	35.071667	-77.041667
786	EWR	Newark Intl	Newark	USA	t	40.691667	-74.168333
787	EXT	Exeter	Exeter	United Kingdom	t	50.733333	-3.411667
788	EYW	Key West Intl	Key West	USA	t	24.555000	-81.758333
789	EZE	Ezeiza Intl Ministro Pis	Buenos Aires Eze	Argentina	t	-34.818333	-58.536667
790	EZS	Elazig	Elazig	Turkey	t	38.605000	39.293333
791	FAD	King Fahd	Field Adminstrtn	USA	t	26.471667	49.798333
792	FAE	Vagar	Faroe Islands	Faroe Islands	t	62.063333	-7.276667
793	FAI	Fairbanks Intl	Fairbanks Intl	USA	t	64.813333	-147.858333
794	FAL	False River	New Roads	USA	t	30.716667	-91.478333
795	FAN	Lista	Farsund	Norway	t	58.100000	6.625000
796	FAO	Faro	Faro Pt	Portugal	t	37.011667	-7.963333
797	FAR	Hector Intl	Fargo	USA	t	46.918333	-96.813333
798	FAT	Fresno Yosemite Intl	Fresno	USA	t	36.775000	-119.716667
799	FAW	Waterkloof Ab	Not In Tbl	\N	t	-25.828333	28.221667
800	FAY	Fayetteville Regl/Grannis	Fayetteville Nc	USA	t	34.990000	-78.878333
801	FBK	Wainwright Aaf	Fairbanks Fbk	USA	t	64.835000	-147.616667
802	FBM	Lubumbashi Intl	Lubumbashi	Zaire Republic	t	-11.590000	27.525000
803	FBR	Ft Bridger	Ft Bridger	USA	t	41.391667	-110.406667
804	FBU	Fornebu	Oslo Fornebu	Norway	t	59.895000	10.618333
805	FCA	Glacier Park Intl	Kalispell Glcr Pk	USA	t	48.310000	-114.255000
806	FCH	Fresno-Chandler Downtown	Fresno Chandler	USA	t	36.731667	-119.818333
807	FCO	Fiumicino	Rome Fiumicino	Italy	t	41.810000	12.251667
808	FDF	Le Lamentin	Fort De France	Martinique	t	14.590000	-60.998333
809	FDH	Friedrichshafen	Friedrichshafen	Germany	t	47.670000	9.511667
810	FDK	Frederick Mun	Frederick Md	USA	t	39.416667	-77.373333
811	FDR	Frederick Mun	Frederick Ok	USA	t	34.351667	-98.983333
812	FDY	Findlay	Findlay	USA	t	41.013333	-83.668333
813	FEL	Furstenfeldbruck Ab	Furstenfeldbruck	Germany	t	48.205000	11.266667
814	FEN	Fernando De Noronha	Fernando Noronha	Brazil	t	-3.850000	-32.416667
815	FEZ	Saiss	Fez	Morocco	t	33.933333	-4.966667
816	FFC	Peachtree City-Falcon	Not In Tbl	\N	t	33.356667	-84.571667
817	FFD	Fairford, Uk	Fairford	United Kingdom	t	51.681667	-1.790000
818	FFM	Fergus Falls Mun-Mickelson	Fergus Falls	USA	t	46.283333	-96.156667
819	FFO	Wright Patterson Afb	Wright Patterson	USA	t	39.823333	-84.045000
820	FFT	Capital City	Frankfort	USA	t	38.181667	-84.903333
821	FGB	Felicia G. Bell Arpt	Galileo Uk	USA	t	-81.666667	-120.000000
822	FHU	Libby Aaf-Sierra Vista Mun	Ft Huachuca	USA	t	31.588333	-110.343333
823	FIH	N Djili Intl	Kinshasa Ndjili	Zaire Republic	t	-4.383333	15.448333
824	FJR	Fujairah Intl	Al Fujairah	United Arab Emi	t	25.108333	56.330000
825	FKI	Bangoka Intl	Kisangani	Zaire Republic	t	0.480000	25.331667
826	FKL	Venango Regl	Franklin	USA	t	41.376667	-79.860000
827	FKS	Fukushima	Fukushima	Japan	t	37.226667	140.433333
828	FLG	Flagstaff Pulliam	Flagstaff	USA	t	35.138333	-111.670000
829	FLL	Ft Lauderdale-Hollywood Intl	Ft Lauderdale	USA	t	26.071667	-80.151667
830	FLN	Hercilio Luz Intl	Florianopolis	Brazil	t	-27.668333	-48.551667
831	FLO	Florence Regl	Florence	USA	t	34.185000	-79.723333
832	FLR	Peretola	Florence	Italy	t	43.806667	11.201667
833	FLX	Fallon Mun	Fallon Nv	USA	t	39.498333	-118.748333
834	FMA	Formosa	Formosa	Argentina	t	-26.200000	-58.233333
835	FMH	Otis Angb	Falmouth	USA	t	41.658333	-70.521667
836	FMI	Kalemie	Kalemie	Zaire Republic	t	-5.866667	29.250000
837	FMN	Four Corners Regl	Farmington Nm	USA	t	36.741667	-108.228333
838	FMO	Munster-Osnabruck	Muenster	Germany	t	52.133333	7.683333
839	FMS	Ft Madison Mun	Fort Madison	USA	t	40.658333	-91.326667
840	FMY	Page	Fort Myers Page	USA	t	26.585000	-81.861667
841	FNA	Lungi	Freetown Lungi	Sierra Leone	t	8.615000	-13.195000
842	FNC	Funchal	Funchal	Portugal	t	32.690000	-16.773333
843	FNI	Garons Navy	Nimes	France	t	43.758333	4.416667
844	FNL	Ft Collins-Loveland Mun	Ft Collins Lovlnd	USA	t	40.451667	-105.010000
845	FNT	Bishop Intl	Flint	USA	t	42.965000	-83.743333
846	FOD	Ft Dodge Regl	Ft Dodge	USA	t	42.550000	-94.191667
847	FOE	Forbes	Topeka Foe	USA	t	38.950000	-95.663333
848	FOG	Gino Lisa	Foggia	Italy	t	41.431667	15.535000
849	FOK	The Gabreski	Westhampton	USA	t	40.843333	-72.631667
850	FOR	Pinto Martins	Fortaleza	Brazil	t	-3.775000	-38.531667
851	FPA	Flight Payroll	Pan American	USA	t	38.298333	-93.716667
852	FPO	Freeport Intl	Freeport Bs	Bahamas	t	26.555000	-78.698333
853	FPR	St Lucie Co Intl	Ft Pierce	USA	t	27.495000	-80.366667
854	FRA	Frankfurt/Main	Frankfurt	Germany	t	50.031667	8.570000
855	FRF	Rhein-Main Afb	Not In Tbl	\N	t	50.033333	8.570000
856	FRG	Republic	Farmingdale	USA	t	40.728333	-73.413333
857	FRL	Forli	Forli	Italy	t	44.195000	12.068333
858	FRS	Santa Elena	Flores	Guatemala	t	16.913333	-89.866667
859	FRU	Manas	Bishkek	Kyrgyzstan	t	43.061667	74.478333
860	FRW	Francistown	Francistown	Botswana	t	-21.158333	27.481667
861	FSC	Figari/Sud Corse	Figari	France	t	41.501667	9.096667
862	FSD	Foss	Sioux Falls	USA	t	43.580000	-96.741667
863	FSI	Post Aaf	Ft Sill	USA	t	34.650000	-98.401667
864	FSM	Ft Smith Regl	Ft Smith	USA	t	35.335000	-94.366667
865	FSP	St Pierre	St Pierre Miq	St Pierre Mique	t	46.773333	-56.163333
866	FSS	Kinloss Uk	Forres	United Kingdom	t	57.648333	-3.558333
867	FST	Ft Stockton-Pecos Co	Fort Stockton	USA	t	30.915000	-102.911667
868	FTW	Ft Worth Meacham Intl	Ft Worth Meacham	USA	t	32.818333	-97.361667
869	FTY	Fulton Co-Brown	Atlnta Fultn Cnty	USA	t	33.778333	-84.520000
870	FUE	Fuerteventura	Fuerteventura	Spain	t	28.450000	-13.861667
871	FUJ	Fukue	Fukue	Japan	t	32.661667	128.835000
872	FUK	Fukuoka	Fukuoka	Japan	t	33.580000	130.453333
873	FUL	Fullerton Mun	Fullerton	USA	t	33.871667	-117.978333
874	FUN	Funafuti Intl	Funafuti Atol	Tuvalu	t	-8.526667	179.203333
875	FWA	Ft Wayne Intl	Ft Wayne	USA	t	40.978333	-85.195000
876	FXE	Ft Lauderdale Executive	Ft Lauderdale Exc	USA	t	26.196667	-80.170000
877	FYV	Drake	Fayetteville Ar	USA	t	36.005000	-94.170000
878	FZO	Filton	Filton	United Kingdom	t	51.518333	-2.588333
879	GAD	Gadsden Mun	Gadsden	USA	t	33.971667	-86.088333
880	GAJ	Yamagata	Yamagata	Japan	t	38.408333	140.373333
881	GAL	Pitka	Galena	USA	t	64.735000	-156.936667
882	GAO	Guantanamo	Guantanamo	Cuba	t	20.080000	-75.156667
883	GAQ	Korogoussou	Gao	Mali	t	16.248333	-0.005000
884	GAU	Guwahati	Gauhati	India	t	26.103333	91.588333
885	GBD	Great Bend Mun	Great Bend	USA	t	38.343333	-98.858333
886	GBE	Khama Intl	Gaborone	Botswana	t	-24.555000	25.918333
887	GBG	Galesburg Mun	Galesburg	USA	t	40.936667	-90.430000
888	GCC	Gillette-Campbell Co	Gillette	USA	t	44.348333	-105.538333
889	GCI	Guernsey	Guernsey	United Kingdom	t	49.435000	-2.600000
890	GCK	Garden City Regl	Garden City Ks	USA	t	37.926667	-100.723333
891	GCM	Roberts Intl	Grand Cayman	Cayman Islands	t	19.291667	-81.350000
892	GCN	Grand Canyon Natl Park	Grand Canyon	USA	t	35.951667	-112.146667
893	GCY	Greeneville-Greene Co Mun	Not In Tbl	\N	t	36.191667	-82.815000
894	GDL	Guadalajara Hidalgo Intl	Guadalajara	Mexico	t	20.520000	-103.310000
895	GDN	Rebiechowo	Gdansk	Poland	t	54.376667	18.466667
896	GDT	Grand Turk Intl	Grand Turk	Turks And Caico	t	21.443333	-71.141667
897	GDV	Dawson Community	Glendive	USA	t	47.138333	-104.806667
898	GDX	Sokol	Magadan	E Ural Russia	t	59.910000	150.718333
899	GED	Sussex Co	Georgetown De	USA	t	38.688333	-75.358333
900	GEG	Spokane Intl	Spokane	USA	t	47.618333	-117.533333
901	GEL	Santo Angelo	Santo Angelo	Brazil	t	-28.281667	-54.168333
902	GEN	Gardermoen	Oslo Gardermoen	Norway	t	60.201667	11.085000
903	GEO	Cheddi Jagan Intl	Georgetown Gy	Guyana	t	6.488333	-58.265000
904	GER	Nueva Gerona	Nueva Gerona	Cuba	t	21.838333	-82.778333
905	GEV	Gallivare	Gallivare	Sweden	t	67.133333	20.816667
906	GEY	South Big Horn Co	Greybull	USA	t	44.515000	-108.081667
907	GFK	Grand Forks Intl	Grand Forks Nd	USA	t	47.948333	-97.175000
908	GFL	Warren Co	Glens Falls	USA	t	43.340000	-73.610000
909	GFY	Grootfontein	Grootfontein	South Africa	t	-19.600000	18.133333
910	GGE	Georgetown Co	Georgetown Sc	USA	t	33.311667	-79.316667
911	GGT	Exuma Intl	George Town Bs	Bahamas	t	23.561667	-75.875000
912	GGW	Wokal/Glasgow Intl	Glasgow Mt	USA	t	48.211667	-106.613333
913	GHA	Noumerate	Ghardaia	Algeria	t	32.383333	3.816667
914	GHB	Governors Harbour Bf	Governors Harbour	Bahamas	t	25.285000	-76.330000
915	GHT	Ghat	Ghat	Libya	t	25.136667	10.145000
916	GIB	Gibraltar Ab	Gibraltar	Gibraltar	t	36.151667	-5.348333
917	GIF	Winter Haven S-Gilbert	Winter Haven	USA	t	28.061667	-81.751667
918	GIG	Rio De Janeiro/Intl-Galeao	Rio De Janeiro	Brazil	t	-22.808333	-43.250000
919	GIZ	Gizan	Gizan	Saudi Arabia	t	16.900000	42.585000
920	GJM	Guajara Mirim	Guajaramirim	Brazil	t	-10.786667	-65.280000
921	GJT	Walker	Grand Junction	USA	t	39.121667	-108.526667
922	GKE	Geilenkirchen Ab	Geilenkirchen	Germany	t	50.960000	6.043333
923	GLA	Glasgow	Glasgow Gla	United Kingdom	t	55.871667	-4.431667
924	GLD	Renner	Goodland	USA	t	39.370000	-101.698333
925	GLH	Mid Delta Regl	Greenville Ms	USA	t	33.481667	-90.985000
926	GLS	Scholes	Galveston	USA	t	29.265000	-94.860000
927	GLT	Gladstone	Gladstone	Australia	t	-23.868333	151.221667
928	GMA	Gemena	Gemana	Zaire Republic	t	3.266667	19.766667
929	GMU	Greenville Downtown	Greenville Downtn	USA	t	34.846667	-82.350000
930	GNB	St Geoirs	Grenoble	France	t	45.363333	5.333333
931	GND	Point Salines Intl	Grenada	Grenada	t	12.003333	-61.786667
932	GNV	Gainesville Regl	Gainesville Fl	USA	t	29.690000	-82.271667
933	GOA	Sestri	Genoa	Italy	t	44.411667	8.836667
934	GOI	Dabolim Navy	Goa	India	t	15.373333	73.825000
935	GOM	Goma Intl	Goma	Zaire Republic	t	-1.666667	29.233333
936	GON	Groton-New London	New London	USA	t	41.330000	-72.045000
937	GOT	Landvetter	Gothenburg Got	Sweden	t	57.658333	12.290000
938	GOU	Garoua	Garoua	Cameroon	t	9.335000	13.380000
939	GOV	Gove	Gove	Australia	t	-12.273333	136.823333
940	GPA	Araxos Ab	Patras	Greece	t	38.150000	21.416667
941	GPM	Grand Praire Muni	Not In Tbl	\N	t	32.698333	-97.046667
942	GPS	Seymour	Galapagos Is	Ecuador	t	-0.453333	-90.265000
943	GPT	Gulfport-Biloxi Regl	Gulfport Biloxi	USA	t	30.406667	-89.070000
944	GRB	Austin Straubel Intl	Green Bay	USA	t	44.485000	-88.131667
945	GRF	Gray Aaf	Tacoma Gray Afb	USA	t	47.081667	-122.578333
946	GRI	Central Nebraska Regl	Grand Island	USA	t	40.966667	-98.308333
947	GRJ	George	George	South Africa	t	-34.006667	22.373333
948	GRK	Gray Aaf	Ft Hood Kileen	USA	t	31.065000	-97.828333
949	GRO	Girona	Gerona	Spain	t	41.905000	2.763333
950	GRQ	Eelde	Groningen	Netherlands	t	53.125000	6.583333
951	GRR	Kent Co Intl	Grand Rapids Mi	USA	t	42.881667	-85.523333
952	GRS	Grosseto Mil	Grosseto	Italy	t	42.761667	11.071667
953	GRU	Sao Paulo/Intl-Guarulhos	Sao Paulo Gru	Brazil	t	-23.435000	-46.471667
954	GRX	Granada	Granada	Spain	t	37.190000	-3.775000
955	GRZ	Graz	Graz	Austria	t	46.993333	15.440000
956	GSB	Seymour Johnson Afb	Goldsboro	USA	t	35.338333	-77.958333
957	GSE	Save Ab	Gothenburg Gse	Sweden	t	57.775000	11.870000
958	GSJ	San Jose	San Jose	Guatemala	t	13.936667	-90.836667
959	GSL	Taltheilei Narrows	Great Slave Lake	Canada	t	62.598333	-111.541667
960	GSO	Piedmont Triad Intl	Greensboro Highpt	USA	t	36.096667	-79.936667
961	GSP	Greenville-Spartanburg	Greenville Sptnbg	USA	t	34.896667	-82.216667
962	GTB	Wheeler-Sack Aaf	Genting	Malaysia	t	44.051667	-75.720000
963	GTF	Great Falls Intl	Great Falls	USA	t	47.481667	-111.370000
964	GTR	Golden Triangle Regl	Columbus Ms Gtr	USA	t	33.450000	-88.590000
965	GUA	La Aurora Intl	Guatemala City	Guatemala	t	14.581667	-90.526667
966	GUC	Gunnison Co	Gunnison	USA	t	38.533333	-106.931667
967	GUI	Guiria	Guiria	Venezuela	t	10.580000	-62.318333
968	GUJ	Guaratingueta	Guaratingueta	Brazil	t	-22.791667	-45.203333
969	GUM	Guam Intl	Guam	Us Pacific Is	t	13.483333	144.795000
970	GUP	Gallup Mun	Gallup	USA	t	35.510000	-108.788333
971	GUQ	Guanare	Guanare	Venezuela	t	9.016667	-69.733333
972	GUS	Grissom Arb	Grissom Afb	USA	t	40.646667	-86.151667
973	GUT	Gutersloh	Gutersloh	Germany	t	51.923333	8.306667
974	GVA	Cointrin	Geneva	Switzerland	t	46.238333	6.110000
975	GVT	Majors	Greenville Tx	USA	t	33.066667	-96.065000
976	GVW	Richards-Gebaur Meml	Not In Tbl	\N	t	38.843333	-94.560000
977	GVX	Gavle-Sandviken Ab	Gavle	Sweden	t	60.591667	16.950000
978	GWD	Gwadar	Gwadar	Pakistan	t	25.233333	62.328333
979	GWO	Greenwood-Leflore	Greenwood Ms	USA	t	33.493333	-90.083333
980	GWT	Westerland/Sylt	Westerland	Germany	t	54.910000	8.341667
981	GXY	Greeley-Weld Co	Greeley	USA	t	40.426667	-104.631667
982	GYA	Guayaramerin, Bol	Guayaramerin	Bolivia	t	-10.818333	-65.346667
983	GYE	Simon Bolivar Intl	Guayaquil	Ecuador	t	-2.153333	-79.883333
984	GYM	Gen Jose Ma Yanez Intl	Guaymas	Mexico	t	27.968333	-110.921667
985	GYN	Santa Genoveva	Goiania	Brazil	t	-16.628333	-49.225000
986	GYR	Phx Goodyear Muni	Goodyear	USA	t	33.423333	-112.375000
987	GYY	Gary Regl	Gary	USA	t	41.615000	-87.411667
988	GZT	Oguzeli	Gaziantep	Turkey	t	36.948333	37.478333
989	HAB	Marion Co-Rankin Fite	Hamilton Al	USA	t	34.118333	-87.996667
990	HAC	Hachijojima	Hachijo	Japan	t	33.110000	139.788333
991	HAD	Halmstad Ab	Halmstad	Sweden	t	56.690000	12.821667
992	HAH	Prince Said Ibrahim	Moroni Hahaya	Comoros	t	-11.533333	43.261667
993	HAI	Three Rivers Mun-Haines	Not In Tbl	\N	t	41.958333	-85.593333
994	HAJ	Hannover	Hanover	Germany	t	52.460000	9.683333
995	HAK	Dayingshan	Haikou	China	t	20.018333	110.346667
996	HAM	Hamburg	Hamburg	Germany	t	53.630000	9.986667
997	HAN	Noibai Intl	Hanoi	Vietnam	t	21.221667	105.803333
998	HAO	Hamilton-Fairfield	Not In Tbl	\N	t	39.363333	-84.523333
999	HAS	Hail	Hail	Saudi Arabia	t	27.438333	41.686667
1000	HAU	Karmoy	Haugesund	Norway	t	59.343333	5.213333
1001	HAV	Jose Marti Intl	Havana	Cuba	t	22.988333	-82.408333
1002	HBA	Hobart	Hobart	Australia	t	-42.836667	147.508333
1003	HBG	Chain Mun	Hattiesburg	USA	t	31.265000	-89.251667
1004	HBR	Hobart Mun	Hobart	USA	t	34.990000	-99.050000
1005	HBT	King Khalid Military City	Hafr Albatin	Saudi Arabia	t	27.900000	45.526667
1006	HDD	Hyderabad	Hyderabad Hdd	Pakistan	t	25.300000	68.383333
1007	HDM	Hamadan	Hamadan	Iran	t	34.866667	48.550000
1008	HDN	Yampa Valley	Stmbt Springs Hdn	USA	t	40.480000	-107.216667
1009	HDO	Hondo Mun	Hondo	USA	t	29.358333	-99.176667
1010	HDY	Hat Yai Intl	Hat Yai	Thailand	t	6.930000	100.398333
1011	HEA	Herat Iran	Herat	Afghanistan	t	34.215000	62.225000
1012	HEE	Thompson-Robbins	Helena Ar	USA	t	34.575000	-90.675000
1013	HEL	Vantaa	Helsinki Vantaa	Finland	t	60.316667	24.965000
1014	HER	Nikos Kazantzakis	Heraklion	Greece	t	35.336667	25.176667
1015	HET	Baita	Hohhot	China	t	40.853333	111.821667
1016	HEZ	Hardy-Anders-Adams Co	Natchez	USA	t	31.613333	-91.296667
1017	HFD	Hartford-Brainard	Hartford	USA	t	41.735000	-72.650000
1018	HFF	Mackall Aaf	Not In Tbl	\N	t	35.035000	-79.496667
1019	HGH	Jianqiao	Hangzhou	China	t	30.331667	120.240000
1020	HGR	Washington Co Regl	Hagerstown	USA	t	39.706667	-77.728333
1021	HHE	Hachinohe Aero	Hachinohe	Japan	t	40.548333	141.470000
1022	HHH	Hilton Head Island	Hilton Head Is	USA	t	32.225000	-80.698333
1023	HHI	Wheeler Aaf	Not In Tbl	\N	t	21.480000	-158.036667
1024	HHN	Heringsdorf	Hahn	Germany	t	53.878333	14.151667
1025	HIB	Chisholm-Hibbing	Hibbing	USA	t	47.385000	-92.838333
1026	HIF	Hill Afb	Ogden Hill Afb	USA	t	41.123333	-111.971667
1027	HIJ	Hiroshima	Hiroshima	Japan	t	34.431667	132.923333
1028	HIK	Hickam Afb	Not In Tbl	\N	t	21.318333	-157.923333
1029	HIO	Portland-Hillsboro	Not In Tbl	\N	t	45.540000	-122.948333
1030	HIR	Henderson	Honiara	Solomon Islands	t	-9.416667	160.053333
1031	HJR	Khajuraho	Khajuraho	India	t	24.818333	79.920000
1032	HKD	Hakodate Aero	Hakodate	Japan	t	41.768333	140.821667
1033	HKG	Hong Kong Intl	Hong Kong	Hong Kong	t	22.316667	114.201667
1034	HKS	Hawkins	Jackson Hawkins	USA	t	32.333333	-90.221667
1035	HKT	Phuket Intl	Phuket	Thailand	t	8.110000	98.311667
1036	HKY	Hickory Regl	Hickory	USA	t	35.740000	-81.388333
1037	HLA	Lanseria	Lanseria	South Africa	t	-25.933333	27.921667
1038	HLF	Hultsfred Ab	Hultsfred	Sweden	t	57.525000	15.825000
1039	HLG	Wheeling-Ohio Co	Wheeling	USA	t	40.175000	-80.645000
1040	HLN	Helena Regl	Helena Mt	USA	t	46.606667	-111.981667
1041	HLP	Halim Intl	Jakarta Hlp	Indonesia	t	-6.268333	106.888333
1042	HLR	Hood Aaf	Killeen Ft Hood	USA	t	31.136667	-97.713333
1043	HLZ	Hamilton	Hamilton Nz	New Zealand	t	-37.868333	175.335000
1044	HME	Oued Irara	Hassi Messaoud	Algeria	t	31.673333	6.141667
1045	HMN	Holloman Afb	Holloman Afb	USA	t	32.851667	-106.106667
1046	HMO	Gen Ignacio Pesqueira Garcia	Hermosillo	Mexico	t	29.095000	-111.046667
1047	HNA	Hanamaki	Hanamaki	Japan	t	39.426667	141.138333
1048	HND	Tokyo Haneda Intl	Tokyo Haneda	Japan	t	35.550000	139.783333
1049	HNL	Honolulu Intl	Honolulu	USA	t	21.318333	-157.921667
1050	HOB	Lea Co	Hobbs	USA	t	32.686667	-103.216667
1051	HOD	Hodeidah Intl	Hodeidah	Yemen Republic	t	14.753333	42.976667
1052	HOG	Holguin	Holguin	Cuba	t	20.785000	-76.313333
1053	HOI	Hao	Hao Island	French Polynesi	t	-18.063333	-140.956667
1054	HOM	Homer	Homer	USA	t	59.645000	-151.476667
1055	HOP	Campbell Aaf	Hopkinsville	USA	t	36.671667	-87.491667
1056	HOT	Hot Springs Meml	Hot Springs Ar	USA	t	34.476667	-93.095000
1057	HOU	Hobby	Houston Hobby	USA	t	29.645000	-95.278333
1058	HOW	Howard Afb	Ft Kobbe	Panama	t	8.915000	-79.596667
1059	HPN	Westchester Co	Westchester Cnty	USA	t	41.066667	-73.706667
1060	HQM	Bowerman	Hoquiam	USA	t	46.970000	-123.935000
1061	HRB	Yanjiagang	Harbin	China	t	45.620000	126.246667
1062	HRE	Harare Intl	Harare	Zimbabwe	t	-17.931667	31.093333
1063	HRG	Hurghada	Hurghada	Egypt	t	27.183333	33.798333
1064	HRL	Rio Grande Valley Intl	Harlingen	USA	t	26.228333	-97.653333
1065	HRO	Boone Co	Harrison	USA	t	36.260000	-93.153333
1066	HRT	Hurlburt	Harrogate	United Kingdom	t	30.426667	-86.688333
1067	HSA	Stennis Intl	Clas Stin Mia	USA	t	30.368333	-89.455000
1068	HSI	Hastings Mun	Hastings	USA	t	40.605000	-98.426667
1069	HSP	Ingalls	Hot Springs Va	USA	t	37.950000	-79.833333
1070	HST	Dade Co-Homestead Regl	Homestead	USA	t	25.488333	-80.383333
1071	HSV	Huntsville Intl-Jones	Huntsville	USA	t	34.640000	-86.771667
1072	HTI	Hamilton I.	Hamilton Island	Australia	t	-20.358333	148.950000
1073	HTO	East Hampton	East Hampton	USA	t	40.958333	-72.251667
1074	HTS	Tri-State/Ferguson	Huntington	USA	t	38.366667	-82.556667
1075	HUA	Redstone Aaf	Not In Tbl	\N	t	34.678333	-86.683333
1076	HUF	Hulman Regl	Terre Haute	USA	t	39.451667	-87.308333
1077	HUL	Houlton Intl	Houlton	USA	t	46.121667	-67.791667
1078	HUM	Houma-Terrebonne	Houma	USA	t	29.566667	-90.660000
1079	HUN	Hualien	Hualien	Taiwan	t	24.023333	121.610000
1080	HUT	Hutchinson Mun	Hutchinson	USA	t	38.065000	-97.860000
1081	HUX	Bahia De Huatulco	Huatulco	Mexico	t	15.773333	-96.260000
1082	HUY	Humberside	Humberside	United Kingdom	t	53.573333	-0.348333
1083	HVN	Tweed-New Haven	New Haven	USA	t	41.263333	-72.886667
1084	HVR	Havre City-Co	Havre	USA	t	48.541667	-109.761667
1085	HWD	Hayward	Hayward	USA	t	37.658333	-122.121667
1086	HWN	Hwange National Park	Hwange Natl Pk	Zimbabwe	t	-18.631667	27.006667
1087	HWO	North Perry	Hollywood	USA	t	26.000000	-80.240000
1088	HYA	Barnstable Mun-Boardman/Polan*	Hyannis	USA	t	41.668333	-70.280000
1089	HYD	Hyderabad	Hyderabad Hyd	India	t	17.451667	78.463333
1090	HYS	Hays Mun	Hays	USA	t	38.843333	-99.273333
1091	HZB	Calonne	Hazebrouck	France	t	50.620000	2.645000
1092	IAB	Mc Connell Afb	Mcconnell Afb Ks	USA	t	37.621667	-97.266667
1093	IAD	Washington Dulles Intl	Washington Dulles	USA	t	38.943333	-77.455000
1094	IAG	Niagara Falls Intl	Niagara Falls	USA	t	43.106667	-78.945000
1095	IAH	G Bush Intercontinental/Houst*	Houston Intl Iah	USA	t	29.980000	-95.338333
1096	IAM	In Amenas	In Amenas	Algeria	t	28.050000	9.636667
1097	IAS	Iasi	Iasi	Romania	t	47.180000	27.621667
1098	IBA	New Ibadan	Ibadan	Nigeria	t	7.360000	3.976667
1099	IBE	Perales	Ibague	Colombia	t	4.423333	-75.136667
1100	IBZ	Ibiza	Ibiza	Spain	t	38.873333	1.373333
1101	ICT	Wichita Mid-Continent	Wichita	USA	t	37.648333	-97.431667
1102	IDA	Fanning	Idaho Falls	USA	t	43.513333	-112.070000
1103	IDR	Indore	Indore	India	t	22.721667	75.805000
1104	IEG	Babimost	Zielona Gora	Poland	t	52.136667	15.798333
1105	IFN	Shahid Beheshti	Isfahan	Iran	t	32.750000	51.860000
1106	IFP	Laughlin/Bullhead Intl	Bullhead City	USA	t	35.156667	-114.558333
1107	IGL	Cigli Ab	Izmir Cigli	Turkey	t	38.511667	27.010000
1108	IGM	Kingman	Kingman	USA	t	35.258333	-113.936667
1109	IGR	Cataratas Del Iguazu Agrntna	Iguazu	Argentina	t	-25.738333	-54.486667
1110	IGU	Cataratas	Iguassu Falls	Brazil	t	-25.595000	-54.486667
1111	IKT	Irkutsk	Irkutsk	E Ural Russia	t	52.266667	104.395000
1112	ILA	Ilopango Intl	Illaga	Indonesia	t	13.691667	-89.116667
1113	ILC	Ilo Peru	Ilo	Peru	t	-17.691667	-71.338333
1114	ILE	Killeen Mun	Killeen	USA	t	31.085000	-97.685000
1115	ILG	New Castle Co	Wilmington Phl	USA	t	39.678333	-75.605000
1116	ILM	New Hanover Intl	Wilmington Nc	USA	t	34.270000	-77.901667
1117	ILN	Airborne	Wilmington Oh	USA	t	39.426667	-83.791667
1118	ILO	Iloilo	Iloilo	Philippines	t	10.713333	122.543333
1119	ILR	Ilorin	Ilorin	Nigeria	t	8.438333	4.493333
1120	ILY	Islay	Islay	United Kingdom	t	55.681667	-6.256667
1121	IMF	Tulihal	Imphal	India	t	24.763333	93.901667
1122	IMM	Immokalee	Immokalee	USA	t	26.431667	-81.400000
1123	IMP	Imperatriz	Imperatriz	Brazil	t	-5.530000	-47.456667
1124	IMT	Ford	Iron Mountain	USA	t	45.818333	-88.113333
1125	IND	Indianapolis Intl	Indianapolis	USA	t	39.716667	-86.293333
1126	INI	Nis	Nis	Yugoslavia	t	43.336667	21.858333
1127	INL	Falls Intl	Internatl Falls	USA	t	48.565000	-93.401667
1128	INN	Innsbruck	Innsbruck	Austria	t	47.260000	11.343333
1129	INT	Smith Reynolds	Winston Salem	USA	t	36.133333	-80.221667
1130	INU	Nauru Intl	Nauru	Nauru	t	-0.550000	166.915000
1131	INV	Inverness	Inverness	United Kingdom	t	57.540000	-4.048333
1132	INW	Winslow Mun	Winslow	USA	t	35.021667	-110.721667
1133	INZ	In Salah	In Salah	Algeria	t	27.243333	2.511667
1134	IOA	Ioannina	Ioannina	Greece	t	39.698333	20.821667
1135	IOL	Isle Of Lucy	Not In Tbl	\N	t	54.091667	-4.621667
1136	IOM	Isle Of Man	Isle Of Man	United Kingdom	t	54.083333	-4.621667
1137	IOS	Ilheus	Ilheus	Brazil	t	-14.813333	-39.031667
1138	IOW	Iowa City Mun	Iowa City	USA	t	41.638333	-91.545000
1139	IPC	Mataveri Intl	Easter Island	Chile	t	-27.165000	-109.426667
1140	IPI	San Luis	Ipiales	Colombia	t	0.868333	-77.660000
1141	IPL	Imperial County	Elcentro Imperial	USA	t	32.833333	-115.578333
1142	IPN	Usiminas	Ipatinga	Brazil	t	-19.470000	-42.486667
1143	IPT	Williamsport Rgnl	Williamsport	USA	t	41.241667	-76.921667
1144	IQQ	Diego Aracena Intl	Iquique	Chile	t	-20.535000	-70.178333
1145	IQT	Col Francisco Secada Vignetta	Iquitos	Peru	t	-3.785000	-73.310000
1146	IRD	Ishurdi	Ishurdi	Bangladesh	t	24.133333	89.066667
1147	IRJ	Capitan V. Almandos Almonacid	La Rioja	Argentina	t	-29.388333	-66.801667
1148	IRP	Isiro-Matari	Isiro	Zaire Republic	t	2.826667	27.586667
1149	ISA	Mt Isa	Mt Isa	Australia	t	-20.663333	139.488333
1150	ISB	Chaklala	Islamabad	Pakistan	t	33.616667	73.100000
1151	ISM	Kissimmee Mun	Kissimmee	USA	t	28.290000	-81.436667
1152	ISO	Kinston Regl Jetport At Stall*	Kinston	USA	t	35.326667	-77.615000
1153	ISP	Long Island Mac Arthur	Long Is Macarthur	USA	t	40.795000	-73.100000
1154	IST	Istanbul Ataturk	Istanbul	Turkey	t	40.976667	28.815000
1155	ITH	Tompkins Co	Ithaca	USA	t	42.490000	-76.458333
1156	ITM	Osaka Intl	Osaka Itami	Japan	t	34.780000	135.441667
1157	ITO	Hilo Intl	Hilo	USA	t	19.720000	-155.048333
1158	IUE	Niue Intl	Niue Island	Niue	t	-19.076667	-169.926667
1159	IVC	Invercargill	Invercargill	New Zealand	t	-46.416667	168.320000
1160	IVL	Ivalo	Ivalo	Finland	t	68.610000	27.416667
1161	IWA	Williams Gateway	Ivanova	Russia	t	33.306667	-111.655000
1162	IWD	Gogebic Co	Ironwood	USA	t	46.526667	-90.130000
1163	IWO	Iwojima Aero	Not In Tbl	\N	t	24.786667	141.323333
1164	IXA	Agartala	Agartala	India	t	23.890000	91.241667
1165	IXD	New Century Aircenter Olathe	Allahabad	India	t	38.831667	-94.888333
1166	IXE	Mangalore	Mangalore	India	t	12.960000	74.890000
1167	IXG	Belgaum	Belgaum	India	t	15.856667	74.618333
1168	IXM	Madurai	Madurai	India	t	9.833333	78.088333
1169	IXR	Ranchi	Ranchi	India	t	23.313333	85.323333
1170	IXS	Silchar	Silchar	India	t	24.911667	92.978333
1171	IXY	Gandhidham	Kandla	India	t	23.111667	70.100000
1172	IXZ	Port Blair	Port Blair	India	t	11.645000	92.735000
1173	IZO	Izumo	Izumo	Japan	t	35.410000	132.891667
1174	JAA	Jalalabad	Not In Tbl	\N	t	34.396667	70.495000
1175	JAC	Jackson Hole	Jackson Wy	USA	t	43.605000	-110.736667
1176	JAF	Kankesanturai Ab	Jaffna	Sri Lanka	t	9.791667	80.066667
1177	JAI	Jaipur	Jaipur	India	t	26.823333	75.803333
1178	JAN	Jackson Intl	Jackson Ms	USA	t	32.310000	-90.075000
1179	JAX	Jacksonville Intl	Jacksonville Fl	USA	t	30.493333	-81.686667
1180	JBR	Jonesboro Mun	Jonesboro	USA	t	35.830000	-90.645000
1181	JCT	Kimble Co	Junction	USA	t	30.510000	-99.761667
1182	JCY	Johnson City	Not In Tbl	\N	t	30.260000	-98.621667
1183	JED	King Abdulaziz Intl	Jeddah	Saudi Arabia	t	21.680000	39.155000
1184	JER	Jersey	Jersey	United Kingdom	t	49.208333	-2.193333
1185	JFK	Kennedy Intl	New York Jfk	USA	t	40.638333	-73.778333
1186	JHB	Sultan Ismail	Johor Bahru	Malaysia	t	1.638333	103.670000
1187	JHM	Kapalua/West Maui	Kapalua Maui	USA	t	20.966667	-156.675000
1188	JHW	Chautauqua Co/Jamestown	Jamestown Ny	USA	t	42.153333	-79.256667
1189	JIB	Ambouli	Djibouti	Djibouti	t	11.546667	43.158333
1190	JKG	Jonkoping	Jonkoping	Sweden	t	57.756667	14.068333
1191	JLC	Jlc Test Arpt	Not In Tbl	\N	t	45.666667	-60.000000
1192	JLN	Joplin Regl	Joplin	USA	t	37.150000	-94.496667
1193	JMH	Jmh Test Arpt	Schaumberg	USA	t	45.666667	-100.000000
1194	JMK	Mikonos	Mikonos	Greece	t	37.436667	25.346667
1195	JNB	Johannesburg Intl	Johannesburg	South Africa	t	-26.133333	28.241667
1196	JNH	John Nelson Hardy	Not In Tbl	\N	t	80.000000	-120.000000
1197	JNI	Junin	Junin	Argentina	t	-34.541667	-60.933333
1198	JNU	Juneau Intl	Juneau Ak	USA	t	58.353333	-134.575000
1199	JOE	Joensuu	Joensuu	Finland	t	62.658333	29.626667
1200	JOI	Joinville	Joinville	Brazil	t	-26.223333	-48.800000
1201	JON	Johnston Atoll	Johnston Island	Micronesia	t	16.730000	-169.535000
1202	JOS	Jos	Jos	Nigeria	t	9.638333	8.870000
1203	JPA	Pres Castro Pinto	Joao Pessoa	Brazil	t	-7.148333	-34.950000
1204	JRO	Kilimanjaro Intl	Kilimanjaro	Tanzania	t	-3.426667	37.073333
1205	JRS	Jerusalem	Jerusalem	Israel	t	31.863333	35.218333
1206	JSR	Jessore	Jessore	Bangladesh	t	23.183333	89.166667
1207	JST	Johnstown-Cambria Co	Johnstown	USA	t	40.315000	-78.833333
1208	JTR	Santorini	Santorini	Greece	t	36.400000	25.478333
1209	JUB	Juba	Juba	Sudan	t	4.871667	31.593333
1210	JUJ	Gobernador Horacio Guzman	Jujuy	Argentina	t	-24.403333	-65.078333
1211	JVL	Rock Co	Janesville	USA	t	42.618333	-89.040000
1212	JXN	Jackson Co-Reynolds	Jackson Mi	USA	t	42.258333	-84.458333
1213	JYV	Jyvaskyla	Jyvaskyla	Finland	t	62.400000	25.675000
1214	JZI	Charleston Executive	Not In Tbl	\N	t	32.700000	-80.001667
1215	JZS	San Juan Fir	Not In Tbl	\N	t	18.433333	-66.000000
1216	KAB	Kariba	Kariba	Zimbabwe	t	-16.518333	28.885000
1217	KAC	Kamishly	Kameshli	Syria	t	37.033333	41.200000
1218	KAD	New Kaduna	Kaduna	Nigeria	t	10.695000	7.318333
1219	KAG	Kangnung Aero	Kangnung	South Korea	t	37.750000	128.946667
1220	KAJ	Kajaani	Kajaani	Finland	t	64.283333	27.690000
1221	KAN	Mallam Aminu Kano	Kano	Nigeria	t	12.048333	8.525000
1222	KAO	Kuusamo	Kuusamo	Finland	t	65.988333	29.235000
1223	KAU	Kauhava Ab	Kauhava	Fiji	t	63.123333	23.055000
1224	KBL	Kabul	Kabul	Afghanistan	t	34.568333	69.215000
1225	KBP	Borispol	Kiev Borispol	Ukraine	t	50.345000	30.895000
1226	KBR	Sultan Ismail Petra	Kota Bharu	Malaysia	t	6.165000	102.293333
1227	KCZ	Kochi	Kochi	Japan	t	33.540000	133.673333
1228	KEF	Keflavik	Reykjavik Kef	Iceland	t	63.985000	-22.605000
1229	KEL	Holtenau	Kiel	Germany	t	54.378333	10.145000
1230	KEM	Tornio	Kemi	Finland	t	65.778333	24.588333
1231	KER	Kerman	Kerman	Iran	t	30.273333	56.950000
1232	KEV	Halli Ab	Kuorevisi	Finland	t	61.855000	24.791667
1233	KGA	Kananga	Kananga	Zaire Republic	t	-5.900000	22.466667
1234	KGF	Karaganda	Karaganda	Kazakhstan	t	49.666667	72.333333
1235	KGI	Kalgoorlie/Boulder	Kalgoorlie	Australia	t	-30.790000	121.461667
1236	KGL	Gregoire Kayibanda	Kigali	Rwanda	t	-1.965000	30.133333
1237	KGS	Ippokratis	Kos	Greece	t	36.795000	27.090000
1238	KHH	Kaohsiung Intl	Kaohsiung	Taiwan	t	22.576667	120.341667
1239	KHI	Quaid-E-Azam Intl	Karachi	Pakistan	t	24.900000	67.150000
1240	KHK	Khark	Khark	Iran	t	29.266667	50.316667
1241	KHV	Khabarovsk Novy	Khabarovsk Novyy	E Ural Russia	t	48.526667	135.186667
1242	KID	Everod	Kristianstad	Sweden	t	55.920000	14.086667
1243	KIJ	Niigata	Niigata	Japan	t	37.951667	139.115000
1244	KIM	Kimberley	Kimberley	South Africa	t	-28.800000	24.763333
1245	KIN	Norman Manley Intl	Kingston Manley	Jamaica	t	17.931667	-76.788333
1246	KIS	Kisumu	Kisumu	Kenya	t	-0.083333	34.733333
1247	KIV	Kishinau	Kishinev	Moldova Rep	t	46.928333	28.933333
1248	KIW	Southdowns	Kitwe	Zambia	t	-12.900000	28.150000
1249	KIX	Kansai Intl	Osaka Kansai	Japan	t	34.423333	135.246667
1250	KKJ	Kitakyushu	Kita Kyushu	Japan	t	33.831667	130.948333
1251	KKK	Koksijde Ab	Kalakaket	USA	t	51.090000	2.653333
1252	KKN	Hoybuktmoen	Kirkenes	Norway	t	69.725000	29.895000
1253	KLR	Kalmar	Kalmar	Sweden	t	56.685000	16.290000
1254	KLU	Klagenfurt	Klagenfurt	Austria	t	46.641667	14.336667
1255	KLV	Karlovy Vary	Karlovy Vary	Czech Republic	t	50.201667	12.915000
1256	KLX	Kalamata Ab	Kalamata	Greece	t	37.070000	22.025000
1257	KMI	Miyazaki	Miyazaki	Japan	t	31.873333	131.450000
1258	KMJ	Kumamoto	Kumamoto	Japan	t	32.833333	130.856667
1259	KMP	Keetmanshoop	Keetmanshoop	Namibia	t	-26.540000	18.113333
1260	KMQ	Komatsu	Komatsu	Japan	t	36.390000	136.410000
1261	KMS	Kumasi	Kumasi	Ghana	t	6.716667	-1.583333
1262	KMX	King Khalid Ab	Khamis Mushait	Saudi Arabia	t	18.300000	42.800000
1263	KNA	Vina Del Mar	Vina Del Mar	Chile	t	-32.941667	-71.478333
1264	KND	Kindu	Kindu	Zaire Republic	t	-2.933333	25.900000
1265	KNU	Kanpur	Kanpur	India	t	26.440000	80.365000
1266	KNX	Kununurra	Kununurra	Australia	t	-15.780000	128.706667
1267	KOA	Keahole-Kona Intl	Kona	USA	t	19.738333	-156.045000
1268	KOJ	Kagoshima	Kagoshima	Japan	t	31.800000	130.721667
1269	KOK	Kruunupyy	Kokkola	Finland	t	63.720000	23.141667
1270	KRF	Kramfors Ab	Kramfors	Sweden	t	63.048333	17.771667
1271	KRK	Jps Intl	Krakow	Poland	t	50.076667	19.785000
1272	KRN	Kiruna	Kiruna	Sweden	t	67.821667	20.340000
1273	KRP	Karup Ab	Karup	Denmark	t	56.298333	9.111667
1274	KRS	Kjevik	Kristiansand	Norway	t	58.205000	8.088333
1275	KRT	Khartoum	Khartoum	Sudan	t	15.600000	32.558333
1276	KSA	Kosrae	Kosrae	Micronesia	t	5.356667	162.958333
1277	KSC	Kosice	Kosice	Slovakia	t	48.663333	21.243333
1278	KSD	Karlstad	Karlstad	Sweden	t	59.358333	13.468333
1279	KSH	Shahid Ashrafi Esfahani	Kermanshah	Iran	t	34.346667	47.148333
1280	KSM	St Marys Alaska	Saint Marys	USA	t	62.063333	-163.300000
1281	KSO	Aristotelis	Kastoria	Greece	t	40.450000	21.276667
1282	KSU	Kvernberget	Kristiansund	Norway	t	63.111667	7.826667
1283	KTA	Karratha	Karratha	Australia	t	-20.711667	116.773333
1284	KTM	Tribhuvan Intl	Kathmandu	Nepal	t	27.695000	85.361667
1285	KTN	Ketchikan Intl	Ketchikan	USA	t	55.355000	-131.713333
1286	KTR	Tindal Military	Katherine	Australia	t	-14.520000	132.376667
1287	KTT	Kittila	Kittila	Finland	t	67.696667	24.851667
1288	KTW	Pyrzowice	Katowice	Poland	t	50.473333	19.081667
1289	KUF	Kurumoch	Samara	Russia	t	53.500000	50.155000
1290	KUH	Kushiro	Kushiro	Japan	t	43.038333	144.196667
1291	KUL	Sultan Abdul Aziz Shah-Subang	Kuala Lumpur	Malaysia	t	3.130000	101.550000
1292	KUO	Kuopio	Kuopio	Finland	t	63.008333	27.796667
1293	KUV	Kunsan Ab	Kunsan	South Korea	t	35.903333	126.616667
1294	KVA	Megas Alexandros	Kavalla	Greece	t	40.915000	24.620000
1295	KVB	Skovde	Skovde	Sweden	t	58.455000	13.971667
1296	KWA	Bucholz Aaf	Kwajalein	Micronesia	t	8.711667	167.728333
1297	KWI	Kuwait Intl	Kuwait	Kuwait	t	29.225000	47.968333
1298	KWZ	Kolwezi	Kolwezi	Zaire Republic	t	-10.766667	25.500000
1299	KYA	Konya Ab	Konya	Turkey	t	37.980000	32.565000
1300	KZI	Filippos	Kozani	Greece	t	40.286667	21.841667
1301	LAA	Lamar Mun	Lamar	USA	t	38.068333	-102.688333
1302	LAD	4th Of February	Luanda	Angola	t	-8.853333	13.236667
1303	LAF	Purdue Univ	Lafayette Laf In	USA	t	40.411667	-86.936667
1304	LAI	Lannion	Lannion	France	t	48.755000	-3.471667
1305	LAJ	Lages	Lajes	Brazil	t	-27.773333	-50.283333
1306	LAL	Lakeland Linder Regl	Lakeland	USA	t	27.988333	-82.018333
1307	LAN	Capital City	Lansing	USA	t	42.778333	-84.586667
1308	LAO	Laoag	Laoag	Philippines	t	18.180000	120.530000
1309	LAP	Gen Manuel Marquez De Leon	La Paz Mx	Mexico	t	24.071667	-110.361667
1310	LAR	Laramie Regl	Laramie	USA	t	41.311667	-105.673333
1311	LAS	Mc Carran Intl	Las Vegas Nv	USA	t	36.080000	-115.150000
1312	LAW	Lawton-Ft Sill Regl	Lawton	USA	t	34.566667	-98.415000
1313	LAX	Los Angeles Intl	Los Angeles	USA	t	33.941667	-118.406667
1314	LBA	Leeds Bradford	Leeds	United Kingdom	t	53.865000	-1.658333
1315	LBB	Lubbock Intl	Lubbock	USA	t	33.663333	-101.821667
1316	LBD	Khudzhand	Khudzhand	Tajikistan	t	40.215000	69.695000
1317	LBG	Le Bourget	Paris Lebourget	France	t	48.970000	2.441667
1318	LBI	Le Sequestre	Albi	France	t	43.913333	2.116667
1319	LBL	Liberal Mun	Liberal	USA	t	37.043333	-100.958333
1320	LBV	Leon M Ba	Libreville	Gabon	t	0.458333	9.415000
1321	LCA	Larnaca Intl	Larnaca	Cyprus	t	34.878333	33.630000
1322	LCE	Goloson Intl	La Ceiba	Honduras	t	15.745000	-86.853333
1323	LCF	Lake City Mun	Not In Tbl	\N	t	30.181667	-82.576667
1324	LCG	La Coruna	La Coruna	Spain	t	43.303333	-8.375000
1325	LCH	Lake Charles Regl	Lake Charles	USA	t	30.125000	-93.223333
1326	LCI	Laconia Mun	Laconia	USA	t	43.571667	-71.418333
1327	LCK	Rickenbacker Intl	Columbus Rcknbckr	USA	t	39.813333	-82.926667
1328	LCX	Polaris	Little Cornwallis	Canada	t	75.391667	-96.931667
1329	LCY	London City	London City Arpt	United Kingdom	t	51.503333	0.055000
1330	LDB	Londrina	Londrina	Brazil	t	-23.328333	-51.135000
1331	LDE	Ossun-Lourdes	Lourdes Tarbes	France	t	43.185000	-0.001667
1332	LDK	Lidkoping Ab	Lidkoping	Sweden	t	58.465000	13.173333
1333	LEA	Learmonth	Learmonth	Australia	t	-22.235000	114.088333
1334	LEB	Lebanon Mun	Lebanon Hanover	USA	t	43.625000	-72.303333
1335	LED	Pulkovo	St Petersburg Led	Russia	t	59.800000	30.265000
1336	LEH	Octeville	Le Havre	France	t	49.533333	0.088333
1337	LEI	Almeria	Almeria	Spain	t	36.843333	-2.370000
1338	LEJ	Leipzig-Halle	Leipzig	Germany	t	51.415000	12.226667
1339	LEK	Tata	Labe	Guinea	t	11.325000	-12.286667
1340	LET	Alfredo Vasquez Cobo	Leticia	Colombia	t	-4.190000	-69.940000
1341	LEW	Auburn-Lewiston Mun	Lewiston Me	USA	t	44.048333	-70.283333
1342	LEX	Blue Grass	Lexington Ky	USA	t	38.036667	-84.605000
1343	LFI	Langley Afb	Langley Afb	USA	t	37.081667	-76.360000
1344	LFK	Angelina Co	Lufkin Nacodoches	USA	t	31.233333	-94.750000
1345	LFR	La Fria	La Fria	Venezuela	t	8.250000	-72.283333
1346	LFT	Lafayette Regl	Lafayette Lft La	USA	t	30.205000	-91.986667
1347	LFW	Tokoin	Lome	Togo	t	6.161667	1.255000
1348	LGA	La Guardia	New York Lga	USA	t	40.776667	-73.871667
1349	LGC	Callaway	La Grange	USA	t	33.008333	-85.071667
1350	LGF	Laguna Aaf	Laguna Aaf	USA	t	32.865000	-114.391667
1351	LGG	Liege	Liege	Belgium	t	50.636667	5.443333
1352	LGK	Langkawi Intl	Langkawi	Malaysia	t	6.336667	99.735000
1353	LGQ	Lago Agrio	Lago Agrio	Ecuador	t	0.091667	-76.868333
1354	LGS	Malargue	Malargue	Argentina	t	-35.478333	-69.585000
1355	LGU	Logan-Cache	Logan	USA	t	41.786667	-111.851667
1356	LGW	Gatwick	London Gatwick	United Kingdom	t	51.146667	-0.188333
1357	LHE	Lahore	Lahore	Pakistan	t	31.520000	74.401667
1358	LHR	Heathrow	London Heathrow	United Kingdom	t	51.476667	-0.458333
1359	LID	Valkenburg Navy	Valkenburg Navy	United Kingdom	t	52.165000	4.416667
1360	LIG	Bellegarde	Limoges	France	t	45.860000	1.180000
1361	LIH	Lihue	Lihue Kauai	USA	t	21.975000	-159.338333
1362	LIL	Lesquin	Lille	France	t	50.563333	3.088333
1363	LIM	Jorge Chavez Intl	Lima Pe	Peru	t	-12.018333	-77.111667
1364	LIN	Linate	Milan Linate	Italy	t	45.448333	9.278333
1365	LIP	Lins	Not In Tbl	\N	t	-21.661667	-49.730000
1366	LIR	Danial Oduber Quiros Intl	Liberia	Costa Rica	t	10.593333	-85.545000
1367	LIT	Adams	Little Rock	USA	t	34.728333	-92.223333
1368	LJU	Ljubljana	Ljubljana	Slovenia	t	46.223333	14.460000
1369	LKL	Banak Ab	Lakselv	Norway	t	70.066667	24.975000
1370	LKO	Lucknow	Lucknow	India	t	26.761667	80.885000
1371	LKV	Lake Co	Lakeview	USA	t	42.160000	-120.398333
1372	LKZ	Lakenheath Ab	Brandon	United Kingdom	t	52.408333	0.561667
1373	LLA	Kallax Ab	Lulea	Sweden	t	65.543333	22.126667
1374	LMH	Limon Intnl	Not In Tbl	\N	t	9.960000	-83.023333
1375	LMM	Los Mochis	Los Mochis	Mexico	t	25.685000	-109.081667
1376	LMO	Lossiemouth Ab	Not In Tbl	\N	t	57.705000	-3.336667
1377	LMP	Lampedusa	Lampedusa	Italy	t	35.495000	12.610000
1378	LMT	Klamath Falls Intl	Klamath Falls	USA	t	42.155000	-121.731667
1379	LNK	Lincoln Mun	Lincoln	USA	t	40.850000	-96.758333
1380	LNP	Lonesome Pine	Wise	USA	t	36.986667	-82.530000
1381	LNS	Lancaster	Lancaster	USA	t	40.121667	-76.295000
1382	LNY	Lanai	Lanai	USA	t	20.785000	-156.950000
1383	LNZ	Linz	Linz	Austria	t	48.235000	14.188333
1384	LOL	Derby	Lovelock	USA	t	40.065000	-118.565000
1385	LOS	Murtala Muhammed	Lagos	Nigeria	t	6.573333	3.318333
1386	LOU	Bowman	Not In Tbl	\N	t	38.226667	-85.661667
1387	LOZ	London-Corbin/Magee	London Ky	USA	t	37.086667	-84.076667
1388	LPB	J F Kennedy Intl	La Paz Bo	Bolivia	t	-16.510000	-68.180000
1389	LPI	Saab	Linkoping	Sweden	t	58.405000	15.678333
1390	LPL	Liverpool	Liverpool	United Kingdom	t	53.333333	-2.848333
1391	LPP	Lappeenranta	Lappeenranta	Finland	t	61.045000	28.151667
1392	LRA	Larisa Ab	Larisa	Greece	t	39.648333	22.448333
1393	LRC	Laarbruch Ab	Laarbruch	Germany	t	51.603333	6.143333
1394	LRD	Laredo Intl	Laredo Intl	USA	t	27.543333	-99.460000
1395	LRF	Little Rock Afb	Little Rock Afb	USA	t	34.915000	-92.145000
1396	LRH	Laleu	La Rochelle	France	t	46.180000	-1.185000
1397	LRL	Niamtougou	Lama Kara	Togo	t	9.776667	1.093333
1398	LRM	La Romana Intl	La Romana	Dominican Rep	t	18.410000	-68.941667
1399	LRT	Lann-Bihoue Navy	Lorient	France	t	47.760000	-3.438333
1400	LRU	Las Cruces Intl	Las Cruces	USA	t	32.288333	-106.921667
1401	LSC	La Florida	La Serena	Chile	t	-29.910000	-71.196667
1402	LSE	La Crosse Mun	Lacrosse	USA	t	43.878333	-91.255000
1403	LSF	Lawson Aaf	Lawson Aaf	USA	t	32.336667	-84.988333
1404	LSP	Josefa Camejo Intl	Las Piedras	Venezuela	t	11.778333	-70.148333
1405	LST	Launceston	Launceston	Australia	t	-41.545000	147.213333
1406	LSV	Nellis Afb	Nellis Afb	USA	t	36.235000	-115.033333
1407	LTA	Tzaneen	Tzaneen	South Africa	t	-23.821667	30.325000
1408	LTN	Luton	London Luton	United Kingdom	t	51.873333	-0.366667
1409	LTO	Loreto Intl	Loreto	Mexico	t	25.990000	-111.346667
1410	LTQ	Paris-Plage	Le Touquet	France	t	50.515000	1.628333
1411	LTS	Altus Afb	Altus	USA	t	34.663333	-99.273333
1412	LUF	Luke Afb	Luke Afb	USA	t	33.533333	-112.381667
1413	LUK	Cincinnati-Lunken	Cincinnati Lunken	USA	t	39.103333	-84.418333
1414	LUL	Hesler-Noble	Laurel	USA	t	31.671667	-89.171667
1415	LUN	Lusaka Intl	Lusaka	Zambia	t	-15.326667	28.455000
1416	LUQ	San Luis	San Luis	Argentina	t	-33.276667	-66.351667
1417	LUX	Luxembourg	Luxembourg	Luxembourg	t	49.623333	6.205000
1418	LVA	Entrammes	Laval	France	t	48.031667	-0.741667
1419	LVI	Livingstone	Livingstone	Zambia	t	-17.818333	25.818333
1420	LVK	Livermore Mun	Livermore	USA	t	37.693333	-121.820000
1421	LVM	Mission	Livingston	USA	t	45.698333	-110.446667
1422	LVS	Las Vegas Mun	Las Vegas Nm	USA	t	35.653333	-105.141667
1423	LWB	Greenbrier Valley	Greenbrier Lwsbrg	USA	t	37.856667	-80.398333
1424	LWC	Lawrence Mun	Lawrence Ks	USA	t	39.010000	-95.215000
1425	LWM	Lawrence Mun	Lawrence Ma	USA	t	42.716667	-71.123333
1426	LWR	Leeuwarden Ab	Leeuwarden	Netherlands	t	53.225000	5.751667
1427	LWS	Lewiston-Nez Perce Co	Lewiston Clarks	USA	t	46.373333	-117.015000
1428	LWT	Lewistown Mun	Lewistown Mt	USA	t	47.048333	-109.465000
1429	LWV	Lawrenceville-Vincennes Intl	Lawrenceville	USA	t	38.763333	-87.605000
1430	LXR	Luxor	Luxor	Egypt	t	25.670000	32.703333
1431	LXS	Limnos	Lemnos	Greece	t	39.916667	25.236667
1432	LYE	Lyneham Ab	Lyneham	United Kingdom	t	51.503333	-1.991667
1433	LYH	Lynchburg Regl-Glenn	Lynchburg	USA	t	37.326667	-79.200000
1434	LYN	Bron	Lyon Lyn	France	t	45.730000	4.938333
1435	LYP	Faisalabad	Faisalabad	Pakistan	t	31.365000	72.995000
1436	LYR	Longyear	Longyearbyen	Norway	t	78.245000	15.468333
1437	LYS	Satolas	Lyon Lys	France	t	45.726667	5.081667
1438	MAA	Chennai Intl	Chennai Madras	India	t	12.993333	80.176667
1439	MAB	Maraba	Maraba	Brazil	t	-5.365000	-49.138333
1440	MAD	Barajas	Madrid	Spain	t	40.473333	-3.558333
1441	MAF	Midland Intl	Midland Odessa	USA	t	31.941667	-102.201667
1442	MAH	Menorca	Menorca	Spain	t	39.861667	4.220000
1443	MAJ	Marshall Is Intl	Majuro	Micronesia	t	7.063333	171.271667
1444	MAM	Gen Servando Canales Intl	Matamoros	Mexico	t	25.770000	-97.525000
1445	MAN	Manchester	Manchester Uk	United Kingdom	t	53.353333	-2.273333
1446	MAO	Eduardo Gomes Intl	Manaus	Brazil	t	-3.038333	-60.046667
1447	MAR	La Chinita Intl	Maracaibo	Venezuela	t	10.561667	-71.725000
1448	MAS	Marcia Sheid	Manus Island	Papua New Guine	t	81.666667	-120.000000
1449	MAZ	Eugenio Maria De Hostos	Mayaguez	Puerto Rico	t	18.255000	-67.148333
1450	MBA	Mombasa Moi	Mombasa	Kenya	t	-4.025000	39.596667
1451	MBD	Mmabatho Intl	Mmabatho	South Africa	t	-25.803333	25.545000
1452	MBJ	Sangster Intl	Montego Bay	Jamaica	t	18.500000	-77.915000
1453	MBS	Mbs Intl	Saginaw	USA	t	43.531667	-84.078333
1454	MBX	Maribor	Maribor	Slovenia	t	46.480000	15.690000
1455	MCC	Mc Clellan Afb	Mcclelland Afb	USA	t	38.666667	-121.400000
1456	MCE	Merced Mun/Macready	Merced	USA	t	37.283333	-120.513333
1457	MCF	Macdill Afb	Macdill Afb Fl	USA	t	27.848333	-82.520000
1458	MCG	Mc Grath	Mcgrath	USA	t	62.951667	-155.605000
1459	MCI	Kansas City Intl	Kansas City Intl	USA	t	39.296667	-94.713333
1460	MCK	Mc Cook Mun	Mccook	USA	t	40.205000	-100.591667
1461	MCN	Middle Georgia Regl	Macon	USA	t	32.691667	-83.648333
1462	MCO	Orlando Intl	Orlando Intl	USA	t	28.428333	-81.315000
1463	MCP	Macapa Intl	Macapa	Brazil	t	0.051667	-51.066667
1464	MCT	Seeb Intl	Muscat	Oman	t	23.591667	58.281667
1465	MCW	Mason City Mun	Mason City	USA	t	43.156667	-93.330000
1466	MCY	Maroochydore	Maroochydore	Australia	t	-26.603333	153.091667
1467	MCZ	Campo Dos Palmares	Maceio	Brazil	t	-9.516667	-35.783333
1468	MDA	Arroyo Barril	Martindale Aaf	USA	t	19.198333	-69.430000
1469	MDC	Ratulangi	Manado	Indonesia	t	1.548333	124.925000
1470	MDD	Midland	Not In Tbl	\N	t	32.035000	-102.100000
1471	MDE	Jose Maria Cordova	Medellin	Colombia	t	6.166667	-75.426667
1472	MDH	Southern Illinois	Carbondale	USA	t	37.778333	-89.251667
1473	MDK	Mbandaka	Mbandaka	Zaire Republic	t	0.026667	18.288333
1474	MDL	Chanmyathazi	Mandalay	Myanmar	t	21.943333	96.093333
1475	MDO	Middleton Island	Middleton Is	USA	t	59.450000	-146.308333
1476	MDT	Harrisburg Intl	Harrisburg Intl	USA	t	40.193333	-76.763333
1477	MDW	Chicago-Midway	Chicago Midway	USA	t	41.785000	-87.751667
1478	MDY	Midway Naf	Midway Island	Us Pacific Is	t	28.193333	-177.395000
1479	MDZ	El Plumerillo	Mendoza	Argentina	t	-32.833333	-68.783333
1480	MEA	Macae	Macae	Brazil	t	-22.341667	-41.763333
1481	MEB	Essendon	Melbourne Meb	Australia	t	-37.728333	144.901667
1482	MEC	Eloy Alfaro Intl	Manta	Ecuador	t	-0.943333	-80.676667
1483	MED	Pr Mohammad Bin Abdulaziz Intl	Madinah	Saudi Arabia	t	24.553333	39.705000
1484	MEI	Key	Meridian	USA	t	32.331667	-88.751667
1485	MEL	Melbourne Intl	Melbourne	Australia	t	-37.673333	144.843333
1486	MEM	Memphis Intl	Memphis	USA	t	35.043333	-89.976667
1487	MER	Castle	Not In Tbl	\N	t	37.380000	-120.566667
1488	MES	Polonia	Medan	Indonesia	t	3.563333	98.675000
1489	MEX	Mexico City	Mexico City	Mexico	t	19.435000	-99.071667
1490	MFD	Mansfield Lahm Mun	Mansfield	USA	t	40.820000	-82.515000
1491	MFE	Mc Allen Miller Intl	Mcallen	USA	t	26.175000	-98.238333
1492	MFM	Macau	Macau	Macau	t	22.150000	113.588333
1493	MFR	Rogue Valley Intl-Medford	Medford Or	USA	t	42.371667	-122.871667
1494	MFU	Mfuwe	Mfuwe	Zambia	t	-13.266667	31.933333
1495	MGA	Augusto Cesar Sandino	Managua	Nicaragua	t	12.140000	-86.170000
1496	MGD	Magdalena Bol	Magdalena	Bolivia	t	-13.256667	-64.060000
1497	MGE	Dobbins Arb	Marietta	USA	t	33.915000	-84.515000
1498	MGH	Margate	Margate	South Africa	t	-30.856667	30.343333
1499	MGJ	Orange Co	Montgomery	USA	t	41.508333	-74.263333
1500	MGM	Dannelly	Montgomery	USA	t	32.300000	-86.393333
1501	MGR	Moultrie Mun	Moultrie Thomas	USA	t	31.083333	-83.801667
1502	MGW	Morgantown Mun-Hart	Morgantown	USA	t	39.641667	-79.915000
1503	MGY	Dayton-Wright Brothers	Montgomery Co	USA	t	39.590000	-84.223333
1504	MHD	Shahid Hashemi Nejad	Mashad	Iran	t	36.233333	59.645000
1505	MHE	Mitchell Mun	Mitchell Sd	USA	t	43.773333	-98.038333
1506	MHH	Marsh Harbor Bahamas	Marsh Harbour	Bahamas	t	26.511667	-77.085000
1507	MHK	Manhattan Regl	Manhattan	USA	t	39.140000	-96.670000
1508	MHQ	Mariehamn	Mariehamn Aland	Finland	t	60.121667	19.898333
1509	MHR	Mather	Mather Afb	USA	t	38.553333	-121.296667
1510	MHT	Manchester	Manchester Nh	USA	t	42.933333	-71.436667
1511	MHV	Mohave	Mojave	USA	t	35.055000	-118.150000
1512	MHZ	Mildenhall Ab	Mildenhall	United Kingdom	t	52.360000	0.486667
1513	MIA	Miami Intl	Miami Interntnl	USA	t	25.791667	-80.290000
1514	MIB	Minot Afb	Minot Afb Nd	USA	t	48.415000	-101.356667
1515	MID	Lic Manuel Crecencio Rejon	Merida Mx	Mexico	t	20.940000	-89.655000
1516	MIE	Delaware Co-Johnson	Muncie	USA	t	40.241667	-85.395000
1517	MIK	Mikkeli	Mikkeli	Finland	t	61.685000	27.203333
1518	MIO	Miami Mun	Miami	USA	t	36.908333	-94.886667
1519	MIQ	Millard Mun	Omaha Millard	USA	t	41.195000	-96.111667
1520	MIR	Habib Bourguiba	Monastir	Tunisia	t	35.756667	10.753333
1521	MIU	Maiduguri	Maiduguri	Nigeria	t	11.855000	13.081667
1522	MIV	Millville Mun	Millville	USA	t	39.366667	-75.073333
1523	MJD	Moenjodaro	Mohenjo Daro	Pakistan	t	27.333333	68.183333
1524	MJM	Mbuji-Mayi	Mbuji Mayi	Zaire Republic	t	-6.116667	23.566667
1525	MJN	Amborovy	Majunga	Madagascar	t	-15.665000	46.350000
1526	MJT	Odysseas Elytis	Mytilene	Greece	t	39.058333	26.600000
1527	MJV	San Javier Ab	Murcia	Spain	t	37.775000	-0.810000
1528	MKC	Kansas City Downtown	Kansas City Dwntn	USA	t	39.121667	-94.591667
1529	MKE	Gen Mitchell Intl	Milwaukee	USA	t	42.946667	-87.896667
1530	MKG	Muskegon Co	Muskegon	USA	t	43.168333	-86.236667
1531	MKJ	Kingston Fir Mkjk	Makoua	Congo Republic	t	0.000000	0.000000
1532	MKK	Molokai	Molokai Hoolehua	USA	t	21.151667	-157.095000
1533	MKL	Mc Kellar-Sipes Regl	Jackson Tn	USA	t	35.598333	-88.915000
1534	MKO	Davis	Muskogee Davis	USA	t	35.656667	-95.360000
1535	MKY	Mackay	Mackay	Australia	t	-21.171667	149.178333
1536	MLA	Luqa	Malta	Malta	t	35.858333	14.476667
1537	MLB	Melbourne Intl	Melbourne Fl	USA	t	28.101667	-80.645000
1538	MLC	Mc Alester Regl	Mcalester	USA	t	34.881667	-95.783333
1539	MLE	Male Intl	Male	Maldives	t	4.190000	73.533333
1540	MLF	Milford Mun	Milford	USA	t	38.425000	-113.011667
1541	MLH	Mulhouse-Basel	Mulhouse Basel	France	t	47.590000	7.530000
1542	MLI	Quad-City Intl.	Moline Quad City	USA	t	41.448333	-90.506667
1543	MLJ	Baldwin Co	Milledgeville	USA	t	33.153333	-83.240000
1544	MLM	Gen Francisco J Mujica Intl	Morelia	Mexico	t	19.845000	-101.028333
1545	MLS	Wiley	Miles City	USA	t	46.426667	-105.885000
1546	MLU	Monroe Regl	Monroe	USA	t	32.510000	-92.036667
1547	MLW	Spriggs Payne	Monrovia Mlw	Liberia	t	6.283333	-10.766667
1548	MMB	Memanbetsu	Memanbetsu	Japan	t	43.880000	144.166667
1549	MME	Teesside	Teesside	United Kingdom	t	54.508333	-1.426667
1550	MMM	Hamamatsu Aero	Middle Mount	Australia	t	34.746667	137.705000
1551	MMT	Mc Entire Angb	Not In Tbl	\N	t	33.920000	-80.806667
1552	MMU	Morristown Mun	Morristown	USA	t	40.798333	-74.413333
1553	MMX	Sturup	Malmo Sturup	Sweden	t	55.548333	13.355000
1554	MNI	W.h Bramble Montserrat Is	Montserrat	Montserrat	t	16.760000	-62.155000
1555	MNL	Ninoy Aquino Intl	Manila	Philippines	t	14.510000	121.016667
1556	MNM	Menominee-Marinette Twin Co	Menominee	USA	t	45.126667	-87.638333
1557	MNS	Mansa	Mansa	Zambia	t	-11.133333	28.866667
1558	MNZ	Manassas Regl/Davis	Manassas	USA	t	38.720000	-77.515000
1559	MOA	Moa	Moa	Cuba	t	20.650000	-74.928333
1560	MOB	Mobile Regl	Mobile Pascagoula	USA	t	30.690000	-88.241667
1561	MOC	Montes Claros Brazil	Montes Claros	Brazil	t	-16.703333	-43.820000
1562	MOD	Modesto City-Co-Sham	Modesto	USA	t	37.625000	-120.953333
1563	MOJ	Montijo Ab	Montijo Ab Pt	Portugal	t	38.705000	-9.035000
1564	MOL	Aro	Molde	Norway	t	62.745000	7.271667
1565	MOR	Moore-Murrell	Morristown Tn	USA	t	36.178333	-83.375000
1566	MOT	Minot Intl	Minot	USA	t	48.258333	-101.280000
1567	MOV	Monclova Mexico	Moranbah	Australia	t	26.956667	-101.468333
1568	MPJ	Petit Jean Park	Not In Tbl	\N	t	35.138333	-92.908333
1569	MPL	Montpellier/Mediterranee	Montpellier Fr	France	t	43.583333	3.961667
1570	MPM	Maputo	Maputo	Mozambique	t	-25.920000	32.571667
1571	MPV	Knapp State	Montpelier Vt	USA	t	44.203333	-72.561667
1572	MQQ	Moundou	Moundou	Chad	t	8.616667	16.066667
1573	MQT	Marquette Co	Marquette	USA	t	46.533333	-87.561667
1574	MQY	Smyrna	Smyrna	USA	t	36.008333	-86.520000
1575	MRB	Eastern W Va Regl/Shepherd	Martinsburg	USA	t	39.401667	-77.983333
1576	MRC	Maury Co	Columbia Tn	USA	t	35.553333	-87.178333
1577	MRD	Alberto Carnevalli	Merida Ve	Venezuela	t	8.583333	-71.166667
1578	MRF	Marfa Mun	Not In Tbl	\N	t	30.370000	-104.016667
1579	MRK	Marco I	Marco Island	USA	t	25.995000	-81.671667
1580	MRS	Marseille/Provence	Marseille	France	t	43.436667	5.215000
1581	MRU	Mauritius Intl	Mauritius	Mauritius	t	-20.430000	57.681667
1582	MRY	Monterey Peninsula	Monterey Ca Mry	USA	t	36.586667	-121.841667
1583	MSD	San Isidro Ab	Mt Pleasant Ut	USA	t	18.503333	-69.761667
1584	MSE	Manston U.k.	Manston	United Kingdom	t	51.341667	1.346667
1585	MSJ	Misawa Ab	Misawa	Japan	t	40.701667	141.375000
1586	MSL	Northwest Alabama Regl	Muscle Shoals	USA	t	34.745000	-87.610000
1587	MSN	Dane Co Regl-Truax	Madison	USA	t	43.138333	-89.336667
1588	MSO	Missoula Intl	Missoula	USA	t	46.915000	-114.090000
1589	MSP	Minneapolis-St Paul Intl	Minneapolis St Pl	USA	t	44.880000	-93.216667
1590	MSQ	Minsk-2	Minsk	Belarus	t	53.883333	28.033333
1591	MSS	Massena Intl-Richards	Massena	USA	t	44.935000	-74.845000
1592	MST	Maastricht-Aachen	Maastricht	Netherlands	t	50.915000	5.776667
1593	MSU	Moshoeshoe I Intl	Maseru	Lesotho	t	-29.453333	27.555000
1594	MSV	Sullivan Co Intl	Monticello Sulliv	USA	t	41.700000	-74.795000
1595	MSY	New Orleans Intl	New Orleans	USA	t	29.993333	-90.256667
1596	MTC	Selfridge Angb	Mt Clemens	USA	t	42.611667	-82.831667
1597	MTH	Marathon	Marathon	USA	t	24.725000	-81.050000
1598	MTJ	Montrose Regl	Montrose	USA	t	38.508333	-107.893333
1599	MTN	Martin State	Baltimore Martin	USA	t	39.325000	-76.413333
1600	MTO	Coles Co Meml	Mattoon	USA	t	39.476667	-88.280000
1601	MTP	Montauk	Montauk Point	USA	t	41.075000	-71.920000
1602	MTR	Los Garzones	Monteria	Colombia	t	8.828333	-75.828333
1603	MTS	Matsapha	Manzini	Swaziland	t	-26.528333	31.306667
1604	MTT	Minatitlan	Minatitlan	Mexico	t	18.101667	-94.580000
1605	MTY	Gen Mariano Escobedo Intl	Monterrey Mx Mty	Mexico	t	25.778333	-100.106667
1606	MUB	Maun	Maun	Botswana	t	-19.971667	23.426667
1607	MUC	Munich	Munich	Germany	t	48.353333	11.785000
1608	MUN	Maturin Intl	Maturin	Venezuela	t	9.748333	-63.166667
1609	MUO	Mountain Home Afb	Mountain Home Afb	USA	t	43.043333	-115.871667
1610	MUX	Multan	Multan	Pakistan	t	30.200000	71.416667
1611	MUZ	Musoma	Musoma	Tanzania	t	-1.498333	33.800000
1612	MVB	M Vengue	Franceville	Gabon	t	-1.651667	13.436667
1613	MVC	Monroe Co	Not In Tbl	\N	t	31.456667	-87.350000
1614	MVD	Carrasco Intl/Gen C L Berisso	Montevideo	Uruguay	t	-34.836667	-56.030000
1615	MVR	Salak	Maroua	Cameroon	t	10.453333	14.253333
1616	MVY	Martha S Vineyard	Marthas Vineyard	USA	t	41.391667	-70.613333
1617	MVZ	Masvingo	Masvingo	Zimbabwe	t	-20.060000	30.861667
1618	MWA	Williamson Co Regl	Marion Il	USA	t	37.751667	-89.010000
1619	MWH	Grant Co	Moses Lake	USA	t	47.206667	-119.320000
1620	MWL	Mineral Wells	Mineral Wells	USA	t	32.781667	-98.060000
1621	MWZ	Mwanza	Mwanza	Tanzania	t	-2.450000	32.933333
1622	MXA	Manila Mun	Manila	USA	t	35.891667	-90.153333
1623	MXE	Laurinburg-Maxton	Maxton	USA	t	34.788333	-79.360000
1624	MXF	Maxwell Afb	Maxwell Afb Al	USA	t	32.380000	-86.363333
1625	MXL	Gen Rodolfo Sanchez Taboada	Mexicali	Mexico	t	32.630000	-115.240000
1626	MXP	Malpensa	Milan Malpensa	Italy	t	45.633333	8.730000
1627	MXX	Siljan	Mora	Sweden	t	60.958333	14.513333
1628	MYC	Mariscal Sucre Ab	Maracay	Venezuela	t	10.250000	-67.650000
1629	MYJ	Matsuyama	Matsuyama	Japan	t	33.823333	132.701667
1630	MYL	Mc Call	Mccall	USA	t	44.888333	-116.101667
1631	MYR	Myrtle Beach Intl	Myrtle Beach	USA	t	33.678333	-78.926667
1632	MYV	Yuba Co	Marysvle Yubaci	USA	t	39.096667	-121.568333
1633	MYW	Mtwara	Mtwara	Tanzania	t	-10.333333	40.180000
1634	MZG	Makung Ab	Makung	Taiwan	t	23.571667	119.621667
1635	MZH	Merzifon Ab	Merzifon	Turkey	t	40.831667	35.520000
1636	MZJ	Marana - Pinal Airpark	Marana	USA	t	32.510000	-111.326667
1637	MZM	Frescaty Ab	Metz	France	t	49.075000	6.133333
1638	MZO	Manzanillo	Manzanillo Cu	Cuba	t	20.285000	-77.093333
1639	MZT	Mazatlan	Mazatlan	Mexico	t	23.160000	-106.263333
1640	NAG	Nagpur	Nagpur	India	t	21.090000	79.048333
1641	NAK	Nakhon Ratchasima Thailand	Nakhon Ratchasima	Thailand	t	14.936667	102.078333
1642	NAN	Nadi Intl	Nadi	Fiji	t	-17.755000	177.443333
1643	NAP	Capodichino Mil	Naples	Italy	t	40.883333	14.288333
1644	NAS	Nassau Intl	Nassau	Bahamas	t	25.040000	-77.470000
1645	NAT	Augusto Severo Intl	Natal	Brazil	t	-5.906667	-35.248333
1646	NAX	John Rodgers Fld	Barbers Point	USA	t	21.305000	-158.071667
1647	NBC	Beaufort Mcas	Naberevnye Chelny	Russia	t	32.478333	-80.718333
1648	NBE	Dallas Nas	Dallas Nas Tx	USA	t	32.735000	-96.968333
1649	NBG	New Orleans Nas	New Orleans Nas	USA	t	29.825000	-90.025000
1650	NBO	Nairobi J. Kenyatta	Nairobi Kenyatta	Kenya	t	-1.318333	36.925000
1651	NBW	Guantanamo Bay Nas	Not In Tbl	\N	t	19.906667	-75.206667
1652	NCE	Nice/Cote D Azur	Nice	France	t	43.665000	7.215000
1653	NCF	Curacao Fir	French Railways	France	t	0.000000	0.000000
1654	NCL	Newcastle	Newcastle Uk	United Kingdom	t	55.036667	-1.690000
1655	NCY	Meythet	Annecy	France	t	45.930000	6.106667
1656	NDB	Nouadhibou	Nouadhibou	Mauritania	t	20.928333	-17.033333
1657	NDJ	N Djamena	Ndjamena	Chad	t	12.125000	15.025000
1658	NEL	Lakehurst Naes	Not In Tbl	\N	t	40.033333	-74.353333
1659	NEU	Iwakuni Mcas	Sam Neua	Lao Peoples Dem	t	34.140000	132.238333
1660	NEV	Newcastle, Nevis	Nevis	Nevis	t	17.211667	-62.591667
1661	NEW	Lakefront	New Orlns Lakfrnt	USA	t	30.041667	-90.026667
1662	NFL	Fallon Nas	Fallon N A S	USA	t	39.415000	-118.700000
1663	NFW	Fort Worth Nas	Not In Tbl	\N	t	32.768333	-97.440000
1664	NGA	Young	Young	Australia	t	-34.250000	148.248333
1665	NGE	N Gaoundere	N Gaoundere	Cameroon	t	7.358333	13.561667
1666	NGF	Kaneohe Bay Mcaf	Not In Tbl	\N	t	21.450000	-157.768333
1667	NGO	Nagoya	Nagoya	Japan	t	35.251667	136.926667
1668	NGP	Corpus Christi Nas/Truax	Not In Tbl	\N	t	27.691667	-97.290000
1669	NGS	Nagasaki	Nagasaki	Japan	t	32.913333	129.915000
1670	NGU	Norfolk Nas	Norfolk	USA	t	36.936667	-76.288333
1671	NGZ	Alameda Nas	Alameda Nas Ca	USA	t	37.788333	-122.320000
1672	NHK	Patuxent River Nas	Patuxent Rv Nas	USA	t	38.291667	-76.415000
1673	NHT	Northolt Ab	Northolt	United Kingdom	t	51.551667	-0.416667
1674	NHZ	Brunswick Nas	Brunswick Me	USA	t	43.891667	-69.938333
1675	NID	China Lake Naws	Nassau Inn	USA	t	35.688333	-117.690000
1676	NIM	Diori Hamani	Niamey	Niger	t	13.480000	2.171667
1677	NIP	Jacksonville Nas	Jacksonville Nas	USA	t	30.233333	-81.675000
1678	NIT	Souche	Niort	France	t	46.313333	-0.393333
1679	NJA	Atsugi Aero	Not In Tbl	\N	t	35.443333	139.453333
1680	NJK	El Centro Naf	El Centro Naf	USA	t	32.825000	-115.675000
1681	NKC	Nouakchott	Nouakchott	Mauritania	t	18.095000	-15.950000
1682	NKT	Cherry Point Mcas	Cherry Point Mcas	USA	t	34.903333	-76.880000
1683	NKW	Diego Garcia Navy	Not In Tbl	\N	t	-7.313333	72.410000
1684	NKX	Miramar Nas California	Mirimar Nas	USA	t	32.870000	-117.143333
1685	NLA	Ndola	Ndola	Zambia	t	-12.995000	28.665000
1686	NLC	Lemoore Nas	Lemoore Nas Ca	USA	t	36.331667	-119.951667
1687	NLD	Quetzalcoatl Intl	Nuevo Laredo	Mexico	t	27.441667	-99.568333
1688	NLK	Norfolk Island Intl	Norfolk Island	Norfolk Island	t	-29.041667	167.933333
1689	NOC	Connaught	Connaught	Ireland	t	53.910000	-8.816667
1690	NOP	Mactan Intl	Mactan Island	Philippines	t	10.313333	123.983333
1691	NOS	Fascene	Nossi Be	Madagascar	t	-13.316667	48.310000
1692	NOU	Tontouta	Noumea Tontouta	New Caledonia	t	-22.018333	166.211667
1693	NOV	Albano Machado	Huambo	Angola	t	-12.805000	15.755000
1694	NPA	Pensacola Nas	Not In Tbl	\N	t	30.351667	-87.318333
1695	NQA	Millington Mun	Not In Tbl	\N	t	35.355000	-89.868333
1696	NQN	Neuquen	Neuquen	Argentina	t	-38.933333	-68.133333
1697	NQX	Key West Nas	Key West Nas	USA	t	24.573333	-81.685000
1698	NQY	St Mawgan Ab	Newquay	United Kingdom	t	50.440000	-4.993333
1699	NRB	Mayport Ns	Navy Mayport	USA	t	30.391667	-81.423333
1700	NRK	Kungsangen	Norrkoping	Sweden	t	58.585000	16.245000
1701	NRR	Roosevelt Roads Ns	Roosevelt Rds Nas	Puerto Rico	t	18.245000	-65.643333
1702	NRT	New Tokyo Intl Narita	Tokyo Narita	Japan	t	35.763333	140.390000
1703	NSI	Nsimalen	Yaounde Nsimalen	Cameroon	t	3.713333	11.551667
1704	NSY	Sigonella Mil	Sigonella	Italy	t	37.403333	14.921667
1705	NTB	Notodden	Notodden	Norway	t	59.563333	9.218333
1706	NTD	Point Mugu Naws	Point Mugu Nas	USA	t	34.118333	-119.118333
1707	NTE	Nantes/Atlantique	Nantes	France	t	47.156667	-1.606667
1708	NTL	Williamtown Military	Newcastle Ntl	Australia	t	-32.795000	151.833333
1709	NTR	Del Norte Intl	Monterrey Denorte	Mexico	t	25.865000	-100.236667
1710	NTU	Oceana Nas	Oceana Nas Va	USA	t	36.823333	-76.030000
1711	NUE	Nurnberg	Nuremberg	Germany	t	49.498333	11.076667
1712	NUQ	Moffett Field	Not In Tbl	\N	t	37.415000	-122.050000
1713	NUW	Whidbey I Nas	Not In Tbl	\N	t	48.351667	-122.655000
1714	NVA	Benito Salas	Neiva	Colombia	t	2.948333	-75.296667
1715	NVS	Fourchambault	Neveras	France	t	47.003333	3.111667
1716	NVT	Navegantes-Itajai	Navegantes	Brazil	t	-26.878333	-48.646667
1717	NWI	Norwich	Norwich	United Kingdom	t	52.675000	1.283333
1718	NXX	Willow Grove Nas Jrb	Willow Grove Nas	USA	t	40.198333	-75.146667
1719	NYO	Skavsta	Nykoping	Sweden	t	58.788333	16.903333
1720	NZC	Cecil Field Nas	Cecil Nas	USA	t	30.218333	-81.876667
1721	NZJ	El Toro Marine Base	El Toro Mcas Ca	USA	t	33.675000	-117.730000
1722	NZY	North Island Nas	North Island Nas	USA	t	32.698333	-117.215000
1723	OAJ	Ellis	Jacksonville Nc	USA	t	34.828333	-77.611667
1724	OAK	Metro Oakland Intl	Oakland Ca	USA	t	37.720000	-122.220000
1725	OAX	Xoxocotlan Intl	Oaxaca	Mexico	t	16.998333	-96.725000
1726	OBF	Oberpfaffenhofen	Oberpfafenhofen	Germany	t	48.080000	11.281667
1727	OBO	Obihiro	Obihiro	Japan	t	42.730000	143.220000
1728	OCF	Ocala Regl/Taylor	Ocala	USA	t	29.171667	-82.223333
1729	OCH	Mangham Regl	Nacogdoches	USA	t	31.576667	-94.708333
1730	OCW	Warren	Washington Nc	USA	t	35.570000	-77.048333
1731	ODE	Odense	Odense	Denmark	t	55.476667	10.331667
1732	ODH	Odiham Ab	Not In Tbl	\N	t	51.233333	-0.940000
1733	ODS	Odessa	Odessa	Ukraine	t	46.426667	30.678333
1734	OER	Ornskoldsvik	Ornskoldsvik	Sweden	t	63.408333	18.995000
1735	OGD	Ogden-Hinckley	Ogden	USA	t	41.195000	-112.011667
1736	OGG	Kahului	Kahului Maui	USA	t	20.898333	-156.430000
1737	OGS	Ogdensburg Intl	Ogdensburg	USA	t	44.681667	-75.465000
1738	OHA	Ohakea Military	Not In Tbl	\N	t	-40.208333	175.386667
1739	OHD	Ohrid	Ohrid	Macedonia	t	41.180000	20.741667
1740	OHI	Oshakati	Oshakati	Namibia	t	-17.793333	15.698333
1741	OIA	Oil Platform	Not In Tbl	\N	t	27.946667	-90.996667
1742	OIT	Oita	Oita	Japan	t	33.475000	131.738333
1743	OKA	Naha	Okinawa	Japan	t	26.191667	127.646667
1744	OKC	Will Rogers World	Oklahoma City	USA	t	35.391667	-97.600000
1745	OKD	Sapporo	Sapporo Okadama	Japan	t	43.115000	141.383333
1746	OKJ	Okayama	Okayama	Japan	t	34.751667	133.855000
1747	OKK	Kokomo Mun	Kokomo	USA	t	40.526667	-86.058333
1748	OKO	Yokota Ab	Yokota Afb	Japan	t	35.745000	139.351667
1749	OKY	Oakey Military	Oakey	Australia	t	-27.410000	151.735000
1750	OLA	Orland Ab	Orland	Norway	t	63.698333	9.605000
1751	OLB	Costa Smeralda	Olbia	Italy	t	40.896667	9.516667
1752	OLF	Clayton	Wolf Point	USA	t	48.093333	-105.575000
1753	OLM	Olympia	Olympia	USA	t	46.970000	-122.901667
1754	OLS	Nogales Intl	Nogales	USA	t	31.416667	-110.846667
1755	OLU	Columbus Mun	Columbus Ne	USA	t	41.446667	-97.340000
1756	OLV	Olive Branch	Olive Branch	USA	t	34.978333	-89.786667
1757	OMA	Eppley	Omaha	USA	t	41.301667	-95.893333
1758	OME	Nome	Nome	USA	t	64.511667	-165.445000
1759	OMR	Oradea	Oradea	Romania	t	47.025000	21.903333
1760	OND	Ondangwa	Ondangwa	Namibia	t	-17.878333	15.950000
1761	ONM	Socorro Mun	Not In Tbl	\N	t	34.021667	-106.901667
1762	ONO	Ontario Mun	Ontario Or	USA	t	44.020000	-117.013333
1763	ONP	Newport Mun	Newport Or	USA	t	44.580000	-124.056667
1764	ONT	Ontario Intl	Ontario Ca	USA	t	34.055000	-117.600000
1765	ONX	Enrique Adolfo Jimenez	Colon	Panama	t	9.355000	-79.866667
1766	ONY	Olney Mun	Olney Tx	USA	t	33.350000	-98.818333
1767	OOA	Oskaloosa Mun	Oskaloosa	USA	t	41.225000	-92.493333
1768	OOL	Coolangatta	Gold Coast	Australia	t	-28.165000	153.505000
1769	OPF	Opa Locka	Opa Locka	USA	t	25.906667	-80.278333
1770	OPL	St Landry Parish-Ahart	Opelousas	USA	t	30.558333	-92.098333
1771	OPO	Francisco Sa Carneiro	Porto Portugal	Portugal	t	41.233333	-8.676667
1772	OQU	Quonset State	Not In Tbl	\N	t	41.596667	-71.411667
1773	ORB	Orebro	Orebro	Sweden	t	59.226667	15.040000
1774	ORD	Chicago-O Hare Intl	Chicago Ohare	USA	t	41.978333	-87.903333
1775	ORE	Bricy Ab	Orleans	France	t	47.986667	1.761667
1776	ORF	Norfolk Intl	Norfolk Va Beach	USA	t	36.893333	-76.200000
1777	ORH	Worcester Regl	Worcester	USA	t	42.266667	-71.875000
1778	ORK	Cork	Cork	Ireland	t	51.840000	-8.488333
1779	ORL	Executive	Orlando	USA	t	28.545000	-81.331667
1780	ORN	Es Senia	Oran Dz	Algeria	t	35.626667	-0.608333
1781	ORS	Eastsound Orcas Isl	Orpheus Is Rsrt	Australia	t	48.708333	-122.913333
1782	ORT	Northway	Northway	USA	t	62.960000	-141.928333
1783	ORW	Ormara	Ormara	Pakistan	t	25.300000	64.583333
1784	ORX	Oriximina	Oriximina	Brazil	t	-1.766667	-55.866667
1785	ORY	Orly	Paris Orly	France	t	48.723333	2.380000
1786	OSC	Oscoda-Wurtsmith	Oscoda	USA	t	44.451667	-83.380000
1787	OSD	Froson Ab	Ostersund	Sweden	t	63.195000	14.503333
1788	OSH	Wittman Regl	Oshkosh	USA	t	43.983333	-88.556667
1789	OSN	Osan Ab	Osan Afb	South Korea	t	37.085000	127.031667
1790	OSR	Mosnov	Ostrava	Czech Republic	t	49.695000	18.110000
1791	OST	Ostend	Ostend	Belgium	t	51.198333	2.863333
1792	OTH	North Bend Mun	North Bend	USA	t	43.416667	-124.245000
1793	OTM	Ottumwa Industrial	Ottumwa	USA	t	41.106667	-92.448333
1794	OTP	Otopeni	Bucharest Otopeni	Romania	t	44.575000	26.086667
1795	OTZ	Wien Meml	Kotzebue	USA	t	66.883333	-162.598333
1796	OUA	Ouagadougou	Ouagadougou	Burkina Faso	t	12.353333	-1.510000
1797	OUD	Angads	Oujda	Morocco	t	34.788333	-1.926667
1798	OUL	Oulu	Oulu	Finland	t	64.928333	25.358333
1799	OUN	Univ Of Okla Westheimer	Norman	USA	t	35.245000	-97.471667
1800	OVB	Tolmachevo	Novosibirsk	E Ural Russia	t	55.011667	82.651667
1801	OVD	Asturias	Asturias	Spain	t	43.563333	-6.031667
1802	OWB	Owensboro-Daviess Co	Owensboro	USA	t	37.740000	-87.165000
1803	OWD	Norwood Meml	Norwood	USA	t	42.190000	-71.171667
1804	OXB	Osvaldo Vieira Intl	Bissau	Guinea Bissau	t	11.888333	-15.656667
1805	OXC	Waterbury-Oxford	Oxford	USA	t	41.478333	-73.135000
1806	OXR	Oxnard	Oxnard	USA	t	34.200000	-119.206667
1807	OYA	Goya	Goya	Argentina	t	-29.103333	-59.216667
1808	OYK	Oiapoque	Oiapoque	Brazil	t	3.855000	-51.796667
1809	OZP	Seville Moron Ab, Spain	Moron Ab	Spain	t	41.205000	-5.615000
1810	OZR	Cairns Aaf	Ozark	USA	t	31.273333	-85.713333
1811	OZZ	Ouarzazate	Ouarzazate	Morocco	t	30.933333	-6.900000
1812	PAD	Paderborn-Lippstadt	Paderborn	Germany	t	51.613333	8.615000
1813	PAE	Snohomish Co	Everett	USA	t	47.906667	-122.280000
1814	PAH	Barkley Regional	Paducah	USA	t	37.060000	-88.773333
1815	PAM	Tyndall Afb	Tyndall Afb Fl	USA	t	30.070000	-85.575000
1816	PAP	Port-Au-Prince	Port Au Prince	Haiti	t	18.578333	-72.295000
1817	PAT	Patna	Patna	India	t	25.593333	85.093333
1818	PAV	Paulo Afonso	Paulo Afonso	Brazil	t	-9.401667	-38.253333
1819	PAZ	Tuxpan	Poza Rica	Mexico	t	20.601667	-97.458333
1820	PBC	Hermanos Serdan, Puebla, Mex	Puebla	Mexico	t	19.143333	-98.371667
1821	PBF	Grider	Pine Bluff	USA	t	34.173333	-91.933333
1822	PBI	Palm Beach Intl	West Palm Beach	USA	t	26.681667	-80.095000
1823	PBL	Gen. Bartolome Salom Intl	Puerto Cabello	Venezuela	t	10.483333	-68.066667
1824	PBM	J.a. Pengel Intl	Paramaribo	Suriname	t	5.451667	-55.195000
1825	PCL	David Abenzur Rengifo	Pucallpa	Peru	t	-8.375000	-74.571667
1826	PDG	Padang Indonesia	Padang	Indonesia	t	-0.883333	100.350000
1827	PDK	Dekalb-Peachtree	Atlanta Dekalb	USA	t	33.875000	-84.301667
1828	PDL	Joao Paulo Ii	Ponta Delgada	Portugal	t	37.740000	-25.696667
1829	PDS	Piedras Negras Intl	Piedras Negras	Mexico	t	28.628333	-100.535000
1830	PDT	Eastern Oreg Regl At Pendleton	Pendleton	USA	t	45.695000	-118.840000
1831	PDX	Portland Intl	Portland Or Pdx	USA	t	45.588333	-122.596667
1832	PEG	San Egidio	Perugia	Italy	t	43.096667	12.510000
1833	PEI	Matecana	Pereira	Colombia	t	4.813333	-75.745000
1834	PEK	Beijing Capital	Beijing	China	t	40.075000	116.590000
1835	PEL	Ponta Pelada	Pelaneng	Lesotho	t	-3.145000	-59.983333
1836	PEM	Padre Aldamiz	Puerto Maldonad	Peru	t	-12.621667	-69.221667
1837	PEN	Penang Intl	Penang	Malaysia	t	5.298333	100.278333
1838	PEQ	Pecos Mun	Pecos City	USA	t	31.381667	-103.510000
1839	PER	Perth Intl	Perth	Australia	t	-31.940000	115.966667
1840	PET	Pelotas	Pelotas	Brazil	t	-31.718333	-52.326667
1841	PEW	Peshawar	Peshawar	Pakistan	t	33.991667	71.516667
1842	PFA	Fos Control Test City	Paf Warren	USA	t	38.298333	-93.716667
1843	PFB	Lauro Kurtz	Passo Fundo	Brazil	t	-28.243333	-52.326667
1844	PFN	Panama City-Bay Co Intl	Panama City Fl	USA	t	30.211667	-85.681667
1845	PFO	Pafos Intl	Paphos	Cyprus	t	34.718333	32.483333
1846	PGA	Page Mun	Page	USA	t	36.925000	-111.448333
1847	PGD	Charlotte Co	Punta Gorda	USA	t	26.920000	-81.990000
1848	PGF	Rivesaltes	Perpignan	France	t	42.741667	2.870000
1849	PGV	Pitt-Greenville	Greenville Nc	USA	t	35.633333	-77.385000
1850	PGX	Bassillac	Perigueux	France	t	45.198333	0.815000
1851	PHC	Port Harcourt	Port Harcourt	Nigeria	t	5.013333	6.950000
1852	PHE	Port Hedland Intl	Port Hedland	Australia	t	-20.376667	118.625000
1853	PHF	Newport News/Williamsburg Intl	Newport News	USA	t	37.131667	-76.491667
1854	PHL	Philadelphia Intl	Philadelphia	USA	t	39.870000	-75.245000
1855	PHT	Henry Co	Paris Tn	USA	t	36.336667	-88.381667
1856	PHX	Phoenix Sky Harbor Intl	Phoenix	USA	t	33.435000	-112.008333
1857	PIA	Greater Peoria Regl	Peoria	USA	t	40.663333	-89.691667
1858	PIB	Hattiesburg-Laurel Regl	Laurel Hattiesbrg	USA	t	31.466667	-89.336667
1859	PIE	St Petersburg-Clearwater Intl	St Petersburg	USA	t	27.910000	-82.686667
1860	PIH	Pocatello Regl	Pocatello	USA	t	42.910000	-112.595000
1861	PIK	Prestwick	Glasgow Prestwick	United Kingdom	t	55.506667	-4.585000
1862	PIM	Callaway Gardens-Harris Co	Pine Mountain	USA	t	32.840000	-84.881667
1863	PIO	Pisco	Pisco	Peru	t	-13.741667	-76.216667
1864	PIR	Pierre Regl	Pierre	USA	t	44.381667	-100.285000
1865	PIS	Biard	Poitiers	France	t	46.588333	0.306667
1866	PIT	Pittsburgh Intl	Pittsburgh	USA	t	40.490000	-80.231667
1867	PIU	Capt Guillermo Concha Iberico	Piura	Peru	t	-5.201667	-80.613333
1868	PJG	Panjgur	Panjgur	Pakistan	t	26.950000	64.138333
1869	PKB	Wood Co Wilson	Parkersburg	USA	t	39.345000	-81.438333
1870	PKC	Yelizovo	Petropavlovsk Kam	E Ural Russia	t	53.170000	158.451667
1871	PKV	Pskov	Pskov	Russia	t	57.786667	28.396667
1872	PKW	Selebi-Phikwe	Seleb Phikwe	Botswana	t	-22.055000	27.820000
1873	PLH	Plymouth	Plymouth Uk	United Kingdom	t	50.421667	-4.103333
1874	PLM	Sultan M Badaruddin Ii	Palembang	Indonesia	t	-2.900000	104.700000
1875	PLN	Pellston Regl Apt Of Emmet Co	Pellston	USA	t	45.570000	-84.796667
1876	PLS	Providenciales Intl	Providenciales	Turks And Caico	t	21.773333	-72.265000
1877	PLZ	Port Elizabeth	Port Elizabeth	South Africa	t	-33.988333	25.611667
1878	PMA	Pemba	Pemba Island	Tanzania	t	-5.266667	39.833333
1879	PMC	El Tepual Intl	Puerto Montt	Chile	t	-41.431667	-73.091667
1880	PMD	Palmdale Af Plant 42	Palmdale Af 42	USA	t	34.628333	-118.083333
1881	PMF	Parma	Parma	Italy	t	44.820000	10.295000
1882	PMG	Ponta Pora Intl	Ponta Pora	Brazil	t	-22.548333	-55.700000
1883	PMI	Palma De Mallorca	Palma De Mallorca	Spain	t	39.556667	2.730000
1884	PMO	Punta Raisi	Palermo	Italy	t	38.180000	13.098333
1885	PMR	Palmerston North	Palmerston North	New Zealand	t	-40.321667	175.616667
1886	PMV	Del Caribe Intl Gen Santi/Mari	Porlamar	Venezuela	t	10.916667	-63.965000
1887	PNA	Noain	Pamplona	Spain	t	42.770000	-1.643333
1888	PNB	Porto Nacional	Porto Nacional	Brazil	t	-10.716667	-48.398333
1889	PNC	Ponca City Mun	Ponca City	USA	t	36.730000	-97.098333
1890	PNE	Northeast Philadelphia	N Philadelphia	USA	t	40.081667	-75.010000
1891	PNH	Pochentong	Phnom Penh	Cambodia	t	11.548333	104.851667
1892	PNI	Pohnpei Intl	Pohnpei	Micronesia	t	6.985000	158.208333
1893	PNK	Supadio	Pontianak	Indonesia	t	-0.146667	109.403333
1894	PNL	Pantelleria Mil	Pantelleria	Italy	t	36.813333	11.965000
1895	PNQ	Pune Ab	Poona	India	t	18.583333	73.920000
1896	PNR	Pointe Noire	Pointe Noire	Congo Republic	t	-4.811667	11.885000
1897	PNS	Pensacola Regl	Pensacola	USA	t	30.471667	-87.186667
1898	PNZ	Petrolina	Petrolina	Brazil	t	-9.363333	-40.565000
1899	POA	Salgado Filho Intl	Porto Alegre	Brazil	t	-29.993333	-51.170000
1900	POB	Pope Afb	Pope Afb Nc	USA	t	35.170000	-79.013333
1901	POE	Polk Aaf	Ft Polk	USA	t	31.043333	-93.190000
1902	POG	Port Gentil	Port Gentil	Gabon	t	-0.718333	8.750000
1903	POM	Port Moresby Intl.	Port Moresby	Papua New Guine	t	-9.443333	147.215000
1904	POO	Pocos De Caldas	Pocos De Caldas	Brazil	t	-21.836667	-46.565000
1905	POR	Pori	Pori	Finland	t	61.460000	21.800000
1906	POS	Piarco Intl	Port Of Spain	Trinidad	t	10.591667	-61.348333
1907	POU	Dutchess Co	Poughkeepsie	USA	t	41.625000	-73.883333
1908	POX	Cormeilles-En-Vexin	Pontoise	France	t	49.096667	2.041667
1909	POY	Powell Mun	Powell	USA	t	44.868333	-108.791667
1910	POZ	Lawica	Poznan	Poland	t	52.420000	16.826667
1911	PPA	Le Fors	Pampa	USA	t	35.611667	-100.995000
1912	PPB	Presidente Prudente	Pres Prudente	Brazil	t	-22.176667	-51.418333
1913	PPF	Tri-City	Parsons	USA	t	37.330000	-95.508333
1914	PPG	Pago Pago Intl	Pago Pago	Us Pacific Is	t	-14.330000	-170.710000
1915	PPM	Pompano Beach	Pompano Beach	USA	t	26.246667	-80.110000
1916	PPP	Whitsunday	Proserpine	Australia	t	-20.495000	148.551667
1917	PPS	Puerto Princesa	Puerto Princesa	Philippines	t	9.743333	118.755000
1918	PPT	Faaa	Papeete	French Polynesi	t	-17.556667	-149.610000
1919	PQI	Northern Maine Regl At Presqu*	Presque Isle	USA	t	46.688333	-68.043333
1920	PRA	Gen Urquiza	Parana	Argentina	t	-31.778333	-60.466667
1921	PRB	Paso Robles Mun	Paso Robles	USA	t	35.671667	-120.626667
1922	PRC	Love	Prescott	USA	t	34.650000	-112.420000
1923	PRG	Ruzyne	Prague	Czech Republic	t	50.100000	14.260000
1924	PRN	Pristina	Pristina	Yugoslavia	t	42.573333	21.040000
1925	PRX	Cox	Paris Tx	USA	t	33.635000	-95.450000
1926	PRY	Wonderboom	Pretoria	South Africa	t	-25.650000	28.216667
1927	PSA	San Giusto	Pisa	Italy	t	43.681667	10.393333
1928	PSB	Mid-State	Philipsburg	USA	t	40.883333	-78.086667
1929	PSC	Tri-Cities	Pasco	USA	t	46.263333	-119.118333
1930	PSD	Port Said	Port Said	Egypt	t	31.280000	32.236667
1931	PSE	Mercedita	Ponce	Puerto Rico	t	18.006667	-66.561667
1932	PSF	Pittsfield Mun	Pittsfield	USA	t	42.426667	-73.291667
1933	PSG	Johnson Petersburg	Petersburg Alas	USA	t	56.800000	-132.945000
1934	PSI	Pasni	Pasni	Pakistan	t	25.290000	63.343333
1935	PSK	New River Valley	Pulaski Dublin	USA	t	37.136667	-80.678333
1936	PSM	Pease Intl Tradeport	Portsmouth Nh	USA	t	43.076667	-70.821667
1937	PSO	Bullhead Laughlin	Pasto	Colombia	t	35.165000	-114.565000
1938	PSP	Palm Springs Regl	Palm Springs	USA	t	33.828333	-116.505000
1939	PSR	Pescara	Pescara	Italy	t	42.436667	14.186667
1940	PSS	Posadas	Posadas	Argentina	t	-27.386667	-55.968333
1941	PSX	Palacios Mun	Not In Tbl	\N	t	28.726667	-96.250000
1942	PSZ	Salvador Ogaya	Puerto Suarez	Bolivia	t	-18.980000	-57.821667
1943	PTK	Oakland Co Intl	Pontiac	USA	t	42.665000	-83.418333
1944	PTN	Williams Meml	Morgn Cty Pattr	USA	t	29.710000	-91.338333
1945	PTP	Le Raizet	Pointe A Pitre	Guadeloupe	t	16.266667	-61.521667
1946	PTT	Pratt Industrial	Pratt	USA	t	37.700000	-98.746667
1947	PTV	Porterville Mun	Porterville	USA	t	36.028333	-119.061667
1948	PTY	Tocumen Intl	Panama City Pa	Panama	t	9.070000	-79.383333
1949	PUB	Pueblo Meml	Pueblo	USA	t	38.288333	-104.495000
1950	PUC	Carbon Co	Price	USA	t	39.611667	-110.750000
1951	PUF	Pau/Pyrenees	Pau	France	t	43.380000	-0.416667
1952	PUJ	Punta Cana Intl	Punta Cana	Dominican Rep	t	18.566667	-68.361667
1953	PUQ	Carlos Ibanez Del Campo Intl	Punta Arenas	Chile	t	-53.003333	-70.850000
1954	PUS	Kimhae Intl	Pusan	South Korea	t	35.178333	128.940000
1955	PUW	Pullman/Moscow Regl	Pullman	USA	t	46.743333	-117.108333
1956	PUY	Pula	Pula	Croatia	t	44.893333	13.926667
1957	PUZ	Puerto Cabezas,nicaragua	Puerto Cabezas	Nicaragua	t	14.045000	-83.386667
1958	PVC	Provincetown Mun	Provincetown	USA	t	42.071667	-70.220000
1959	PVD	Green State	Providence	USA	t	41.723333	-71.426667
1960	PVH	Porto Velho	Porto Velho	Brazil	t	-8.713333	-63.901667
1961	PVK	Aktion	Preveza Lefkas	Greece	t	38.925000	20.766667
1962	PVR	Puerto Valarta	Puerto Vallarta	Mexico	t	20.680000	-105.253333
1963	PVU	Provo Mun	Provo	USA	t	40.215000	-111.720000
1964	PVW	Hale Co	Plainview Tx	USA	t	34.166667	-101.716667
1965	PWA	Wiley Post	Okc Wiley Post	USA	t	35.533333	-97.646667
1966	PWK	Palwaukee Mun	Chi Pal Waukee	USA	t	42.113333	-87.900000
1967	PWM	Portland Intl	Portland Me Pwm	USA	t	43.645000	-70.308333
1968	PWT	Bremerton Natl	Bremerton	USA	t	47.491667	-122.761667
1969	PXM	Puerto Escondido	Puerto Escondido	Mexico	t	15.875000	-97.088333
1970	PXO	Porto Santo	Porto Santo	Portugal	t	33.066667	-16.345000
1971	PYH	Puerto Ayacucho	Puerto Ayacucho	Venezuela	t	5.600000	-67.600000
1972	PYR	Andravida Ab	Pyrgos	Greece	t	37.925000	21.290000
1973	PZU	New Port Sudan	Port Sudan	Sudan	t	19.431667	37.231667
1974	QAK	Barbacena	Qx Oakland	USA	t	-21.263333	-43.761667
1975	QGU	Gifu Ja	Guatemala Cty Res	Guatemala	t	35.395000	136.870000
1976	QHV	Novo Hamburgo Brazil	Novo Hamburgo	Brazil	t	-29.696667	-51.081667
1977	QIQ	Rio Claro Brazil	Rio Claro Res	Brazil	t	-22.430000	-47.561667
1978	QJB	Jubail	Jubail	Saudi Arabia	t	27.038333	49.405000
1979	QNS	Canoas Ab	North Sea Ferries	Netherlands	t	-29.941667	-51.148333
1980	QPG	Paya Lebar	Singapore	Singapore	t	1.360000	103.910000
1981	QRA	Randgermiston	Jnb Randgermiston	South Africa	t	-26.240000	28.151667
1982	QRO	Ign Fernando Espinoza Guitier*	Queretaro	Mexico	t	20.621667	-100.368333
1983	QUT	Utsunomiya Aero	Utsunomiya	Japan	t	36.510000	139.868333
1984	RAE	Arar	Arar	Saudi Arabia	t	30.905000	41.136667
1985	RAH	Rafha	Rafha	Saudi Arabia	t	29.625000	43.490000
1986	RAJ	Rajkot	Rajkot	India	t	22.308333	70.778333
1987	RAK	Menara	Marrakech	Morocco	t	31.610000	-8.041667
1988	RAL	Riverside Mun	Riverside Cal	USA	t	33.951667	-117.445000
1989	RAO	Leite Lopes	Ribeirao Preto	Brazil	t	-21.135000	-47.775000
1990	RAP	Rapid City Regl	Rapid City	USA	t	44.045000	-103.056667
1991	RAR	Rarotonga Intl	Rarotonga	Cook Islands	t	-21.200000	-159.795000
1992	RBA	Sale	Rabat	Morocco	t	34.050000	-6.756667
1993	RBD	Redbird	Not In Tbl	\N	t	32.680000	-96.866667
1994	RBG	Roseburg Regl	Roseburg	USA	t	43.238333	-123.355000
1995	RBL	Red Bluff Mun	Red Bluff	USA	t	40.150000	-122.251667
1996	RBQ	Rurrenabaque Bol	Rurrenabaque	Bolivia	t	-14.466667	-67.566667
1997	RBR	Presidente Medici Intl	Rio Branco	Brazil	t	-9.991667	-67.803333
1998	RBW	Walterboro Mun	Not In Tbl	\N	t	32.920000	-80.640000
1999	RCA	Ellsworth Afb	Ellsworth Afb	USA	t	44.145000	-103.101667
2000	RCH	Almirante Padilla	Riohacha	Colombia	t	11.530000	-72.930000
2001	RCM	Richmond	Richmond Au	Australia	t	-20.701667	143.113333
2002	RCO	St Agnant	Rochefort	France	t	45.890000	-0.980000
2003	RCQ	Reconquista	Reconquista	Argentina	t	-29.215000	-59.695000
2004	RCU	Area De Material	Rio Cuarto	Argentina	t	-33.081667	-64.268333
2005	RDB	Red Dog Ak	Red Dog	USA	t	67.420000	-164.050000
2006	RDD	Redding Mun	Redding	USA	t	40.508333	-122.293333
2007	RDG	Reading Regl/Spaatz	Reading	USA	t	40.378333	-75.965000
2008	RDM	Roberts	Redmond	USA	t	44.253333	-121.148333
2009	RDU	Raleigh-Durham Intl	Raleigh Durham	USA	t	35.876667	-78.786667
2010	RDZ	Marcillac	Rodez	France	t	44.408333	2.483333
2011	REC	Guararapes Intl	Recife	Brazil	t	-8.125000	-34.921667
2012	RED	Mifflin Co	Reedsville	USA	t	40.676667	-77.626667
2013	REE	Reese Afb	Not In Tbl	\N	t	33.598333	-102.043333
2014	REG	Reggio Calabria	Reggio Calabria	Italy	t	38.070000	15.653333
2015	REK	Reykjavik	Reykjavik Rek	Iceland	t	64.128333	-21.941667
2016	REL	Almirante Zar	Trelew	Argentina	t	-43.210000	-65.280000
2017	RES	Resistencia	Resistencia	Argentina	t	-27.450000	-59.050000
2018	REU	Reus Ab	Reus	Spain	t	41.148333	1.168333
2019	REX	Gen Lucio Blanco	Reynosa Mexico	Mexico	t	26.008333	-98.228333
2020	REY	Reyes, Bol	Reyes	Bolivia	t	-14.305000	-67.348333
2021	RFD	Greater Rockford	Rockford	USA	t	42.195000	-89.091667
2022	RGA	Rio Grande	Rio Grande Arg	Argentina	t	-53.775000	-67.743333
2023	RGI	Rangiroa	Rangiroa	French Polynesi	t	-14.958333	-147.660000
2024	RGL	Norberto Fernandez	Rio Gallegos	Argentina	t	-51.616667	-69.283333
2025	RGN	Yangon Intl	Yangon	Myanmar	t	16.905000	96.136667
2026	RHE	Champagne Ab	Reims	France	t	49.310000	4.050000
2027	RHI	Rhinelander-Oneida Co	Rhinelander	USA	t	45.630000	-89.465000
2028	RHO	Diagoras	Rhodes	Greece	t	36.405000	28.086667
2029	RIA	Santa Maria	Santa Maria Br	Brazil	t	-29.710000	-53.691667
2030	RIB	Riberalta, Bol	Riberalta	Bolivia	t	-11.008333	-66.075000
2031	RIC	Richmond Intl	Richmond	USA	t	37.505000	-77.318333
2032	RIG	Rio Grande	Rio Grande Brzl	Brazil	t	-32.081667	-52.165000
2033	RIL	Garfield Co Regl	Rifle	USA	t	39.525000	-107.726667
2034	RIV	March Field	March Afb Ca	USA	t	33.880000	-117.258333
2035	RIW	Riverton Regl	Riverton	USA	t	43.063333	-108.458333
2036	RIY	Riyan	Riyan	Yemen Republic	t	14.655000	49.378333
2037	RJH	Rajshahi	Rajshahi	Bangladesh	t	24.436667	88.618333
2038	RJK	Rijeka	Rijeka	Croatia	t	45.216667	14.575000
2039	RKP	Aransas Co	Rockport Tx	USA	t	28.086667	-97.043333
2040	RKS	Rock Springs-Sweetwater	Rock Springs	USA	t	41.593333	-109.065000
2041	RKT	Khaimah Intl	Ras Al Khaimah	United Arab Emi	t	25.613333	55.938333
2042	RKW	Rockwood Mun	Rockwood	USA	t	35.921667	-84.688333
2043	RLC	Rlc Test Arpt	Not In Tbl	\N	t	45.000000	-60.000000
2044	RLD	Richland	Richland Wash	USA	t	46.305000	-119.303333
2045	RMA	Roma	Roma Australia	Australia	t	-26.545000	148.773333
2046	RME	Griffiss	Rome Ny	USA	t	43.233333	-75.406667
2047	RMF	Riyadh Ab	Not In Tbl	\N	t	24.716667	46.720000
2048	RMG	Russell	Rome Ga	USA	t	34.350000	-85.156667
2049	RMI	Rimini Mil	Rimini	Italy	t	44.020000	12.611667
2050	RML	Ratmalana	Colombo	Sri Lanka	t	6.821667	79.885000
2051	RMS	Ramstein Ab	Ramstein	Germany	t	49.436667	7.600000
2052	RNB	Ronneby Ab	Ronneby	Sweden	t	56.266667	15.266667
2053	RND	Randolph Afb	Randolph Afb Tx	USA	t	29.528333	-98.276667
2054	RNE	Renaison	Roanne	France	t	46.053333	4.000000
2055	RNI	Corn Island	Corn Island	Nicaragua	t	12.166667	-83.066667
2056	RNN	Ronne	Bornholm	Denmark	t	55.063333	14.760000
2057	RNO	Reno/Tahoe Intl	Reno	USA	t	39.498333	-119.766667
2058	RNS	St Jacques	Rennes	France	t	48.071667	-1.728333
2059	RNT	Renton Mun	Not In Tbl	\N	t	47.491667	-122.213333
2060	ROA	Roanoke Regl/Woodrum	Roanoke	USA	t	37.325000	-79.975000
2061	ROB	Roberts Intl	Monrovia Rob	Liberia	t	6.238333	-10.358333
2062	ROC	Greater Rochester Intl	Rochester Ny Roc	USA	t	43.118333	-77.671667
2063	ROG	Rogers Mun-Carter	Rogers	USA	t	36.371667	-94.106667
2064	ROK	Rockhampton	Rockhampton	Australia	t	-23.381667	150.475000
2065	ROP	Rota I Intl	Rota	Us Pacific Is	t	14.173333	145.241667
2066	ROR	Babelthuap	Koror	Micronesia	t	7.363333	134.550000
2067	ROS	Rosario	Rosario	Argentina	t	-32.905000	-60.781667
2068	ROW	Roswell Industrial	Roswell	USA	t	33.300000	-104.530000
2069	RPR	Raipur	Raipur	India	t	21.180000	81.740000
2070	RRG	Plaine Corail	Rodrigues Is	Mauritius	t	-19.756667	63.361667
2071	RRS	Roros	Roros	Norway	t	62.578333	11.345000
2072	RSA	Santa Rosa	Santa Rosa Ar	Argentina	t	-36.590000	-64.278333
2073	RSD	Rock Sound	Rock Sound	Bahamas	t	24.891667	-76.178333
2074	RST	Rochester Intl	Rochester Mn Rst	USA	t	43.908333	-92.496667
2075	RSW	Southwest Florida Intl	Fort Myers Rsw	USA	t	26.535000	-81.755000
2076	RSY	Reno Stead Nevada	Not In Tbl	\N	t	39.666667	-119.875000
2077	RTB	Roatan	Roatan	Honduras	t	16.315000	-86.525000
2078	RTM	Rotterdam	Rotterdam	Netherlands	t	51.956667	4.436667
2079	RTN	Raton Mun/Crews	Raton	USA	t	36.740000	-104.501667
2080	RUH	King Khalid Intl	Riyadh	Saudi Arabia	t	24.961667	46.706667
2081	RUN	Gillot	St Denis Reunion	Reunion	t	-20.876667	55.521667
2082	RUT	Rutland State	Rutland	USA	t	43.528333	-72.948333
2083	RVN	Rovaniemi	Rovaniemi	Finland	t	66.560000	25.833333
2084	RVS	Jones Jr	Tulsa Lloyd Jones	USA	t	36.038333	-95.983333
2085	RVY	Rivera Intl	Rivera	Uruguay	t	-30.968333	-55.471667
2086	RWI	Rocky Mount-Wilson	Rocky Mount	USA	t	35.853333	-77.891667
2087	RWL	Rawlins Mun	Rawlins	USA	t	41.805000	-107.198333
2088	RYK	Sheikh Zayed	Rahim Yar Khan	Pakistan	t	28.385000	70.278333
2089	RYN	Ryan Field	Royan	France	t	32.141667	-111.173333
2090	RZE	Jasionka	Rzeszow	Poland	t	50.110000	22.020000
2091	SAC	Sacramento Executive	Sacramento Exec	USA	t	38.511667	-121.491667
2092	SAF	Santa Fe Mun	Santa Fe Nm	USA	t	35.616667	-106.086667
2093	SAH	Sanaa Intl	Sanaa	Yemen Republic	t	15.480000	44.220000
2094	SAL	El Salvador Intl	San Salvador	El Salvador	t	13.441667	-89.058333
2095	SAN	San Diego Intl-Lindbergh	San Diego	USA	t	32.733333	-117.188333
2096	SAP	La Mesa Intl	San Pedro Sula	Honduras	t	15.451667	-87.925000
2097	SAT	San Antonio Intl	San Antonio	USA	t	29.533333	-98.468333
2098	SAV	Savannah Intl	Savannah	USA	t	32.126667	-81.201667
2099	SAW	Sawyer	Not In Tbl	\N	t	46.353333	-87.395000
2100	SBA	Santa Barbara Mun	Santa Barbara	USA	t	34.425000	-119.840000
2101	SBB	Santa Barbara De Barinas	Santa Barbara Ve	Venezuela	t	7.833333	-71.166667
2102	SBD	San Bernardino Intl	San Bernardino	USA	t	34.095000	-117.233333
2103	SBK	Armor	St Brieuc	France	t	48.538333	-2.855000
2104	SBL	Santa Ana De Yacuma Bol	Santa Ana Bo	Bolivia	t	-13.766667	-65.450000
2105	SBN	Michiana Regl Transport Center	South Bend	USA	t	41.708333	-86.318333
2106	SBP	San Luis Obispo Co-Mc Chesney	San Luis Obispo	USA	t	35.236667	-120.641667
2107	SBQ	Sibi	Sibi	Pakistan	t	29.573333	67.841667
2108	SBX	Shelby	Not In Tbl	\N	t	48.540000	-111.870000
2109	SBY	Salisbury-Ocean City Wicomic*	Salisbury Md	USA	t	38.340000	-75.510000
2110	SBZ	Turnisor	Sibiu	Romania	t	45.786667	24.093333
2111	SCC	Deadhorse	Deadhorse	USA	t	70.193333	-148.465000
2112	SCH	Schenectady Co	Not In Tbl	\N	t	42.851667	-73.928333
2113	SCK	Stockton Metro	Stockton	USA	t	37.893333	-121.236667
2114	SCL	Arturo Merino Benitez Intl	Santiago Scl	Chile	t	-33.390000	-70.785000
2115	SCN	Saarbrucken	Saarbruecken	Germany	t	49.213333	7.108333
2116	SCQ	Santiago	Sntiago D Cmpst	Spain	t	42.895000	-8.411667
2117	SCU	Antonio Maceo Intl	Santiago Scu	Cuba	t	19.968333	-75.835000
2118	SCV	Salcea	Suceava	Romania	t	47.695000	26.351667
2119	SDA	Saddam Intl	Baghdad Saddam	Iraq	t	33.241667	44.236667
2120	SDB	Langebaanweg	Not In Tbl	\N	t	-32.966667	18.160000
2121	SDE	Santiago Del Estero	Sntiago Dl Estero	Argentina	t	-27.755000	-64.298333
2122	SDF	Louisville Intl-Standiford	Louisville	USA	t	38.173333	-85.735000
2123	SDJ	Sendai	Sendai	Japan	t	38.136667	140.921667
2124	SDL	Sundsvall-Harnosand	Sundsvall	Sweden	t	62.530000	17.445000
2125	SDM	Brown Mun	San Diego Brown	USA	t	32.571667	-116.980000
2126	SDQ	Las Americas Intl	Santo Domingo	Dominican Rep	t	18.428333	-69.668333
2127	SDR	Santander	Santander	Spain	t	43.426667	-3.818333
2128	SDU	Santos Dumont	Rio De Janeiro	Brazil	t	-22.910000	-43.161667
2129	SDV	Sde Dov	Tel Aviv Sde Dv	Israel	t	32.115000	34.781667
2130	SDY	Sidney-Richland Mun	Sidney Mont	USA	t	47.706667	-104.191667
2131	SEA	Seattle-Tacoma Intl	Seattle Tacoma	USA	t	47.448333	-122.308333
2132	SEB	Sebha	Sebha	Libya	t	27.008333	14.430000
2133	SEE	Gillespie	S Diego Gillespie	USA	t	32.825000	-116.971667
2134	SEF	Sebring Regl	Sebring	USA	t	27.455000	-81.341667
2135	SEG	Penn Valley	Not In Tbl	\N	t	40.820000	-76.863333
2136	SEL	Kimpo Intl	Seoul Kimpo	South Korea	t	37.553333	126.798333
2137	SEM	Craig	Not In Tbl	\N	t	32.343333	-86.986667
2138	SEN	Southend	London Southend	United Kingdom	t	51.570000	0.696667
2139	SEZ	Seychelles Intl	Mahe Island	Seychelles	t	-4.671667	55.521667
2140	SFA	Thyna	Sfax	Tunisia	t	34.721667	10.688333
2141	SFB	Orlando Sanford	Sanford Fl	USA	t	28.778333	-81.238333
2142	SFD	San Fernando De Apure	Sn Frndo De Apure	Venezuela	t	7.883333	-67.443333
2143	SFJ	Sondre Stromfjord	Kangerlussuaq	Greenland	t	67.016667	-50.693333
2144	SFM	Sanford Regl	Sanford Me	USA	t	43.393333	-70.706667
2145	SFN	Sauce Viejo	Santa Fe Arg	Argentina	t	-31.711667	-60.806667
2146	SFO	San Francisco Intl	San Francisco	USA	t	37.618333	-122.373333
2147	SFS	Subic Bay Intl	Subic Bay	Philippines	t	14.796667	120.266667
2148	SFT	Skelleftea	Skelleftea	Sweden	t	64.625000	21.080000
2149	SFZ	North Central State	Not In Tbl	\N	t	41.920000	-71.490000
2150	SGF	Springfield-Branson Regl	Springfield Mo	USA	t	37.243333	-93.386667
2151	SGH	Springfield-Beckley Mun	Springfield Oh	USA	t	39.840000	-83.840000
2152	SGN	Tansonnhat	Ho Chi Minh	Vietnam	t	10.818333	106.655000
2153	SGR	Sugar Land Mun/Hull	Sugarland	USA	t	29.621667	-95.655000
2154	SGT	Stuttgart Mun	Stuttgart Ar	USA	t	34.600000	-91.573333
2155	SGU	St George Mun	St George	USA	t	37.090000	-113.591667
2156	SGZ	Songkhla, Thailand	Songkhla	Thailand	t	7.185000	100.608333
2157	SHA	Hongqiao	Shanghai	China	t	31.196667	121.335000
2158	SHB	Nakashibetsu	Nakashibetsu	Japan	t	43.575000	144.963333
2159	SHD	Shenandoah Valley Regl	Shenandoah Vall	USA	t	38.263333	-78.895000
2160	SHE	Taoxian	Shenyang	China	t	41.638333	123.485000
2161	SHJ	Sharjah Intl	Sharjah	United Arab Emi	t	25.328333	55.515000
2162	SHN	Sanderson	Shelton	USA	t	47.233333	-123.146667
2163	SHR	Sheridan Co	Sheridan	USA	t	44.768333	-106.980000
2164	SHV	Shreveport Regl	Shreveport	USA	t	32.445000	-93.825000
2165	SHW	Sharurah	Sharurah Saudi Ar	Saudi Arabia	t	17.466667	47.120000
2166	SIA	Xianyang	Xi An Xiguan	China	t	34.440000	108.755000
2167	SID	Sal Amilcar Cabral	Sal	Cape Verde	t	16.743333	-22.950000
2168	SIG	Isla Grande	San Juan Isla	Puerto Rico	t	18.460000	-66.101667
2169	SIN	Changi	Singapore	Singapore	t	1.358333	103.990000
2170	SIR	Sion	Sion	Switzerland	t	46.220000	7.326667
2171	SIS	Sishen	Sishen	South Africa	t	-27.650000	23.000000
2172	SIT	Sitka	Sitka	USA	t	57.046667	-135.360000
2173	SIU	Siuna	Siuna	Nicaragua	t	13.716667	-84.766667
2174	SIY	Siskiyou Co	Montague	USA	t	41.780000	-122.466667
2175	SJB	San Joaquin, Bol	San Joaquin	Bolivia	t	-13.066667	-64.816667
2176	SJC	San Jose Intl	San Jose Ca Sjc	USA	t	37.361667	-121.928333
2177	SJD	Los Cabos Intl	San Jose Cabo	Mexico	t	23.155000	-109.720000
2178	SJE	Jorge E Gonzalez	San Jose Del Gua	Colombia	t	2.583333	-72.640000
2179	SJJ	Sarajevo	Sarajevo	Bosnia	t	43.825000	18.333333
2180	SJK	Sao Jose Dos Campos	S Jose D Camp	Brazil	t	-23.228333	-45.870000
2181	SJL	Sao Gabriel Da Cachoeira	Sao Gabriel	Brazil	t	-0.148333	-66.985000
2182	SJN	St Johns Industrial	St Johns Az	USA	t	34.518333	-109.378333
2183	SJO	Juan Santamaria Intl	San Jose Cr Sjo	Costa Rica	t	9.993333	-84.211667
2184	SJP	Sao Jose Do Rio Preto	Sa Jse D Rio Pr	Brazil	t	-20.815000	-49.403333
2185	SJT	Mathis	San Angelo	USA	t	31.358333	-100.495000
2186	SJU	San Juan P.r.	San Juan Pr	Puerto Rico	t	18.438333	-66.001667
2187	SJY	Seinajoki	Seinajoki	Finland	t	62.693333	22.835000
2188	SKA	Fairchild Afb	Fairchild Afb Wa	USA	t	47.615000	-117.655000
2189	SKB	Robert L Bradshaw Intl	St Kitts	Nevis	t	17.310000	-62.718333
2190	SKF	Kelly Afb	San Antonio Kel	USA	t	29.383333	-98.580000
2191	SKG	Makedonia	Thessaloniki	Greece	t	40.520000	22.973333
2192	SKO	S.abubakar Iii Intl	Sokoto	Nigeria	t	12.915000	5.206667
2193	SKP	Skopje	Skopje	Macedonia	t	41.960000	21.626667
2194	SKS	Vojens/Skrydstrup Ab	Vojens	Denmark	t	55.226667	9.265000
2195	SKU	Skiros Ab	Skiros	Greece	t	38.968333	24.486667
2196	SKV	St Catherine	Santa Katarina	Egypt	t	28.683333	34.066667
2197	SKY	Griffing-Sandusky	Sandusky	USA	t	41.433333	-82.651667
2198	SKZ	Sukkur	Sukkur	Pakistan	t	27.721667	68.790000
2199	SLA	Salta	Salta	Argentina	t	-24.861667	-65.478333
2200	SLC	Salt Lake City Intl	Salt Lake City	USA	t	40.788333	-111.976667
2201	SLD	Sliac	Sliac	Slovakia	t	48.638333	19.135000
2202	SLE	Mc Nary	Salem Ore	USA	t	44.908333	-123.001667
2203	SLI	Los Alamitos, Aaf Calif	Solwezi	Zambia	t	33.790000	-118.051667
2204	SLK	Adirondack Regl	Saranac L Placd	USA	t	44.385000	-74.205000
2205	SLL	Salalah	Salalah	Oman	t	17.036667	54.088333
2206	SLM	Matacan	Salamanca	Spain	t	40.953333	-5.500000
2207	SLN	Salina Mun	Salina	USA	t	38.790000	-97.650000
2208	SLP	Ponciano Arriaga Intl	San Luis Potosi	Mexico	t	22.253333	-100.933333
2209	SLR	Sulphur Springs Mun	Not In Tbl	\N	t	33.158333	-95.620000
2210	SLU	Vigie	St Lucia Slu	St Lucia	t	14.018333	-61.000000
2211	SLW	Plan De Guadalupe Intl	Saltillo	Mexico	t	25.548333	-100.926667
2212	SLZ	Marechal Cunha Machado	Sao Luiz	Brazil	t	-2.586667	-44.235000
2213	SMA	Santa Maria	Santa Maria Azors	Portugal	t	36.971667	-25.170000
2214	SMD	Smith	Not In Tbl	\N	t	41.143333	-85.151667
2215	SME	Somerset-Pulaski Co-Wilson	Somerset	USA	t	37.053333	-84.613333
2216	SMF	Sacramento Intl	Sacramento	USA	t	38.695000	-121.590000
2217	SMI	Samos	Samos Island	Greece	t	37.690000	26.911667
2218	SMR	Simon Bolivar	Santa Marta	Colombia	t	11.121667	-74.233333
2219	SMX	Santa Maria Pub/Capt Hancock	Santa Maria	USA	t	34.898333	-120.456667
2220	SNA	John Wayne-Orange Co	Orange County	USA	t	33.675000	-117.866667
2221	SNC	Gen Ulpiano Paez	Salinas Ec	Ecuador	t	-2.206667	-80.983333
2222	SNE	Sydney Fir	Sao Nicolau	Cape Verde	t	-33.940000	151.170000
2223	SNG	San Ignacio De Velasco	Sn Igncio D Vls	Bolivia	t	-16.366667	-60.950000
2224	SNK	Winston	Snyder	USA	t	32.693333	-100.950000
2225	SNL	Shawnee Mun	Not In Tbl	\N	t	35.355000	-96.941667
2226	SNN	Shannon	Shannon	Ireland	t	52.700000	-8.920000
2227	SNP	St Paul Island	St Paul Island	USA	t	57.163333	-170.220000
2228	SNR	Montoir	St Nazaire	France	t	47.310000	-2.155000
2229	SNS	Salinas Mun	Salinas	USA	t	36.661667	-121.605000
2230	SNU	Santa Clara Cu	Santa Clara Cu	Cuba	t	22.493333	-79.940000
2231	SNV	Sant Elena De Uairen	Santa Elena	Venezuela	t	4.683333	-61.183333
2232	SNZ	Santa Cruz Ab	Not In Tbl	\N	t	-22.931667	-43.718333
2233	SOC	Adi Sumarmo Wiryokusumo	Solo	Indonesia	t	-7.516667	110.755000
2234	SOF	Sofia	Sofia Vrazhdebna	Bulgaria	t	42.695000	23.408333
2235	SOM	San Tome	San Tome	Venezuela	t	8.950000	-64.150000
2236	SOO	Soderhamn Ab	Soderhamn	Sweden	t	61.261667	17.101667
2237	SOP	Moore Co	Pinehurst S Pines	USA	t	35.236667	-79.390000
2238	SOU	Southampton Intl	Southampton En	United Kingdom	t	50.948333	-1.355000
2239	SOW	Show Low Mun	Show Low Ariz	USA	t	34.265000	-110.003333
2240	SOZ	Solenzara Ab	Not In Tbl	\N	t	41.928333	9.405000
2241	SPA	Spartanburg Downtown Meml	Spartanburg	USA	t	34.915000	-81.955000
2242	SPC	La Palma	Snt Cruz La Palma	Spain	t	28.618333	-17.753333
2243	SPD	Saidpur	Said Pur	Bangladesh	t	25.766667	88.910000
2244	SPI	Capital	Springfield Il	USA	t	39.843333	-89.676667
2245	SPK	Chitose	Sapporo	Japan	t	42.791667	141.670000
2246	SPM	Spangdahlem Ab	Spangdahlem	Germany	t	49.976667	6.700000
2247	SPN	Saipan Intl	Saipan	Us Pacific Is	t	15.118333	145.728333
2248	SPS	Sheppard Afb/Wichita Falls Mun	Wichita Falls	USA	t	33.985000	-98.491667
2249	SPU	Kastela	Split	Croatia	t	43.538333	16.301667
2250	SPZ	Springdale Mun	Springdale	USA	t	36.175000	-94.118333
2251	SQI	Whiteside Co-Bittorf	Sterlng Rockfalls	USA	t	41.741667	-89.675000
2252	SRE	Juana Azurduy De Padilla	Sucre	Bolivia	t	-19.008333	-65.293333
2253	SRG	Achmad Yani	Semarang	Indonesia	t	-6.975000	110.376667
2254	SRI	Richmond	Samarinda	Indonesia	t	-33.601667	150.778333
2255	SRJ	Cpt German Q Guardia	San Borja	Bolivia	t	-14.806667	-66.820000
2256	SRQ	Sarasota-Bradenton	Sarasota Bradentn	USA	t	27.395000	-82.553333
2257	SRT	Soroti	Soroti Uganda	Uganda	t	1.720000	33.616667
2258	SRW	Rowan Co	Salisbury Nc	USA	t	25.645000	-80.520000
2259	SRY	Dashte-Naz	Sary	Iran	t	36.635000	53.193333
2260	SRZ	El Trompillo	Santa Cruz Srz	Bolivia	t	-17.800000	-63.176667
2261	SSA	Dois De Julho Intl	Salvador	Brazil	t	-12.906667	-38.321667
2262	SSC	Shaw Afb	Sumpter	USA	t	33.971667	-80.470000
2263	SSG	Malabo	Malabo	Equatorial Guin	t	3.750000	8.708333
2264	SSH	Sharm El Sheikh	Sharm El Sheik	Egypt	t	27.978333	34.386667
2265	SSI	Mc Kinnon	Brunswick Mckinon	USA	t	31.150000	-81.390000
2266	SSN	Seoul Ab	Seoul Ab	South Korea	t	37.445000	127.113333
2267	SSS	Matsushima Aero	Siassi	Papua New Guine	t	38.401667	141.221667
2268	SST	Santa Teresita	Santa Teresita	Argentina	t	-36.550000	-56.683333
2269	SSX	Samsun	Samsun	Turkey	t	41.278333	36.303333
2270	SSZ	Santos Ab	Santos	Brazil	t	-23.926667	-46.298333
2271	STB	Santa Barbara Del Zulia	Santa Barbara V	Venezuela	t	9.033333	-71.950000
2272	STD	Mayor Buenaventura Vivas Intl	Snto Domingo Ve	Venezuela	t	7.568333	-72.028333
2273	STE	Stevens Point Mun	Stevens Point	USA	t	44.545000	-89.530000
2274	STI	Cibao Intl	Santiago Do	Dominican Rep	t	19.466667	-70.700000
2275	STJ	Rosecrans Meml	St Joseph	USA	t	39.771667	-94.908333
2276	STL	Lambert-St Louis Intl	St Louis Intl	USA	t	38.746667	-90.358333
2277	STM	Santarem Intl	Santarem	Brazil	t	-2.423333	-54.785000
2278	STN	Stansted	London Stansted	United Kingdom	t	51.883333	0.236667
2279	STP	St Paul Downtown-Holman	St Paul Downtown	USA	t	44.933333	-93.060000
2280	STR	Stuttgart	Stuttgart	Germany	t	48.688333	9.221667
2281	STS	Sonoma Co	Santa Rosa	USA	t	38.508333	-122.811667
2282	STT	Charlotte Amalie King	St Thomas	Virgin Islands	t	18.336667	-64.973333
2283	STX	Henry E Rohlsen	St Croix	Virgin Islands	t	17.701667	-64.798333
2284	STY	Salto	Salto	Uruguay	t	-31.433333	-57.983333
2285	SUB	Juanda	Surabaya	Indonesia	t	-7.380000	112.785000
2286	SUE	Door Co Cherryland	Sturgeon Bay	USA	t	44.843333	-87.420000
2287	SUF	Terme	Lamezia Terme	Italy	t	38.906667	16.241667
2288	SUJ	Satu Mare	Satu Mare	Romania	t	47.703333	22.881667
2289	SUM	Sumburgh U.k.	Sumter	USA	t	59.880000	-1.293333
2290	SUN	Friedman Meml	Sun Valley	USA	t	43.503333	-114.295000
2291	SUS	Spirit Of St Louis	Spirit O St Louis	USA	t	38.661667	-90.650000
2292	SUU	Travis Afb	Travis Afb	USA	t	38.261667	-121.926667
2293	SUV	Nausori Intl	Suva	Fiji	t	-18.043333	178.561667
2294	SUX	Sioux Gateway	Sioux City	USA	t	42.401667	-96.383333
2295	SVC	Grant Co	Silver City	USA	t	32.635000	-108.155000
2296	SVD	E T Joshua	St Vincent	St Vincent	t	13.143333	-61.213333
2297	SVG	Sola	Stavanger	Norway	t	58.880000	5.630000
2298	SVH	Statesville Mun	Statesville	USA	t	35.761667	-80.955000
2299	SVI	San Vicente Del Caguan	Sn Vncnte De Ca	Colombia	t	2.140000	-74.746667
2300	SVL	Savonlinna	Savonlinna	Finland	t	61.941667	28.946667
2301	SVN	Hunter Aaf	Savannah Svn	USA	t	32.010000	-81.145000
2302	SVO	Sheremetyevo	Moscow Svo	Russia	t	55.971667	37.415000
2303	SVQ	San Pablo	Sevilla	Spain	t	37.418333	-5.896667
2304	SVX	Koltsovo	Ekaterinburg	E Ural Russia	t	56.743333	60.805000
2305	SVZ	San Antonio Del Tachira Intl	San Antonio Ve	Venezuela	t	7.866667	-72.450000
2306	SWF	Stewart Intl	Newburgh Stewart	USA	t	41.503333	-74.103333
2307	SWO	Stillwater Mun	Stillwater	USA	t	36.160000	-97.085000
2308	SWW	Avenger	Sweetwater	USA	t	32.466667	-100.465000
2309	SXB	Entzheim	Strasbourg	France	t	48.540000	7.631667
2310	SXF	Schonefeld	Berlin Schonefeld	Germany	t	52.378333	13.520000
2311	SXI	Sirri Island	Not In Tbl	\N	t	25.908333	54.555000
2312	SXM	Princess Juliana Intl	St Maarten	Netherlands An	t	18.038333	-63.111667
2313	SYA	Eareckson As	Shemya Island	USA	t	52.711667	174.113333
2314	SYD	Kingsford Smith Intl	Sydney	Australia	t	-33.945000	151.176667
2315	SYI	Bomar-Shelbyville Mun	Shelbyville	USA	t	35.560000	-86.441667
2316	SYO	Shonai	Shonai	Japan	t	38.808333	139.790000
2317	SYR	Syracuse Hancock Intl	Syracuse	USA	t	43.110000	-76.105000
2318	SYY	Stornoway	Stornoway	United Kingdom	t	58.213333	-6.326667
2319	SYZ	Shiraz Intl	Shiraz	Iran	t	29.540000	52.588333
2320	SZG	Salzburg	Salzburg Austria	Austria	t	47.795000	13.003333
2321	SZK	Skukuza	Skukuza	South Africa	t	-24.966667	31.600000
2322	SZX	Huangtian	Shenzhen	China	t	22.638333	113.811667
2323	SZZ	Goleniow	Szczecin	Poland	t	53.585000	14.903333
2324	TAB	Crown Point	Tobago	Trinidad	t	11.145000	-60.840000
2325	TAC	Daniel Z Romualdez	Tacloban	Philippines	t	11.230000	125.025000
2326	TAD	Stokes	Trinadad Colo	USA	t	37.258333	-104.340000
2327	TAE	Taegu Aero	Taegu	South Korea	t	35.890000	128.660000
2328	TAK	Takamatsu	Takamatsu	Japan	t	34.210000	134.018333
2329	TAM	Gen Francisco Javier Mina	Tampico	Mexico	t	22.288333	-97.863333
2330	TAP	Tapachula Intl	Tapachula	Mexico	t	14.791667	-92.370000
2331	TAR	Grottaglie	Taranto	Italy	t	40.516667	17.398333
2332	TAS	Tashkent Yuzhny	Tashkent	Uzbekistan	t	41.256667	69.273333
2333	TAT	Tatry	Tatry Poprad	Slovakia	t	49.073333	20.243333
2334	TAW	Tacuarembo	Tacuarembo	Uruguay	t	-31.750000	-55.923333
2335	TBO	Tabora	Tabora	Tanzania	t	-5.073333	32.828333
2336	TBR	Statesboro Mun	Statesboro	USA	t	32.481667	-81.736667
2337	TBS	Novoalexeyevka	Tbilisi	Georgia	t	41.671667	44.955000
2338	TBT	Tabatinga Intl	Tabatinga	Brazil	t	-4.250000	-69.936667
2339	TBU	Fua Amotu Intl	Tongatapu	Tonga	t	-21.241667	-175.138333
2340	TBZ	Tabriz Intl	Tabriz	Iran	t	38.133333	46.235000
2341	TCA	Tennant Creek	Tennant Creek	Australia	t	-19.635000	134.181667
2342	TCB	Treasure Cay	Treasure Cay	Bahamas	t	26.746667	-77.393333
2343	TCC	Tucumcari Mun	Dsc Communictns	USA	t	35.181667	-103.601667
2344	TCE	Cataloi	Tulcea	Romania	t	45.061667	28.713333
2345	TCL	Tuscaloosa Mun	Tuscaloosa	USA	t	33.220000	-87.610000
2346	TCM	Mc Chord Afb	Mcchord Afb	USA	t	47.136667	-122.475000
2347	TCO	La Florida	Tumaco	Colombia	t	1.820000	-78.750000
2348	TCP	Taba Intl	Taba	Egypt	t	29.600000	34.783333
2349	TCQ	Col Carlos Ciriani Santa Rosa	Tacna	Peru	t	-18.048333	-70.256667
2350	TCS	Truth Or Consequences Mun	Truth Or Conseqnc	USA	t	33.235000	-107.270000
2351	TDD	Jorge Henrich Arauz	Trinidad Bo	Bolivia	t	-14.818333	-64.913333
2352	TDL	Tandil	Tandil	Argentina	t	-37.233333	-59.250000
2353	TDW	Tradewind	Not In Tbl	\N	t	35.168333	-101.825000
2354	TEB	Teterboro	Teterboro	USA	t	40.850000	-74.060000
2355	TED	Thisted	Thisted	Denmark	t	57.068333	8.703333
2356	TEE	Tebessa	Tbessa Algeria	Algeria	t	35.433333	8.133333
2357	TEG	Port Au Prince Fir Mteg	Not In Tbl	\N	t	18.566667	-72.283333
2358	TEK	Tekirdag, Corlu Ab	Tatitlek	USA	t	41.140000	27.920000
2359	TER	Lajes Ab	Terceira	Portugal	t	38.761667	-27.091667
2360	TET	Chingozi	Tete	Mozambique	t	-16.108333	33.638333
2361	TEX	Telluride Regl	Telluride	USA	t	37.953333	-107.908333
2362	TFF	Tefe	Tefe	Brazil	t	-3.380000	-64.723333
2363	TFN	Los Rodeos	Tenerife Tci	Spain	t	28.480000	-16.340000
2364	TFS	Reina Sofia	Tenerife Reinasfi	Spain	t	28.041667	-16.570000
2365	TGD	Podgorica	Podgorica	Yugoslavia	t	42.358333	19.256667
2366	TGM	Vidrasau	Tirgu Mures	Romania	t	46.468333	24.413333
2367	TGR	Sidi Mahdi	Touggourt	Algeria	t	33.066667	6.083333
2368	TGU	Toncontin Intl	Tegucigalpa	Honduras	t	14.060000	-87.216667
2369	TGZ	Francisco Sarabia	Tuxtla Gutierrez	Mexico	t	16.768333	-93.340000
2370	THA	Tullahoma Regl/Northern	Tullahoma	USA	t	35.380000	-86.245000
2371	THE	Teresina	Teresina	Brazil	t	-5.060000	-42.823333
2372	THF	Tempelhof	Berlin Tempelhof	Germany	t	52.473333	13.400000
2373	THN	Trollhattan-Vanersborg	Trollhattan	Sweden	t	58.316667	12.343333
2374	THR	Mehrabad Intl	Tehran Iran	Iran	t	35.690000	51.313333
2375	THU	Thule Ab	Pituffik	Greenland	t	76.533333	-68.700000
2376	TID	Bou Chekif	Tiaret	Algeria	t	35.350000	1.466667
2377	TIF	Taif	Taif	Saudi Arabia	t	21.481667	40.543333
2378	TIJ	Gen Abelardo L Rodriguez Intl	Tijuana	Mexico	t	32.540000	-116.971667
2379	TIK	Tinker Afb	Tinker Afb Ok	USA	t	35.416667	-97.383333
2380	TIP	Tripoli Intl	Tripoli	Libya	t	32.668333	13.156667
2381	TIQ	West Tinian	Tinian	Us Pacific Is	t	14.996667	145.616667
2382	TIV	Tivat	Tivat	Yugoslavia	t	42.403333	18.726667
2383	TIW	Tacoma Narrows	Tacoma	USA	t	47.266667	-122.576667
2384	TIX	Space Coast Regl	Titusville	USA	t	28.513333	-80.798333
2385	TJA	Capt Oriel Lea Plaza	Tarija	Bolivia	t	-21.546667	-64.706667
2386	TJM	Tyumen	Tyumen	E Ural Russia	t	57.168333	65.318333
2387	TKD	Takoradi Ab	Takoradi	Ghana	t	4.891667	-1.766667
2388	TKK	Chuuk Intl	Truk	Micronesia	t	7.461667	151.841667
2389	TKN	Tokunoshima	Tokunoshima	Japan	t	27.831667	128.883333
2390	TKS	Tokushima	Tokushima	Japan	t	34.128333	134.608333
2391	TKU	Turku	Turku	Finland	t	60.513333	22.265000
2392	TLC	Lic Adolfo Lopez Mateos Intl	Toluca	Mexico	t	19.335000	-99.565000
2393	TLH	Tallahassee Regl	Tallahassee	USA	t	30.395000	-84.350000
2394	TLL	Ulemiste	Tallinn	Estonia	t	59.413333	24.831667
2395	TLM	Zenata	Tlemcen	Algeria	t	35.011667	-1.448333
2396	TLN	Le Palyvestre Navy	Toulon	France	t	43.096667	6.145000
2397	TLR	Mefford	Not In Tbl	\N	t	36.155000	-119.325000
2398	TLS	Blagnac	Toulouse	France	t	43.623333	1.380000
2399	TLV	Ben Gurion	Tel Aviv Tlv	Israel	t	32.010000	34.876667
2400	TMB	Kendall-Tamiami Executive	Tamiami Airport	USA	t	25.648333	-80.433333
2401	TME	Tame	Tame Columbia	Colombia	t	6.453333	-71.761667
2402	TML	Tamale Ab	Tamale	Ghana	t	9.566667	-0.866667
2403	TMM	Toamasina	Tamatave	Madagascar	t	-18.115000	49.391667
2404	TMO	Tumeremo	Tumeremo	Venezuela	t	7.250000	-61.433333
2405	TMP	Pirkkala	Tampere	Finland	t	61.415000	23.590000
2406	TMR	Aguenar	Tamanrasset Alger	Algeria	t	22.813333	5.458333
2407	TNG	Boukhalf	Tangier	Morocco	t	35.723333	-5.908333
2408	TNN	Tainan Aero	Tainan	Taiwan	t	22.958333	120.200000
2409	TNP	Twentynine Palms	Twenty Nine Palms	USA	t	34.131667	-115.945000
2410	TNR	Ivato	Antananarivo	Madagascar	t	-18.795000	47.475000
2411	TNT	Dade-Collier Trng Transition	Pan Am	USA	t	25.861667	-80.896667
2412	TOA	Zamperini	Torrance	USA	t	33.803333	-118.338333
2413	TOE	Nefta	Tozeur	Tunisia	t	33.930000	8.111667
2414	TOI	Troy Mun	Not In Tbl	\N	t	31.860000	-86.011667
2415	TOJ	Torrejon	Madrid Torrejon	Spain	t	40.486667	-3.456667
2416	TOL	Toledo Express	Toledo	USA	t	41.586667	-83.806667
2417	TOP	Billard Mun	Topeka	USA	t	39.068333	-95.621667
2418	TOR	Torrington Mun	Not In Tbl	\N	t	42.063333	-104.151667
2419	TOS	Tromso	Tromso Norway	Norway	t	69.680000	18.918333
2420	TOY	Toyama	Toyama	Japan	t	36.645000	137.190000
2421	TPA	Tampa Intl	Tampa Tpa	USA	t	27.975000	-82.531667
2422	TPC	Tarapoa	Tarapoa	Ecuador	t	-0.118333	-76.333333
2423	TPE	Chiang Kai Shek Intl	Taipei Tpe	Taiwan	t	25.081667	121.223333
2424	TPH	Tonopah	Tonopah	USA	t	38.060000	-117.086667
2425	TPL	Draughon-Miller Centrl Tx Regl	Temple	USA	t	31.151667	-97.406667
2426	TPQ	Tepic	Tepic	Mexico	t	21.410000	-104.840000
2427	TPS	Birgi Mil	Trapani	Italy	t	37.911667	12.485000
2428	TRC	Torreon Intl	Torreon	Mexico	t	25.568333	-103.410000
2429	TRD	Vaernes Ab	Trondheim	Norway	t	63.456667	10.925000
2430	TRF	Torp	Sandefjord	Norway	t	59.186667	10.260000
2431	TRI	Tri-City Regl	Tri City Arpt Tn	USA	t	36.475000	-82.406667
2432	TRM	Thermal	Thermal	USA	t	33.625000	-116.158333
2433	TRN	Caselle	Turin	Italy	t	45.200000	7.650000
2434	TRS	Ronchi Dei Legionari	Trieste	Italy	t	45.826667	13.471667
2435	TRU	Cap Carlos Martinez De Pinill*	Trujillo Pe	Peru	t	-8.083333	-79.116667
2436	TRV	Trivandrum	Trivandrum	India	t	8.476667	76.920000
2437	TRW	Bonriki Intl	Tarawa	Kiribati	t	1.378333	173.150000
2438	TRZ	Tiruchirappalli	Tiruchirapally	India	t	10.763333	78.715000
2439	TSA	Sungshan	Taipei Tsa	Taiwan	t	25.070000	121.543333
2440	TSF	S.angelo Mil	Treviso	Italy	t	45.651667	12.198333
2441	TSJ	Tsushima	Tsushima	Japan	t	34.281667	129.331667
2442	TSM	Taos Mun	Taos	USA	t	36.456667	-105.671667
2443	TSN	Binhai	Tianjin	China	t	39.123333	117.345000
2444	TSR	Giarmata	Timisoara	Romania	t	45.810000	21.340000
2445	TSV	Townsville Intl	Townsville	Australia	t	-19.255000	146.765000
2446	TTA	Plage Blanche	Tan Tan	Morocco	t	28.445000	-11.158333
2447	TTB	Arbatax	Tortoli	Italy	t	39.916667	9.683333
2448	TTD	Portland-Troutdale	Not In Tbl	\N	t	45.548333	-122.400000
2449	TTJ	Tottori	Tottori	Japan	t	35.526667	134.166667
2450	TTN	Mercer Co	Trenton Nj	USA	t	40.276667	-74.813333
2451	TTU	Sania Ramel	Tetuan	Morocco	t	35.600000	-5.316667
2452	TUC	Benjamin Matienzo	Tucuman Arg	Argentina	t	-26.850000	-65.116667
2453	TUF	St Symphorien Ab	Tours	France	t	47.431667	0.723333
2454	TUI	Turaif	Turaif	Saudi Arabia	t	31.691667	38.730000
2455	TUK	Turbat	Turbat	Pakistan	t	25.985000	63.030000
2456	TUL	Tulsa Intl	Tulsa	USA	t	36.198333	-95.886667
2457	TUN	Carthage	Tunis	Tunisia	t	36.848333	10.225000
2458	TUP	Tupelo Mun-Lemons	Tupelo	USA	t	34.266667	-88.768333
2459	TUR	Tucurui	Tucurui	Brazil	t	-3.776667	-49.718333
2460	TUS	Tucson Intl	Tucson	USA	t	32.115000	-110.940000
2461	TUU	Tabuk	Tabuk	Saudi Arabia	t	28.371667	36.625000
2462	TUV	Tucupita	Tucupita	Venezuela	t	9.100000	-62.050000
2463	TUX	Tuxpan	Tumbler Ridge	Canada	t	19.583333	-103.383333
2464	TVC	Cherry Capital	Traverse City	USA	t	44.740000	-85.581667
2465	TVI	Thomasville Mun	Thomasville	USA	t	30.900000	-83.880000
2466	TVL	Lake Tahoe	Lake Tahoe Tvl	USA	t	38.893333	-119.995000
2467	TWF	Joslin-Magic Valley Regl	Twin Falls	USA	t	42.481667	-114.486667
2468	TXG	Taichung Aero	Taichung	Taiwan	t	24.188333	120.645000
2469	TXK	Texarkana Regl-Webb	Texarkana	USA	t	33.453333	-93.990000
2470	TXL	Tegel	Berlin Tegel	Germany	t	52.558333	13.286667
2471	TYL	Capitan Montes	Talara	Peru	t	-4.571667	-81.251667
2472	TYM	Staniel Cay , Bs	Staniel Cay	Bahamas	t	24.166667	-76.450000
2473	TYN	Wusu	Taiyuan	China	t	37.748333	112.630000
2474	TYR	Tyler Pounds	Tyler Texas	USA	t	32.353333	-95.401667
2475	TYS	Mc Ghee Tyson	Knoxville	USA	t	35.811667	-83.991667
2476	TZP	Piarco Fir	Not In Tbl	\N	t	0.000000	0.000000
2477	TZX	Trabzon	Trabzon	Turkey	t	40.998333	39.778333
2478	UAK	Narsarsuaq	Narsarsuaq	Greenland	t	61.160000	-45.426667
2479	UAM	Andersen Afb	Guam Anderson Afb	Us Pacific Is	t	13.580000	144.923333
2480	UAQ	San Juan	San Juan Ar	Argentina	t	-31.570000	-68.420000
2481	UBA	Uberaba	Uberaba	Brazil	t	-19.763333	-47.965000
2482	UBJ	Yamaguchi-Ube	Ube	Japan	t	33.925000	131.278333
2483	UCA	Oneida Co	Utica Ny	USA	t	43.145000	-75.383333
2484	UDD	Bermuda Dunes	Palm Desert	USA	t	33.748333	-116.273333
2485	UDI	Uberlandia	Uberlandia	Brazil	t	-18.881667	-48.223333
2486	UDR	Udaipur	Udaipur	India	t	24.616667	73.895000
2487	UEL	Quelimane	Quelimane	Mozambique	t	-17.850000	36.866667
2488	UES	Waukesha Co	Waukesha	USA	t	43.040000	-88.236667
2489	UET	Quetta	Quetta	Pakistan	t	30.250000	66.940000
2490	UGN	Waukegan Regl	Waukegan	USA	t	42.421667	-87.866667
2491	UHE	Kunovice	Uherske Hradist	Czech Republic	t	49.028333	17.438333
2492	UIN	Quincy Mun-Baldwin	Quincy	USA	t	39.941667	-91.193333
2493	UIO	Mariscal Sucre Intl	Quito	Ecuador	t	-0.143333	-78.483333
2494	UIP	Pluguffan	Quimper	France	t	47.975000	-4.166667
2495	UKI	Ukiah Mun	Ukiah	USA	t	39.125000	-123.200000
2496	ULC	Los Cerrillos Apt	Santiago	Chile	t	-33.488333	-70.693333
2497	ULD	Prince M.buthelezi	Ulundi	South Africa	t	-28.318333	31.416667
2498	UME	Umea	Umea	Sweden	t	63.793333	20.283333
2499	UMR	Woomera	Woomera Sa Aust	Australia	t	-31.143333	136.816667
2500	UNK	Unalakleet	Unalakleet	USA	t	63.888333	-160.796667
2501	UNV	State College Pa	St Cllge Univ Pk	USA	t	40.848333	-77.848333
2502	UPG	Hasanuddin	Ujung Pandang	Indonesia	t	-5.060000	119.553333
2503	UPN	Gen Ignacio Lopez Rayon	Uruapan Mexico	Mexico	t	19.395000	-102.038333
2504	UPS	Uppsala Ab	Uppsala Afb	Sweden	t	59.900000	17.595000
2505	URG	Rubem Berta Intl	Uruguaiana	Brazil	t	-29.780000	-57.036667
2506	URO	Rouen/Vallee De Seine	Rouen	France	t	49.391667	1.185000
2507	URT	Surat Thani	Surat Thani	Thailand	t	9.133333	99.140000
2508	URY	Guriat	Gurayat	Saudi Arabia	t	31.411667	37.278333
2509	USH	Ushuaia Intl	Ushuaia	Argentina	t	-54.841667	-68.293333
2510	UST	St Augustine	St Augustine	USA	t	29.958333	-81.338333
2511	UTH	Udon Thani	Udon Thani	Thailand	t	17.381667	102.793333
2512	UTI	Utti Ab	Kouvola	Finland	t	60.895000	26.940000
2513	UTN	Upington	Upington	South Africa	t	-28.400000	21.260000
2514	UTP	U-Taphao Intl	Utapao	Thailand	t	12.676667	101.008333
2515	UTT	K.d. Matanzima	Umtata	South Africa	t	-31.545000	28.673333
2516	UUD	Mukhino	Ulan Ude	E Ural Russia	t	51.806667	107.441667
2517	UUS	Khomutovo	Yuzhno Sakhalinsk	E Ural Russia	t	46.888333	142.716667
2518	UVA	Garner	Uvalde	USA	t	29.210000	-99.743333
2519	UVF	Hewanorra Intl	St Lucia Uvf	St Lucia	t	13.731667	-60.951667
2520	UVL	New Valley	New Valley	Egypt	t	25.475000	30.588333
2521	VAA	Vaasa	Vaasa	Finland	t	63.045000	21.766667
2522	VAD	Moody Afb	Moody Afb Ga	USA	t	30.966667	-83.191667
2523	VAF	Chabeuil	Valence	France	t	44.915000	4.968333
2524	VAG	Maj Brigadeiro Trompowsky	Varginha	Brazil	t	-21.588333	-45.471667
2525	VAN	Van	Van	Turkey	t	38.468333	43.330000
2526	VAR	Varna	Varna	Bulgaria	t	43.233333	27.816667
2527	VAS	Sivas	Sivas	Turkey	t	39.815000	36.901667
2528	VBG	Vandenberg Afb	Vandenberg Afb	USA	t	34.736667	-120.586667
2529	VBY	Visby	Visby	Sweden	t	57.661667	18.345000
2530	VCE	Tessera	Venice It	Italy	t	45.503333	12.351667
2531	VCP	Viracopos Intl	Sao Paulo Vcp	Brazil	t	-23.005000	-47.133333
2532	VCT	Victoria Regl	Victoria Tx	USA	t	28.851667	-96.918333
2533	VDA	Ovda Ab	Ovda	Israel	t	29.935000	34.940000
2534	VDB	Leirin	Fagernes	Norway	t	61.006667	9.298333
2535	VDC	Vitoria Da Conquista	Vitoria Da Conq	Brazil	t	-14.861667	-40.861667
2536	VDI	Vidalia Mun	Not In Tbl	\N	t	32.191667	-82.371667
2537	VDM	Gobernador Castello	Viedma	Argentina	t	-40.868333	-62.996667
2538	VDZ	Valdez	Valdez	USA	t	61.133333	-146.248333
2539	VEL	Vernal	Vernal	USA	t	40.440000	-109.508333
2540	VER	Gen Heriberto Jara Intl	Veracruz	Mexico	t	19.145000	-96.186667
2541	VFA	Victoria Falls	Victoria Falls	Zimbabwe	t	-18.091667	25.840000
2542	VGA	Vijayawada	Vijayawada	India	t	16.525000	80.798333
2543	VGO	Vigo	Vigo	Spain	t	42.230000	-8.625000
2544	VHN	Culberson Co	Van Horn	USA	t	31.056667	-104.783333
2545	VHY	Charmeil	Vichy Fr	France	t	46.171667	3.405000
2546	VIC	Vicenza	Vicenza	Italy	t	45.591667	11.526667
2547	VIE	Schwechat	Vienna	Austria	t	48.110000	16.570000
2548	VIG	Juan Pablo Perez Alfonso	El Vigia	Venezuela	t	8.625000	-71.673333
2549	VIJ	Virgin Gorda	Virgin Gorda	British Virgin	t	18.450000	-64.433333
2550	VIL	Dakhla	Villa Cisneros	Morocco	t	23.720000	-15.933333
2551	VIS	Visalia Mun	Visalia	USA	t	36.318333	-119.391667
2552	VIT	Foronda	Vitoria Es	Spain	t	42.883333	-2.721667
2553	VIX	Goiabeiras	Vitoria Br	Brazil	t	-20.258333	-40.286667
2554	VKO	Vnukovo	Moscow Vko	Russia	t	55.598333	37.275000
2555	VKS	Vicksburg Mun	Vicksburg	USA	t	32.238333	-90.928333
2556	VLC	Manises	Valencia Es	Spain	t	39.490000	-0.480000
2557	VLD	Valdosta Regl	Valdosta	USA	t	30.781667	-83.276667
2558	VLI	Bauerfield	Port Vila	Vanuatu	t	-17.703333	168.311667
2559	VLL	Villanubla	Valladolid	Spain	t	41.706667	-4.850000
2560	VLM	Rafael Pabon	Villa Montes	Bolivia	t	-21.251667	-63.405000
2561	VLN	Arturo Michelena Intl	Valencia Ve	Venezuela	t	10.150000	-67.933333
2562	VLV	Dr.antonio Nicolas Briceno	Valera	Venezuela	t	9.350000	-70.616667
2563	VNC	Venice Mun	Venice Fl	USA	t	27.070000	-82.440000
2564	VNO	Vilnius Intl	Vilnius	Lithuania	t	54.636667	25.286667
2565	VNS	Varanasi	Varanasi	India	t	25.450000	82.860000
2566	VNY	Van Nuys	Van Nuys	USA	t	34.208333	-118.488333
2567	VOK	Volk	Not In Tbl	\N	t	43.931667	-90.266667
2568	VOL	Nea Anghialos Ab	Volos	Greece	t	39.220000	22.795000
2569	VPS	Eglin Afb	Fort Walton Beach	USA	t	30.486667	-86.520000
2570	VPZ	Porter Co Mun	Valparaiso In	USA	t	41.453333	-87.005000
2571	VRA	Varadero Intl	Varadero	Cuba	t	23.030000	-81.436667
2572	VRB	Vero Beach Mun	Vero Beach	USA	t	27.655000	-80.416667
2573	VRK	Varkaus	Varkaus	Finland	t	62.170000	27.871667
2574	VRN	Villafranca Mil	Verona	Italy	t	45.395000	10.886667
2575	VSA	C P A Carlos Rovirosa Intl	Villahermosa	Mexico	t	17.993333	-92.816667
2576	VSF	Hartness State	Springfield Vt	USA	t	43.343333	-72.516667
2577	VST	Hasslo Ab	Vasteras	Sweden	t	59.588333	16.633333
2578	VTE	Vientiane	Vientiane	Lao Peoples Dem	t	17.988333	102.561667
2579	VTU	Tunas	Las Tunas	Cuba	t	20.986667	-76.935000
2580	VTZ	Vishakapatnam	Vishakhapatnam	India	t	17.721667	83.225000
2581	VUP	Alfonso Lopez	Valledupar	Colombia	t	10.440000	-73.253333
2582	VVC	Vanguardia	Villavicencio	Colombia	t	4.171667	-73.616667
2583	VVI	Viru Viru Intl	Santa Cruz Vvi	Bolivia	t	-17.640000	-63.133333
2584	VVO	Knevichi	Vladivostok	E Ural Russia	t	43.398333	132.153333
2585	VXC	Lichinga	Vila Cabral	Mozambique	t	-13.283333	35.250000
2586	VXO	Kronoberg	Vaxjo	Sweden	t	56.930000	14.731667
2587	VYS	Illinois Valley Regl-Duncan	Peru Il	USA	t	41.351667	-89.151667
2588	WAE	Wadi Al Dawasir	Wadi Ad Dawasir	Saudi Arabia	t	20.503333	45.198333
2589	WAL	Wallops Flight Facility	Not In Tbl	\N	t	37.941667	-75.461667
2590	WAW	Okecie	Warsaw	Poland	t	52.165000	20.968333
2591	WCA	Cairo West Ab	Castro	Chile	t	30.115000	30.915000
2592	WDG	Enid Woodring Mun	Enid	USA	t	36.378333	-97.790000
2593	WDH	Windhoek	Windhoek Wdh	Namibia	t	-22.480000	17.471667
2594	WDR	Winder-Barrow	Winder	USA	t	33.981667	-83.666667
2595	WEG	Quallys Town	Not In Tbl	\N	t	53.308333	-113.578333
2596	WEI	Weipa	Weipa	Australia	t	-12.678333	141.925000
2597	WEL	Welkom	Welkom	South Africa	t	-28.000000	26.666667
2598	WIC	Wick	Wick	United Kingdom	t	58.456667	-3.095000
2599	WIE	Wiesbaden Ab/Aaf	Not In Tbl	\N	t	50.048333	8.325000
2600	WJF	General William J Fox Airfield	Palmdale Lancastr	USA	t	34.740000	-118.218333
2601	WKJ	Wakkanai	Wakkanai	Japan	t	45.401667	141.803333
2602	WLD	Strother	Winfield	USA	t	37.166667	-97.036667
2603	WLG	Wellington Intl	Wellington	New Zealand	t	-41.326667	174.805000
2604	WLS	Hihifo	Wallis Island	Wallis Funta Is	t	-13.238333	-176.196667
2605	WLW	Quallys Town	Willows	USA	t	49.955000	-119.378333
2606	WMC	Winnemucca Mun	Winnemucca	USA	t	40.895000	-117.805000
2607	WMH	Baxter Co Regional	Mountain Home	USA	t	36.368333	-92.468333
2608	WNS	Nawabshah	Nawab	Pakistan	t	26.218333	68.390000
2609	WNT	Qualleys Town	Not In Tbl	\N	t	53.308333	-113.578333
2610	WOE	Woensdrecht Ab	Not In Tbl	\N	t	51.448333	4.341667
2611	WPC	Pincher Creek	Pincher Creek	Canada	t	49.520000	-113.996667
2612	WPR	Capitan Fuentes Martinez	Porvenir	Chile	t	-53.250000	-70.333333
2613	WQB	Qualleys Town	Not In Tbl	\N	t	46.793333	-71.390000
2614	WRB	Robins Afb	Robins Afb Ga	USA	t	32.640000	-83.591667
2615	WRI	Mc Guire Afb	Mcguire Afb	USA	t	40.015000	-74.590000
2616	WRL	Worland Mun	Worland	USA	t	43.965000	-107.950000
2617	WSG	Washington Co	Washington Pa	USA	t	40.135000	-80.290000
2618	WTD	West End	West End Bahamas	Bahamas	t	26.686667	-78.975000
2619	WTN	Waddington Ab	Not In Tbl	\N	t	53.165000	-0.521667
2620	WTO	Qualleys Town	Wotho Marshall Is	Us Pacific Is	t	43.676667	-79.630000
2621	WUH	Tianhe	Wuhan	China	t	30.785000	114.210000
2622	WUL	Quallys Town	Not In Tbl	\N	t	45.466667	-73.740000
2623	WVB	Walvis Bay/Rooikop	Walvis Bay	Namibia	t	-22.978333	14.650000
2624	WVL	Waterville Lafleur	Waterville	USA	t	44.531667	-69.675000
2625	WVR	Quallys Town	Village Resorts	USA	t	49.193333	-123.198333
2626	WWG	Quallys Town	Not In Tbl	\N	t	49.910000	-97.243333
2627	WWR	West Woodward	Woodward	USA	t	36.436667	-99.520000
2628	WXE	Quallys Town	Not In Tbl	\N	t	52.170000	-106.698333
2629	WXK	Qualleys Town	Not In Tbl	\N	t	48.476667	-68.496667
2630	WYS	Yellowstone	West Yellowstone	USA	t	44.688333	-111.116667
2631	WZF	Qualleys Town	Not In Tbl	\N	t	44.880000	-63.508333
2632	XBJ	Birjand	Birjand	Iran	t	32.900000	59.266667
2633	XCH	Christmas I	Christmas Island	Australia	t	-10.450000	105.688333
2634	XFW	Finkenwerder	Not In Tbl	\N	t	53.536667	9.836667
2635	XHG	Tulsa Maintenance Hgr 5	Aa Hanger 5 Tul	USA	t	36.196667	-95.886667
2636	XLS	St Louis	St Louis Sn	Senegal	t	16.041667	-16.458333
2637	XLW	Lemwerder	Lemwerder	Germany	t	53.143333	8.623333
2638	XMR	Cape Canaveral Afs Skid Strip,	Agcy De Portix	El Salvador	t	28.466667	-80.566667
2639	XMW	Montauban	Midway Rent A Car	USA	t	44.026667	1.378333
2640	XRY	Jerez Ab	Jerez Frontera	Spain	t	36.745000	-6.058333
2641	XTL	Tadoule Lake	Tadoule Lake Mb	Canada	t	0.000000	0.000000
2642	XYT	Montaudran	Not In Tbl	\N	t	43.576667	1.441667
2643	YAD	La Grande 3 Que	Not In Tbl	\N	t	53.568333	-76.188333
2644	YAH	La Grande	Lagrande 4	Canada	t	53.753333	-73.671667
2645	YAI	Gen. Bernardo O Higgins	Chillan	Chile	t	-36.580000	-72.030000
2646	YAK	Icy Bay	Yakutat Alaska	USA	t	59.501667	-139.660000
2647	YAL	Alert Bay Bc	Alert Bay	Canada	t	50.581667	-126.915000
2648	YAM	Sault Ste Marie	Saultstemarie On	Canada	t	46.485000	-84.508333
2649	YAP	Yap Intl	Yap	Micronesia	t	9.498333	138.081667
2650	YAT	Attawapiskat Ontario	Attawapiskat	Canada	t	52.928333	-82.430000
2651	YAW	Halifax/Shearwater Ns	Shearwater Ns	Canada	t	44.640000	-63.498333
2652	YAY	St Anthony	St Anthony	Canada	t	51.391667	-56.083333
2653	YAZ	Tofino	Tofino	Canada	t	49.080000	-125.776667
2654	YBA	Banff Alta	Banff Ab	Canada	t	51.200000	-115.533333
2655	YBB	Pelly Bay	Pelly Bay Twnsite	Canada	t	68.535000	-89.808333
2656	YBC	Baie-Comeau	Baie Comeau Qc	Canada	t	49.131667	-68.206667
2657	YBE	Uranuim City Sask	Uranium City	Canada	t	59.561667	-108.478333
2658	YBG	Bagotville	Bagotville Qc	Canada	t	48.330000	-70.995000
2659	YBK	Baker Lake	Baker Lake Nt	Canada	t	64.298333	-96.078333
2660	YBL	Campbell River	Campbell River Bc	Canada	t	49.950000	-125.270000
2661	YBQ	Tadoule Lake	Telegraph Harbour	Canada	t	58.708333	-98.513333
2662	YBR	Brandon	Brandon	Canada	t	49.908333	-99.950000
2663	YBT	Brochet	Brochet Mb	Canada	t	57.890000	-101.678333
2664	YBX	Lourdes-De-Blanc-Sablon	Blanc Sablon Qc	Canada	t	51.443333	-57.185000
2665	YCB	Cambridge Bay	Cambridge Bay Nt	Canada	t	69.108333	-105.138333
2666	YCC	Cornwall Regl	Cornwall	Canada	t	45.091667	-74.563333
2667	YCD	Nanaimo	Nanaimo Bc	Canada	t	49.051667	-123.870000
2668	YCE	Huron	Not In Tbl	\N	t	43.285000	-81.508333
2669	YCG	Castlegar	Castlegar Bc	Canada	t	49.295000	-117.631667
2670	YCH	Miramichi	Chatham Nb	Canada	t	47.005000	-65.456667
2671	YCL	Charlo	Charlo Nb	Canada	t	47.990000	-66.330000
2672	YCO	Tugkugluktuk-Coppermine	Coppermine	Canada	t	67.816667	-115.143333
2673	YCR	Charlie Sinclair Memorial	Cross Lake	Canada	t	54.610000	-97.760000
2674	YCS	Chesterfield Inlet	Chestrfldinlet Nt	Canada	t	63.346667	-90.731667
2675	YCT	Coronation Alta	Coronation	Canada	t	52.071667	-111.440000
2676	YCW	Chilliwack B.c	Chilliwack Bc	Canada	t	49.153333	-121.938333
2677	YCY	Clyde River Nwt	Clyde River	Canada	t	70.485000	-68.516667
2678	YCZ	Fairmont Hot Springs	Fairmount Springs	Canada	t	50.331667	-115.873333
2679	YDF	Deer Lake	Deer Lake Nf	Canada	t	49.210000	-57.390000
2680	YDJ	Hatchet Lake Sask	Hatchet Lake Sask	Canada	t	58.660000	-103.540000
2681	YDL	Dease Lake	Dease Lake	Canada	t	58.421667	-130.031667
2682	YDN	Dauphin	Dauphin	Canada	t	51.100000	-100.051667
2683	YDO	Dolbeau-St-Methode	Dolbeau	Canada	t	48.778333	-72.375000
2684	YDQ	Dawson Creek	Dawson Creek	Canada	t	55.741667	-120.181667
2685	YDU	Kasba Lake Nwt	Kasba Lake Nwt	Canada	t	60.295000	-102.500000
2686	YDW	Obre Lake Nwt	Obre Lake Nwt	Canada	t	60.323333	-103.133333
2687	YED	Edmonton/Namao Alberta Helipor	Edmonton Namao	Canada	t	53.673333	-113.458333
2688	YEG	Edmonton Intl	Edmonton Intl Ab	Canada	t	53.308333	-113.578333
2689	YEK	Arviat	Arviat	Canada	t	61.095000	-94.071667
2690	YEO	Yeovil Radar Navy	Yeovilton	United Kingdom	t	51.008333	-2.636667
2691	YET	Edson	Edson	Canada	t	53.578333	-116.465000
2692	YEU	Eureka Nwt	Eureka Nt	Canada	t	79.995000	-85.813333
2693	YEV	Zubko	Inuvik Nt	Canada	t	68.303333	-133.481667
2694	YEY	Amos Mun	Amos	Canada	t	48.563333	-78.248333
2695	YFA	Fort Albany Ont Canada	Fort Albany	Canada	t	52.201667	-81.696667
2696	YFB	Iqaluit	Iqaluit Nt	Canada	t	63.755000	-68.555000
2697	YFC	Fredericton	Fredericton Nb	Canada	t	45.868333	-66.531667
2698	YFD	Brantford	Dnd Brantford	Canada	t	43.130000	-80.341667
2699	YFG	Fontange	Not In Tbl	\N	t	54.553333	-71.175000
2700	YFO	Flin Flon	Flin Flon Mb	Canada	t	54.676667	-101.681667
2701	YFR	Ft Resolution Nwt	Fort Resolution	Canada	t	61.175000	-113.686667
2702	YFS	Ft Simpson	Fort Simpson	Canada	t	61.760000	-121.236667
2703	YGD	Goderich	Dnd Goderich	Canada	t	43.766667	-81.710000
2704	YGH	Fort Good Hope	Fort Good Hope	Canada	t	66.261667	-128.616667
2705	YGJ	Miho Aero	Yonago	Japan	t	35.488333	133.238333
2706	YGK	Kingston	Kingston On	Canada	t	44.225000	-76.596667
2707	YGL	La Grande Riviere	La Grande Qc	Canada	t	53.625000	-77.703333
2708	YGM	Gimili Indus Park	Not In Tbl	\N	t	50.623333	-97.038333
2709	YGO	Gods Lake Narrows	Gods Narrows Mb	Canada	t	54.560000	-94.493333
2710	YGP	Gaspe	Gaspe Qc	Canada	t	48.775000	-64.478333
2711	YGQ	Geraldton	Geraldton Ot	Canada	t	49.778333	-86.938333
2712	YGR	Iles-De-La-Madeleine	Iles Demadlein Qc	Canada	t	47.423333	-61.776667
2713	YGT	Igloolik	Igloolik	Canada	t	69.365000	-81.816667
2714	YGV	Havre St-Pierre	Havre Stpierre Qc	Canada	t	50.281667	-63.610000
2715	YGW	Kuujjuarapik Que	Kuujjuarapik Qc	Canada	t	55.281667	-77.758333
2716	YGX	Gillam Man	Gillam Mb	Canada	t	56.358333	-94.710000
2717	YHB	Hudson Bay Sask	Hudson Bay	Canada	t	52.816667	-102.306667
2718	YHD	Dryden Regional	Dryden On	Canada	t	49.831667	-92.743333
2719	YHH	Nemiscau Que	Campbell River Bc	Canada	t	51.690000	-76.135000
2720	YHI	Holman	Holman Island	Canada	t	70.758333	-117.803333
2721	YHK	Gjoa Haven	Gjoa Haven	Canada	t	68.635000	-95.850000
2722	YHM	Hamilton	Hamilton Ot	Canada	t	43.171667	-79.930000
2723	YHR	Chevery Que	Chevery Qc	Canada	t	50.466667	-59.633333
2724	YHU	Montreal/St-Hubert	Montreal Sthubert	Canada	t	45.516667	-73.416667
2725	YHY	Hay River	Hay River Nt	Canada	t	60.838333	-115.776667
2726	YHZ	Halifax Intl	Halifax Ns	Canada	t	44.880000	-63.508333
2727	YIF	St-Augustin	Pakuashipi Qc	Canada	t	51.211667	-58.658333
2728	YIO	Pond Inlet	Pond Inlet	Canada	t	72.683333	-77.966667
2729	YIP	Willow Run	Detrt Willow Rn	USA	t	42.236667	-83.530000
2730	YIV	Island Lake	Islnd Lk Grdn Hll	Canada	t	53.856667	-94.651667
2731	YJA	Jasper-Hinton	Jasper	Canada	t	53.318333	-117.751667
2732	YJN	St-Jean	St Jean Qc	Canada	t	45.293333	-73.280000
2733	YJT	Stephenville	Stephenville Nf	Canada	t	48.543333	-58.550000
2734	YKA	Kamloops	Kamloops Bc	Canada	t	50.701667	-120.441667
2735	YKC	Collins Bay	Collins Bay	Canada	t	58.235000	-103.676667
2736	YKF	Kitchener/Waterloo Regl	Kitchener	Canada	t	43.458333	-80.383333
2737	YKJ	Key Lake Sask	Key Lake	Canada	t	57.256667	-105.615000
2738	YKL	Schefferville	Schefferville Qc	Canada	t	54.805000	-66.805000
2739	YKM	Yakima Air Terminal	Yakima	USA	t	46.566667	-120.543333
2740	YKO	Akulivik	Akulivik Canada	Canada	t	60.816667	-78.141667
2741	YKQ	Waskaganish	Waskaganish	Canada	t	51.471667	-78.755000
2742	YKS	Yakutsk	Yakutsk	E Ural Russia	t	62.093333	129.763333
2743	YKZ	Toronto/Buttonville Muni	Toronto Buttnvlle	Canada	t	43.861667	-79.370000
2744	YLC	Lake Harbor	Lake Harbour	Canada	t	62.850000	-69.890000
2745	YLD	Chapleau	Chapleau	Canada	t	47.820000	-83.346667
2746	YLE	Lac La Martre Nwt	Lac La Martre	Canada	t	63.125000	-117.241667
2747	YLF	Laforge 1	Not In Tbl	\N	t	54.103333	-72.530000
2748	YLL	Lloydminster	Lloydminster	Canada	t	53.308333	-110.071667
2749	YLO	Shilo Flewin Field Man	Lot Polish Air	USA	t	49.781667	-99.638333
2750	YLR	Leaf Rapids	Leaf Rapids Mn	Canada	t	56.513333	-99.985000
2751	YLT	Alert Nwt	Alert	Canada	t	82.518333	-62.268333
2752	YLW	Kelowna	Kelowna Bc	Canada	t	49.955000	-119.376667
2753	YMD	Mould Bay	Not In Tbl	\N	t	76.236667	-119.318333
2754	YME	Matane	Matane	Canada	t	48.856667	-67.453333
2755	YMJ	Moose Jaw	Moose Jaw	Canada	t	50.330000	-105.556667
2756	YML	Charlevoix	Murray Bay	Canada	t	47.596667	-70.223333
2757	YMM	Ft Mc Murray	Fort Mcmurray Ab	Canada	t	56.651667	-111.221667
2758	YMO	Moosonee	Moosonee	Canada	t	51.290000	-80.606667
2759	YMT	Chapais	Chibougamau Qc	Canada	t	49.771667	-74.526667
2760	YMW	Maniwaki	Maniwaki	Canada	t	46.273333	-75.990000
2761	YMX	Mirabel/Ymx	Montreal Mirabel	Canada	t	45.678333	-74.038333
2762	YMY	Ear Falls Ont	Montreal Downtown	Canada	t	50.723333	-93.385000
2763	YNA	Natashquan	Natashquan Qc	Canada	t	50.188333	-61.788333
2764	YNB	Yenbo	Yanbu	Saudi Arabia	t	24.143333	38.063333
2765	YNC	Wemindjii, Que	Wemindji	Canada	t	53.006667	-78.825000
2766	YND	Ottawa/Gatineau	Gatineau Hull	Canada	t	45.520000	-75.563333
2767	YNE	Norway House	Norway House	Canada	t	53.958333	-97.846667
2768	YNG	Youngstown-Warren Regl	Youngstown Warr	USA	t	41.258333	-80.675000
2769	YNL	Points North Landing	Pnts No Landing	Canada	t	58.273333	-104.075000
2770	YNM	Matagami	Matagami	Canada	t	49.760000	-77.801667
2771	YOA	Koala Nwt	Koala	Canada	t	64.700000	-110.615000
2772	YOC	Old Crow Yt	Old Crow	Canada	t	67.570000	-139.840000
2773	YOD	Cold Lake	Cold Lake	Canada	t	54.405000	-110.278333
2774	YOH	Oxford House	Oxford House Mb	Canada	t	54.933333	-95.278333
2775	YOJ	High Level	High Level Ab	Canada	t	58.620000	-117.163333
2776	YOL	Yola	Yola	Nigeria	t	9.258333	12.430000
2777	YOP	Rainbow Lake Alta	Rainbow Lake Ab	Canada	t	58.490000	-119.403333
2778	YOW	Ottawa/Macdonald-Cartier Intl	Ottawa On	Canada	t	45.321667	-75.668333
2779	YPA	Prince Albert	Prince Albert	Canada	t	53.213333	-105.671667
2780	YPE	Peace River	Peace River Ab	Canada	t	56.226667	-117.446667
2781	YPG	Portage La Prairie/Southport M	Portge La Prairie	Canada	t	49.903333	-98.273333
2782	YPL	Pickle Lake	Pickle Lake	Canada	t	51.445000	-90.215000
2783	YPN	Port Menier	Port Menier Qc	Canada	t	49.835000	-64.286667
2784	YPO	Peawanuck Ontario	Peawanuck	Canada	t	54.983333	-85.433333
2785	YPQ	Peterborough	Peterborough	Canada	t	44.230000	-78.363333
2786	YPR	Prince Rupert	Prince Rupert Bc	Canada	t	54.285000	-130.443333
2787	YPS	Port Hawkesbury	Port Hawkesbury	Canada	t	45.656667	-61.366667
2788	YPU	Puntzi Mountain	Not In Tbl	\N	t	52.113333	-124.143333
2789	YPW	Powell River	Powell River	Canada	t	49.833333	-124.500000
2790	YPX	Povungnituk, Que	Puvirnituq	Canada	t	60.050000	-77.286667
2791	YPY	Ft Chipewyan	Fort Chipewyan	Canada	t	58.766667	-111.116667
2792	YQA	Muskoka	Muskoka	Canada	t	44.973333	-79.303333
2793	YQB	Quebec/Lesage Intl	Quebec Qc	Canada	t	46.793333	-71.390000
2794	YQD	The Pas	The Pas Mb	Canada	t	53.971667	-101.091667
2795	YQF	Red Deer Industrial	Red Deer Alta	Canada	t	52.178333	-113.891667
2796	YQG	Windsor	Windsor On	Canada	t	42.273333	-82.958333
2797	YQH	Watson Lake	Watson Lake	Canada	t	60.116667	-128.821667
2798	YQI	Yarmouth	Yarmouth Ns	Canada	t	43.826667	-66.086667
2799	YQK	Kenora	Kenora	Canada	t	49.788333	-94.361667
2800	YQL	Lethbridge	Lethbridge Ab	Canada	t	49.630000	-112.798333
2801	YQM	Moncton	Moncton Nb	Canada	t	46.111667	-64.681667
2802	YQQ	Comox	Comox Bc	Canada	t	49.710000	-124.886667
2803	YQR	Regina	Regina Sk	Canada	t	50.431667	-104.665000
2804	YQS	St Thomas Mun	St Thomas Ont	Canada	t	42.770000	-81.110000
2805	YQT	Thunder Bay	Thunder Bay On	Canada	t	48.371667	-89.323333
2806	YQU	Grande Prairie	Grande Prairie Ab	Canada	t	55.178333	-118.885000
2807	YQV	Yorkton	Yorkton Sask	Canada	t	51.263333	-102.461667
2808	YQW	North Battleford/Cameron Mcin*	N Battleford	Canada	t	52.768333	-108.243333
2809	YQX	Gander Intl	Gander Nf	Canada	t	48.940000	-54.568333
2810	YQY	Sydney	Sydney Ns	Canada	t	46.160000	-60.046667
2811	YQZ	Quesnel	Quesnel	Canada	t	53.025000	-122.510000
2812	YRB	Resolute Bay	Resolute Nt	Canada	t	74.716667	-94.950000
2813	YRC	Chicoutimi/St-Honore	Not In Tbl	\N	t	48.520000	-71.051667
2814	YRI	Riviere-Du-Loup	Riviere Du Loup	Canada	t	47.763333	-69.583333
2815	YRJ	Roberval	Roberval Qc	Canada	t	48.520000	-72.265000
2816	YRL	Red Lake	Red Lake	Canada	t	51.066667	-93.791667
2817	YRM	Rocky Mountain House	Not In Tbl	\N	t	52.428333	-114.903333
2818	YRQ	Trois-Rivieres	Trois Rivieres Qc	Canada	t	46.351667	-72.678333
2819	YRT	Rankin Inlet	Rankin Inlet Nt	Canada	t	62.810000	-92.115000
2820	YSB	Sudbury	Sudbury On	Canada	t	46.625000	-80.798333
2821	YSC	Sherbrooke	Sherbrooke	Canada	t	45.436667	-71.690000
2822	YSD	Suffield Alta	Suffield Ab	Canada	t	50.266667	-111.183333
2823	YSF	Stony Radids	Stony Rapids Sk	Canada	t	59.250000	-105.841667
2824	YSG	Snowdrift Nwt	Snowdrift	Canada	t	62.408333	-110.686667
2825	YSJ	Saint John	Saint John Nb	Canada	t	45.315000	-65.890000
2826	YSL	St-Leonard	St Leonard	Canada	t	47.156667	-67.833333
2827	YSM	Ft Smith	Fort Smith Nt	Canada	t	60.021667	-111.960000
2828	YSN	St.catharines	Salmon Arm	Canada	t	43.191667	-79.171667
2829	YSP	Marathon	Marathon	Canada	t	48.755000	-86.343333
2830	YSR	Nanisivik	Nanisivik Nt	Canada	t	72.981667	-84.615000
2831	YST	St. Theresa Point	Ste Therese Pnt	Canada	t	53.840000	-94.851667
2832	YSU	Summerside	Summerside	Canada	t	46.438333	-63.830000
2833	YTA	Pembroke	Pembroke	Canada	t	45.863333	-77.251667
2834	YTB	Koala Nwt	Hartley Bay	Canada	t	64.700000	-110.615000
2835	YTE	Cape Dorset	Cape Dorset	Canada	t	64.230000	-76.526667
2836	YTF	Alma	Alma Qc	Canada	t	48.508333	-71.641667
2837	YTH	Thompson	Thompson Mb	Canada	t	55.800000	-97.858333
2838	YTR	Trenton	Trenton Ot	Canada	t	44.118333	-77.526667
2839	YTS	Timmins	Timmins	Canada	t	48.568333	-81.376667
2840	YTZ	Toronto Island/City Centre	Toronto Center On	Canada	t	43.626667	-79.395000
2841	YUB	Tuktoyaktuk	Tuktoyaktuk	Canada	t	69.433333	-133.026667
2842	YUL	Dorval/Yul	Montreal Dorval	Canada	t	45.466667	-73.740000
2843	YUM	Yuma Mcas/Yuma Intl	Yuma	USA	t	32.655000	-114.605000
2844	YUT	Repulse Bay	Repulse Bay Nt	Canada	t	66.521667	-86.225000
2845	YUX	Hall Beach	Hall Beach	Canada	t	68.775000	-81.241667
2846	YUY	Rouyn-Noranda	Rouyn Noranda Pq	Canada	t	48.206667	-78.833333
2847	YVB	Bonaventure	Bonaventure Qc	Canada	t	48.071667	-65.461667
2848	YVC	La Ronge	La Ronge	Canada	t	55.150000	-105.261667
2849	YVE	Vernon	Vernon	Canada	t	50.250000	-119.333333
2850	YVG	Vermilion	Vermillion Ab	Canada	t	53.355000	-110.823333
2851	YVM	Broughton Is. Nwt	Broughton	Canada	t	67.541667	-64.025000
2852	YVO	Val-D Or	Val Dor Qc	Canada	t	48.053333	-77.781667
2853	YVP	Kuujjuaq	Kuujjuaq	Canada	t	58.095000	-68.426667
2854	YVQ	Norman Wells	Norman Wells Nt	Canada	t	65.281667	-126.800000
2855	YVR	Vancouver Intl	Vancouver Bc	Canada	t	49.195000	-123.181667
2856	YVT	Buffalo Narrows	Buffalo Narrows	Canada	t	55.838333	-108.425000
2857	YVV	Wiarton	Wiarton On	Canada	t	44.745000	-81.106667
2858	YWA	Petawawa Ont	Petawawa On	Canada	t	45.951667	-77.320000
2859	YWG	Winnipeg Intl	Winnipeg Mb	Canada	t	49.910000	-97.243333
2860	YWK	Wabush	Wabush Nf	Canada	t	52.921667	-66.863333
2861	YWL	Williams Lake	Williams Lake	Canada	t	52.181667	-122.053333
2862	YWO	Lupin	Dnd Shilo	Canada	t	65.758333	-111.250000
2863	YWV	Wainwright Alta	Dnd Wainwright	Canada	t	52.786667	-110.851667
2864	YXC	Cranbrook	Cranbrook Bc	Canada	t	49.610000	-115.781667
2865	YXD	Edmonton City Center	Edmonton Municipl	Canada	t	53.571667	-113.520000
2866	YXE	Saskatoon	Saskatoon Sk	Canada	t	52.170000	-106.698333
2867	YXH	Medicine Hat	Medicine Hat Ab	Canada	t	50.018333	-110.720000
2868	YXJ	Ft St John	Fort St John Bc	Canada	t	56.236667	-120.740000
2869	YXK	Rimouski	Rimouski Montjoli	Canada	t	48.476667	-68.496667
2870	YXL	Sioux Lookout	Sioux Lookout	Canada	t	50.113333	-91.903333
2871	YXN	Whale Cove	Whale Cove Nt	Canada	t	62.238333	-92.596667
2872	YXP	Pangnirtung Nwt	Pangnirtung	Canada	t	66.140000	-65.708333
2873	YXR	Earlton	Earlton	Canada	t	47.695000	-79.848333
2874	YXS	Prince George	Prince George Bc	Canada	t	53.890000	-122.678333
2875	YXT	Terrace	Terrace Bc	Canada	t	54.465000	-128.576667
2876	YXU	London	London On	Canada	t	43.035000	-81.153333
2877	YXX	Abbotsford	Abbotsford	Canada	t	49.025000	-122.363333
2878	YXY	Whitehorse	Whitehorse Yt	Canada	t	60.710000	-135.068333
2879	YXZ	Wawa	Wawa Ont	Canada	t	47.966667	-84.785000
2880	YYB	North Bay	North Bay	Canada	t	46.363333	-79.421667
2881	YYC	Calgary Intl	Calgary Intl Ab	Canada	t	51.113333	-114.020000
2882	YYD	Smithers	Smithers Bc	Canada	t	54.823333	-127.181667
2883	YYE	Ft Nelson	Fort Nelson Bc	Canada	t	58.836667	-122.596667
2884	YYF	Penticton	Penticton Bc	Canada	t	49.461667	-119.601667
2885	YYG	Charlottetown	Charlottetown Pe	Canada	t	46.290000	-63.120000
2886	YYH	Taloyoak	Taloyoak	Canada	t	69.546667	-93.576667
2887	YYJ	Victoria Intl	Victoria Bc	Canada	t	48.646667	-123.425000
2888	YYL	Lynn Lake	Lynn Lake Mb	Canada	t	56.863333	-101.075000
2889	YYN	Swift Current	Swift Current	Canada	t	50.291667	-107.690000
2890	YYQ	Churchill	Churchill Mb	Canada	t	58.736667	-94.056667
2891	YYR	Goose	Goose Bay Nf	Canada	t	53.318333	-60.425000
2892	YYT	St John S	St Johns Nf	Canada	t	47.618333	-52.751667
2893	YYU	Kapuskasing	Kapuskasing	Canada	t	49.413333	-82.466667
2894	YYY	Mont-Joli	Mont Joli Qc	Canada	t	48.608333	-68.206667
2895	YYZ	Toronto/Pearson Intl	Toronto On	Canada	t	43.676667	-79.630000
2896	YZE	Gore Bay-Manitoulin	Gore Bay	Canada	t	45.885000	-82.566667
2897	YZF	Yellowknife	Yellowknife Nt	Canada	t	62.461667	-114.440000
2898	YZH	Slave Lake	Slave Lake	Canada	t	55.293333	-114.778333
2899	YZP	Sandspit	Sandspit Bc	Canada	t	53.253333	-131.811667
2900	YZR	Sarnia	Sarnia On	Canada	t	42.998333	-82.308333
2901	YZS	Coral Harbour	Coral Harbour Nt	Canada	t	64.195000	-83.360000
2902	YZT	Port Hardy	Port Hardy Bc	Canada	t	50.680000	-127.365000
2903	YZU	Whitecourt	White Court	Canada	t	54.143333	-115.786667
2904	YZV	Sept-Iles	Sept Iles Qc	Canada	t	50.223333	-66.265000
2905	YZW	Teslin	Teslin	Canada	t	60.170000	-132.741667
2906	YZX	Greenwood	Greenwood Ns	Canada	t	44.983333	-64.916667
2907	YZY	Mackenzie	Not In Tbl	\N	t	55.305000	-123.133333
2908	ZAC	York Landing	York Landing	Canada	t	56.090000	-96.091667
2909	ZAD	Zadar	Zadar	Croatia	t	44.108333	15.350000
2910	ZAG	Pleso	Zagreb	Croatia	t	45.743333	16.073333
2911	ZAH	Zahedan Intl	Zahedan	Iran	t	29.473333	60.901667
2912	ZAL	Pichoy	Valdivia	Chile	t	-39.638333	-73.083333
2913	ZAM	Zamboanga Intl	Zamboanga	Philippines	t	6.920000	122.065000
2914	ZAR	Zaria	Zaria	Nigeria	t	11.133333	7.683333
2915	ZAZ	Zaragoza	Zaragoza	Spain	t	41.666667	-1.040000
2916	ZBF	Bathhurst Nb	Bathurst	Canada	t	47.625000	-65.736667
2917	ZBM	Bromont	Bromont	Canada	t	45.290000	-72.740000
2918	ZBR	Konarak Ab	Chah Bahar	Iran	t	25.443333	60.383333
2919	ZCL	Gen Leobardo C Ruiz Intl	Zacatecas	Mexico	t	22.896667	-102.685000
2920	ZCO	Maquehue	Temuco	Chile	t	-38.763333	-72.636667
2921	ZEM	Eastmain River, Que	East Main	Canada	t	52.223333	-78.521667
2922	ZFG	Pukatawagan	Not In Tbl	\N	t	55.750000	-101.266667
2923	ZFM	Ft. Mcpherson	Fort Mcpherson	Canada	t	67.400000	-134.855000
2924	ZGF	Grand Forks Bc	Grand Forks Bc	Canada	t	49.015000	-118.430000
2925	ZGI	Gods River	Gods River Mb	Canada	t	54.840000	-94.081667
2926	ZGS	Getgsemanie	Gethsemani Qc	Canada	t	50.716667	-59.333333
2927	ZIG	Ziguinchor	Ziguinchor	Senegal	t	12.553333	-16.276667
2928	ZIH	Zihuatanejo	Ixtap Zihuatanejo	Mexico	t	17.601667	-101.460000
2929	ZJN	Swan River Manitoba	Swan River	Canada	t	52.125000	-101.236667
2930	ZKB	Kasba Lake	Kasaba Bay	Zambia	t	60.295000	-102.501667
2931	ZKE	Kashechewan Ontario	Kaschechewan	Canada	t	52.283333	-81.683333
2932	ZKG	Kegaska	Kegaska Qc	Canada	t	50.200000	-61.283333
2933	ZLO	Manzanillo	Manzanillo Mx	Mexico	t	19.143333	-104.556667
2934	ZLT	La Tabatiere	La Tabatiere Qc	Canada	t	50.716667	-59.000000
2935	ZML	108 Mile	Aero Costa Rico	USA	t	51.736667	-121.333333
2936	ZND	Zinder	Zinder	Niger	t	13.783333	8.983333
2937	ZNZ	Kisauni	Zanzibar	Tanzania	t	-6.223333	39.223333
2938	ZOS	Canal Bajo/Carlos H Siebert	Osorno	Chile	t	-40.606667	-73.056667
2939	ZPH	Zephyrhills Mun	Preferred Hotels	USA	t	28.226667	-82.155000
2940	ZRH	Zurich	Zurich	Switzerland	t	47.458333	8.548333
2941	ZSA	Cockburn Town	San Salvador	Bahamas	t	24.066667	-74.516667
2942	ZSN	South Indian Lake	Stendal	Germany	t	56.793333	-98.908333
2943	ZTB	Tete Ala Baleine Whalehead	Tetealabaleine Qc	Canada	t	50.700000	-59.316667
2944	ZTH	Zakinthos	Zakinthos	Greece	t	37.751667	20.883333
2945	ZTM	Shamattawa	Shamattawa Mb	Canada	t	55.861667	-92.081667
2946	ZUE	Cape Parry	Not In Tbl	\N	t	70.168333	-124.691667
2947	ZUM	Churchill Falls	Churchill Falls	Canada	t	53.561667	-64.105000
2948	ZWH	Lac Brochet	Windhoek Rr Stn	Namibia	t	58.616667	-101.468333
2949	ZYF	Farnborough Dra	Not In Tbl	\N	t	51.275000	-0.773333
2950	ZYL	Osmani	Sylhet	Bangladesh	t	24.960000	91.873333
2951	ZZV	Zanesville Mun	Zanesville	USA	t	39.943333	-81.891667
\.


--
-- Data for Name: rule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rule (rule_id) FROM stdin;
1
2
3
\.


--
-- Data for Name: tier_definition; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tier_definition (tier_id, tier_code, tier_description, tier_ranking, is_active, tenant_id) FROM stdin;
1	B	Basic	1	t	1
2	S	Silver	3	t	1
3	G	Gold	5	t	1
4	P	Platinum	7	t	1
\.


--
-- Data for Name: bonus; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bonus (bonus_id, bonus_code, bonus_description, start_date, end_date, is_active, bonus_type, bonus_amount, rule_id, tenant_id, apply_sunday, apply_monday, apply_tuesday, apply_wednesday, apply_thursday, apply_friday, apply_saturday, required_tier_id) FROM stdin;
10	MAR	Marriott Bonus 1	2025-01-01	0025-12-31	t	fixed	100	\N	3	t	t	t	t	t	t	t	\N
6	BILLSTEST	bills test bonus	2025-01-01	2025-12-30	t	fixed	200	1	1	t	t	t	t	t	t	t	\N
8	TEST2	First Class Test	2024-12-31	2025-12-30	t	fixed	100	3	1	t	t	t	t	t	t	t	\N
12	DECEMBER	TESTING FOR DEC 1	2010-01-01	2030-12-31	f	fixed	333	\N	1	t	t	t	t	t	t	t	\N
\.


--
-- Data for Name: carriers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.carriers (carrier_id, code, name, alliance, country, is_active, tenant_id) FROM stdin;
1	BJ	Blue Jets Airways	\N	USA	t	1
2	DL	Delta Air Lines	SkyTeam	USA	t	1
3	AA	American Airlines	Oneworld	USA	t	1
4	UA	United Airlines	Star Alliance	USA	t	1
5	WN	Southwest Airlines	\N	USA	t	1
6	B6	JetBlue Airways	\N	USA	t	1
7	AS	Alaska Airlines	Oneworld	USA	t	1
8	NK	Spirit Airlines	\N	USA	t	1
9	F9	Frontier Airlines	\N	USA	t	1
10	G4	Allegiant Air	\N	USA	t	1
\.


--
-- Data for Name: display_template; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.display_template (template_id, tenant_id, template_name, template_type, is_active, activity_type) FROM stdin;
1	1	Default Verbose	V	t	A
3	1	Redemption Default Efficient	E	t	R
2	1	Default Efficient	E	t	A
\.


--
-- Data for Name: display_template_line; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.display_template_line (line_id, template_id, line_number, template_string) FROM stdin;
1	1	10	[M,origin,"Code"],[T," to "],[M,destination,"Code"]
2	1	20	[M,carrier,"Description",20],[T," • "],[M,flight_number,"Code"]
3	1	30	[M,fare_class,"Description"]
6	3	10	[M,redemption_type,"Both"]
16	2	10	[T,"Carrier: "],[M,carrier,"Code",2],[T,"    Flight: "],[M,flight_number,"Code",5],[T,"   Class: "],[M,fare_class,"Code"],[T,"   Origin: "],[M,origin,"Code"],[T,"   Destination: "],[M,destination,"Code"],[T,"   MQD: "],[M,mqd,"Code",5]
\.


--
-- Data for Name: input_template; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.input_template (template_id, tenant_id, template_name, activity_type, is_active) FROM stdin;
2	1	Partner Activity Entry	P	t
3	1	Adjustment Entry	J	t
1	1	Flight Entry	A	t
\.


--
-- Data for Name: input_template_line; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.input_template_line (line_id, template_id, line_number, template_string) FROM stdin;
4	2	10	[M,partner,"half",R],[M,partner_program,"half",R,partner]
5	2	20	[M,base_miles,"half",R]
6	3	10	[M,adjustment,"half",R]
7	3	20	[M,base_miles,"half",R]
14	1	10	[M,carrier,"third",R],[M,flight_number,"third",O],[M,fare_class,"third",R,"Class"]
15	1	20	[M,origin,"half",R],[M,destination,"half",R]
16	1	30	[M,mqd,"half",R,"MQD's"]
\.


--
-- Data for Name: link_tank; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.link_tank (tenant_id, table_key, link_bytes, next_link) FROM stdin;
1	member	5	16
1	activity	5	259
1	member_promotion	5	39
\.


--
-- Data for Name: member; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member (member_id, tenant_id, fname, lname, middle_initial, address1, address2, city, state, zip, phone, email, is_active, membership_number, zip_plus4, link) FROM stdin;
1	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	1001	\N	
2	1	Eva	Longoria	\N	\N	\N	\N	\N	\N	\N	\N	t	1002	\N	
3	1	Ava	Longoria	\N	\N	\N	\N	\N	\N	\N	\N	t	1003	\N	
4	1	William	Jansen	1	5	6	7	MN	\N	3	2	t	2153442807	\N	
5	1	Nancy	Jones	N	8944 Sunset Blvd	\N	Phoenix	AZ	85001	544-351-8603	nancy.jones@test.com	t	2153442808	3433	
6	1	Sarah	Gonzalez	S	5660 Hill Rd	\N	Minneapolis	MN	55401	703-935-2187	sarah.gonzalez@test.com	t	2153442809	5538	
7	1	Michael	Thomas	M	6465 Main St	\N	Austin	TX	78701	772-431-5700	michael.thomas@test.com	t	2153442810	8374	\b
8	1	Karen	Martin	K	3961 Hill Rd	\N	Denver	CO	80201	628-977-8726	karen.martin@test.com	t	2153442811	4466	\t
9	1	Matthew	Wilson	M	1950 Oak Ave	\N	Minneapolis	MN	55401	854-640-3177	matthew.wilson@test.com	t	2153442812	4900	\n
10	1	Christopher	Hernandez	C	4210 Park Ave	Apt 210	San Antonio	TX	78201	527-795-2488	christopher.hernandez@test.com	t	2153442813	2831	\v
11	1	Daniel	Garcia	D	9664 Cedar Ln	Apt 127	Atlanta	GA	30301	483-225-8747	daniel.garcia@test.com	t	2153442814	2679	\f
12	1	Karen	Martinez	K	1794 Maple Dr	\N	Phoenix	AZ	85001	370-811-8615	karen.martinez@test.com	t	2153442815	7361	\r
13	1	Karen	Martin	K	5490 Lake Dr	\N	San Diego	CA	92101	485-830-8872	karen.martin@test.com	t	2153442816	8173	
14	1	Mary	Anderson	M	3945 Elm St	\N	Los Angeles	CA	90001	840-377-3621	mary.anderson@test.com	t	2153442817	1380	
15	1	John	Smith	\N	12932	\N	orono	MN	55123	6122249000	john@gmail.com	t	2153442831	\N	
\.


--
-- Data for Name: member_detail_1; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_detail_1 (p_link, molecule_id, c1) FROM stdin;
\.


--
-- Data for Name: member_detail_2; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_detail_2 (p_link, molecule_id, n1) FROM stdin;
\.


--
-- Data for Name: member_detail_2244; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_detail_2244 (p_link, molecule_id, n1, n2, n3, n4, detail_id) FROM stdin;
	41	-32766	-7903	1592	0	14
\.


--
-- Data for Name: member_detail_3; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_detail_3 (p_link, molecule_id, c1) FROM stdin;
\.


--
-- Data for Name: member_detail_4; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_detail_4 (p_link, molecule_id, n1) FROM stdin;
\.


--
-- Data for Name: member_detail_5; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_detail_5 (p_link, molecule_id, c1) FROM stdin;
\.


--
-- Data for Name: member_detail_list; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_detail_list (detail_list_id, member_id, molecule_id, v1, v2, v3, v4, v5, v6, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: promotion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotion (promotion_id, tenant_id, promotion_code, promotion_name, promotion_description, start_date, end_date, is_active, enrollment_type, allow_member_enrollment, rule_id, count_type, goal_amount, reward_type, reward_amount, reward_tier_id, reward_promotion_id, process_limit_count, duration_type, duration_end_date, duration_days, counter_molecule_id) FROM stdin;
1	1	FLY3-5K	Fly 3 Flights, Get 5,000 Miles	Take 3 qualifying flights and receive a bonus of 5,000 miles	2025-01-01	2025-12-31	t	A	f	\N	flights	3	points	5000	\N	\N	\N	\N	\N	\N	\N
2	1	SILVER-20K	Silver Tier - 20K Miles	Earn 20,000 miles to achieve Silver tier status	2025-01-01	2025-12-31	t	A	f	\N	miles	20000	tier	\N	2	\N	1	calendar	2025-12-31	\N	\N
3	1	VIP-DIAMOND	VIP Diamond Winback	Exclusive offer: Take one flight to reclaim Diamond status	2025-11-01	2025-12-31	t	R	f	\N	flights	1	tier	\N	4	\N	1	calendar	2026-01-31	\N	\N
4	1	MQDTEST	MQD Test	\N	2020-01-01	2999-12-31	t	A	f	\N	molecules	1000	points	\N	\N	\N	1	\N	\N	\N	37
5	1	test1	fly 1 time get points	\N	2020-01-01	2035-12-31	f	A	f	\N	flights	1	points	3333	\N	\N	1	\N	\N	\N	\N
\.


--
-- Data for Name: member_promotion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_promotion (member_promotion_id, member_id, promotion_id, tenant_id, enrolled_date, qualify_date, process_date, progress_counter, enrolled_by_user_id, qualified_by_user_id, goal_amount, qualified_by_promotion_id, link, p_link) FROM stdin;
8	4	2	1	2025-12-04	\N	\N	1492	\N	\N	20000	\N	\N	\N
9	4	1	1	2025-12-04	\N	\N	1	\N	\N	3	\N	\N	\N
7	4	4	1	2025-12-04	2025-12-04	\N	3223	\N	\N	1000	\N	\N	\N
\.


--
-- Data for Name: member_promotion_detail; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_promotion_detail (detail_id, member_promotion_id, contribution_amount, enrolled_member_id, p_link, activity_link) FROM stdin;
261	8	1492	\N	\N	
262	9	1	\N	\N	
\.


--
-- Data for Name: member_tier; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_tier (member_tier_id, member_id, tier_id, start_date, end_date, p_link) FROM stdin;
1	4	3	2024-07-01	2025-12-31	
6	4	1	2025-01-01	2025-12-31	
5	4	2	2025-04-01	2025-12-31	
4	4	4	2025-09-01	2025-12-31	
7	15	1	2025-12-01	\N	
\.


--
-- Data for Name: molecule_column_def; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_column_def (column_def_id, molecule_id, column_name, column_type, column_order, description) FROM stdin;
7	42	A	ref	1	bucket_id (member_detail_list.detail_list_id)
12	32	A	ref	1	value
13	21	A	ref	1	value
14	30	A	ref	1	value
15	31	A	ref	1	value
16	33	A	ref	1	value
17	34	A	ref	1	value
19	5	A	numeric	1	value
20	11	A	ref	1	value
21	37	A	numeric	1	value
22	38	A	ref	1	value
23	40	A	ref	1	value
8	42	B	numeric	2	amount (positive=earn, negative=redeem)
36	41	N1	key	1	Rule id
37	41	N2	date	2	Expire date
38	41	N3	numeric	3	Accrued 
39	41	N4	numeric	4	Redeemed
40	2	N1	key	1	value
41	3	N1	key	1	value
42	1	C1	key	1	value
43	4	C1	key	1	value
\.


--
-- Data for Name: molecule_text_pool; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_text_pool (text_id, text_value, usage_count, first_used) FROM stdin;
\.


--
-- Data for Name: molecule_value_boolean; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_boolean (value_id, molecule_id, bool_value, is_active) FROM stdin;
\.


--
-- Data for Name: molecule_value_date; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_date (value_id, molecule_id, date_value, is_active) FROM stdin;
\.


--
-- Data for Name: molecule_value_embedded_list; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_embedded_list (embedded_value_id, molecule_id, tenant_id, category, code, description, sort_order, is_active) FROM stdin;
1	16	1	redemption_type	F	Fixed Point Redemption	10	t
2	16	1	redemption_type	V	Variable Point Redemption	20	t
7	16	1	redemption_status	A	Active	10	t
8	16	1	redemption_status	I	Inactive	20	t
16	16	1	redemption_status	b	billy	10	t
19	20	1	A	icon	✈️	1	t
20	20	1	A	color	#059669	2	t
21	20	1	A	bg_color	#f0fdf4	3	t
22	20	1	A	border_color	#059669	4	t
23	20	1	A	show_bonuses	true	5	t
24	20	1	A	action_verb	Added	6	t
25	20	1	R	label	Redemption	1	t
26	20	1	R	icon	🎁	2	t
27	20	1	R	color	#dc2626	3	t
28	20	1	R	bg_color	#fee2e2	4	t
29	20	1	R	border_color	#dc2626	5	t
30	20	1	R	show_bonuses	false	6	t
31	20	1	R	action_verb	Redeemed	7	t
33	20	1	P	label	Partner	1	t
34	20	1	P	icon	🤝	2	t
35	20	1	P	color	#0891b2	3	t
36	20	1	P	bg_color	#ecfeff	4	t
37	20	1	P	border_color	#0891b2	5	t
38	20	1	P	show_bonuses	false	6	t
39	20	1	P	action_verb	Added	7	t
40	20	1	J	label	Adjustment	1	t
41	20	1	J	icon	⚖️	2	t
42	20	1	J	color	#7c3aed	3	t
43	20	1	J	bg_color	#faf5ff	4	t
44	20	1	J	border_color	#7c3aed	5	t
45	20	1	J	show_bonuses	false	6	t
46	20	1	J	action_verb	Adjusted	7	t
47	20	1	M	label	Promotion	1	t
48	20	1	M	icon	🎯	2	t
49	20	1	M	color	#f59e0b	3	t
50	20	1	M	bg_color	#fef3c7	4	t
51	20	1	M	border_color	#f59e0b	5	t
52	20	1	M	show_bonuses	false	6	t
53	20	1	M	action_verb	Awarded	7	t
57	20	1	A	label	Base Activity	0	t
58	20	1	A	sort_order	1	0	t
59	20	1	A	display_in_activity_list	true	0	t
60	20	1	P	sort_order	2	0	t
61	20	1	P	display_in_activity_list	true	0	t
62	20	1	M	sort_order	3	0	t
63	20	1	M	display_in_activity_list	true	0	t
64	20	1	R	sort_order	4	0	t
65	20	1	R	display_in_activity_list	true	0	t
66	20	1	J	sort_order	5	0	t
67	20	1	J	display_in_activity_list	true	0	t
68	20	1	N	label	Bonus	1	t
69	20	1	N	icon	⭐	2	t
70	20	1	N	color	#eab308	3	t
71	20	1	N	bg_color	#fef9c3	4	t
72	20	1	N	border_color	#eab308	5	t
73	20	1	N	show_bonuses	false	6	t
74	20	1	N	action_verb	Awarded	7	t
75	20	1	N	sort_order	6	0	t
76	20	1	N	display_in_activity_list	false	0	t
85	16	1	A	data_edit_function	validateFlightActivity	0	t
86	16	1	A	points_mode	calculated	0	t
87	16	1	A	calc_function	calculateFlightMiles	0	t
54	16	1	debug	enabled	N	10	t
9	16	1	molecule_types	value-text	Value - Text	10	t
10	16	1	molecule_types	value-numeric	Value - Numeric	20	t
11	16	1	molecule_types	value-date	Value - Date	30	t
12	16	1	molecule_types	value-boolean	Value - Boolean	40	t
13	16	1	molecule_types	internal_list	Internal List	50	t
15	16	1	molecule_types	external_list	External List (Lookup)	70	t
105	16	1	membership	last_member_number	215344286	0	t
55	16	1	retro	days_allowed	999	20	t
56	16	1	tier	max_qualification_days	365	30	t
95	16	1	membership	check_digit_algorithm	luhn	0	t
\.


--
-- Data for Name: molecule_value_list; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_list (value_id, molecule_id, context_id, row_num, value, col) FROM stdin;
361	2	119	1	6	A
362	1	120	1	7	A
363	3	120	1	8	A
364	2	120	1	9	A
365	1	121	1	5	A
1	1	1	1	2	A
2	3	1	1	1	A
3	2	1	1	2	A
4	4	1	1	9	A
5	5	1	1	887	A
11	1	3	1	3	A
12	3	3	1	1	A
13	2	3	1	13	A
20	1	6	1	5	A
21	3	6	1	13	A
22	2	6	1	9	A
23	1	7	1	9	A
24	3	7	1	10	A
25	2	7	1	10	A
32	1	10	1	6	A
33	3	10	1	1	A
34	2	10	1	10	A
35	1	11	1	7	A
36	3	11	1	10	A
37	2	11	1	12	A
38	1	12	1	2	A
39	3	12	1	9	A
40	2	12	1	5	A
41	1	13	1	3	A
42	3	13	1	11	A
43	2	13	1	6	A
44	1	14	1	3	A
45	3	14	1	4	A
46	2	14	1	7	A
50	1	16	1	2	A
51	3	16	1	14	A
52	2	16	1	5	A
53	1	17	1	6	A
54	3	17	1	4	A
55	2	17	1	2	A
56	1	18	1	5	A
57	3	18	1	9	A
58	2	18	1	12	A
59	1	19	1	8	A
60	3	19	1	9	A
61	2	19	1	11	A
62	1	20	1	8	A
63	3	20	1	13	A
64	2	20	1	1	A
65	1	21	1	3	A
66	3	21	1	14	A
67	2	21	1	13	A
68	1	22	1	10	A
69	3	22	1	10	A
70	2	22	1	13	A
71	1	23	1	6	A
72	3	23	1	6	A
73	2	23	1	2	A
74	1	24	1	5	A
75	3	24	1	4	A
76	2	24	1	2	A
77	1	25	1	3	A
78	3	25	1	4	A
79	2	25	1	1	A
80	1	26	1	10	A
81	3	26	1	4	A
82	2	26	1	12	A
83	1	27	1	1	A
84	3	27	1	1	A
85	2	27	1	13	A
86	1	28	1	4	A
87	3	28	1	4	A
88	2	28	1	5	A
89	1	29	1	5	A
90	3	29	1	14	A
91	2	29	1	15	A
92	1	30	1	5	A
93	3	30	1	4	A
94	2	30	1	2	A
95	1	31	1	1	A
96	3	31	1	9	A
97	2	31	1	5	A
98	1	32	1	1	A
99	3	32	1	1	A
100	2	32	1	12	A
101	1	33	1	10	A
102	3	33	1	7	A
103	2	33	1	5	A
104	1	34	1	10	A
105	3	34	1	5	A
106	2	34	1	15	A
107	1	35	1	10	A
108	3	35	1	3	A
109	2	35	1	11	A
110	1	36	1	6	A
111	3	36	1	6	A
112	2	36	1	7	A
113	1	37	1	2	A
114	3	37	1	13	A
115	2	37	1	10	A
116	1	38	1	4	A
117	3	38	1	9	A
118	2	38	1	8	A
119	1	39	1	1	A
120	3	39	1	4	A
121	2	39	1	13	A
122	1	40	1	6	A
123	3	40	1	8	A
124	2	40	1	9	A
125	1	41	1	9	A
126	3	41	1	8	A
127	2	41	1	9	A
128	1	42	1	3	A
129	3	42	1	10	A
130	2	42	1	4	A
131	1	43	1	7	A
132	3	43	1	8	A
133	2	43	1	10	A
134	1	44	1	2	A
135	3	44	1	10	A
136	2	44	1	10	A
137	1	45	1	2	A
138	3	45	1	2	A
139	2	45	1	4	A
140	1	46	1	5	A
141	3	46	1	2	A
142	2	46	1	6	A
143	1	47	1	8	A
144	3	47	1	9	A
145	2	47	1	15	A
146	1	48	1	5	A
147	3	48	1	6	A
148	2	48	1	3	A
149	1	49	1	3	A
150	3	49	1	1	A
151	2	49	1	11	A
152	1	50	1	3	A
153	3	50	1	12	A
154	2	50	1	7	A
155	1	51	1	6	A
156	3	51	1	13	A
157	2	51	1	4	A
158	1	52	1	8	A
159	3	52	1	4	A
160	2	52	1	14	A
161	1	53	1	10	A
162	3	53	1	9	A
163	2	53	1	2	A
164	1	54	1	5	A
165	3	54	1	13	A
166	2	54	1	4	A
167	1	55	1	3	A
168	3	55	1	10	A
169	2	55	1	10	A
170	1	56	1	2	A
171	3	56	1	6	A
172	2	56	1	12	A
173	1	57	1	8	A
174	3	57	1	5	A
175	2	57	1	5	A
176	1	58	1	4	A
177	3	58	1	3	A
178	2	58	1	1	A
179	1	59	1	1	A
180	3	59	1	1	A
181	2	59	1	12	A
182	1	60	1	9	A
183	3	60	1	5	A
184	2	60	1	10	A
185	1	61	1	5	A
186	3	61	1	4	A
187	2	61	1	3	A
188	1	62	1	9	A
189	3	62	1	4	A
190	2	62	1	4	A
191	1	63	1	1	A
192	3	63	1	14	A
193	2	63	1	13	A
194	1	64	1	2	A
195	3	64	1	10	A
196	2	64	1	2	A
197	1	65	1	6	A
198	3	65	1	5	A
199	2	65	1	12	A
200	1	66	1	10	A
201	3	66	1	12	A
202	2	66	1	6	A
203	1	67	1	2	A
204	3	67	1	4	A
205	2	67	1	11	A
206	1	68	1	5	A
207	3	68	1	13	A
208	2	68	1	8	A
209	1	69	1	7	A
210	3	69	1	14	A
211	2	69	1	5	A
212	1	70	1	8	A
213	3	70	1	4	A
214	2	70	1	8	A
215	1	71	1	6	A
216	3	71	1	14	A
217	2	71	1	2	A
218	1	72	1	6	A
219	3	72	1	2	A
220	2	72	1	12	A
221	1	73	1	9	A
222	3	73	1	9	A
223	2	73	1	4	A
224	1	74	1	5	A
225	3	74	1	7	A
226	2	74	1	14	A
227	1	75	1	10	A
228	3	75	1	15	A
229	2	75	1	8	A
230	1	76	1	5	A
231	3	76	1	4	A
232	2	76	1	5	A
233	1	77	1	10	A
234	3	77	1	14	A
235	2	77	1	6	A
236	1	78	1	5	A
237	3	78	1	2	A
238	2	78	1	11	A
239	1	79	1	5	A
240	3	79	1	11	A
241	2	79	1	15	A
242	1	80	1	10	A
243	3	80	1	4	A
244	2	80	1	11	A
245	1	81	1	1	A
246	3	81	1	10	A
247	2	81	1	12	A
248	1	82	1	4	A
249	3	82	1	6	A
250	2	82	1	7	A
251	1	83	1	3	A
252	3	83	1	3	A
253	2	83	1	8	A
254	1	84	1	6	A
255	3	84	1	2	A
256	2	84	1	7	A
257	1	85	1	6	A
258	3	85	1	10	A
259	2	85	1	11	A
260	1	86	1	3	A
261	3	86	1	8	A
262	2	86	1	9	A
263	1	87	1	3	A
264	3	87	1	8	A
265	2	87	1	11	A
266	1	88	1	6	A
267	3	88	1	15	A
268	2	88	1	1	A
269	1	89	1	2	A
270	3	89	1	15	A
271	2	89	1	13	A
272	1	90	1	2	A
273	3	90	1	11	A
274	2	90	1	1	A
275	1	91	1	3	A
276	3	91	1	7	A
277	2	91	1	9	A
278	1	92	1	9	A
279	3	92	1	9	A
280	2	92	1	3	A
281	1	93	1	1	A
282	3	93	1	7	A
283	2	93	1	1	A
284	1	94	1	9	A
285	3	94	1	10	A
286	2	94	1	8	A
287	1	95	1	3	A
288	3	95	1	10	A
289	2	95	1	10	A
290	1	96	1	2	A
291	3	96	1	1	A
292	2	96	1	9	A
293	1	97	1	1	A
294	3	97	1	9	A
295	2	97	1	13	A
296	1	98	1	10	A
297	3	98	1	2	A
298	2	98	1	1	A
299	1	99	1	4	A
300	3	99	1	3	A
301	2	99	1	6	A
302	1	100	1	7	A
303	3	100	1	14	A
304	2	100	1	9	A
305	1	101	1	7	A
306	3	101	1	14	A
307	2	101	1	2	A
308	1	102	1	3	A
309	3	102	1	5	A
310	2	102	1	6	A
311	1	103	1	2	A
312	3	103	1	4	A
313	2	103	1	3	A
314	1	104	1	1	A
315	3	104	1	10	A
316	2	104	1	2	A
317	1	105	1	5	A
318	3	105	1	10	A
319	2	105	1	3	A
320	1	106	1	3	A
321	3	106	1	12	A
322	2	106	1	10	A
323	1	107	1	3	A
324	3	107	1	15	A
325	2	107	1	7	A
326	1	108	1	6	A
327	3	108	1	3	A
328	2	108	1	10	A
329	1	109	1	3	A
330	3	109	1	6	A
331	2	109	1	8	A
332	1	110	1	8	A
333	3	110	1	15	A
334	2	110	1	8	A
335	1	111	1	2	A
336	3	111	1	3	A
337	2	111	1	1	A
338	1	112	1	5	A
339	3	112	1	1	A
340	2	112	1	10	A
341	1	113	1	2	A
342	3	113	1	12	A
343	2	113	1	8	A
344	1	114	1	4	A
345	3	114	1	2	A
346	2	114	1	12	A
347	1	115	1	2	A
348	3	115	1	5	A
349	2	115	1	2	A
350	1	116	1	9	A
351	3	116	1	10	A
352	2	116	1	15	A
353	1	117	1	1	A
354	3	117	1	4	A
355	2	117	1	15	A
356	1	118	1	6	A
357	3	118	1	14	A
358	2	118	1	6	A
359	1	119	1	10	A
360	3	119	1	10	A
366	3	121	1	14	A
367	2	121	1	8	A
368	1	122	1	9	A
369	3	122	1	3	A
370	2	122	1	1	A
371	1	123	1	3	A
372	3	123	1	13	A
373	2	123	1	14	A
374	1	124	1	3	A
375	3	124	1	6	A
376	2	124	1	3	A
377	1	125	1	7	A
378	3	125	1	13	A
379	2	125	1	8	A
380	1	126	1	7	A
381	3	126	1	3	A
382	2	126	1	5	A
383	1	127	1	4	A
384	3	127	1	4	A
385	2	127	1	11	A
386	1	128	1	4	A
387	3	128	1	11	A
388	2	128	1	3	A
389	1	129	1	1	A
390	3	129	1	1	A
391	2	129	1	10	A
392	1	130	1	6	A
393	3	130	1	15	A
394	2	130	1	12	A
395	1	131	1	8	A
396	3	131	1	8	A
397	2	131	1	8	A
398	1	132	1	9	A
399	3	132	1	14	A
400	2	132	1	15	A
401	1	133	1	2	A
402	3	133	1	15	A
403	2	133	1	9	A
404	1	134	1	6	A
405	3	134	1	1	A
406	2	134	1	15	A
407	1	135	1	4	A
408	3	135	1	10	A
409	2	135	1	5	A
410	1	136	1	2	A
411	3	136	1	9	A
412	2	136	1	4	A
413	1	137	1	6	A
414	3	137	1	11	A
415	2	137	1	3	A
416	1	138	1	6	A
417	3	138	1	6	A
418	2	138	1	10	A
419	1	139	1	2	A
420	3	139	1	10	A
421	2	139	1	9	A
422	1	140	1	9	A
423	3	140	1	8	A
424	2	140	1	6	A
425	1	141	1	5	A
426	3	141	1	5	A
427	2	141	1	12	A
428	1	142	1	3	A
429	3	142	1	11	A
430	2	142	1	4	A
431	1	143	1	9	A
432	3	143	1	5	A
433	2	143	1	4	A
434	1	144	1	5	A
435	3	144	1	7	A
436	2	144	1	14	A
437	1	145	1	2	A
438	3	145	1	10	A
439	2	145	1	5	A
440	1	146	1	10	A
441	3	146	1	12	A
442	2	146	1	14	A
443	1	147	1	6	A
444	3	147	1	3	A
445	2	147	1	6	A
446	1	148	1	3	A
447	3	148	1	4	A
448	2	148	1	11	A
738	41	2	1	1554	C
745	42	216	1	1	A
729	41	3	1	2	A
731	41	3	1	0	D
732	41	3	1	24865	E
746	42	216	1	333	B
733	42	212	1	1	A
734	42	212	1	1121	B
730	41	3	1	1221	C
735	42	213	1	1	A
736	42	213	1	100	B
737	41	2	1	2	A
739	41	2	1	0	D
740	41	2	1	24865	E
741	42	214	1	1	A
742	42	214	1	1121	B
743	42	215	1	1	A
744	42	215	1	100	B
767	42	223	1	1	A
768	42	223	1	1121	B
769	42	224	1	1	A
770	42	224	1	200	B
771	42	225	1	1	A
772	42	225	1	100	B
\.


--
-- Data for Name: molecule_value_lookup; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_lookup (lookup_id, molecule_id, table_name, id_column, code_column, label_column, maintenance_page, maintenance_description, is_tenant_specific) FROM stdin;
4	21	redemption_rule	redemption_id	redemption_code	redemption_description	\N	\N	t
5	23	tier_definition	tier_id	tier_code	tier_description	\N	\N	t
6	23	tier_definition	tier_id	tier_code	tier_description	\N	\N	t
7	30	partner	partner_id	partner_code	partner_name	\N	\N	t
8	31	partner_program	program_id	program_code	program_name	\N	\N	t
9	32	adjustment	adjustment_id	adjustment_code	adjustment_name	\N	\N	t
10	33	member_promotion	member_promotion_id	member_promotion_id	member_promotion_id	\N	\N	t
11	34	promotion	promotion_id	promotion_code	promotion_name	admin_promotions.html	Promotion values are maintained in the <a href="admin_promotions.html">Promotion Management</a> page.	t
1	1	carriers	carrier_id	code	name	admin_carriers.html	Carrier values are maintained in the <a href="admin_carriers.html">Carrier Management</a> page.	t
3	2	airports	airport_id	code	name	admin_airports.html	Airport values are maintained in the <a href="admin_airports.html">Airport Management</a> page.	f
2	3	airports	airport_id	code	name	admin_airports.html	Airport values are maintained in the <a href="admin_airports.html">Airport Management</a> page.	f
\.


--
-- Data for Name: molecule_value_numeric; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_numeric (value_id, molecule_id, numeric_value, is_active) FROM stdin;
1	8	999	t
2	9	365	t
3	10	215344290	t
\.


--
-- Data for Name: molecule_value_ref; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_ref (value_id, molecule_id, ref_id, display_label, sort_order, is_active) FROM stdin;
\.


--
-- Data for Name: molecule_value_text; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.molecule_value_text (value_id, molecule_id, text_value, display_label, sort_order, is_active) FROM stdin;
5	4	Y	Economy	3	t
6	1	AA	American Airlines	1	t
7	1	DL	Delta Air Lines	2	t
8	1	UA	United Airlines	3	t
9	4	F	First Class	1	t
10	4	c	Business Class	4	t
17	14	E002	Expiration Rule Not Found	2	t
16	14	E001	Activity too old	1	t
18	14	E003	Insufficient {{M,currency_label,value,,L}} for this Redemption	3	t
19	22	SQL_SAMPLE	cd ~/Projects/Loyalty-Demo && psql -h localhost -U billjansen -d loyalty -f sql/create_activity_display_molecule.sql	1	t
20	22	SERVER_START	~/Projects/Loyalty-Demo/bootstrap/start.sh	2	t
21	22	CREATE_HANDOFF	bash ~/Projects/Loyalty-Demo/bootstrap/NewChat/create_handoff_package.sh	3	t
23	22	DELETE_ALL	psql -h localhost -U billjansen -d loyalty -c "DELETE FROM redemption_detail; DELETE FROM activity_bonus; DELETE FROM activity_detail; DELETE FROM activity; DELETE FROM point_lot;"	4	t
24	27	AL	Alabama	1	t
25	27	AK	Alaska	2	t
26	27	AZ	Arizona	3	t
27	27	AR	Arkansas	4	t
28	27	CA	California	5	t
29	27	CO	Colorado	6	t
30	27	CT	Connecticut	7	t
31	27	DE	Delaware	8	t
32	27	DC	District of Columbia	9	t
33	27	FL	Florida	10	t
34	27	GA	Georgia	11	t
35	27	HI	Hawaii	12	t
36	27	ID	Idaho	13	t
37	27	IL	Illinois	14	t
38	27	IN	Indiana	15	t
39	27	IA	Iowa	16	t
40	27	KS	Kansas	17	t
41	27	KY	Kentucky	18	t
42	27	LA	Louisiana	19	t
43	27	ME	Maine	20	t
44	27	MD	Maryland	21	t
45	27	MA	Massachusetts	22	t
46	27	MI	Michigan	23	t
47	27	MN	Minnesota	24	t
48	27	MS	Mississippi	25	t
49	27	MO	Missouri	26	t
50	27	MT	Montana	27	t
51	27	NE	Nebraska	28	t
52	27	NV	Nevada	29	t
53	27	NH	New Hampshire	30	t
54	27	NJ	New Jersey	31	t
55	27	NM	New Mexico	32	t
56	27	NY	New York	33	t
57	27	NC	North Carolina	34	t
58	27	ND	North Dakota	35	t
59	27	OH	Ohio	36	t
60	27	OK	Oklahoma	37	t
61	27	OR	Oregon	38	t
62	27	PA	Pennsylvania	39	t
63	27	RI	Rhode Island	40	t
64	27	SC	South Carolina	41	t
65	27	SD	South Dakota	42	t
66	27	TN	Tennessee	43	t
67	27	TX	Texas	44	t
68	27	UT	Utah	45	t
69	27	VT	Vermont	46	t
70	27	VA	Virginia	47	t
71	27	WA	Washington	48	t
72	27	WV	West Virginia	49	t
73	27	WI	Wisconsin	50	t
74	27	WY	Wyoming	51	t
75	14	E004	Duplicate Origin and Destination.	4	t
15	13	Flight	\N	0	t
2	7	Kilometers	\N	0	t
1	6	Kilometer	\N	0	t
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

COPY public.point_expiration_rule (rule_key, start_date, end_date, expiration_date, description, rule_id, tenant_id) FROM stdin;
R2024	2024-01-01	2024-12-31	2026-12-31	\N	1	1
R2025	2025-01-01	2025-12-31	2027-12-31	\N	2	1
2023_RULE	2023-01-01	2023-12-31	2024-12-31	\N	3	1
2024_RULE	2024-01-01	2024-12-31	2025-12-31	\N	4	1
2025_RULE	2025-01-01	2025-12-31	2026-12-31	\N	5	1
2026_RULE	2026-01-01	2026-12-31	2027-12-31	Test	6	1
\.


--
-- Data for Name: point_type; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_type (tenant_id, point_type, name, expires_days, is_active) FROM stdin;
1	B	Base Miles	365	t
\.


--
-- Data for Name: redemption_rule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.redemption_rule (redemption_id, tenant_id, redemption_code, redemption_description, status, start_date, end_date, redemption_type, points_required) FROM stdin;
1	1	RED10K	10 K test	A	2025-01-01	2025-12-31	F	10000
\.


--
-- Data for Name: rule_criteria; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rule_criteria (criteria_id, rule_id, molecule_key, operator, value, label, joiner, sort_order) FROM stdin;
5	2	carrier	equals	"DL"	Delta test	\N	1
2	1	destination	equals	"BOS"	Fly into Boston	AND	2
11	1	member_state	equals	"MN"	Lives in Minnesota	\N	3
8	3	fare_class	equals	"F"	Fly First	\N	1
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

COPY public.x_tenant_settings (tenant_id, display_unit_singular, display_unit_plural, airline_fields) FROM stdin;
1	mile	miles	{"origin": true, "fare_class": true, "destination": true, "carrier_code": true}
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

COPY t_delta.activity_attr (activity_id, key, value_text) FROM stdin;
\.


--
-- Data for Name: airports; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.airports (iata, icao, name, city, country, lat, lon, tz, is_active) FROM stdin;
MSP	KMSP	Minneapolis–Saint Paul Intl	Minneapolis	US	44.881900	-93.221800	America/Chicago	t
LGA	KLGA	LaGuardia	New York	US	40.776900	-73.874000	America/New_York	t
ATL	KATL	Hartsfield–Jackson Atlanta Intl	Atlanta	US	33.640700	-84.427700	America/New_York	t
SEA	KSEA	Seattle–Tacoma Intl	Seattle	US	47.450200	-122.308800	America/Los_Angeles	t
LAX	KLAX	Los Angeles Intl	Los Angeles	US	33.941600	-118.408500	America/Los_Angeles	t
\.


--
-- Data for Name: airports_stage; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.airports_stage (iata, icao, name, city, country, lat, lon, tz, is_active) FROM stdin;
\.


--
-- Data for Name: attr_def; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.attr_def (attr_id, target, key, data_type, required, min_value, max_value, regex, enum_values, unit) FROM stdin;
\.


--
-- Data for Name: carriers; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.carriers (code, name, alliance, country, is_active) FROM stdin;
DL	Delta Air Lines	SkyTeam	US	t
AA	American Airlines	oneworld	US	t
UA	United Airlines	Star Alliance	US	t
BJ	Bills airline	Sky	YS	t
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

COPY t_delta.label_map (context, field_id, label, aliases, help_text) FROM stdin;
activity	origin_airport_code	Origin	["From", "Departure Airport"]	\N
activity	destination_airport_code	Destination	["To", "Arrival Airport"]	\N
\.


--
-- Data for Name: member_attr; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.member_attr (member_id, key, value_text) FROM stdin;
\.


--
-- Data for Name: theme; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.theme (theme_id, tokens, assets) FROM stdin;
1	{"bg": "#FFFFFF", "text": "#111111", "brand": "#0B5FFF", "error": "#EF4444", "muted": "#6B7280", "radius": "10px", "density": "comfy", "success": "#10B981", "surface": "#F7F7F8", "warning": "#F59E0B", "fontFamily": "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif", "brandContrast": "#FFFFFF"}	{"logoUrl": "/assets/tenants/default-logo.png", "faviconUrl": "/assets/tenants/default-favicon.ico"}
\.


--
-- Data for Name: tier_levels; Type: TABLE DATA; Schema: t_delta; Owner: -
--

COPY t_delta.tier_levels (tier_code, name, rank_order, is_active) FROM stdin;
BRONZE	Bronze	1	t
SILVER	Silver	2	t
GOLD	Gold	3	t
PLATINUM	Platinum	4	t
Green	Green tier	11	t
\.


--
-- Data for Name: activity_attr; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.activity_attr (activity_id, key, value_text) FROM stdin;
\.


--
-- Data for Name: airports; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.airports (iata, icao, name, city, country, lat, lon, tz, is_active) FROM stdin;
MSP	KMSP	Minneapolis–Saint Paul Intl	Minneapolis	US	44.881900	-93.221800	America/Chicago	t
LGA	KLGA	LaGuardia	New York	US	40.776900	-73.874000	America/New_York	t
ATL	KATL	Hartsfield–Jackson Atlanta Intl	Atlanta	US	33.640700	-84.427700	America/New_York	t
SEA	KSEA	Seattle–Tacoma Intl	Seattle	US	47.450200	-122.308800	America/Los_Angeles	t
LAX	KLAX	Los Angeles Intl	Los Angeles	US	33.941600	-118.408500	America/Los_Angeles	t
\.


--
-- Data for Name: attr_def; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.attr_def (attr_id, target, key, data_type, required, min_value, max_value, regex, enum_values, unit) FROM stdin;
\.


--
-- Data for Name: carriers; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.carriers (code, name, alliance, country, is_active) FROM stdin;
DL	Delta Air Lines	SkyTeam	US	t
AA	American Airlines	oneworld	US	t
UA	United Airlines	Star Alliance	US	t
\.


--
-- Data for Name: extensions_hooks; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.extensions_hooks (name, enabled, handler_type, handler_target, last_success_at, last_error_at, notes) FROM stdin;
\.


--
-- Data for Name: label_map; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.label_map (context, field_id, label, aliases, help_text) FROM stdin;
activity	origin_airport_code	Origin	["From", "Departure Airport"]	\N
activity	destination_airport_code	Destination	["To", "Arrival Airport"]	\N
\.


--
-- Data for Name: member_attr; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.member_attr (member_id, key, value_text) FROM stdin;
\.


--
-- Data for Name: theme; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.theme (theme_id, tokens, assets) FROM stdin;
\.


--
-- Data for Name: tier_levels; Type: TABLE DATA; Schema: t_demo; Owner: -
--

COPY t_demo.tier_levels (tier_code, name, rank_order, is_active) FROM stdin;
BRONZE	Bronze	1	t
SILVER	Silver	2	t
GOLD	Gold	3	t
PLATINUM	Platinum	4	t
\.


--
-- Name: activity_activity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_activity_id_seq', 12, true);


--
-- Name: activity_detail_list_detail_list_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_detail_list_detail_list_id_seq', 450, true);


--
-- Name: adjustment_adjustment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.adjustment_adjustment_id_seq', 7, true);


--
-- Name: airports_airport_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.airports_airport_id_seq', 2951, true);


--
-- Name: bonus_bonus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bonus_bonus_id_seq', 12, true);


--
-- Name: carriers_carrier_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.carriers_carrier_id_seq', 11, true);


--
-- Name: display_template_line_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.display_template_line_line_id_seq', 16, true);


--
-- Name: display_template_template_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.display_template_template_id_seq', 3, true);


--
-- Name: input_template_line_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.input_template_line_line_id_seq', 16, true);


--
-- Name: input_template_template_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.input_template_template_id_seq', 3, true);


--
-- Name: member_detail_2244_detail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.member_detail_2244_detail_id_seq', 14, true);


--
-- Name: member_detail_list_detail_list_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.member_detail_list_detail_list_id_seq', 1, false);


--
-- Name: member_member_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.member_member_id_seq', 15, true);


--
-- Name: member_promotion_detail_detail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.member_promotion_detail_detail_id_seq', 262, true);


--
-- Name: member_promotion_member_promotion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.member_promotion_member_promotion_id_seq', 9, true);


--
-- Name: member_tier_member_tier_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.member_tier_member_tier_id_seq', 7, true);


--
-- Name: molecule_column_def_column_def_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.molecule_column_def_column_def_id_seq', 43, true);


--
-- Name: molecule_def_molecule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.molecule_def_molecule_id_seq', 43, true);


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

SELECT pg_catalog.setval('public.molecule_value_embedded_list_embedded_value_id_seq', 126, true);


--
-- Name: molecule_value_list_new_value_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.molecule_value_list_new_value_id_seq', 776, true);


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

SELECT pg_catalog.setval('public.molecule_value_text_value_id_seq', 75, true);


--
-- Name: partner_partner_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.partner_partner_id_seq', 3, true);


--
-- Name: partner_program_program_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.partner_program_program_id_seq', 7, true);


--
-- Name: point_expiration_rule_rule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.point_expiration_rule_rule_id_seq', 6, true);


--
-- Name: promotion_promotion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.promotion_promotion_id_seq', 5, true);


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

\unrestrict RdzY693Qh8nHBVOjhLncKA3guOrg7VNYiA9PcYyGx9xdT06AcZGKGERLPfcEyfv


--
-- Sysparm sample data
--

INSERT INTO sysparm (sysparm_id, tenant_id, sysparm_key, value_type, description) VALUES
(1, 1, 'membership_number_offset', 'numeric', 'Offset added to link_tank counter for membership numbers'),
(2, 1, 'activity_display', 'text', 'Display configuration per activity type');

SELECT setval('sysparm_sysparm_id_seq', 2);

INSERT INTO sysparm_detail (detail_id, sysparm_id, category, code, value, sort_order) VALUES
-- Simple scalar: membership_number_offset
(1, 1, NULL, NULL, '2153442000', 0),
-- Embedded list: activity_display for type A (Air)
(2, 2, 'A', 'icon', '✈️', 1),
(3, 2, 'A', 'label', 'Flight', 2),
(4, 2, 'A', 'color', '#3b82f6', 3),
-- activity_display for type N (Non-Air)
(5, 2, 'N', 'icon', '🛒', 1),
(6, 2, 'N', 'label', 'Partner', 2),
(7, 2, 'N', 'color', '#10b981', 3),
-- activity_display for type R (Redemption)
(8, 2, 'R', 'icon', '🎁', 1),
(9, 2, 'R', 'label', 'Redemption', 2),
(10, 2, 'R', 'color', '#f59e0b', 3);

SELECT setval('sysparm_detail_detail_id_seq', 10);
