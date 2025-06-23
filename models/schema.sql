--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8 (Debian 16.8-1.pgdg120+1)
-- Dumped by pg_dump version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.admin_users OWNER TO postgres;

--
-- Name: admin_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_users_id_seq OWNER TO postgres;

--
-- Name: admin_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_users_id_seq OWNED BY public.admin_users.id;


--
-- Name: clock_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clock_entries (
    id integer NOT NULL,
    worker_id character varying(5) NOT NULL,
    project_id integer,
    action character varying(10) NOT NULL,
    datetime_utc character varying NOT NULL,
    datetime_local character varying,
    timezone character varying(50),
    note text,
    pay_rate numeric(8,2),
    regular_time numeric(5,2),
    overtime numeric(5,2),
    pay_amount numeric(10,2),
    paid boolean DEFAULT false,
    paid_date date,
    billed boolean DEFAULT false,
    billed_date date,
    admin_forced_by character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    session_id uuid,
    timezone_offset integer,
    CONSTRAINT clock_entries_action_check CHECK (((action)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying])::text[])))
);


ALTER TABLE public.clock_entries OWNER TO postgres;

--
-- Name: clock_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clock_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clock_entries_id_seq OWNER TO postgres;

--
-- Name: clock_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clock_entries_id_seq OWNED BY public.clock_entries.id;


--
-- Name: pay_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pay_rates (
    id integer NOT NULL,
    worker_id character varying(5) NOT NULL,
    rate numeric(8,2) NOT NULL,
    start_date date NOT NULL,
    end_date date
);


ALTER TABLE public.pay_rates OWNER TO postgres;

--
-- Name: pay_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pay_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pay_rates_id_seq OWNER TO postgres;

--
-- Name: pay_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pay_rates_id_seq OWNED BY public.pay_rates.id;


--
-- Name: project_workers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_workers (
    id integer NOT NULL,
    project_id integer NOT NULL,
    worker_id character varying(5) NOT NULL
);


ALTER TABLE public.project_workers OWNER TO postgres;

--
-- Name: project_workers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.project_workers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.project_workers_id_seq OWNER TO postgres;

--
-- Name: project_workers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.project_workers_id_seq OWNED BY public.project_workers.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    location character varying(100),
    city character varying(100),
    start_date character varying,
    finish_date character varying,
    hidden boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.projects_id_seq OWNER TO postgres;

--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: workers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workers (
    id integer NOT NULL,
    worker_id character varying(5) NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    start_date character varying NOT NULL,
    end_date character varying,
    note text,
    inactive boolean DEFAULT false,
    password_hash text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workers OWNER TO postgres;

--
-- Name: workers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.workers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workers_id_seq OWNER TO postgres;

--
-- Name: workers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.workers_id_seq OWNED BY public.workers.id;


--
-- Name: admin_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_users ALTER COLUMN id SET DEFAULT nextval('public.admin_users_id_seq'::regclass);


--
-- Name: clock_entries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clock_entries ALTER COLUMN id SET DEFAULT nextval('public.clock_entries_id_seq'::regclass);


--
-- Name: pay_rates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pay_rates ALTER COLUMN id SET DEFAULT nextval('public.pay_rates_id_seq'::regclass);


--
-- Name: project_workers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_workers ALTER COLUMN id SET DEFAULT nextval('public.project_workers_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: workers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers ALTER COLUMN id SET DEFAULT nextval('public.workers_id_seq'::regclass);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_username_key UNIQUE (username);


--
-- Name: clock_entries clock_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clock_entries
    ADD CONSTRAINT clock_entries_pkey PRIMARY KEY (id);


--
-- Name: pay_rates pay_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pay_rates
    ADD CONSTRAINT pay_rates_pkey PRIMARY KEY (id);


--
-- Name: project_workers project_workers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_workers
    ADD CONSTRAINT project_workers_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: workers workers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT workers_pkey PRIMARY KEY (id);


--
-- Name: workers workers_worker_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT workers_worker_id_key UNIQUE (worker_id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: clock_entries clock_entries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clock_entries
    ADD CONSTRAINT clock_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: clock_entries clock_entries_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clock_entries
    ADD CONSTRAINT clock_entries_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id);


--
-- Name: pay_rates pay_rates_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pay_rates
    ADD CONSTRAINT pay_rates_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id);


--
-- Name: project_workers project_workers_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_workers
    ADD CONSTRAINT project_workers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_workers project_workers_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_workers
    ADD CONSTRAINT project_workers_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id);


--
-- PostgreSQL database dump complete
--

