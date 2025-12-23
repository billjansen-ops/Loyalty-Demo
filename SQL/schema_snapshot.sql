--
-- PostgreSQL database dump
--

\restrict F1SyuyOHo3A06nFnfdI1dxAiEzRaw4kfzXZQHVGVK2qWpchDXJjUdMX7y5IlBZG

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
-- Name: t_delta; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA t_delta;


--
-- Name: t_demo; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA t_demo;


--
-- Name: app_current_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_current_tenant_id() RETURNS smallint
    LANGUAGE sql STABLE
    AS $$
  SELECT current_setting('app.tenant_id', true)::SMALLINT
$$;


--
-- Name: date_to_molecule_int(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.date_to_molecule_int(d date) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    RETURN d - DATE '1959-12-03';
END;
$$;


--
-- Name: get_member_current_tier(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_member_current_tier(p_member_id bigint) RETURNS TABLE(tier_code character varying, tier_description character varying, tier_ranking integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_member_tier_on_date(p_member_id, CURRENT_DATE);
END;
$$;


--
-- Name: get_member_tier_on_date(bigint, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_member_tier_on_date(p_member_id bigint, p_date date DEFAULT CURRENT_DATE) RETURNS TABLE(tier_code character varying, tier_description character varying, tier_ranking integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        td.tier_code,
        td.tier_description,
        td.tier_ranking
    FROM member_tier mt
    JOIN tier_definition td ON mt.tier_id = td.tier_id
    WHERE mt.member_id = p_member_id
      AND mt.start_date <= p_date
      AND (mt.end_date IS NULL OR mt.end_date >= p_date)
    ORDER BY td.tier_ranking DESC
    LIMIT 1;
END;
$$;


--
-- Name: molecule_int_to_date(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.molecule_int_to_date(n integer) RETURNS date
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    RETURN DATE '1959-12-03' + n;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity (
    activity_id bigint NOT NULL,
    activity_date date NOT NULL,
    post_date date NOT NULL,
    activity_type character(1) NOT NULL,
    link character(5),
    p_link character(5)
);


--
-- Name: activity_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_activity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_activity_id_seq OWNED BY public.activity.activity_id;


--
-- Name: activity_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_detail (
    molecule_id integer NOT NULL,
    v_ref_id bigint,
    p_link character(5)
);


--
-- Name: activity_detail_1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_detail_1 (
    p_link character(5) NOT NULL,
    molecule_id integer NOT NULL,
    c1 character(1)
);


--
-- Name: activity_detail_2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_detail_2 (
    p_link character(5) NOT NULL,
    molecule_id integer NOT NULL,
    n1 smallint
);


--
-- Name: activity_detail_3; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_detail_3 (
    p_link character(5) NOT NULL,
    molecule_id integer NOT NULL,
    c1 character(3)
);


--
-- Name: activity_detail_4; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_detail_4 (
    p_link character(5) NOT NULL,
    molecule_id integer NOT NULL,
    n1 integer
);


--
-- Name: activity_detail_5; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_detail_5 (
    p_link character(5) NOT NULL,
    molecule_id integer NOT NULL,
    c1 character(5)
);


--
-- Name: activity_detail_54; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_detail_54 (
    p_link character(5) NOT NULL,
    molecule_id integer NOT NULL,
    c1 character(5),
    n1 integer
);


--
-- Name: activity_detail_list; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_detail_list (
    detail_list_id bigint NOT NULL,
    activity_id bigint NOT NULL,
    molecule_id integer NOT NULL,
    v1 bigint,
    v2 numeric,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE activity_detail_list; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.activity_detail_list IS 'Multi-row activity relationships: points earned/redeemed, promo contributions, etc.';


--
-- Name: activity_detail_list_detail_list_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.activity_detail_list ALTER COLUMN detail_list_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.activity_detail_list_detail_list_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: adjustment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adjustment (
    adjustment_id integer NOT NULL,
    tenant_id smallint NOT NULL,
    adjustment_code character varying(20) NOT NULL,
    adjustment_name character varying(100) NOT NULL,
    adjustment_type character(1) NOT NULL,
    fixed_points integer,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT adjustment_adjustment_type_check CHECK ((adjustment_type = ANY (ARRAY['F'::bpchar, 'V'::bpchar]))),
    CONSTRAINT adjustment_fixed_points_check CHECK ((((adjustment_type = 'F'::bpchar) AND (fixed_points IS NOT NULL) AND (fixed_points > 0)) OR ((adjustment_type = 'V'::bpchar) AND (fixed_points IS NULL))))
);


--
-- Name: TABLE adjustment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.adjustment IS 'Manual point adjustments for customer service and corrections';


--
-- Name: COLUMN adjustment.adjustment_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.adjustment.adjustment_type IS 'F=Fixed amount, V=Variable amount entered by CSR';


--
-- Name: COLUMN adjustment.fixed_points; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.adjustment.fixed_points IS 'Preset points for Fixed type adjustments';


--
-- Name: adjustment_adjustment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.adjustment_adjustment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: adjustment_adjustment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.adjustment_adjustment_id_seq OWNED BY public.adjustment.adjustment_id;


--
-- Name: airports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.airports (
    airport_id integer NOT NULL,
    code character varying(3) NOT NULL,
    name character varying(255) NOT NULL,
    city character varying(100),
    country character varying(100),
    is_active boolean DEFAULT true,
    lat numeric(9,6),
    long numeric(9,6)
);


--
-- Name: airports_airport_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.airports_airport_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: airports_airport_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.airports_airport_id_seq OWNED BY public.airports.airport_id;


--
-- Name: bonus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bonus (
    bonus_id integer NOT NULL,
    bonus_code character varying(10) NOT NULL,
    bonus_description character varying(30) NOT NULL,
    start_date date NOT NULL,
    end_date date,
    is_active boolean DEFAULT true,
    bonus_type character varying(10) NOT NULL,
    bonus_amount integer NOT NULL,
    rule_id integer,
    tenant_id smallint NOT NULL,
    apply_sunday boolean DEFAULT true NOT NULL,
    apply_monday boolean DEFAULT true NOT NULL,
    apply_tuesday boolean DEFAULT true NOT NULL,
    apply_wednesday boolean DEFAULT true NOT NULL,
    apply_thursday boolean DEFAULT true NOT NULL,
    apply_friday boolean DEFAULT true NOT NULL,
    apply_saturday boolean DEFAULT true NOT NULL,
    required_tier_id integer,
    CONSTRAINT bonus_bonus_type_check CHECK (((bonus_type)::text = ANY (ARRAY[('fixed'::character varying)::text, ('percent'::character varying)::text])))
);


--
-- Name: TABLE bonus; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bonus IS 'Defines bonus rules for earning extra miles/points';


--
-- Name: COLUMN bonus.bonus_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bonus.bonus_code IS 'Unique code identifier (e.g., GOLD_10PCT, DBL_MILES)';


--
-- Name: COLUMN bonus.bonus_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bonus.bonus_description IS 'Human-readable description shown to members';


--
-- Name: COLUMN bonus.bonus_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bonus.bonus_type IS 'fixed = flat amount, percent = percentage of base';


--
-- Name: COLUMN bonus.bonus_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bonus.bonus_amount IS 'If percent: 10 = 10%. If fixed: 500 = 500 miles';


--
-- Name: bonus_bonus_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bonus_bonus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bonus_bonus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bonus_bonus_id_seq OWNED BY public.bonus.bonus_id;


--
-- Name: carriers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carriers (
    carrier_id integer NOT NULL,
    code character varying(3) NOT NULL,
    name character varying(255) NOT NULL,
    alliance character varying(50),
    country character varying(100),
    is_active boolean DEFAULT true,
    tenant_id smallint NOT NULL
);


--
-- Name: carriers_carrier_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.carriers_carrier_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: carriers_carrier_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carriers_carrier_id_seq OWNED BY public.carriers.carrier_id;


--
-- Name: display_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.display_template (
    template_id integer NOT NULL,
    tenant_id smallint NOT NULL,
    template_name character varying(100) NOT NULL,
    template_type character(1) NOT NULL,
    is_active boolean DEFAULT false,
    activity_type character(1) DEFAULT 'A'::bpchar NOT NULL,
    CONSTRAINT display_template_template_type_check CHECK ((template_type = ANY (ARRAY['V'::bpchar, 'E'::bpchar])))
);


--
-- Name: TABLE display_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.display_template IS 'Activity Display Templates - defines how activities display in CSR pages';


--
-- Name: COLUMN display_template.template_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.display_template.template_type IS 'V=Verbose, E=Efficient (from display_template_type molecule)';


--
-- Name: COLUMN display_template.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.display_template.is_active IS 'Only 1 active V and 1 active E allowed per tenant (enforced in code)';


--
-- Name: COLUMN display_template.activity_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.display_template.activity_type IS 'Activity type this template applies to - valid values from activity_display molecule categories';


--
-- Name: display_template_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.display_template_line (
    line_id integer NOT NULL,
    template_id integer NOT NULL,
    line_number integer NOT NULL,
    template_string text NOT NULL
);


--
-- Name: TABLE display_template_line; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.display_template_line IS 'Individual lines within a display template';


--
-- Name: COLUMN display_template_line.line_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.display_template_line.line_number IS 'Order of lines (10, 20, 30...) - used for display ordering';


--
-- Name: COLUMN display_template_line.template_string; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.display_template_line.template_string IS 'Template syntax: [M,molecule_key,"format",max_length],[T,"text"]';


--
-- Name: display_template_line_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.display_template_line_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: display_template_line_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.display_template_line_line_id_seq OWNED BY public.display_template_line.line_id;


--
-- Name: display_template_template_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.display_template_template_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: display_template_template_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.display_template_template_id_seq OWNED BY public.display_template.template_id;


--
-- Name: input_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.input_template (
    template_id integer NOT NULL,
    tenant_id smallint NOT NULL,
    template_name character varying(100) NOT NULL,
    activity_type character(1) NOT NULL,
    is_active boolean DEFAULT false,
    CONSTRAINT input_template_activity_type_check CHECK ((activity_type = ANY (ARRAY['A'::bpchar, 'R'::bpchar, 'P'::bpchar, 'J'::bpchar, 'M'::bpchar, 'N'::bpchar])))
);


--
-- Name: TABLE input_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.input_template IS 'Activity Input Templates - defines how activity entry forms are built';


--
-- Name: COLUMN input_template.activity_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.input_template.activity_type IS 'A=Flight, R=Redemption, P=Partner, J=Adjustment';


--
-- Name: input_template_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.input_template_line (
    line_id integer NOT NULL,
    template_id integer NOT NULL,
    line_number integer NOT NULL,
    template_string text NOT NULL
);


--
-- Name: TABLE input_template_line; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.input_template_line IS 'Individual rows within an input template';


--
-- Name: COLUMN input_template_line.line_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.input_template_line.line_number IS 'Order of rows (10, 20, 30...) - used for form layout';


--
-- Name: COLUMN input_template_line.template_string; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.input_template_line.template_string IS 'Template syntax: [M,molecule_key,"width",R/O] or [T,"Section Label"]';


--
-- Name: input_template_line_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.input_template_line ALTER COLUMN line_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.input_template_line_line_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: input_template_template_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.input_template ALTER COLUMN template_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.input_template_template_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: link_tank; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_tank (
    tenant_id smallint NOT NULL,
    table_key character varying(30) NOT NULL,
    link_bytes smallint NOT NULL,
    next_link bigint NOT NULL
);


--
-- Name: TABLE link_tank; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.link_tank IS 'Central registry managing all primary keys with right-sized storage (per tenant)';


--
-- Name: member_member_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.member_member_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member (
    member_id bigint DEFAULT nextval('public.member_member_id_seq'::regclass) NOT NULL,
    tenant_id smallint NOT NULL,
    fname character varying(50),
    lname character varying(50),
    middle_initial character(1),
    address1 character varying(100),
    address2 character varying(100),
    city character varying(50),
    state character(2),
    zip character(5),
    phone character varying(20),
    email character varying(100),
    is_active boolean DEFAULT true,
    membership_number character varying(16),
    zip_plus4 character(4),
    link character(5)
);


--
-- Name: COLUMN member.fname; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member.fname IS 'Member first name';


--
-- Name: COLUMN member.lname; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member.lname IS 'Member last name';


--
-- Name: COLUMN member.middle_initial; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member.middle_initial IS 'Member middle initial';


--
-- Name: COLUMN member.phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member.phone IS 'Member phone number';


--
-- Name: COLUMN member.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member.email IS 'Member email address';


--
-- Name: COLUMN member.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member.is_active IS 'Whether member account is active';


--
-- Name: member_detail_1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_detail_1 (
    p_link character(5) NOT NULL,
    molecule_id integer NOT NULL,
    c1 character(1)
);


--
-- Name: member_detail_2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_detail_2 (
    p_link character(5) NOT NULL,
    molecule_id integer NOT NULL,
    n1 smallint
);


--
-- Name: member_detail_2244_detail_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.member_detail_2244_detail_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: member_detail_2244; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_detail_2244 (
    p_link character(5) NOT NULL,
    molecule_id integer NOT NULL,
    n1 smallint,
    n2 smallint,
    n3 integer,
    n4 integer,
    detail_id bigint DEFAULT nextval('public.member_detail_2244_detail_id_seq'::regclass) NOT NULL
);


--
-- Name: member_detail_3; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_detail_3 (
    p_link character(5) NOT NULL,
    molecule_id integer NOT NULL,
    c1 character(3)
);


--
-- Name: member_detail_4; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_detail_4 (
    p_link character(5) NOT NULL,
    molecule_id integer NOT NULL,
    n1 integer
);


--
-- Name: member_detail_5; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_detail_5 (
    p_link character(5) NOT NULL,
    molecule_id integer NOT NULL,
    c1 character(5)
);


--
-- Name: member_detail_list; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_detail_list (
    detail_list_id bigint NOT NULL,
    member_id bigint NOT NULL,
    molecule_id integer NOT NULL,
    v1 bigint,
    v2 bigint,
    v3 numeric,
    v4 numeric,
    v5 date,
    v6 date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE member_detail_list; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.member_detail_list IS 'Multi-row member state: point buckets, promo enrollments, tier status, etc.';


--
-- Name: member_detail_list_detail_list_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.member_detail_list ALTER COLUMN detail_list_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.member_detail_list_detail_list_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: member_promotion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_promotion (
    member_promotion_id bigint NOT NULL,
    member_id bigint NOT NULL,
    promotion_id integer NOT NULL,
    tenant_id smallint NOT NULL,
    enrolled_date date NOT NULL,
    qualify_date date,
    process_date date,
    progress_counter numeric DEFAULT 0 NOT NULL,
    enrolled_by_user_id integer,
    qualified_by_user_id integer,
    goal_amount numeric DEFAULT 0 NOT NULL,
    qualified_by_promotion_id integer,
    link character(5),
    p_link character(5),
    CONSTRAINT valid_member_promotion_dates CHECK ((((qualify_date IS NULL) OR (qualify_date >= enrolled_date)) AND ((process_date IS NULL) OR (process_date >= enrolled_date))))
);


--
-- Name: TABLE member_promotion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.member_promotion IS 'Individual member enrollment and progress tracking for promotions';


--
-- Name: COLUMN member_promotion.enrolled_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member_promotion.enrolled_date IS 'When member joined promotion (auto or manual)';


--
-- Name: COLUMN member_promotion.qualify_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member_promotion.qualify_date IS 'When member reached goal (progress_counter >= goal_amount)';


--
-- Name: COLUMN member_promotion.process_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member_promotion.process_date IS 'When reward was delivered/fulfilled';


--
-- Name: COLUMN member_promotion.progress_counter; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member_promotion.progress_counter IS 'Current progress toward goal (flights count, miles sum, etc.)';


--
-- Name: COLUMN member_promotion.enrolled_by_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member_promotion.enrolled_by_user_id IS 'CSR who manually enrolled (NULL=auto-enroll)';


--
-- Name: COLUMN member_promotion.qualified_by_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member_promotion.qualified_by_user_id IS 'CSR who manually qualified (NULL=auto-qualify)';


--
-- Name: COLUMN member_promotion.goal_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member_promotion.goal_amount IS 'Goal amount locked in at enrollment time. Copied from promotion.goal_amount when member enrolls. Prevents retroactive changes if promotion rule is modified.';


--
-- Name: COLUMN member_promotion.qualified_by_promotion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member_promotion.qualified_by_promotion_id IS 'Tracks which promotion actually earned the tier reward. NULL = this promotion earned it. 
   Non-NULL = courtesy qualified via cascade from another promotion.';


--
-- Name: member_promotion_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_promotion_detail (
    detail_id bigint NOT NULL,
    member_promotion_id bigint NOT NULL,
    contribution_amount numeric NOT NULL,
    enrolled_member_id bigint,
    p_link character(5),
    activity_link character(5),
    CONSTRAINT valid_promotion_detail_link CHECK ((((activity_link IS NOT NULL) AND (enrolled_member_id IS NULL)) OR ((activity_link IS NULL) AND (enrolled_member_id IS NOT NULL))))
);


--
-- Name: TABLE member_promotion_detail; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.member_promotion_detail IS 'Attribution linking activities to promotions with contribution amounts';


--
-- Name: COLUMN member_promotion_detail.contribution_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member_promotion_detail.contribution_amount IS 'How much this activity/enrollment contributed to progress';


--
-- Name: COLUMN member_promotion_detail.enrolled_member_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member_promotion_detail.enrolled_member_id IS 'For referral counting: who was enrolled (NULL for activity counting)';


--
-- Name: member_promotion_detail_detail_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.member_promotion_detail ALTER COLUMN detail_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.member_promotion_detail_detail_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: member_promotion_member_promotion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.member_promotion ALTER COLUMN member_promotion_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.member_promotion_member_promotion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: member_tier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_tier (
    member_tier_id integer NOT NULL,
    member_id bigint NOT NULL,
    tier_id integer NOT NULL,
    start_date date NOT NULL,
    end_date date,
    p_link character(5),
    CONSTRAINT valid_date_range CHECK (((end_date IS NULL) OR (end_date >= start_date)))
);


--
-- Name: member_tier_member_tier_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.member_tier_member_tier_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: member_tier_member_tier_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.member_tier_member_tier_id_seq OWNED BY public.member_tier.member_tier_id;


--
-- Name: molecule_column_def; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.molecule_column_def (
    column_def_id integer NOT NULL,
    molecule_id integer NOT NULL,
    column_name character varying(10) NOT NULL,
    column_type character varying(20) NOT NULL,
    column_order smallint NOT NULL,
    description character varying(255)
);


--
-- Name: TABLE molecule_column_def; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.molecule_column_def IS 'Defines the meaning of generic columns (v1-v6) for dynamic_list molecules';


--
-- Name: COLUMN molecule_column_def.column_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_column_def.column_name IS 'Which generic column: v1, v2, v3, v4, v5, or v6';


--
-- Name: COLUMN molecule_column_def.column_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_column_def.column_type IS 'Data type: ref (BIGINT pointer), numeric, date, text';


--
-- Name: molecule_column_def_column_def_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.molecule_column_def ALTER COLUMN column_def_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.molecule_column_def_column_def_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: molecule_def; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.molecule_def (
    molecule_key text NOT NULL,
    label text NOT NULL,
    value_kind text,
    scalar_type text,
    lookup_table_key text,
    tenant_id smallint NOT NULL,
    context text NOT NULL,
    is_static boolean DEFAULT false,
    is_permanent boolean DEFAULT false,
    is_required boolean DEFAULT false,
    is_active boolean DEFAULT true,
    foreign_schema text,
    description text,
    display_order integer DEFAULT 0,
    molecule_id integer NOT NULL,
    sample_code character varying(50),
    sample_description character varying(255),
    decimal_places smallint DEFAULT 0,
    ref_table_name text,
    ref_field_name text,
    ref_function_name text,
    parent_molecule_key character varying(50),
    parent_fk_field character varying(50),
    can_be_promotion_counter boolean DEFAULT false NOT NULL,
    display_width smallint,
    list_context character varying(20),
    system_required boolean DEFAULT false,
    input_type character(1) DEFAULT 'P'::bpchar,
    molecule_type character(1) DEFAULT 'D'::bpchar,
    value_structure character varying(20) DEFAULT 'single'::character varying,
    storage_size smallint,
    value_type character varying(10)
);


--
-- Name: COLUMN molecule_def.decimal_places; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_def.decimal_places IS 'Number of decimal places for numeric molecules (0 for integers, 2 for currency, etc.)';


--
-- Name: COLUMN molecule_def.ref_table_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_def.ref_table_name IS 'For reference/direct_field: table to query (e.g., member, activity)';


--
-- Name: COLUMN molecule_def.ref_field_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_def.ref_field_name IS 'For reference/direct_field: field to retrieve (e.g., fname, activity_date)';


--
-- Name: COLUMN molecule_def.ref_function_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_def.ref_function_name IS 'For reference/function: stored function to call (e.g., get_member_tier_on_date)';


--
-- Name: COLUMN molecule_def.parent_molecule_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_def.parent_molecule_key IS 'For hierarchical molecules: key of parent molecule (e.g., partner_program has parent partner)';


--
-- Name: COLUMN molecule_def.parent_fk_field; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_def.parent_fk_field IS 'For hierarchical molecules: foreign key field name in lookup table (e.g., partner_id)';


--
-- Name: COLUMN molecule_def.can_be_promotion_counter; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_def.can_be_promotion_counter IS 'Indicates if this numeric molecule can be summed for promotion goals (e.g., MQD=true, flight_number=false)';


--
-- Name: COLUMN molecule_def.display_width; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_def.display_width IS 'Width in bytes for input fields. NULL uses default.';


--
-- Name: COLUMN molecule_def.list_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_def.list_context IS 'For dynamic_list: member or activity (which detail_list table stores the data)';


--
-- Name: COLUMN molecule_def.system_required; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_def.system_required IS 'Core platform molecule - cannot be deleted';


--
-- Name: COLUMN molecule_def.molecule_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_def.molecule_type IS 'S=Static (tenant level), D=Dynamic (per activity/member), R=Reference (query on demand)';


--
-- Name: COLUMN molecule_def.value_structure; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_def.value_structure IS 'single=one value, embedded=multi-row with columns, NULL for reference';


--
-- Name: molecule_def_molecule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.molecule_def_molecule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: molecule_def_molecule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.molecule_def_molecule_id_seq OWNED BY public.molecule_def.molecule_id;


--
-- Name: molecule_text_pool; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.molecule_text_pool (
    text_id integer NOT NULL,
    text_value character varying(1000) NOT NULL,
    usage_count integer DEFAULT 1,
    first_used timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE molecule_text_pool; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.molecule_text_pool IS 'Deduplicated text storage pool for text-type molecules';


--
-- Name: COLUMN molecule_text_pool.text_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_text_pool.text_id IS 'Integer ID stored in child records - keeps records pure integers';


--
-- Name: COLUMN molecule_text_pool.text_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_text_pool.text_value IS 'Actual text value (max 1000 chars, database-portable)';


--
-- Name: COLUMN molecule_text_pool.usage_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_text_pool.usage_count IS 'Number of times this text is referenced - for analytics';


--
-- Name: COLUMN molecule_text_pool.first_used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_text_pool.first_used IS 'When this text value was first stored';


--
-- Name: molecule_text_pool_text_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.molecule_text_pool_text_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: molecule_text_pool_text_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.molecule_text_pool_text_id_seq OWNED BY public.molecule_text_pool.text_id;


--
-- Name: molecule_value_boolean; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.molecule_value_boolean (
    value_id integer NOT NULL,
    molecule_id integer NOT NULL,
    bool_value boolean NOT NULL,
    is_active boolean DEFAULT true
);


--
-- Name: molecule_value_boolean_value_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.molecule_value_boolean_value_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: molecule_value_boolean_value_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.molecule_value_boolean_value_id_seq OWNED BY public.molecule_value_boolean.value_id;


--
-- Name: molecule_value_date; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.molecule_value_date (
    value_id integer NOT NULL,
    molecule_id integer NOT NULL,
    date_value date NOT NULL,
    is_active boolean DEFAULT true
);


--
-- Name: molecule_value_date_value_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.molecule_value_date_value_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: molecule_value_date_value_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.molecule_value_date_value_id_seq OWNED BY public.molecule_value_date.value_id;


--
-- Name: molecule_value_embedded_list; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.molecule_value_embedded_list (
    embedded_value_id integer NOT NULL,
    molecule_id integer NOT NULL,
    tenant_id smallint NOT NULL,
    category character varying(50) NOT NULL,
    code character varying(50) NOT NULL,
    description text NOT NULL,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true
);


--
-- Name: TABLE molecule_value_embedded_list; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.molecule_value_embedded_list IS 'Storage for embedded list molecules - categorized lists within a single molecule (e.g., system parameters with multiple subcategories)';


--
-- Name: COLUMN molecule_value_embedded_list.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_value_embedded_list.category IS 'Subcategory key within the molecule (e.g., redemption_type, activity_type)';


--
-- Name: COLUMN molecule_value_embedded_list.code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_value_embedded_list.code IS 'Short code for the value (e.g., F, V, A, P, R, X)';


--
-- Name: COLUMN molecule_value_embedded_list.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_value_embedded_list.description IS 'Human-readable description of the value';


--
-- Name: COLUMN molecule_value_embedded_list.sort_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_value_embedded_list.sort_order IS 'Display order for UI dropdowns and lists';


--
-- Name: molecule_value_embedded_list_embedded_value_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.molecule_value_embedded_list_embedded_value_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: molecule_value_embedded_list_embedded_value_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.molecule_value_embedded_list_embedded_value_id_seq OWNED BY public.molecule_value_embedded_list.embedded_value_id;


--
-- Name: molecule_value_list; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.molecule_value_list (
    value_id bigint NOT NULL,
    molecule_id integer NOT NULL,
    context_id bigint NOT NULL,
    row_num integer DEFAULT 1 NOT NULL,
    value bigint,
    col character(1) NOT NULL
);


--
-- Name: molecule_value_list_new_value_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.molecule_value_list_new_value_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: molecule_value_list_new_value_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.molecule_value_list_new_value_id_seq OWNED BY public.molecule_value_list.value_id;


--
-- Name: molecule_value_lookup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.molecule_value_lookup (
    lookup_id integer NOT NULL,
    molecule_id integer NOT NULL,
    table_name text NOT NULL,
    id_column text NOT NULL,
    code_column text NOT NULL,
    label_column text NOT NULL,
    maintenance_page text,
    maintenance_description text,
    is_tenant_specific boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE molecule_value_lookup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.molecule_value_lookup IS 'Configuration for molecules that reference external lookup tables';


--
-- Name: COLUMN molecule_value_lookup.table_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_value_lookup.table_name IS 'Name of the external table (e.g., carriers, airports)';


--
-- Name: COLUMN molecule_value_lookup.id_column; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_value_lookup.id_column IS 'Primary key column name in external table (e.g., carrier_id)';


--
-- Name: COLUMN molecule_value_lookup.code_column; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_value_lookup.code_column IS 'Code/key column name (e.g., code)';


--
-- Name: COLUMN molecule_value_lookup.label_column; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_value_lookup.label_column IS 'Display label column name (e.g., name)';


--
-- Name: COLUMN molecule_value_lookup.maintenance_page; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_value_lookup.maintenance_page IS 'URL to maintenance page (e.g., admin_carriers.html)';


--
-- Name: COLUMN molecule_value_lookup.maintenance_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_value_lookup.maintenance_description IS 'Text to display to user about where to maintain values';


--
-- Name: COLUMN molecule_value_lookup.is_tenant_specific; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.molecule_value_lookup.is_tenant_specific IS 'TRUE if lookup table has tenant_id column (e.g., carriers). FALSE if global shared data (e.g., airports)';


--
-- Name: molecule_value_lookup_lookup_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.molecule_value_lookup_lookup_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: molecule_value_lookup_lookup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.molecule_value_lookup_lookup_id_seq OWNED BY public.molecule_value_lookup.lookup_id;


--
-- Name: molecule_value_numeric; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.molecule_value_numeric (
    value_id integer NOT NULL,
    molecule_id integer NOT NULL,
    numeric_value numeric NOT NULL,
    is_active boolean DEFAULT true
);


--
-- Name: molecule_value_numeric_value_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.molecule_value_numeric_value_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: molecule_value_numeric_value_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.molecule_value_numeric_value_id_seq OWNED BY public.molecule_value_numeric.value_id;


--
-- Name: molecule_value_ref; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.molecule_value_ref (
    value_id integer NOT NULL,
    molecule_id integer NOT NULL,
    ref_id bigint NOT NULL,
    display_label text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true
);


--
-- Name: molecule_value_ref_value_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.molecule_value_ref_value_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: molecule_value_ref_value_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.molecule_value_ref_value_id_seq OWNED BY public.molecule_value_ref.value_id;


--
-- Name: molecule_value_text; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.molecule_value_text (
    value_id integer NOT NULL,
    molecule_id integer NOT NULL,
    text_value text NOT NULL,
    display_label text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true
);


--
-- Name: molecule_value_text_value_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.molecule_value_text_value_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: molecule_value_text_value_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.molecule_value_text_value_id_seq OWNED BY public.molecule_value_text.value_id;


--
-- Name: partner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner (
    partner_id integer NOT NULL,
    tenant_id smallint NOT NULL,
    partner_code character varying(20) NOT NULL,
    partner_name character varying(100) NOT NULL,
    is_active boolean DEFAULT true
);


--
-- Name: partner_partner_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.partner ALTER COLUMN partner_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.partner_partner_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: partner_program; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_program (
    program_id integer NOT NULL,
    partner_id integer NOT NULL,
    tenant_id smallint NOT NULL,
    program_code character varying(20) NOT NULL,
    program_name character varying(100) NOT NULL,
    earning_type character(1) NOT NULL,
    fixed_points bigint,
    is_active boolean DEFAULT true,
    CONSTRAINT chk_fixed_points CHECK ((((earning_type = 'F'::bpchar) AND (fixed_points IS NOT NULL)) OR ((earning_type = 'V'::bpchar) AND (fixed_points IS NULL)))),
    CONSTRAINT partner_program_earning_type_check CHECK ((earning_type = ANY (ARRAY['F'::bpchar, 'V'::bpchar])))
);


--
-- Name: partner_program_program_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.partner_program ALTER COLUMN program_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.partner_program_program_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: point_expiration_rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_expiration_rule (
    rule_key text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    expiration_date date NOT NULL,
    description character varying(30),
    rule_id integer NOT NULL,
    tenant_id integer NOT NULL
);


--
-- Name: point_expiration_rule_rule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.point_expiration_rule_rule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: point_expiration_rule_rule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.point_expiration_rule_rule_id_seq OWNED BY public.point_expiration_rule.rule_id;


--
-- Name: point_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_type (
    tenant_id smallint NOT NULL,
    point_type text NOT NULL,
    name text NOT NULL,
    expires_days integer,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: promotion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion (
    promotion_id integer NOT NULL,
    tenant_id smallint NOT NULL,
    promotion_code character varying(20) NOT NULL,
    promotion_name character varying(100) NOT NULL,
    promotion_description text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    enrollment_type character(1) NOT NULL,
    allow_member_enrollment boolean DEFAULT false NOT NULL,
    rule_id integer,
    count_type character varying(20) NOT NULL,
    goal_amount numeric NOT NULL,
    reward_type character varying(30) NOT NULL,
    reward_amount bigint,
    reward_tier_id integer,
    reward_promotion_id integer,
    process_limit_count integer,
    duration_type character varying(10),
    duration_end_date date,
    duration_days integer,
    counter_molecule_id integer,
    CONSTRAINT promotion_check CHECK (((((reward_type)::text = 'points'::text) AND (reward_amount > 0)) OR (((reward_type)::text <> 'points'::text) AND (reward_amount IS NULL)))),
    CONSTRAINT promotion_count_type_check CHECK (((count_type)::text = ANY (ARRAY[('flights'::character varying)::text, ('miles'::character varying)::text, ('enrollments'::character varying)::text, ('molecules'::character varying)::text]))),
    CONSTRAINT promotion_duration_days_check CHECK (((duration_days IS NULL) OR (duration_days > 0))),
    CONSTRAINT promotion_duration_type_check CHECK (((duration_type IS NULL) OR ((duration_type)::text = ANY (ARRAY[('calendar'::character varying)::text, ('virtual'::character varying)::text])))),
    CONSTRAINT promotion_enrollment_type_check CHECK ((enrollment_type = ANY (ARRAY['A'::bpchar, 'R'::bpchar]))),
    CONSTRAINT promotion_goal_amount_check CHECK ((goal_amount > (0)::numeric)),
    CONSTRAINT promotion_molecule_counter_required CHECK (((((count_type)::text = 'molecules'::text) AND (counter_molecule_id IS NOT NULL)) OR (((count_type)::text <> 'molecules'::text) AND (counter_molecule_id IS NULL)))),
    CONSTRAINT promotion_process_limit_count_check CHECK (((process_limit_count IS NULL) OR (process_limit_count > 0))),
    CONSTRAINT promotion_reward_type_check CHECK (((reward_type)::text = ANY (ARRAY[('points'::character varying)::text, ('tier'::character varying)::text, ('external'::character varying)::text, ('enroll_promotion'::character varying)::text]))),
    CONSTRAINT valid_duration_config CHECK (((((duration_type)::text = 'calendar'::text) AND (duration_end_date IS NOT NULL) AND (duration_days IS NULL)) OR (((duration_type)::text = 'virtual'::text) AND (duration_days IS NOT NULL) AND (duration_end_date IS NULL)) OR ((duration_type IS NULL) AND (duration_end_date IS NULL) AND (duration_days IS NULL)))),
    CONSTRAINT valid_enroll_promotion_reward CHECK (((((reward_type)::text = 'enroll_promotion'::text) AND (reward_promotion_id IS NOT NULL)) OR (((reward_type)::text <> 'enroll_promotion'::text) AND (reward_promotion_id IS NULL)))),
    CONSTRAINT valid_tier_reward CHECK (((((reward_type)::text = 'tier'::text) AND (reward_tier_id IS NOT NULL) AND (duration_type IS NOT NULL)) OR (((reward_type)::text <> 'tier'::text) AND (reward_tier_id IS NULL))))
);


--
-- Name: TABLE promotion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.promotion IS 'Promotion campaigns with multi-activity goals and various reward types';


--
-- Name: COLUMN promotion.enrollment_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.promotion.enrollment_type IS 'A=Auto-enroll on first qualifying activity, R=Restricted (manual/raise-hand only)';


--
-- Name: COLUMN promotion.allow_member_enrollment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.promotion.allow_member_enrollment IS 'For restricted promotions: allow member self-enrollment (raise your hand)';


--
-- Name: COLUMN promotion.count_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.promotion.count_type IS 'What to count: flights (activity count), miles (points), enrollments (referrals), mqd (revenue)';


--
-- Name: COLUMN promotion.reward_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.promotion.reward_type IS 'What member gets: points (activity M), tier (member_tier), external (certificate), enroll_promotion (unlock next)';


--
-- Name: COLUMN promotion.process_limit_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.promotion.process_limit_count IS 'Max times member can complete (NULL=unlimited, supports carryover)';


--
-- Name: COLUMN promotion.duration_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.promotion.duration_type IS 'For tier rewards: calendar (fixed end date) or virtual (days from qualify)';


--
-- Name: COLUMN promotion.counter_molecule_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.promotion.counter_molecule_id IS 'FK to molecule_def.molecule_id - specifies which molecule to count when count_type=''molecules''';


--
-- Name: promotion_promotion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.promotion ALTER COLUMN promotion_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.promotion_promotion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: redemption_rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redemption_rule (
    redemption_id integer NOT NULL,
    tenant_id smallint NOT NULL,
    redemption_code character varying(20) NOT NULL,
    redemption_description text NOT NULL,
    status character(1) DEFAULT 'A'::bpchar NOT NULL,
    start_date date NOT NULL,
    end_date date,
    redemption_type character(1) NOT NULL,
    points_required integer NOT NULL
);


--
-- Name: TABLE redemption_rule; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.redemption_rule IS 'Redemption catalog defining fixed and variable point redemptions available to members';


--
-- Name: COLUMN redemption_rule.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.redemption_rule.status IS 'Redemption status. Valid values: getMoleculeValues(tenantId, ''sysparm'', ''redemption_status'')';


--
-- Name: COLUMN redemption_rule.start_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.redemption_rule.start_date IS 'Date when redemption becomes available';


--
-- Name: COLUMN redemption_rule.end_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.redemption_rule.end_date IS 'Date when redemption expires (NULL = no expiration)';


--
-- Name: COLUMN redemption_rule.redemption_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.redemption_rule.redemption_type IS 'Redemption points type: F=Fixed points, V=Variable points. Valid values: getMoleculeValues(tenantId, ''sysparm'', ''redemption_type'')';


--
-- Name: COLUMN redemption_rule.points_required; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.redemption_rule.points_required IS 'Points required for redemption (fixed amount for type F, base/minimum for type V)';


--
-- Name: redemption_rule_redemption_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redemption_rule_redemption_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redemption_rule_redemption_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redemption_rule_redemption_id_seq OWNED BY public.redemption_rule.redemption_id;


--
-- Name: rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rule (
    rule_id integer NOT NULL
);


--
-- Name: rule_criteria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rule_criteria (
    criteria_id integer NOT NULL,
    rule_id integer,
    molecule_key text NOT NULL,
    operator text NOT NULL,
    value jsonb NOT NULL,
    label text NOT NULL,
    joiner text,
    sort_order integer DEFAULT 0
);


--
-- Name: rule_criteria_criteria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rule_criteria_criteria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rule_criteria_criteria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rule_criteria_criteria_id_seq OWNED BY public.rule_criteria.criteria_id;


--
-- Name: rule_rule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rule_rule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rule_rule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rule_rule_id_seq OWNED BY public.rule.rule_id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value text NOT NULL
);


--
-- Name: tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant (
    tenant_id smallint NOT NULL,
    tenant_key text NOT NULL,
    name text NOT NULL,
    industry text DEFAULT 'airline'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: tenant_tenant_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_tenant_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_tenant_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_tenant_id_seq OWNED BY public.tenant.tenant_id;


--
-- Name: tier_definition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tier_definition (
    tier_id integer NOT NULL,
    tier_code character varying(10) NOT NULL,
    tier_description character varying(30) NOT NULL,
    tier_ranking integer NOT NULL,
    is_active boolean DEFAULT true,
    tenant_id smallint NOT NULL
);


--
-- Name: tier_definition_tier_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tier_definition_tier_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tier_definition_tier_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tier_definition_tier_id_seq OWNED BY public.tier_definition.tier_id;


--
-- Name: x_tenant_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x_tenant_settings (
    tenant_id smallint NOT NULL,
    display_unit_singular text DEFAULT 'mile'::text NOT NULL,
    display_unit_plural text DEFAULT 'miles'::text NOT NULL,
    airline_fields jsonb DEFAULT jsonb_build_object('carrier_code', true, 'origin', true, 'destination', true, 'fare_class', true) NOT NULL
);


--
-- Name: x_tenant_terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x_tenant_terms (
    tenant_id smallint NOT NULL,
    term_key text NOT NULL,
    term_value text NOT NULL
);


--
-- Name: activity_attr; Type: TABLE; Schema: t_delta; Owner: -
--

CREATE TABLE t_delta.activity_attr (
    activity_id bigint NOT NULL,
    key text NOT NULL,
    value_text text NOT NULL
);


--
-- Name: airports; Type: TABLE; Schema: t_delta; Owner: -
--

CREATE TABLE t_delta.airports (
    iata text NOT NULL,
    icao text,
    name text NOT NULL,
    city text,
    country text,
    lat numeric(9,6),
    lon numeric(9,6),
    tz text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: airports_stage; Type: TABLE; Schema: t_delta; Owner: -
--

CREATE TABLE t_delta.airports_stage (
    iata text NOT NULL,
    icao text,
    name text NOT NULL,
    city text,
    country text,
    lat numeric(9,6),
    lon numeric(9,6),
    tz text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: attr_def; Type: TABLE; Schema: t_delta; Owner: -
--

CREATE TABLE t_delta.attr_def (
    attr_id bigint NOT NULL,
    target text NOT NULL,
    key text NOT NULL,
    data_type text NOT NULL,
    required boolean DEFAULT false NOT NULL,
    min_value numeric(18,6),
    max_value numeric(18,6),
    regex text,
    enum_values jsonb DEFAULT '[]'::jsonb NOT NULL,
    unit text
);


--
-- Name: attr_def_attr_id_seq; Type: SEQUENCE; Schema: t_delta; Owner: -
--

CREATE SEQUENCE t_delta.attr_def_attr_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attr_def_attr_id_seq; Type: SEQUENCE OWNED BY; Schema: t_delta; Owner: -
--

ALTER SEQUENCE t_delta.attr_def_attr_id_seq OWNED BY t_delta.attr_def.attr_id;


--
-- Name: carriers; Type: TABLE; Schema: t_delta; Owner: -
--

CREATE TABLE t_delta.carriers (
    code text NOT NULL,
    name text NOT NULL,
    alliance text,
    country text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: extensions_hooks; Type: TABLE; Schema: t_delta; Owner: -
--

CREATE TABLE t_delta.extensions_hooks (
    name text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    handler_type text DEFAULT 'webhook'::text NOT NULL,
    handler_target text,
    last_success_at timestamp with time zone,
    last_error_at timestamp with time zone,
    notes text
);


--
-- Name: label_map; Type: TABLE; Schema: t_delta; Owner: -
--

CREATE TABLE t_delta.label_map (
    context text NOT NULL,
    field_id text NOT NULL,
    label text NOT NULL,
    aliases jsonb DEFAULT '[]'::jsonb NOT NULL,
    help_text text
);


--
-- Name: member_attr; Type: TABLE; Schema: t_delta; Owner: -
--

CREATE TABLE t_delta.member_attr (
    member_id bigint NOT NULL,
    key text NOT NULL,
    value_text text NOT NULL
);


--
-- Name: theme; Type: TABLE; Schema: t_delta; Owner: -
--

CREATE TABLE t_delta.theme (
    theme_id bigint NOT NULL,
    tokens jsonb DEFAULT '{}'::jsonb NOT NULL,
    assets jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: theme_theme_id_seq; Type: SEQUENCE; Schema: t_delta; Owner: -
--

CREATE SEQUENCE t_delta.theme_theme_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: theme_theme_id_seq; Type: SEQUENCE OWNED BY; Schema: t_delta; Owner: -
--

ALTER SEQUENCE t_delta.theme_theme_id_seq OWNED BY t_delta.theme.theme_id;


--
-- Name: tier_levels; Type: TABLE; Schema: t_delta; Owner: -
--

CREATE TABLE t_delta.tier_levels (
    tier_code text NOT NULL,
    name text NOT NULL,
    rank_order integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: v_lookup_summary; Type: VIEW; Schema: t_delta; Owner: -
--

CREATE VIEW t_delta.v_lookup_summary AS
 SELECT ( SELECT count(*) AS count
           FROM t_delta.airports) AS airports,
    ( SELECT count(*) AS count
           FROM t_delta.carriers) AS carriers,
    ( SELECT count(*) AS count
           FROM t_delta.tier_levels) AS tiers,
    ( SELECT count(*) AS count
           FROM t_delta.attr_def
          WHERE (attr_def.target = 'member'::text)) AS member_attrs_defined,
    ( SELECT count(*) AS count
           FROM t_delta.attr_def
          WHERE (attr_def.target = 'activity'::text)) AS activity_attrs_defined,
    ( SELECT count(*) AS count
           FROM t_delta.label_map) AS labels,
    ( SELECT count(*) AS count
           FROM t_delta.extensions_hooks) AS hooks;


--
-- Name: activity_attr; Type: TABLE; Schema: t_demo; Owner: -
--

CREATE TABLE t_demo.activity_attr (
    activity_id bigint NOT NULL,
    key text NOT NULL,
    value_text text NOT NULL
);


--
-- Name: airports; Type: TABLE; Schema: t_demo; Owner: -
--

CREATE TABLE t_demo.airports (
    iata text NOT NULL,
    icao text,
    name text NOT NULL,
    city text,
    country text,
    lat numeric(9,6),
    lon numeric(9,6),
    tz text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: attr_def; Type: TABLE; Schema: t_demo; Owner: -
--

CREATE TABLE t_demo.attr_def (
    attr_id bigint NOT NULL,
    target text NOT NULL,
    key text NOT NULL,
    data_type text NOT NULL,
    required boolean DEFAULT false NOT NULL,
    min_value numeric(18,6),
    max_value numeric(18,6),
    regex text,
    enum_values jsonb DEFAULT '[]'::jsonb NOT NULL,
    unit text
);


--
-- Name: attr_def_attr_id_seq; Type: SEQUENCE; Schema: t_demo; Owner: -
--

CREATE SEQUENCE t_demo.attr_def_attr_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attr_def_attr_id_seq; Type: SEQUENCE OWNED BY; Schema: t_demo; Owner: -
--

ALTER SEQUENCE t_demo.attr_def_attr_id_seq OWNED BY t_demo.attr_def.attr_id;


--
-- Name: carriers; Type: TABLE; Schema: t_demo; Owner: -
--

CREATE TABLE t_demo.carriers (
    code text NOT NULL,
    name text NOT NULL,
    alliance text,
    country text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: extensions_hooks; Type: TABLE; Schema: t_demo; Owner: -
--

CREATE TABLE t_demo.extensions_hooks (
    name text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    handler_type text DEFAULT 'webhook'::text NOT NULL,
    handler_target text,
    last_success_at timestamp with time zone,
    last_error_at timestamp with time zone,
    notes text
);


--
-- Name: label_map; Type: TABLE; Schema: t_demo; Owner: -
--

CREATE TABLE t_demo.label_map (
    context text NOT NULL,
    field_id text NOT NULL,
    label text NOT NULL,
    aliases jsonb DEFAULT '[]'::jsonb NOT NULL,
    help_text text
);


--
-- Name: member_attr; Type: TABLE; Schema: t_demo; Owner: -
--

CREATE TABLE t_demo.member_attr (
    member_id bigint NOT NULL,
    key text NOT NULL,
    value_text text NOT NULL
);


--
-- Name: theme; Type: TABLE; Schema: t_demo; Owner: -
--

CREATE TABLE t_demo.theme (
    theme_id bigint NOT NULL,
    tokens jsonb DEFAULT '{}'::jsonb NOT NULL,
    assets jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: theme_theme_id_seq; Type: SEQUENCE; Schema: t_demo; Owner: -
--

CREATE SEQUENCE t_demo.theme_theme_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: theme_theme_id_seq; Type: SEQUENCE OWNED BY; Schema: t_demo; Owner: -
--

ALTER SEQUENCE t_demo.theme_theme_id_seq OWNED BY t_demo.theme.theme_id;


--
-- Name: tier_levels; Type: TABLE; Schema: t_demo; Owner: -
--

CREATE TABLE t_demo.tier_levels (
    tier_code text NOT NULL,
    name text NOT NULL,
    rank_order integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: activity activity_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity ALTER COLUMN activity_id SET DEFAULT nextval('public.activity_activity_id_seq'::regclass);


--
-- Name: adjustment adjustment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adjustment ALTER COLUMN adjustment_id SET DEFAULT nextval('public.adjustment_adjustment_id_seq'::regclass);


--
-- Name: airports airport_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.airports ALTER COLUMN airport_id SET DEFAULT nextval('public.airports_airport_id_seq'::regclass);


--
-- Name: bonus bonus_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonus ALTER COLUMN bonus_id SET DEFAULT nextval('public.bonus_bonus_id_seq'::regclass);


--
-- Name: carriers carrier_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carriers ALTER COLUMN carrier_id SET DEFAULT nextval('public.carriers_carrier_id_seq'::regclass);


--
-- Name: display_template template_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.display_template ALTER COLUMN template_id SET DEFAULT nextval('public.display_template_template_id_seq'::regclass);


--
-- Name: display_template_line line_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.display_template_line ALTER COLUMN line_id SET DEFAULT nextval('public.display_template_line_line_id_seq'::regclass);


--
-- Name: member_tier member_tier_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_tier ALTER COLUMN member_tier_id SET DEFAULT nextval('public.member_tier_member_tier_id_seq'::regclass);


--
-- Name: molecule_def molecule_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_def ALTER COLUMN molecule_id SET DEFAULT nextval('public.molecule_def_molecule_id_seq'::regclass);


--
-- Name: molecule_text_pool text_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_text_pool ALTER COLUMN text_id SET DEFAULT nextval('public.molecule_text_pool_text_id_seq'::regclass);


--
-- Name: molecule_value_boolean value_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_boolean ALTER COLUMN value_id SET DEFAULT nextval('public.molecule_value_boolean_value_id_seq'::regclass);


--
-- Name: molecule_value_date value_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_date ALTER COLUMN value_id SET DEFAULT nextval('public.molecule_value_date_value_id_seq'::regclass);


--
-- Name: molecule_value_embedded_list embedded_value_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_embedded_list ALTER COLUMN embedded_value_id SET DEFAULT nextval('public.molecule_value_embedded_list_embedded_value_id_seq'::regclass);


--
-- Name: molecule_value_list value_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_list ALTER COLUMN value_id SET DEFAULT nextval('public.molecule_value_list_new_value_id_seq'::regclass);


--
-- Name: molecule_value_lookup lookup_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_lookup ALTER COLUMN lookup_id SET DEFAULT nextval('public.molecule_value_lookup_lookup_id_seq'::regclass);


--
-- Name: molecule_value_numeric value_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_numeric ALTER COLUMN value_id SET DEFAULT nextval('public.molecule_value_numeric_value_id_seq'::regclass);


--
-- Name: molecule_value_ref value_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_ref ALTER COLUMN value_id SET DEFAULT nextval('public.molecule_value_ref_value_id_seq'::regclass);


--
-- Name: molecule_value_text value_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_text ALTER COLUMN value_id SET DEFAULT nextval('public.molecule_value_text_value_id_seq'::regclass);


--
-- Name: point_expiration_rule rule_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_expiration_rule ALTER COLUMN rule_id SET DEFAULT nextval('public.point_expiration_rule_rule_id_seq'::regclass);


--
-- Name: redemption_rule redemption_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemption_rule ALTER COLUMN redemption_id SET DEFAULT nextval('public.redemption_rule_redemption_id_seq'::regclass);


--
-- Name: rule rule_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rule ALTER COLUMN rule_id SET DEFAULT nextval('public.rule_rule_id_seq'::regclass);


--
-- Name: rule_criteria criteria_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rule_criteria ALTER COLUMN criteria_id SET DEFAULT nextval('public.rule_criteria_criteria_id_seq'::regclass);


--
-- Name: tenant tenant_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant ALTER COLUMN tenant_id SET DEFAULT nextval('public.tenant_tenant_id_seq'::regclass);


--
-- Name: tier_definition tier_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_definition ALTER COLUMN tier_id SET DEFAULT nextval('public.tier_definition_tier_id_seq'::regclass);


--
-- Name: attr_def attr_id; Type: DEFAULT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.attr_def ALTER COLUMN attr_id SET DEFAULT nextval('t_delta.attr_def_attr_id_seq'::regclass);


--
-- Name: theme theme_id; Type: DEFAULT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.theme ALTER COLUMN theme_id SET DEFAULT nextval('t_delta.theme_theme_id_seq'::regclass);


--
-- Name: attr_def attr_id; Type: DEFAULT; Schema: t_demo; Owner: -
--

ALTER TABLE ONLY t_demo.attr_def ALTER COLUMN attr_id SET DEFAULT nextval('t_demo.attr_def_attr_id_seq'::regclass);


--
-- Name: theme theme_id; Type: DEFAULT; Schema: t_demo; Owner: -
--

ALTER TABLE ONLY t_demo.theme ALTER COLUMN theme_id SET DEFAULT nextval('t_demo.theme_theme_id_seq'::regclass);


--
-- Name: activity_detail_list activity_detail_list_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_detail_list
    ADD CONSTRAINT activity_detail_list_pkey PRIMARY KEY (detail_list_id);


--
-- Name: activity activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_pkey PRIMARY KEY (activity_id);


--
-- Name: adjustment adjustment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adjustment
    ADD CONSTRAINT adjustment_pkey PRIMARY KEY (adjustment_id);


--
-- Name: adjustment adjustment_tenant_code_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adjustment
    ADD CONSTRAINT adjustment_tenant_code_uq UNIQUE (tenant_id, adjustment_code);


--
-- Name: airports airports_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.airports
    ADD CONSTRAINT airports_code_key UNIQUE (code);


--
-- Name: airports airports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.airports
    ADD CONSTRAINT airports_pkey PRIMARY KEY (airport_id);


--
-- Name: bonus bonus_bonus_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonus
    ADD CONSTRAINT bonus_bonus_code_key UNIQUE (bonus_code);


--
-- Name: bonus bonus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonus
    ADD CONSTRAINT bonus_pkey PRIMARY KEY (bonus_id);


--
-- Name: carriers carriers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_code_key UNIQUE (code);


--
-- Name: carriers carriers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_pkey PRIMARY KEY (carrier_id);


--
-- Name: display_template_line display_template_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.display_template_line
    ADD CONSTRAINT display_template_line_pkey PRIMARY KEY (line_id);


--
-- Name: display_template display_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.display_template
    ADD CONSTRAINT display_template_pkey PRIMARY KEY (template_id);


--
-- Name: input_template_line input_template_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.input_template_line
    ADD CONSTRAINT input_template_line_pkey PRIMARY KEY (line_id);


--
-- Name: input_template input_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.input_template
    ADD CONSTRAINT input_template_pkey PRIMARY KEY (template_id);


--
-- Name: link_tank link_tank_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_tank
    ADD CONSTRAINT link_tank_pkey PRIMARY KEY (tenant_id, table_key);


--
-- Name: member_detail_2244 member_detail_2244_detail_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_detail_2244
    ADD CONSTRAINT member_detail_2244_detail_id_unique UNIQUE (detail_id);


--
-- Name: member_detail_list member_detail_list_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_detail_list
    ADD CONSTRAINT member_detail_list_pkey PRIMARY KEY (detail_list_id);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (member_id);


--
-- Name: member_promotion_detail member_promotion_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_promotion_detail
    ADD CONSTRAINT member_promotion_detail_pkey PRIMARY KEY (detail_id);


--
-- Name: member_promotion member_promotion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_promotion
    ADD CONSTRAINT member_promotion_pkey PRIMARY KEY (member_promotion_id);


--
-- Name: member_tier member_tier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_tier
    ADD CONSTRAINT member_tier_pkey PRIMARY KEY (member_tier_id);


--
-- Name: molecule_column_def molecule_column_def_molecule_id_column_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_column_def
    ADD CONSTRAINT molecule_column_def_molecule_id_column_name_key UNIQUE (molecule_id, column_name);


--
-- Name: molecule_column_def molecule_column_def_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_column_def
    ADD CONSTRAINT molecule_column_def_pkey PRIMARY KEY (column_def_id);


--
-- Name: molecule_def molecule_def_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_def
    ADD CONSTRAINT molecule_def_pkey PRIMARY KEY (molecule_id);


--
-- Name: molecule_text_pool molecule_text_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_text_pool
    ADD CONSTRAINT molecule_text_pool_pkey PRIMARY KEY (text_id);


--
-- Name: molecule_value_boolean molecule_value_boolean_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_boolean
    ADD CONSTRAINT molecule_value_boolean_pkey PRIMARY KEY (value_id);


--
-- Name: molecule_value_date molecule_value_date_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_date
    ADD CONSTRAINT molecule_value_date_pkey PRIMARY KEY (value_id);


--
-- Name: molecule_value_embedded_list molecule_value_embedded_list_molecule_id_tenant_id_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_embedded_list
    ADD CONSTRAINT molecule_value_embedded_list_molecule_id_tenant_id_category_key UNIQUE (molecule_id, tenant_id, category, code);


--
-- Name: molecule_value_embedded_list molecule_value_embedded_list_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_embedded_list
    ADD CONSTRAINT molecule_value_embedded_list_pkey PRIMARY KEY (embedded_value_id);


--
-- Name: molecule_value_list molecule_value_list_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_list
    ADD CONSTRAINT molecule_value_list_new_pkey PRIMARY KEY (value_id);


--
-- Name: molecule_value_lookup molecule_value_lookup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_lookup
    ADD CONSTRAINT molecule_value_lookup_pkey PRIMARY KEY (lookup_id);


--
-- Name: molecule_value_numeric molecule_value_numeric_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_numeric
    ADD CONSTRAINT molecule_value_numeric_pkey PRIMARY KEY (value_id);


--
-- Name: molecule_value_ref molecule_value_ref_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_ref
    ADD CONSTRAINT molecule_value_ref_pkey PRIMARY KEY (value_id);


--
-- Name: molecule_value_text molecule_value_text_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_text
    ADD CONSTRAINT molecule_value_text_pkey PRIMARY KEY (value_id);


--
-- Name: partner partner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner
    ADD CONSTRAINT partner_pkey PRIMARY KEY (partner_id);


--
-- Name: partner_program partner_program_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_program
    ADD CONSTRAINT partner_program_pkey PRIMARY KEY (program_id);


--
-- Name: point_expiration_rule point_expiration_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_expiration_rule
    ADD CONSTRAINT point_expiration_rule_pkey PRIMARY KEY (rule_key);


--
-- Name: point_expiration_rule point_expiration_rule_rule_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_expiration_rule
    ADD CONSTRAINT point_expiration_rule_rule_id_key UNIQUE (rule_id);


--
-- Name: point_type point_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_type
    ADD CONSTRAINT point_type_pkey PRIMARY KEY (tenant_id, point_type);


--
-- Name: promotion promotion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion
    ADD CONSTRAINT promotion_pkey PRIMARY KEY (promotion_id);


--
-- Name: redemption_rule redemption_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemption_rule
    ADD CONSTRAINT redemption_rule_pkey PRIMARY KEY (redemption_id);


--
-- Name: redemption_rule redemption_rule_tenant_id_redemption_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemption_rule
    ADD CONSTRAINT redemption_rule_tenant_id_redemption_code_key UNIQUE (tenant_id, redemption_code);


--
-- Name: rule_criteria rule_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rule_criteria
    ADD CONSTRAINT rule_criteria_pkey PRIMARY KEY (criteria_id);


--
-- Name: rule rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rule
    ADD CONSTRAINT rule_pkey PRIMARY KEY (rule_id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: tenant tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_pkey PRIMARY KEY (tenant_id);


--
-- Name: x_tenant_settings tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x_tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant tenant_tenant_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_tenant_key_key UNIQUE (tenant_key);


--
-- Name: x_tenant_terms tenant_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x_tenant_terms
    ADD CONSTRAINT tenant_terms_pkey PRIMARY KEY (tenant_id, term_key);


--
-- Name: tier_definition tier_definition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_definition
    ADD CONSTRAINT tier_definition_pkey PRIMARY KEY (tier_id);


--
-- Name: tier_definition tier_definition_tier_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_definition
    ADD CONSTRAINT tier_definition_tier_code_key UNIQUE (tier_code);


--
-- Name: partner uk_partner_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner
    ADD CONSTRAINT uk_partner_code UNIQUE (tenant_id, partner_code);


--
-- Name: partner_program uk_program_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_program
    ADD CONSTRAINT uk_program_code UNIQUE (tenant_id, program_code);


--
-- Name: promotion unique_promotion_code_per_tenant; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion
    ADD CONSTRAINT unique_promotion_code_per_tenant UNIQUE (tenant_id, promotion_code);


--
-- Name: activity_attr activity_attr_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.activity_attr
    ADD CONSTRAINT activity_attr_pkey PRIMARY KEY (activity_id, key);


--
-- Name: airports airports_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.airports
    ADD CONSTRAINT airports_pkey PRIMARY KEY (iata);


--
-- Name: airports_stage airports_stage_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.airports_stage
    ADD CONSTRAINT airports_stage_pkey PRIMARY KEY (iata);


--
-- Name: attr_def attr_def_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.attr_def
    ADD CONSTRAINT attr_def_pkey PRIMARY KEY (attr_id);


--
-- Name: attr_def attr_def_unique; Type: CONSTRAINT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.attr_def
    ADD CONSTRAINT attr_def_unique UNIQUE (target, key);


--
-- Name: carriers carriers_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.carriers
    ADD CONSTRAINT carriers_pkey PRIMARY KEY (code);


--
-- Name: extensions_hooks extensions_hooks_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.extensions_hooks
    ADD CONSTRAINT extensions_hooks_pkey PRIMARY KEY (name);


--
-- Name: label_map label_map_unique; Type: CONSTRAINT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.label_map
    ADD CONSTRAINT label_map_unique UNIQUE (context, field_id);


--
-- Name: member_attr member_attr_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.member_attr
    ADD CONSTRAINT member_attr_pkey PRIMARY KEY (member_id, key);


--
-- Name: theme theme_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.theme
    ADD CONSTRAINT theme_pkey PRIMARY KEY (theme_id);


--
-- Name: tier_levels tier_levels_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: -
--

ALTER TABLE ONLY t_delta.tier_levels
    ADD CONSTRAINT tier_levels_pkey PRIMARY KEY (tier_code);


--
-- Name: activity_attr activity_attr_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: -
--

ALTER TABLE ONLY t_demo.activity_attr
    ADD CONSTRAINT activity_attr_pkey PRIMARY KEY (activity_id, key);


--
-- Name: airports airports_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: -
--

ALTER TABLE ONLY t_demo.airports
    ADD CONSTRAINT airports_pkey PRIMARY KEY (iata);


--
-- Name: attr_def attr_def_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: -
--

ALTER TABLE ONLY t_demo.attr_def
    ADD CONSTRAINT attr_def_pkey PRIMARY KEY (attr_id);


--
-- Name: attr_def attr_def_unique; Type: CONSTRAINT; Schema: t_demo; Owner: -
--

ALTER TABLE ONLY t_demo.attr_def
    ADD CONSTRAINT attr_def_unique UNIQUE (target, key);


--
-- Name: carriers carriers_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: -
--

ALTER TABLE ONLY t_demo.carriers
    ADD CONSTRAINT carriers_pkey PRIMARY KEY (code);


--
-- Name: extensions_hooks extensions_hooks_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: -
--

ALTER TABLE ONLY t_demo.extensions_hooks
    ADD CONSTRAINT extensions_hooks_pkey PRIMARY KEY (name);


--
-- Name: label_map label_map_unique; Type: CONSTRAINT; Schema: t_demo; Owner: -
--

ALTER TABLE ONLY t_demo.label_map
    ADD CONSTRAINT label_map_unique UNIQUE (context, field_id);


--
-- Name: member_attr member_attr_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: -
--

ALTER TABLE ONLY t_demo.member_attr
    ADD CONSTRAINT member_attr_pkey PRIMARY KEY (member_id, key);


--
-- Name: theme theme_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: -
--

ALTER TABLE ONLY t_demo.theme
    ADD CONSTRAINT theme_pkey PRIMARY KEY (theme_id);


--
-- Name: tier_levels tier_levels_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: -
--

ALTER TABLE ONLY t_demo.tier_levels
    ADD CONSTRAINT tier_levels_pkey PRIMARY KEY (tier_code);


--
-- Name: idx_activity_detail_1_mol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_1_mol ON public.activity_detail_1 USING btree (p_link, molecule_id);


--
-- Name: idx_activity_detail_1_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_1_plink ON public.activity_detail_1 USING btree (p_link);


--
-- Name: idx_activity_detail_2_mol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_2_mol ON public.activity_detail_2 USING btree (p_link, molecule_id);


--
-- Name: idx_activity_detail_2_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_2_plink ON public.activity_detail_2 USING btree (p_link);


--
-- Name: idx_activity_detail_3_mol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_3_mol ON public.activity_detail_3 USING btree (p_link, molecule_id);


--
-- Name: idx_activity_detail_3_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_3_plink ON public.activity_detail_3 USING btree (p_link);


--
-- Name: idx_activity_detail_4_mol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_4_mol ON public.activity_detail_4 USING btree (p_link, molecule_id);


--
-- Name: idx_activity_detail_4_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_4_plink ON public.activity_detail_4 USING btree (p_link);


--
-- Name: idx_activity_detail_54_mol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_54_mol ON public.activity_detail_54 USING btree (p_link, molecule_id);


--
-- Name: idx_activity_detail_54_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_54_plink ON public.activity_detail_54 USING btree (p_link);


--
-- Name: idx_activity_detail_5_mol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_5_mol ON public.activity_detail_5 USING btree (p_link, molecule_id);


--
-- Name: idx_activity_detail_5_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_5_plink ON public.activity_detail_5 USING btree (p_link);


--
-- Name: idx_activity_detail_p_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_detail_p_link ON public.activity_detail USING btree (p_link);


--
-- Name: idx_activity_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_link ON public.activity USING btree (link);


--
-- Name: idx_activity_p_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_p_link ON public.activity USING btree (p_link);


--
-- Name: idx_adl_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adl_activity ON public.activity_detail_list USING btree (activity_id);


--
-- Name: idx_adl_bucket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adl_bucket ON public.activity_detail_list USING btree (v1);


--
-- Name: idx_airports_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_airports_code ON public.airports USING btree (code);


--
-- Name: idx_bonus_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bonus_active ON public.bonus USING btree (is_active);


--
-- Name: idx_bonus_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bonus_code ON public.bonus USING btree (bonus_code);


--
-- Name: idx_bonus_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bonus_dates ON public.bonus USING btree (start_date, end_date);


--
-- Name: idx_bonus_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bonus_tenant ON public.bonus USING btree (tenant_id);


--
-- Name: idx_carriers_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carriers_code ON public.carriers USING btree (code);


--
-- Name: idx_carriers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carriers_tenant ON public.carriers USING btree (tenant_id);


--
-- Name: idx_display_template_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_display_template_active ON public.display_template USING btree (tenant_id, is_active);


--
-- Name: idx_display_template_line_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_display_template_line_order ON public.display_template_line USING btree (template_id, line_number);


--
-- Name: idx_display_template_line_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_display_template_line_template ON public.display_template_line USING btree (template_id);


--
-- Name: idx_display_template_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_display_template_tenant ON public.display_template USING btree (tenant_id);


--
-- Name: idx_expiration_rule_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expiration_rule_tenant ON public.point_expiration_rule USING btree (tenant_id);


--
-- Name: idx_input_template_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_input_template_active ON public.input_template USING btree (tenant_id, activity_type, is_active);


--
-- Name: idx_input_template_line_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_input_template_line_order ON public.input_template_line USING btree (template_id, line_number);


--
-- Name: idx_input_template_line_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_input_template_line_template ON public.input_template_line USING btree (template_id);


--
-- Name: idx_input_template_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_input_template_tenant ON public.input_template USING btree (tenant_id);


--
-- Name: idx_mdl_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mdl_expire ON public.member_detail_list USING btree (v5) WHERE (v5 IS NOT NULL);


--
-- Name: idx_mdl_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mdl_member ON public.member_detail_list USING btree (member_id);


--
-- Name: idx_mdl_member_molecule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mdl_member_molecule ON public.member_detail_list USING btree (member_id, molecule_id);


--
-- Name: idx_member_detail_1_mol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_detail_1_mol ON public.member_detail_1 USING btree (p_link, molecule_id);


--
-- Name: idx_member_detail_1_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_detail_1_plink ON public.member_detail_1 USING btree (p_link);


--
-- Name: idx_member_detail_2244_mol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_detail_2244_mol ON public.member_detail_2244 USING btree (p_link, molecule_id);


--
-- Name: idx_member_detail_2244_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_detail_2244_plink ON public.member_detail_2244 USING btree (p_link);


--
-- Name: idx_member_detail_2_mol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_detail_2_mol ON public.member_detail_2 USING btree (p_link, molecule_id);


--
-- Name: idx_member_detail_2_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_detail_2_plink ON public.member_detail_2 USING btree (p_link);


--
-- Name: idx_member_detail_3_mol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_detail_3_mol ON public.member_detail_3 USING btree (p_link, molecule_id);


--
-- Name: idx_member_detail_3_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_detail_3_plink ON public.member_detail_3 USING btree (p_link);


--
-- Name: idx_member_detail_4_mol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_detail_4_mol ON public.member_detail_4 USING btree (p_link, molecule_id);


--
-- Name: idx_member_detail_4_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_detail_4_plink ON public.member_detail_4 USING btree (p_link);


--
-- Name: idx_member_detail_5_mol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_detail_5_mol ON public.member_detail_5 USING btree (p_link, molecule_id);


--
-- Name: idx_member_detail_5_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_detail_5_plink ON public.member_detail_5 USING btree (p_link);


--
-- Name: idx_member_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_email ON public.member USING btree (email);


--
-- Name: idx_member_lname; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_lname ON public.member USING btree (lname);


--
-- Name: idx_member_membership_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_membership_number ON public.member USING btree (membership_number);


--
-- Name: idx_member_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_phone ON public.member USING btree (phone);


--
-- Name: idx_member_promotion_detail_activity_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_promotion_detail_activity_link ON public.member_promotion_detail USING btree (activity_link);


--
-- Name: idx_member_promotion_detail_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_promotion_detail_plink ON public.member_promotion_detail USING btree (p_link);


--
-- Name: idx_member_promotion_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_promotion_link ON public.member_promotion USING btree (link);


--
-- Name: idx_member_promotion_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_promotion_member ON public.member_promotion USING btree (member_id, promotion_id);


--
-- Name: idx_member_promotion_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_promotion_plink ON public.member_promotion USING btree (p_link);


--
-- Name: idx_member_promotion_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_promotion_tenant ON public.member_promotion USING btree (tenant_id);


--
-- Name: idx_member_tenant_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_tenant_link ON public.member USING btree (tenant_id, link);


--
-- Name: idx_member_tier_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_tier_dates ON public.member_tier USING btree (start_date, end_date);


--
-- Name: idx_member_tier_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_tier_member ON public.member_tier USING btree (member_id);


--
-- Name: idx_member_tier_member_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_tier_member_dates ON public.member_tier USING btree (member_id, start_date, end_date);


--
-- Name: idx_member_tier_plink; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_tier_plink ON public.member_tier USING btree (p_link);


--
-- Name: idx_molecule_def_id_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_molecule_def_id_context ON public.molecule_def USING btree (molecule_id, context);


--
-- Name: idx_molecule_def_key_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_molecule_def_key_tenant ON public.molecule_def USING btree (molecule_key, tenant_id);


--
-- Name: idx_molecule_value_embedded_list_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_molecule_value_embedded_list_lookup ON public.molecule_value_embedded_list USING btree (molecule_id, tenant_id, category, is_active);


--
-- Name: idx_mvl_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mvl_context ON public.molecule_value_list USING btree (context_id);


--
-- Name: idx_mvl_molecule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mvl_molecule ON public.molecule_value_list USING btree (molecule_id);


--
-- Name: idx_mvl_molecule_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mvl_molecule_context ON public.molecule_value_list USING btree (molecule_id, context_id);


--
-- Name: idx_mvl_molecule_context_row; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mvl_molecule_context_row ON public.molecule_value_list USING btree (molecule_id, context_id, row_num);


--
-- Name: idx_partner_program_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_program_partner ON public.partner_program USING btree (partner_id);


--
-- Name: idx_partner_program_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_program_tenant ON public.partner_program USING btree (tenant_id);


--
-- Name: idx_partner_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_tenant ON public.partner USING btree (tenant_id);


--
-- Name: idx_promotion_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_active ON public.promotion USING btree (tenant_id, is_active);


--
-- Name: idx_promotion_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_dates ON public.promotion USING btree (tenant_id, start_date, end_date);


--
-- Name: idx_promotion_detail_enrolled_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_detail_enrolled_member ON public.member_promotion_detail USING btree (enrolled_member_id);


--
-- Name: idx_promotion_detail_promotion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_detail_promotion ON public.member_promotion_detail USING btree (member_promotion_id);


--
-- Name: idx_promotion_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_tenant ON public.promotion USING btree (tenant_id);


--
-- Name: idx_redemption_rule_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redemption_rule_active ON public.redemption_rule USING btree (tenant_id, status, start_date, end_date);


--
-- Name: idx_redemption_rule_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redemption_rule_code ON public.redemption_rule USING btree (tenant_id, redemption_code);


--
-- Name: idx_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_id ON public.tenant USING btree (tenant_id);


--
-- Name: idx_text_pool_value; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_text_pool_value ON public.molecule_text_pool USING btree (text_value);


--
-- Name: idx_tier_def_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tier_def_code ON public.tier_definition USING btree (tier_code);


--
-- Name: idx_tier_def_ranking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tier_def_ranking ON public.tier_definition USING btree (tier_ranking);


--
-- Name: idx_tier_definition_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tier_definition_tenant ON public.tier_definition USING btree (tenant_id);


--
-- Name: member_tenant_member_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX member_tenant_member_id_uq ON public.member USING btree (tenant_id, member_id);


--
-- Name: molecule_def_context_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX molecule_def_context_idx ON public.molecule_def USING btree (tenant_id, context);


--
-- Name: molecule_def_static_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX molecule_def_static_idx ON public.molecule_def USING btree (tenant_id, is_static);


--
-- Name: molecule_def_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX molecule_def_tenant_idx ON public.molecule_def USING btree (tenant_id);


--
-- Name: molecule_def_tenant_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX molecule_def_tenant_key_uq ON public.molecule_def USING btree (tenant_id, molecule_key);


--
-- Name: molecule_value_boolean_molecule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX molecule_value_boolean_molecule_idx ON public.molecule_value_boolean USING btree (molecule_id);


--
-- Name: molecule_value_date_molecule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX molecule_value_date_molecule_idx ON public.molecule_value_date USING btree (molecule_id);


--
-- Name: molecule_value_numeric_molecule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX molecule_value_numeric_molecule_idx ON public.molecule_value_numeric USING btree (molecule_id);


--
-- Name: molecule_value_ref_molecule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX molecule_value_ref_molecule_idx ON public.molecule_value_ref USING btree (molecule_id);


--
-- Name: molecule_value_ref_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX molecule_value_ref_sort_idx ON public.molecule_value_ref USING btree (molecule_id, sort_order);


--
-- Name: molecule_value_text_molecule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX molecule_value_text_molecule_idx ON public.molecule_value_text USING btree (molecule_id);


--
-- Name: molecule_value_text_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX molecule_value_text_sort_idx ON public.molecule_value_text USING btree (molecule_id, sort_order);


--
-- Name: activity_detail_list activity_detail_list_molecule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_detail_list
    ADD CONSTRAINT activity_detail_list_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES public.molecule_def(molecule_id);


--
-- Name: adjustment adjustment_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adjustment
    ADD CONSTRAINT adjustment_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: bonus bonus_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonus
    ADD CONSTRAINT bonus_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.rule(rule_id);


--
-- Name: bonus bonus_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonus
    ADD CONSTRAINT bonus_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: carriers carriers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: display_template_line display_template_line_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.display_template_line
    ADD CONSTRAINT display_template_line_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.display_template(template_id) ON DELETE CASCADE;


--
-- Name: display_template display_template_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.display_template
    ADD CONSTRAINT display_template_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id) ON DELETE CASCADE;


--
-- Name: activity_detail fk_activity_detail_molecule; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_detail
    ADD CONSTRAINT fk_activity_detail_molecule FOREIGN KEY (molecule_id) REFERENCES public.molecule_def(molecule_id);


--
-- Name: bonus fk_bonus_tier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonus
    ADD CONSTRAINT fk_bonus_tier FOREIGN KEY (required_tier_id) REFERENCES public.tier_definition(tier_id);


--
-- Name: member_tier fk_member_tier_member; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_tier
    ADD CONSTRAINT fk_member_tier_member FOREIGN KEY (member_id) REFERENCES public.member(member_id);


--
-- Name: partner_program fk_partner; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_program
    ADD CONSTRAINT fk_partner FOREIGN KEY (partner_id) REFERENCES public.partner(partner_id);


--
-- Name: member_promotion fk_qualified_by_promotion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_promotion
    ADD CONSTRAINT fk_qualified_by_promotion FOREIGN KEY (qualified_by_promotion_id) REFERENCES public.promotion(promotion_id);


--
-- Name: input_template_line input_template_line_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.input_template_line
    ADD CONSTRAINT input_template_line_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.input_template(template_id) ON DELETE CASCADE;


--
-- Name: input_template input_template_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.input_template
    ADD CONSTRAINT input_template_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id) ON DELETE CASCADE;


--
-- Name: member_detail_list member_detail_list_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_detail_list
    ADD CONSTRAINT member_detail_list_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.member(member_id);


--
-- Name: member_detail_list member_detail_list_molecule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_detail_list
    ADD CONSTRAINT member_detail_list_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES public.molecule_def(molecule_id);


--
-- Name: member_promotion_detail member_promotion_detail_enrolled_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_promotion_detail
    ADD CONSTRAINT member_promotion_detail_enrolled_member_id_fkey FOREIGN KEY (enrolled_member_id) REFERENCES public.member(member_id);


--
-- Name: member_promotion_detail member_promotion_detail_member_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_promotion_detail
    ADD CONSTRAINT member_promotion_detail_member_promotion_id_fkey FOREIGN KEY (member_promotion_id) REFERENCES public.member_promotion(member_promotion_id);


--
-- Name: member_promotion member_promotion_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_promotion
    ADD CONSTRAINT member_promotion_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.member(member_id);


--
-- Name: member_promotion member_promotion_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_promotion
    ADD CONSTRAINT member_promotion_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotion(promotion_id);


--
-- Name: member_promotion member_promotion_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_promotion
    ADD CONSTRAINT member_promotion_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: member member_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id) ON DELETE RESTRICT;


--
-- Name: member_tier member_tier_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_tier
    ADD CONSTRAINT member_tier_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.tier_definition(tier_id);


--
-- Name: molecule_column_def molecule_column_def_molecule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_column_def
    ADD CONSTRAINT molecule_column_def_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES public.molecule_def(molecule_id) ON DELETE CASCADE;


--
-- Name: molecule_value_boolean molecule_value_boolean_molecule_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_boolean
    ADD CONSTRAINT molecule_value_boolean_molecule_fk FOREIGN KEY (molecule_id) REFERENCES public.molecule_def(molecule_id) ON DELETE CASCADE;


--
-- Name: molecule_value_date molecule_value_date_molecule_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_date
    ADD CONSTRAINT molecule_value_date_molecule_fk FOREIGN KEY (molecule_id) REFERENCES public.molecule_def(molecule_id) ON DELETE CASCADE;


--
-- Name: molecule_value_embedded_list molecule_value_embedded_list_molecule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_embedded_list
    ADD CONSTRAINT molecule_value_embedded_list_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES public.molecule_def(molecule_id) ON DELETE CASCADE;


--
-- Name: molecule_value_embedded_list molecule_value_embedded_list_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_embedded_list
    ADD CONSTRAINT molecule_value_embedded_list_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: molecule_value_list molecule_value_list_new_molecule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_list
    ADD CONSTRAINT molecule_value_list_new_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES public.molecule_def(molecule_id);


--
-- Name: molecule_value_lookup molecule_value_lookup_molecule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_lookup
    ADD CONSTRAINT molecule_value_lookup_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES public.molecule_def(molecule_id);


--
-- Name: molecule_value_numeric molecule_value_numeric_molecule_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_numeric
    ADD CONSTRAINT molecule_value_numeric_molecule_fk FOREIGN KEY (molecule_id) REFERENCES public.molecule_def(molecule_id) ON DELETE CASCADE;


--
-- Name: molecule_value_ref molecule_value_ref_molecule_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_ref
    ADD CONSTRAINT molecule_value_ref_molecule_fk FOREIGN KEY (molecule_id) REFERENCES public.molecule_def(molecule_id) ON DELETE CASCADE;


--
-- Name: molecule_value_text molecule_value_text_molecule_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.molecule_value_text
    ADD CONSTRAINT molecule_value_text_molecule_fk FOREIGN KEY (molecule_id) REFERENCES public.molecule_def(molecule_id) ON DELETE CASCADE;


--
-- Name: point_expiration_rule point_expiration_rule_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_expiration_rule
    ADD CONSTRAINT point_expiration_rule_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: point_type point_type_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_type
    ADD CONSTRAINT point_type_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id) ON DELETE CASCADE;


--
-- Name: promotion promotion_counter_molecule_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion
    ADD CONSTRAINT promotion_counter_molecule_fk FOREIGN KEY (counter_molecule_id) REFERENCES public.molecule_def(molecule_id);


--
-- Name: promotion promotion_reward_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion
    ADD CONSTRAINT promotion_reward_promotion_id_fkey FOREIGN KEY (reward_promotion_id) REFERENCES public.promotion(promotion_id);


--
-- Name: promotion promotion_reward_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion
    ADD CONSTRAINT promotion_reward_tier_id_fkey FOREIGN KEY (reward_tier_id) REFERENCES public.tier_definition(tier_id);


--
-- Name: promotion promotion_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion
    ADD CONSTRAINT promotion_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.rule(rule_id);


--
-- Name: promotion promotion_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion
    ADD CONSTRAINT promotion_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: redemption_rule redemption_rule_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemption_rule
    ADD CONSTRAINT redemption_rule_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: rule_criteria rule_criteria_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rule_criteria
    ADD CONSTRAINT rule_criteria_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.rule(rule_id) ON DELETE CASCADE;


--
-- Name: x_tenant_settings tenant_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x_tenant_settings
    ADD CONSTRAINT tenant_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id) ON DELETE CASCADE;


--
-- Name: x_tenant_terms tenant_terms_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x_tenant_terms
    ADD CONSTRAINT tenant_terms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id) ON DELETE CASCADE;


--
-- Name: tier_definition tier_definition_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_definition
    ADD CONSTRAINT tier_definition_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: member; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member ENABLE ROW LEVEL SECURITY;

--
-- Name: member member_rls_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY member_rls_tenant ON public.member USING ((tenant_id = public.app_current_tenant_id()));


--
-- PostgreSQL database dump complete
--

\unrestrict F1SyuyOHo3A06nFnfdI1dxAiEzRaw4kfzXZQHVGVK2qWpchDXJjUdMX7y5IlBZG


--
-- Name: sysparm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sysparm (
    sysparm_id integer NOT NULL,
    tenant_id smallint NOT NULL,
    sysparm_key character varying(50) NOT NULL,
    value_type character varying(20) NOT NULL,
    description character varying(255)
);

CREATE SEQUENCE public.sysparm_sysparm_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY public.sysparm ALTER COLUMN sysparm_id SET DEFAULT nextval('public.sysparm_sysparm_id_seq'::regclass);

ALTER TABLE ONLY public.sysparm
    ADD CONSTRAINT sysparm_pkey PRIMARY KEY (sysparm_id);

ALTER TABLE ONLY public.sysparm
    ADD CONSTRAINT sysparm_tenant_key_unique UNIQUE (tenant_id, sysparm_key);

--
-- Name: sysparm_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sysparm_detail (
    detail_id integer NOT NULL,
    sysparm_id integer NOT NULL,
    category character varying(50),
    code character varying(50),
    value text,
    sort_order smallint DEFAULT 0
);

CREATE SEQUENCE public.sysparm_detail_detail_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY public.sysparm_detail ALTER COLUMN detail_id SET DEFAULT nextval('public.sysparm_detail_detail_id_seq'::regclass);

ALTER TABLE ONLY public.sysparm_detail
    ADD CONSTRAINT sysparm_detail_pkey PRIMARY KEY (detail_id);

ALTER TABLE ONLY public.sysparm_detail
    ADD CONSTRAINT sysparm_detail_sysparm_fkey FOREIGN KEY (sysparm_id) REFERENCES public.sysparm(sysparm_id) ON DELETE CASCADE;

CREATE INDEX idx_sysparm_detail_sysparm_id ON public.sysparm_detail(sysparm_id);
