--
-- PostgreSQL database dump
--

\restrict YFFCcd8sxDd2HmOhHIvLNmz6QjjXx2E6lC8GpC8JLGyi9sOEXOZAPQm6ZwmmFAC

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
-- Name: t_delta; Type: SCHEMA; Schema: -; Owner: billjansen
--

CREATE SCHEMA t_delta;


ALTER SCHEMA t_delta OWNER TO billjansen;

--
-- Name: t_demo; Type: SCHEMA; Schema: -; Owner: billjansen
--

CREATE SCHEMA t_demo;


ALTER SCHEMA t_demo OWNER TO billjansen;

--
-- Name: app_current_tenant_id(); Type: FUNCTION; Schema: public; Owner: billjansen
--

CREATE FUNCTION public.app_current_tenant_id() RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
  SELECT current_setting('app.tenant_id', true)::BIGINT
$$;


ALTER FUNCTION public.app_current_tenant_id() OWNER TO billjansen;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity; Type: TABLE; Schema: public; Owner: billjansen
--

CREATE TABLE public.activity (
    activity_id bigint NOT NULL,
    member_id bigint NOT NULL,
    activity_date date NOT NULL,
    kind text NOT NULL,
    subtype text,
    adjustment_code text,
    point_amount numeric,
    point_type text DEFAULT 'miles'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT activity_kind_check CHECK ((kind = ANY (ARRAY['accrual'::text, 'redemption'::text])))
);


ALTER TABLE public.activity OWNER TO billjansen;

--
-- Name: activity_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: billjansen
--

CREATE SEQUENCE public.activity_activity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.activity_activity_id_seq OWNER TO billjansen;

--
-- Name: activity_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: billjansen
--

ALTER SEQUENCE public.activity_activity_id_seq OWNED BY public.activity.activity_id;


--
-- Name: activity_detail; Type: TABLE; Schema: public; Owner: billjansen
--

CREATE TABLE public.activity_detail (
    activity_id bigint NOT NULL,
    k text NOT NULL,
    v_ref_id bigint,
    v_text text,
    v_num numeric,
    v_date date,
    raw text,
    CONSTRAINT activity_detail_check CHECK (((((((v_ref_id IS NOT NULL))::integer + ((v_text IS NOT NULL))::integer) + ((v_num IS NOT NULL))::integer) + ((v_date IS NOT NULL))::integer) = 1))
);


ALTER TABLE public.activity_detail OWNER TO billjansen;

--
-- Name: member; Type: TABLE; Schema: public; Owner: billjansen
--

CREATE TABLE public.member (
    member_id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    name text
);


ALTER TABLE public.member OWNER TO billjansen;

--
-- Name: point_expiration_rule; Type: TABLE; Schema: public; Owner: billjansen
--

CREATE TABLE public.point_expiration_rule (
    rule_key text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    expiration_date date NOT NULL
);


ALTER TABLE public.point_expiration_rule OWNER TO billjansen;

--
-- Name: point_lot; Type: TABLE; Schema: public; Owner: billjansen
--

CREATE TABLE public.point_lot (
    lot_id integer NOT NULL,
    member_id bigint,
    point_type text,
    qty integer,
    earned_at timestamp without time zone,
    expires_at date,
    source text
);


ALTER TABLE public.point_lot OWNER TO billjansen;

--
-- Name: point_lot_lot_id_seq; Type: SEQUENCE; Schema: public; Owner: billjansen
--

CREATE SEQUENCE public.point_lot_lot_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.point_lot_lot_id_seq OWNER TO billjansen;

--
-- Name: point_lot_lot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: billjansen
--

ALTER SEQUENCE public.point_lot_lot_id_seq OWNED BY public.point_lot.lot_id;


--
-- Name: point_type; Type: TABLE; Schema: public; Owner: billjansen
--

CREATE TABLE public.point_type (
    tenant_id bigint NOT NULL,
    point_type text NOT NULL,
    name text NOT NULL,
    expires_days integer,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.point_type OWNER TO billjansen;

--
-- Name: settings; Type: TABLE; Schema: public; Owner: billjansen
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.settings OWNER TO billjansen;

--
-- Name: tenant; Type: TABLE; Schema: public; Owner: billjansen
--

CREATE TABLE public.tenant (
    tenant_id bigint NOT NULL,
    tenant_key text NOT NULL,
    name text NOT NULL,
    industry text DEFAULT 'airline'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tenant OWNER TO billjansen;

--
-- Name: tenant_settings; Type: TABLE; Schema: public; Owner: billjansen
--

CREATE TABLE public.tenant_settings (
    tenant_id bigint NOT NULL,
    display_unit_singular text DEFAULT 'mile'::text NOT NULL,
    display_unit_plural text DEFAULT 'miles'::text NOT NULL,
    airline_fields jsonb DEFAULT jsonb_build_object('carrier_code', true, 'origin', true, 'destination', true, 'fare_class', true) NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tenant_settings OWNER TO billjansen;

--
-- Name: tenant_tenant_id_seq; Type: SEQUENCE; Schema: public; Owner: billjansen
--

CREATE SEQUENCE public.tenant_tenant_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tenant_tenant_id_seq OWNER TO billjansen;

--
-- Name: tenant_tenant_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: billjansen
--

ALTER SEQUENCE public.tenant_tenant_id_seq OWNED BY public.tenant.tenant_id;


--
-- Name: tenant_terms; Type: TABLE; Schema: public; Owner: billjansen
--

CREATE TABLE public.tenant_terms (
    tenant_id bigint NOT NULL,
    term_key text NOT NULL,
    term_value text NOT NULL
);


ALTER TABLE public.tenant_terms OWNER TO billjansen;

--
-- Name: activity_attr; Type: TABLE; Schema: t_delta; Owner: billjansen
--

CREATE TABLE t_delta.activity_attr (
    activity_id bigint NOT NULL,
    key text NOT NULL,
    value_text text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_delta.activity_attr OWNER TO billjansen;

--
-- Name: airports; Type: TABLE; Schema: t_delta; Owner: billjansen
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
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_delta.airports OWNER TO billjansen;

--
-- Name: airports_stage; Type: TABLE; Schema: t_delta; Owner: billjansen
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


ALTER TABLE t_delta.airports_stage OWNER TO billjansen;

--
-- Name: attr_def; Type: TABLE; Schema: t_delta; Owner: billjansen
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
    unit text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_delta.attr_def OWNER TO billjansen;

--
-- Name: attr_def_attr_id_seq; Type: SEQUENCE; Schema: t_delta; Owner: billjansen
--

CREATE SEQUENCE t_delta.attr_def_attr_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE t_delta.attr_def_attr_id_seq OWNER TO billjansen;

--
-- Name: attr_def_attr_id_seq; Type: SEQUENCE OWNED BY; Schema: t_delta; Owner: billjansen
--

ALTER SEQUENCE t_delta.attr_def_attr_id_seq OWNED BY t_delta.attr_def.attr_id;


--
-- Name: carriers; Type: TABLE; Schema: t_delta; Owner: billjansen
--

CREATE TABLE t_delta.carriers (
    code text NOT NULL,
    name text NOT NULL,
    alliance text,
    country text,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_delta.carriers OWNER TO billjansen;

--
-- Name: extensions_hooks; Type: TABLE; Schema: t_delta; Owner: billjansen
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


ALTER TABLE t_delta.extensions_hooks OWNER TO billjansen;

--
-- Name: label_map; Type: TABLE; Schema: t_delta; Owner: billjansen
--

CREATE TABLE t_delta.label_map (
    context text NOT NULL,
    field_id text NOT NULL,
    label text NOT NULL,
    aliases jsonb DEFAULT '[]'::jsonb NOT NULL,
    help_text text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_delta.label_map OWNER TO billjansen;

--
-- Name: member_attr; Type: TABLE; Schema: t_delta; Owner: billjansen
--

CREATE TABLE t_delta.member_attr (
    member_id bigint NOT NULL,
    key text NOT NULL,
    value_text text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_delta.member_attr OWNER TO billjansen;

--
-- Name: theme; Type: TABLE; Schema: t_delta; Owner: billjansen
--

CREATE TABLE t_delta.theme (
    theme_id bigint NOT NULL,
    tokens jsonb DEFAULT '{}'::jsonb NOT NULL,
    assets jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_delta.theme OWNER TO billjansen;

--
-- Name: theme_theme_id_seq; Type: SEQUENCE; Schema: t_delta; Owner: billjansen
--

CREATE SEQUENCE t_delta.theme_theme_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE t_delta.theme_theme_id_seq OWNER TO billjansen;

--
-- Name: theme_theme_id_seq; Type: SEQUENCE OWNED BY; Schema: t_delta; Owner: billjansen
--

ALTER SEQUENCE t_delta.theme_theme_id_seq OWNED BY t_delta.theme.theme_id;


--
-- Name: tier_levels; Type: TABLE; Schema: t_delta; Owner: billjansen
--

CREATE TABLE t_delta.tier_levels (
    tier_code text NOT NULL,
    name text NOT NULL,
    rank_order integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_delta.tier_levels OWNER TO billjansen;

--
-- Name: v_lookup_summary; Type: VIEW; Schema: t_delta; Owner: billjansen
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


ALTER TABLE t_delta.v_lookup_summary OWNER TO billjansen;

--
-- Name: activity_attr; Type: TABLE; Schema: t_demo; Owner: billjansen
--

CREATE TABLE t_demo.activity_attr (
    activity_id bigint NOT NULL,
    key text NOT NULL,
    value_text text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_demo.activity_attr OWNER TO billjansen;

--
-- Name: airports; Type: TABLE; Schema: t_demo; Owner: billjansen
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
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_demo.airports OWNER TO billjansen;

--
-- Name: attr_def; Type: TABLE; Schema: t_demo; Owner: billjansen
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
    unit text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_demo.attr_def OWNER TO billjansen;

--
-- Name: attr_def_attr_id_seq; Type: SEQUENCE; Schema: t_demo; Owner: billjansen
--

CREATE SEQUENCE t_demo.attr_def_attr_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE t_demo.attr_def_attr_id_seq OWNER TO billjansen;

--
-- Name: attr_def_attr_id_seq; Type: SEQUENCE OWNED BY; Schema: t_demo; Owner: billjansen
--

ALTER SEQUENCE t_demo.attr_def_attr_id_seq OWNED BY t_demo.attr_def.attr_id;


--
-- Name: carriers; Type: TABLE; Schema: t_demo; Owner: billjansen
--

CREATE TABLE t_demo.carriers (
    code text NOT NULL,
    name text NOT NULL,
    alliance text,
    country text,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_demo.carriers OWNER TO billjansen;

--
-- Name: extensions_hooks; Type: TABLE; Schema: t_demo; Owner: billjansen
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


ALTER TABLE t_demo.extensions_hooks OWNER TO billjansen;

--
-- Name: label_map; Type: TABLE; Schema: t_demo; Owner: billjansen
--

CREATE TABLE t_demo.label_map (
    context text NOT NULL,
    field_id text NOT NULL,
    label text NOT NULL,
    aliases jsonb DEFAULT '[]'::jsonb NOT NULL,
    help_text text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_demo.label_map OWNER TO billjansen;

--
-- Name: member_attr; Type: TABLE; Schema: t_demo; Owner: billjansen
--

CREATE TABLE t_demo.member_attr (
    member_id bigint NOT NULL,
    key text NOT NULL,
    value_text text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_demo.member_attr OWNER TO billjansen;

--
-- Name: theme; Type: TABLE; Schema: t_demo; Owner: billjansen
--

CREATE TABLE t_demo.theme (
    theme_id bigint NOT NULL,
    tokens jsonb DEFAULT '{}'::jsonb NOT NULL,
    assets jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_demo.theme OWNER TO billjansen;

--
-- Name: theme_theme_id_seq; Type: SEQUENCE; Schema: t_demo; Owner: billjansen
--

CREATE SEQUENCE t_demo.theme_theme_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE t_demo.theme_theme_id_seq OWNER TO billjansen;

--
-- Name: theme_theme_id_seq; Type: SEQUENCE OWNED BY; Schema: t_demo; Owner: billjansen
--

ALTER SEQUENCE t_demo.theme_theme_id_seq OWNED BY t_demo.theme.theme_id;


--
-- Name: tier_levels; Type: TABLE; Schema: t_demo; Owner: billjansen
--

CREATE TABLE t_demo.tier_levels (
    tier_code text NOT NULL,
    name text NOT NULL,
    rank_order integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE t_demo.tier_levels OWNER TO billjansen;

--
-- Name: activity activity_id; Type: DEFAULT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.activity ALTER COLUMN activity_id SET DEFAULT nextval('public.activity_activity_id_seq'::regclass);


--
-- Name: point_lot lot_id; Type: DEFAULT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.point_lot ALTER COLUMN lot_id SET DEFAULT nextval('public.point_lot_lot_id_seq'::regclass);


--
-- Name: tenant tenant_id; Type: DEFAULT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.tenant ALTER COLUMN tenant_id SET DEFAULT nextval('public.tenant_tenant_id_seq'::regclass);


--
-- Name: attr_def attr_id; Type: DEFAULT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.attr_def ALTER COLUMN attr_id SET DEFAULT nextval('t_delta.attr_def_attr_id_seq'::regclass);


--
-- Name: theme theme_id; Type: DEFAULT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.theme ALTER COLUMN theme_id SET DEFAULT nextval('t_delta.theme_theme_id_seq'::regclass);


--
-- Name: attr_def attr_id; Type: DEFAULT; Schema: t_demo; Owner: billjansen
--

ALTER TABLE ONLY t_demo.attr_def ALTER COLUMN attr_id SET DEFAULT nextval('t_demo.attr_def_attr_id_seq'::regclass);


--
-- Name: theme theme_id; Type: DEFAULT; Schema: t_demo; Owner: billjansen
--

ALTER TABLE ONLY t_demo.theme ALTER COLUMN theme_id SET DEFAULT nextval('t_demo.theme_theme_id_seq'::regclass);


--
-- Name: activity_detail activity_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.activity_detail
    ADD CONSTRAINT activity_detail_pkey PRIMARY KEY (activity_id, k);


--
-- Name: activity activity_pkey; Type: CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_pkey PRIMARY KEY (activity_id);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (member_id);


--
-- Name: point_expiration_rule point_expiration_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.point_expiration_rule
    ADD CONSTRAINT point_expiration_rule_pkey PRIMARY KEY (rule_key);


--
-- Name: point_lot point_lot_pkey; Type: CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.point_lot
    ADD CONSTRAINT point_lot_pkey PRIMARY KEY (lot_id);


--
-- Name: point_type point_type_pkey; Type: CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.point_type
    ADD CONSTRAINT point_type_pkey PRIMARY KEY (tenant_id, point_type);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: tenant tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant_settings tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant tenant_tenant_key_key; Type: CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_tenant_key_key UNIQUE (tenant_key);


--
-- Name: tenant_terms tenant_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.tenant_terms
    ADD CONSTRAINT tenant_terms_pkey PRIMARY KEY (tenant_id, term_key);


--
-- Name: activity_attr activity_attr_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.activity_attr
    ADD CONSTRAINT activity_attr_pkey PRIMARY KEY (activity_id, key);


--
-- Name: airports airports_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.airports
    ADD CONSTRAINT airports_pkey PRIMARY KEY (iata);


--
-- Name: airports_stage airports_stage_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.airports_stage
    ADD CONSTRAINT airports_stage_pkey PRIMARY KEY (iata);


--
-- Name: attr_def attr_def_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.attr_def
    ADD CONSTRAINT attr_def_pkey PRIMARY KEY (attr_id);


--
-- Name: attr_def attr_def_unique; Type: CONSTRAINT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.attr_def
    ADD CONSTRAINT attr_def_unique UNIQUE (target, key);


--
-- Name: carriers carriers_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.carriers
    ADD CONSTRAINT carriers_pkey PRIMARY KEY (code);


--
-- Name: extensions_hooks extensions_hooks_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.extensions_hooks
    ADD CONSTRAINT extensions_hooks_pkey PRIMARY KEY (name);


--
-- Name: label_map label_map_unique; Type: CONSTRAINT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.label_map
    ADD CONSTRAINT label_map_unique UNIQUE (context, field_id);


--
-- Name: member_attr member_attr_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.member_attr
    ADD CONSTRAINT member_attr_pkey PRIMARY KEY (member_id, key);


--
-- Name: theme theme_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.theme
    ADD CONSTRAINT theme_pkey PRIMARY KEY (theme_id);


--
-- Name: tier_levels tier_levels_pkey; Type: CONSTRAINT; Schema: t_delta; Owner: billjansen
--

ALTER TABLE ONLY t_delta.tier_levels
    ADD CONSTRAINT tier_levels_pkey PRIMARY KEY (tier_code);


--
-- Name: activity_attr activity_attr_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: billjansen
--

ALTER TABLE ONLY t_demo.activity_attr
    ADD CONSTRAINT activity_attr_pkey PRIMARY KEY (activity_id, key);


--
-- Name: airports airports_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: billjansen
--

ALTER TABLE ONLY t_demo.airports
    ADD CONSTRAINT airports_pkey PRIMARY KEY (iata);


--
-- Name: attr_def attr_def_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: billjansen
--

ALTER TABLE ONLY t_demo.attr_def
    ADD CONSTRAINT attr_def_pkey PRIMARY KEY (attr_id);


--
-- Name: attr_def attr_def_unique; Type: CONSTRAINT; Schema: t_demo; Owner: billjansen
--

ALTER TABLE ONLY t_demo.attr_def
    ADD CONSTRAINT attr_def_unique UNIQUE (target, key);


--
-- Name: carriers carriers_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: billjansen
--

ALTER TABLE ONLY t_demo.carriers
    ADD CONSTRAINT carriers_pkey PRIMARY KEY (code);


--
-- Name: extensions_hooks extensions_hooks_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: billjansen
--

ALTER TABLE ONLY t_demo.extensions_hooks
    ADD CONSTRAINT extensions_hooks_pkey PRIMARY KEY (name);


--
-- Name: label_map label_map_unique; Type: CONSTRAINT; Schema: t_demo; Owner: billjansen
--

ALTER TABLE ONLY t_demo.label_map
    ADD CONSTRAINT label_map_unique UNIQUE (context, field_id);


--
-- Name: member_attr member_attr_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: billjansen
--

ALTER TABLE ONLY t_demo.member_attr
    ADD CONSTRAINT member_attr_pkey PRIMARY KEY (member_id, key);


--
-- Name: theme theme_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: billjansen
--

ALTER TABLE ONLY t_demo.theme
    ADD CONSTRAINT theme_pkey PRIMARY KEY (theme_id);


--
-- Name: tier_levels tier_levels_pkey; Type: CONSTRAINT; Schema: t_demo; Owner: billjansen
--

ALTER TABLE ONLY t_demo.tier_levels
    ADD CONSTRAINT tier_levels_pkey PRIMARY KEY (tier_code);


--
-- Name: activity_detail_activity_idx; Type: INDEX; Schema: public; Owner: billjansen
--

CREATE INDEX activity_detail_activity_idx ON public.activity_detail USING btree (activity_id, k);


--
-- Name: activity_detail_key_ref_idx; Type: INDEX; Schema: public; Owner: billjansen
--

CREATE INDEX activity_detail_key_ref_idx ON public.activity_detail USING btree (k, v_ref_id);


--
-- Name: activity_member_date_idx; Type: INDEX; Schema: public; Owner: billjansen
--

CREATE INDEX activity_member_date_idx ON public.activity USING btree (member_id, activity_date DESC);


--
-- Name: member_tenant_member_id_uq; Type: INDEX; Schema: public; Owner: billjansen
--

CREATE UNIQUE INDEX member_tenant_member_id_uq ON public.member USING btree (tenant_id, member_id);


--
-- Name: activity_detail activity_detail_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.activity_detail
    ADD CONSTRAINT activity_detail_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activity(activity_id) ON DELETE CASCADE;


--
-- Name: activity activity_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.member(member_id) ON DELETE CASCADE;


--
-- Name: member member_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id) ON DELETE RESTRICT;


--
-- Name: point_type point_type_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.point_type
    ADD CONSTRAINT point_type_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id) ON DELETE CASCADE;


--
-- Name: tenant_settings tenant_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id) ON DELETE CASCADE;


--
-- Name: tenant_terms tenant_terms_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: billjansen
--

ALTER TABLE ONLY public.tenant_terms
    ADD CONSTRAINT tenant_terms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id) ON DELETE CASCADE;


--
-- Name: member; Type: ROW SECURITY; Schema: public; Owner: billjansen
--

ALTER TABLE public.member ENABLE ROW LEVEL SECURITY;

--
-- Name: member member_rls_tenant; Type: POLICY; Schema: public; Owner: billjansen
--

CREATE POLICY member_rls_tenant ON public.member USING ((tenant_id = public.app_current_tenant_id()));


--
-- PostgreSQL database dump complete
--

\unrestrict YFFCcd8sxDd2HmOhHIvLNmz6QjjXx2E6lC8GpC8JLGyi9sOEXOZAPQm6ZwmmFAC

