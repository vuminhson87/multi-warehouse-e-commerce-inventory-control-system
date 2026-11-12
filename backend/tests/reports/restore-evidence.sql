--
-- PostgreSQL database dump
--

\restrict AQg3LCkbrrBc57PqZd49ooRlyY5RFOPs5dsY37kBFPZi42GkTmm449hNnzTv99J

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

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

ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_assigned_warehouse_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_reservations DROP CONSTRAINT IF EXISTS stock_reservations_warehouse_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_reservations DROP CONSTRAINT IF EXISTS stock_reservations_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_reservations DROP CONSTRAINT IF EXISTS stock_reservations_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.payment_attempts DROP CONSTRAINT IF EXISTS payment_attempts_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_warehouse_id_fkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.low_stock_alerts DROP CONSTRAINT IF EXISTS low_stock_alerts_warehouse_id_fkey;
ALTER TABLE IF EXISTS ONLY public.low_stock_alerts DROP CONSTRAINT IF EXISTS low_stock_alerts_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_warehouse_id_fkey;
ALTER TABLE IF EXISTS ONLY public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_actor_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.inventories DROP CONSTRAINT IF EXISTS inventories_warehouse_id_fkey;
ALTER TABLE IF EXISTS ONLY public.inventories DROP CONSTRAINT IF EXISTS inventories_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.idempotency_records DROP CONSTRAINT IF EXISTS idempotency_records_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.idempotency_records DROP CONSTRAINT IF EXISTS idempotency_records_order_id_fkey;
DROP INDEX IF EXISTS public.warehouses_code_key;
DROP INDEX IF EXISTS public.users_username_key;
DROP INDEX IF EXISTS public.users_role_idx;
DROP INDEX IF EXISTS public.stock_reservations_status_expires_at_idx;
DROP INDEX IF EXISTS public.stock_reservations_order_id_status_idx;
DROP INDEX IF EXISTS public.stock_reservations_one_active_per_item;
DROP INDEX IF EXISTS public.products_sku_key;
DROP INDEX IF EXISTS public.products_name_lower_idx;
DROP INDEX IF EXISTS public.products_name_idx;
DROP INDEX IF EXISTS public.products_is_active_category_idx;
DROP INDEX IF EXISTS public.payment_attempts_order_id_created_at_idx;
DROP INDEX IF EXISTS public.payment_attempts_one_pending_per_order;
DROP INDEX IF EXISTS public.payment_attempts_gateway_ref_key;
DROP INDEX IF EXISTS public.orders_status_idx;
DROP INDEX IF EXISTS public.orders_customer_id_created_at_idx;
DROP INDEX IF EXISTS public.order_items_order_id_product_id_key;
DROP INDEX IF EXISTS public.low_stock_alerts_warehouse_id_status_idx;
DROP INDEX IF EXISTS public.low_stock_alerts_one_open_per_item;
DROP INDEX IF EXISTS public.inventory_movements_warehouse_id_product_id_created_at_idx;
DROP INDEX IF EXISTS public.inventory_movements_order_id_idx;
DROP INDEX IF EXISTS public.inventories_warehouse_id_product_id_key;
DROP INDEX IF EXISTS public.inventories_product_id_idx;
DROP INDEX IF EXISTS public.idempotency_records_user_id_operation_key_key;
ALTER TABLE IF EXISTS ONLY public.warehouses DROP CONSTRAINT IF EXISTS warehouses_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.stock_reservations DROP CONSTRAINT IF EXISTS stock_reservations_pkey;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_pkey;
ALTER TABLE IF EXISTS ONLY public.payment_attempts DROP CONSTRAINT IF EXISTS payment_attempts_pkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_pkey;
ALTER TABLE IF EXISTS ONLY public.order_items DROP CONSTRAINT IF EXISTS order_items_pkey;
ALTER TABLE IF EXISTS ONLY public.low_stock_alerts DROP CONSTRAINT IF EXISTS low_stock_alerts_pkey;
ALTER TABLE IF EXISTS ONLY public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_pkey;
ALTER TABLE IF EXISTS ONLY public.inventories DROP CONSTRAINT IF EXISTS inventories_pkey;
ALTER TABLE IF EXISTS ONLY public.idempotency_records DROP CONSTRAINT IF EXISTS idempotency_records_pkey;
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
ALTER TABLE IF EXISTS public.warehouses ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.stock_reservations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.products ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.payment_attempts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.orders ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.order_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.low_stock_alerts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.inventory_movements ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.inventories ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.idempotency_records ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.warehouses_id_seq;
DROP TABLE IF EXISTS public.warehouses;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.stock_reservations_id_seq;
DROP TABLE IF EXISTS public.stock_reservations;
DROP SEQUENCE IF EXISTS public.products_id_seq;
DROP TABLE IF EXISTS public.products;
DROP SEQUENCE IF EXISTS public.payment_attempts_id_seq;
DROP TABLE IF EXISTS public.payment_attempts;
DROP SEQUENCE IF EXISTS public.orders_id_seq;
DROP TABLE IF EXISTS public.orders;
DROP SEQUENCE IF EXISTS public.order_items_id_seq;
DROP TABLE IF EXISTS public.order_items;
DROP SEQUENCE IF EXISTS public.low_stock_alerts_id_seq;
DROP TABLE IF EXISTS public.low_stock_alerts;
DROP SEQUENCE IF EXISTS public.inventory_movements_id_seq;
DROP TABLE IF EXISTS public.inventory_movements;
DROP SEQUENCE IF EXISTS public.inventories_id_seq;
DROP TABLE IF EXISTS public.inventories;
DROP SEQUENCE IF EXISTS public.idempotency_records_id_seq;
DROP TABLE IF EXISTS public.idempotency_records;
DROP TABLE IF EXISTS public._prisma_migrations;
DROP TYPE IF EXISTS public."Role";
DROP TYPE IF EXISTS public."ReservationStatus";
DROP TYPE IF EXISTS public."PaymentAttemptStatus";
DROP TYPE IF EXISTS public."OrderStatus";
DROP TYPE IF EXISTS public."InventoryMovementType";
DROP TYPE IF EXISTS public."IdempotencyOperation";
DROP TYPE IF EXISTS public."AlertStatus";
--
-- Name: AlertStatus; Type: TYPE; Schema: public; Owner: mw_user
--

CREATE TYPE public."AlertStatus" AS ENUM (
    'OPEN',
    'RESOLVED'
);


ALTER TYPE public."AlertStatus" OWNER TO mw_user;

--
-- Name: IdempotencyOperation; Type: TYPE; Schema: public; Owner: mw_user
--

CREATE TYPE public."IdempotencyOperation" AS ENUM (
    'CREATE_ORDER',
    'PAY_ORDER',
    'CANCEL_ORDER'
);


ALTER TYPE public."IdempotencyOperation" OWNER TO mw_user;

--
-- Name: InventoryMovementType; Type: TYPE; Schema: public; Owner: mw_user
--

CREATE TYPE public."InventoryMovementType" AS ENUM (
    'RESERVE',
    'RELEASE',
    'CONSUME',
    'RESTORE',
    'RESTOCK',
    'ADJUST'
);


ALTER TYPE public."InventoryMovementType" OWNER TO mw_user;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: mw_user
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PendingPayment',
    'Paid',
    'Processing',
    'Completed',
    'Cancelled'
);


ALTER TYPE public."OrderStatus" OWNER TO mw_user;

--
-- Name: PaymentAttemptStatus; Type: TYPE; Schema: public; Owner: mw_user
--

CREATE TYPE public."PaymentAttemptStatus" AS ENUM (
    'PENDING',
    'SUCCEEDED',
    'FAILED',
    'INCOMPLETE'
);


ALTER TYPE public."PaymentAttemptStatus" OWNER TO mw_user;

--
-- Name: ReservationStatus; Type: TYPE; Schema: public; Owner: mw_user
--

CREATE TYPE public."ReservationStatus" AS ENUM (
    'ACTIVE',
    'CONSUMED',
    'RELEASED',
    'EXPIRED'
);


ALTER TYPE public."ReservationStatus" OWNER TO mw_user;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: mw_user
--

CREATE TYPE public."Role" AS ENUM (
    'CUSTOMER',
    'WAREHOUSE_MANAGER',
    'ADMIN'
);


ALTER TYPE public."Role" OWNER TO mw_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: mw_user
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO mw_user;

--
-- Name: idempotency_records; Type: TABLE; Schema: public; Owner: mw_user
--

CREATE TABLE public.idempotency_records (
    id integer NOT NULL,
    user_id integer NOT NULL,
    operation public."IdempotencyOperation" NOT NULL,
    key uuid NOT NULL,
    request_hash character varying(64) NOT NULL,
    order_id integer,
    response_status integer,
    response_body jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(3) without time zone
);


ALTER TABLE public.idempotency_records OWNER TO mw_user;

--
-- Name: idempotency_records_id_seq; Type: SEQUENCE; Schema: public; Owner: mw_user
--

CREATE SEQUENCE public.idempotency_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.idempotency_records_id_seq OWNER TO mw_user;

--
-- Name: idempotency_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mw_user
--

ALTER SEQUENCE public.idempotency_records_id_seq OWNED BY public.idempotency_records.id;


--
-- Name: inventories; Type: TABLE; Schema: public; Owner: mw_user
--

CREATE TABLE public.inventories (
    id integer NOT NULL,
    warehouse_id integer NOT NULL,
    product_id integer NOT NULL,
    on_hand integer DEFAULT 0 NOT NULL,
    reserved integer DEFAULT 0 NOT NULL,
    low_stock_threshold integer DEFAULT 0 NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT inventories_on_hand_non_negative CHECK ((on_hand >= 0)),
    CONSTRAINT inventories_reserved_le_on_hand CHECK ((reserved <= on_hand)),
    CONSTRAINT inventories_reserved_non_negative CHECK ((reserved >= 0)),
    CONSTRAINT inventories_threshold_non_negative CHECK ((low_stock_threshold >= 0))
);


ALTER TABLE public.inventories OWNER TO mw_user;

--
-- Name: inventories_id_seq; Type: SEQUENCE; Schema: public; Owner: mw_user
--

CREATE SEQUENCE public.inventories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventories_id_seq OWNER TO mw_user;

--
-- Name: inventories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mw_user
--

ALTER SEQUENCE public.inventories_id_seq OWNED BY public.inventories.id;


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: mw_user
--

CREATE TABLE public.inventory_movements (
    id integer NOT NULL,
    warehouse_id integer NOT NULL,
    product_id integer NOT NULL,
    type public."InventoryMovementType" NOT NULL,
    quantity integer NOT NULL,
    on_hand_after integer NOT NULL,
    reserved_after integer NOT NULL,
    order_id integer,
    actor_user_id integer,
    note character varying(255),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT inventory_movements_after_valid CHECK (((on_hand_after >= 0) AND (reserved_after >= 0) AND (reserved_after <= on_hand_after))),
    CONSTRAINT inventory_movements_quantity_positive CHECK ((quantity > 0))
);


ALTER TABLE public.inventory_movements OWNER TO mw_user;

--
-- Name: inventory_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: mw_user
--

CREATE SEQUENCE public.inventory_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_movements_id_seq OWNER TO mw_user;

--
-- Name: inventory_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mw_user
--

ALTER SEQUENCE public.inventory_movements_id_seq OWNED BY public.inventory_movements.id;


--
-- Name: low_stock_alerts; Type: TABLE; Schema: public; Owner: mw_user
--

CREATE TABLE public.low_stock_alerts (
    id integer NOT NULL,
    warehouse_id integer NOT NULL,
    product_id integer NOT NULL,
    available_at_trigger integer NOT NULL,
    threshold integer NOT NULL,
    status public."AlertStatus" DEFAULT 'OPEN'::public."AlertStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resolved_at timestamp(3) without time zone,
    CONSTRAINT low_stock_alerts_threshold_non_negative CHECK ((threshold >= 0))
);


ALTER TABLE public.low_stock_alerts OWNER TO mw_user;

--
-- Name: low_stock_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: mw_user
--

CREATE SEQUENCE public.low_stock_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.low_stock_alerts_id_seq OWNER TO mw_user;

--
-- Name: low_stock_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mw_user
--

ALTER SEQUENCE public.low_stock_alerts_id_seq OWNED BY public.low_stock_alerts.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: mw_user
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    product_name_snapshot character varying(200) NOT NULL,
    unit_price_snapshot numeric(15,2) NOT NULL,
    quantity integer NOT NULL,
    line_total numeric(15,2) NOT NULL,
    CONSTRAINT order_items_line_total_non_negative CHECK ((line_total >= (0)::numeric)),
    CONSTRAINT order_items_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT order_items_unit_price_non_negative CHECK ((unit_price_snapshot >= (0)::numeric))
);


ALTER TABLE public.order_items OWNER TO mw_user;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: mw_user
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO mw_user;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mw_user
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: mw_user
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    fulfillment_warehouse_id integer NOT NULL,
    status public."OrderStatus" DEFAULT 'PendingPayment'::public."OrderStatus" NOT NULL,
    total_amount numeric(15,2) NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    paid_at timestamp(3) without time zone,
    cancelled_at timestamp(3) without time zone,
    CONSTRAINT orders_total_non_negative CHECK ((total_amount >= (0)::numeric))
);


ALTER TABLE public.orders OWNER TO mw_user;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: mw_user
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO mw_user;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mw_user
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: payment_attempts; Type: TABLE; Schema: public; Owner: mw_user
--

CREATE TABLE public.payment_attempts (
    id integer NOT NULL,
    order_id integer NOT NULL,
    status public."PaymentAttemptStatus" DEFAULT 'PENDING'::public."PaymentAttemptStatus" NOT NULL,
    amount numeric(15,2) NOT NULL,
    gateway_ref character varying(64),
    failure_reason character varying(255),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(3) without time zone,
    CONSTRAINT payment_attempts_amount_non_negative CHECK ((amount >= (0)::numeric))
);


ALTER TABLE public.payment_attempts OWNER TO mw_user;

--
-- Name: payment_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: mw_user
--

CREATE SEQUENCE public.payment_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_attempts_id_seq OWNER TO mw_user;

--
-- Name: payment_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mw_user
--

ALTER SEQUENCE public.payment_attempts_id_seq OWNED BY public.payment_attempts.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: mw_user
--

CREATE TABLE public.products (
    id integer NOT NULL,
    sku character varying(40) NOT NULL,
    name character varying(200) NOT NULL,
    category character varying(80) NOT NULL,
    price numeric(15,2) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    image_url character varying(500),
    is_active boolean DEFAULT true NOT NULL,
    discontinued_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT products_price_positive CHECK ((price > (0)::numeric))
);


ALTER TABLE public.products OWNER TO mw_user;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: mw_user
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO mw_user;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mw_user
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: stock_reservations; Type: TABLE; Schema: public; Owner: mw_user
--

CREATE TABLE public.stock_reservations (
    id integer NOT NULL,
    order_id integer NOT NULL,
    warehouse_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    status public."ReservationStatus" DEFAULT 'ACTIVE'::public."ReservationStatus" NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    released_at timestamp(3) without time zone,
    consumed_at timestamp(3) without time zone,
    CONSTRAINT stock_reservations_quantity_positive CHECK ((quantity > 0))
);


ALTER TABLE public.stock_reservations OWNER TO mw_user;

--
-- Name: stock_reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: mw_user
--

CREATE SEQUENCE public.stock_reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_reservations_id_seq OWNER TO mw_user;

--
-- Name: stock_reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mw_user
--

ALTER SEQUENCE public.stock_reservations_id_seq OWNED BY public.stock_reservations.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: mw_user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(100) NOT NULL,
    full_name character varying(120),
    role public."Role" NOT NULL,
    assigned_warehouse_id integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT users_manager_has_warehouse CHECK ((((role = 'WAREHOUSE_MANAGER'::public."Role") AND (assigned_warehouse_id IS NOT NULL)) OR ((role <> 'WAREHOUSE_MANAGER'::public."Role") AND (assigned_warehouse_id IS NULL))))
);


ALTER TABLE public.users OWNER TO mw_user;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: mw_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO mw_user;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mw_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: mw_user
--

CREATE TABLE public.warehouses (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(120) NOT NULL,
    address character varying(255),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.warehouses OWNER TO mw_user;

--
-- Name: warehouses_id_seq; Type: SEQUENCE; Schema: public; Owner: mw_user
--

CREATE SEQUENCE public.warehouses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.warehouses_id_seq OWNER TO mw_user;

--
-- Name: warehouses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mw_user
--

ALTER SEQUENCE public.warehouses_id_seq OWNED BY public.warehouses.id;


--
-- Name: idempotency_records id; Type: DEFAULT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.idempotency_records ALTER COLUMN id SET DEFAULT nextval('public.idempotency_records_id_seq'::regclass);


--
-- Name: inventories id; Type: DEFAULT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.inventories ALTER COLUMN id SET DEFAULT nextval('public.inventories_id_seq'::regclass);


--
-- Name: inventory_movements id; Type: DEFAULT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.inventory_movements ALTER COLUMN id SET DEFAULT nextval('public.inventory_movements_id_seq'::regclass);


--
-- Name: low_stock_alerts id; Type: DEFAULT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.low_stock_alerts ALTER COLUMN id SET DEFAULT nextval('public.low_stock_alerts_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: payment_attempts id; Type: DEFAULT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.payment_attempts ALTER COLUMN id SET DEFAULT nextval('public.payment_attempts_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: stock_reservations id; Type: DEFAULT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.stock_reservations ALTER COLUMN id SET DEFAULT nextval('public.stock_reservations_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: warehouses id; Type: DEFAULT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.warehouses ALTER COLUMN id SET DEFAULT nextval('public.warehouses_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: mw_user
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
8e7ca12d-ef4e-4f59-a0a0-778d6b21a7f9	dbdc9dcfb7176112063415e0d4a36787c13aef7f378abb0fc3653794123a0912	2026-10-29 14:38:24.416522+00	20261020000000_init_schema	\N	\N	2026-10-29 14:38:24.233516+00	1
\.


--
-- Data for Name: idempotency_records; Type: TABLE DATA; Schema: public; Owner: mw_user
--

COPY public.idempotency_records (id, user_id, operation, key, request_hash, order_id, response_status, response_body, created_at, completed_at) FROM stdin;
1	24	CREATE_ORDER	2dd0f5ea-501d-4449-85ab-2c8dc177c567	700539230214932c4d0ced62968aef257fca0da1937156517fbe5b4ff66014be	1	201	{"data": {"items": [{"quantity": 1, "lineTotal": "123.45", "productId": 1, "unitPrice": "123.45", "productName": "Product 1"}], "canPay": true, "paidAt": null, "status": "PendingPayment", "orderId": 1, "currency": "VND", "payments": [], "replayed": false, "canCancel": true, "createdAt": "2026-10-29T14:39:54.071Z", "updatedAt": "2026-10-29T14:39:54.071Z", "cancelledAt": null, "totalAmount": "123.45", "paymentCount": 0, "paymentInProgress": false, "hasActiveReservation": true, "reservationExpiresAt": "2026-10-29T14:54:54.065Z"}, "success": true}	2026-10-29 14:39:53.983	2026-10-29 14:39:54.372
2	2	CREATE_ORDER	16214bdc-54d9-4f0c-96e5-fa34d07dd3d9	700539230214932c4d0ced62968aef257fca0da1937156517fbe5b4ff66014be	2	201	{"data": {"items": [{"quantity": 1, "lineTotal": "123.45", "productId": 1, "unitPrice": "123.45", "productName": "Product 1"}], "canPay": true, "paidAt": null, "status": "PendingPayment", "orderId": 2, "currency": "VND", "payments": [], "replayed": false, "canCancel": true, "createdAt": "2026-10-29T14:39:54.474Z", "updatedAt": "2026-10-29T14:39:54.474Z", "cancelledAt": null, "totalAmount": "123.45", "paymentCount": 0, "paymentInProgress": false, "hasActiveReservation": true, "reservationExpiresAt": "2026-10-29T14:54:54.066Z"}, "success": true}	2026-10-29 14:39:54.058	2026-10-29 14:39:54.823
14	16	CREATE_ORDER	f86f6a4e-b3ea-4b7c-9f57-c667d75897ab	700539230214932c4d0ced62968aef257fca0da1937156517fbe5b4ff66014be	3	201	{"data": {"items": [{"quantity": 1, "lineTotal": "123.45", "productId": 1, "unitPrice": "123.45", "productName": "Product 1"}], "canPay": true, "paidAt": null, "status": "PendingPayment", "orderId": 3, "currency": "VND", "payments": [], "replayed": false, "canCancel": true, "createdAt": "2026-10-29T14:39:54.914Z", "updatedAt": "2026-10-29T14:39:54.914Z", "cancelledAt": null, "totalAmount": "123.45", "paymentCount": 0, "paymentInProgress": false, "hasActiveReservation": true, "reservationExpiresAt": "2026-10-29T14:54:54.869Z"}, "success": true}	2026-10-29 14:39:54.827	2026-10-29 14:39:55.285
4	30	CREATE_ORDER	e9c52e52-20d3-4a07-a7c1-f0099f4d7e04	700539230214932c4d0ced62968aef257fca0da1937156517fbe5b4ff66014be	4	201	{"data": {"items": [{"quantity": 1, "lineTotal": "123.45", "productId": 1, "unitPrice": "123.45", "productName": "Product 1"}], "canPay": true, "paidAt": null, "status": "PendingPayment", "orderId": 4, "currency": "VND", "payments": [], "replayed": false, "canCancel": true, "createdAt": "2026-10-29T14:39:55.399Z", "updatedAt": "2026-10-29T14:39:55.399Z", "cancelledAt": null, "totalAmount": "123.45", "paymentCount": 0, "paymentInProgress": false, "hasActiveReservation": true, "reservationExpiresAt": "2026-10-29T14:54:54.392Z"}, "success": true}	2026-10-29 14:39:54.34	2026-10-29 14:39:55.529
7	5	CREATE_ORDER	310e517f-7452-40d2-981e-f473287412db	700539230214932c4d0ced62968aef257fca0da1937156517fbe5b4ff66014be	5	201	{"data": {"items": [{"quantity": 1, "lineTotal": "123.45", "productId": 1, "unitPrice": "123.45", "productName": "Product 1"}], "canPay": true, "paidAt": null, "status": "PendingPayment", "orderId": 5, "currency": "VND", "payments": [], "replayed": false, "canCancel": true, "createdAt": "2026-10-29T14:39:55.576Z", "updatedAt": "2026-10-29T14:39:55.576Z", "cancelledAt": null, "totalAmount": "123.45", "paymentCount": 0, "paymentInProgress": false, "hasActiveReservation": true, "reservationExpiresAt": "2026-10-29T14:54:54.531Z"}, "success": true}	2026-10-29 14:39:54.488	2026-10-29 14:39:55.674
32	24	PAY_ORDER	e99966d9-d554-4900-b62b-13f0a4e6ded1	c4d38ccf555c157e2bc360cf292380db84a4ba5fd9184186a6bc02d7ce8ea386	1	200	{"data": {"orderId": 1, "gatewayRef": "3f4db587-3342-4e30-bab1-e314b662518e", "completedAt": "2026-10-29T14:39:57.034Z", "orderStatus": "Paid", "failureReason": null, "paymentStatus": "SUCCEEDED", "paymentAttemptId": 2}, "success": true}	2026-10-29 14:39:56.637	2026-10-29 14:39:57.045
31	30	PAY_ORDER	f1f730f1-fa37-4004-8a69-d30463668fcf	232bf32af90ec5a3945a96013309bf4b303c44465c00a09fc978826a7c6e8e81	4	200	{"data": {"orderId": 4, "gatewayRef": "f888e214-3392-488f-98fe-5b4295ea988e", "completedAt": "2026-10-29T14:39:59.061Z", "orderStatus": "Paid", "failureReason": null, "paymentStatus": "SUCCEEDED", "paymentAttemptId": 1}, "success": true}	2026-10-29 14:39:56.619	2026-10-29 14:39:59.077
16	20	CREATE_ORDER	8d3b77ad-d756-4ac8-b159-08b873481d33	700539230214932c4d0ced62968aef257fca0da1937156517fbe5b4ff66014be	6	201	{"data": {"items": [{"quantity": 1, "lineTotal": "123.45", "productId": 1, "unitPrice": "123.45", "productName": "Product 1"}], "canPay": true, "paidAt": null, "status": "PendingPayment", "orderId": 6, "currency": "VND", "payments": [], "replayed": false, "canCancel": true, "createdAt": "2026-10-29T14:39:55.797Z", "updatedAt": "2026-10-29T14:39:55.797Z", "cancelledAt": null, "totalAmount": "123.45", "paymentCount": 0, "paymentInProgress": false, "hasActiveReservation": true, "reservationExpiresAt": "2026-10-29T14:54:54.952Z"}, "success": true}	2026-10-29 14:39:54.922	2026-10-29 14:39:55.87
28	27	CREATE_ORDER	79aeb445-2be9-478a-8a4e-cdd84c8f506c	700539230214932c4d0ced62968aef257fca0da1937156517fbe5b4ff66014be	7	201	{"data": {"items": [{"quantity": 1, "lineTotal": "123.45", "productId": 1, "unitPrice": "123.45", "productName": "Product 1"}], "canPay": true, "paidAt": null, "status": "PendingPayment", "orderId": 7, "currency": "VND", "payments": [], "replayed": false, "canCancel": true, "createdAt": "2026-10-29T14:39:55.891Z", "updatedAt": "2026-10-29T14:39:55.891Z", "cancelledAt": null, "totalAmount": "123.45", "paymentCount": 0, "paymentInProgress": false, "hasActiveReservation": true, "reservationExpiresAt": "2026-10-29T14:54:55.385Z"}, "success": true}	2026-10-29 14:39:55.291	2026-10-29 14:39:55.946
5	3	CREATE_ORDER	f0093db8-0ee3-4f08-b358-1718092e80d7	700539230214932c4d0ced62968aef257fca0da1937156517fbe5b4ff66014be	8	201	{"data": {"items": [{"quantity": 1, "lineTotal": "123.45", "productId": 1, "unitPrice": "123.45", "productName": "Product 1"}], "canPay": true, "paidAt": null, "status": "PendingPayment", "orderId": 8, "currency": "VND", "payments": [], "replayed": false, "canCancel": true, "createdAt": "2026-10-29T14:39:55.965Z", "updatedAt": "2026-10-29T14:39:55.965Z", "cancelledAt": null, "totalAmount": "123.45", "paymentCount": 0, "paymentInProgress": false, "hasActiveReservation": true, "reservationExpiresAt": "2026-10-29T14:54:54.398Z"}, "success": true}	2026-10-29 14:39:54.345	2026-10-29 14:39:56.02
27	26	CREATE_ORDER	b373b02f-d427-40ad-9b54-02e8f684bd88	700539230214932c4d0ced62968aef257fca0da1937156517fbe5b4ff66014be	9	201	{"data": {"items": [{"quantity": 1, "lineTotal": "123.45", "productId": 1, "unitPrice": "123.45", "productName": "Product 1"}], "canPay": true, "paidAt": null, "status": "PendingPayment", "orderId": 9, "currency": "VND", "payments": [], "replayed": false, "canCancel": true, "createdAt": "2026-10-29T14:39:56.072Z", "updatedAt": "2026-10-29T14:39:56.072Z", "cancelledAt": null, "totalAmount": "123.45", "paymentCount": 0, "paymentInProgress": false, "hasActiveReservation": true, "reservationExpiresAt": "2026-10-29T14:54:55.391Z"}, "success": true}	2026-10-29 14:39:55.194	2026-10-29 14:39:56.157
30	15	CREATE_ORDER	23512f91-7056-44be-8ec9-593a057fb408	700539230214932c4d0ced62968aef257fca0da1937156517fbe5b4ff66014be	10	201	{"data": {"items": [{"quantity": 1, "lineTotal": "123.45", "productId": 1, "unitPrice": "123.45", "productName": "Product 1"}], "canPay": true, "paidAt": null, "status": "PendingPayment", "orderId": 10, "currency": "VND", "payments": [], "replayed": false, "canCancel": true, "createdAt": "2026-10-29T14:39:56.196Z", "updatedAt": "2026-10-29T14:39:56.196Z", "cancelledAt": null, "totalAmount": "123.45", "paymentCount": 0, "paymentInProgress": false, "hasActiveReservation": true, "reservationExpiresAt": "2026-10-29T14:54:55.434Z"}, "success": true}	2026-10-29 14:39:55.277	2026-10-29 14:39:56.274
33	5	PAY_ORDER	0da209f3-805c-40bd-b41c-2fd104e6aa51	7c078e07cbaa079f2b3ad7fb1c232682e9e6b12289e80f3d0e79783d5f828d24	5	200	{"data": {"orderId": 5, "gatewayRef": "885de0a9-7af2-44f6-96e5-4bf843066df5", "completedAt": "2026-10-29T14:39:57.116Z", "orderStatus": "Paid", "failureReason": null, "paymentStatus": "SUCCEEDED", "paymentAttemptId": 3}, "success": true}	2026-10-29 14:39:56.635	2026-10-29 14:39:57.131
34	26	PAY_ORDER	68e0ac9b-2371-4f54-9381-9bd88241f86c	f71dbd60f94d6b7326b4b258c8e5ce12be8ebd5bf7d672594f5a2623884d1384	9	200	{"data": {"orderId": 9, "gatewayRef": "2e3e375e-aa3c-485e-9e05-683c0c8dbbef", "completedAt": "2026-10-29T14:39:57.196Z", "orderStatus": "Paid", "failureReason": null, "paymentStatus": "SUCCEEDED", "paymentAttemptId": 5}, "success": true}	2026-10-29 14:39:56.634	2026-10-29 14:39:57.201
35	3	PAY_ORDER	10e8d6b6-afc3-469a-aa84-6a07e8b47227	871de69ae7e2d1cf424b6ca5fe0018a75025deaa078cc322fb3ff68c977e4220	8	200	{"data": {"orderId": 8, "gatewayRef": "b39383a2-53d0-4af4-a2f8-3ed3d513a510", "completedAt": "2026-10-29T14:39:58.576Z", "orderStatus": "Paid", "failureReason": null, "paymentStatus": "SUCCEEDED", "paymentAttemptId": 4}, "success": true}	2026-10-29 14:39:56.69	2026-10-29 14:39:58.594
36	2	PAY_ORDER	15d1ceb7-aaef-41a0-a033-7aca2a18dee2	1d9160f638a4a099be8db51038314a660fc641cfca40c2ad0317a01cef932171	2	200	{"data": {"orderId": 2, "gatewayRef": "1d0751c0-8959-4bb3-bc41-9ac8c615b851", "completedAt": "2026-10-29T14:39:58.436Z", "orderStatus": "Paid", "failureReason": null, "paymentStatus": "SUCCEEDED", "paymentAttemptId": 6}, "success": true}	2026-10-29 14:39:56.67	2026-10-29 14:39:58.441
37	16	PAY_ORDER	6244c767-cefa-4f5b-a1a4-86c97392ab07	92dff0678a1b2142dd7cb3f6bbbaabcadec4d869b612e40f9e77ae2f983077b3	3	200	{"data": {"orderId": 3, "gatewayRef": "534b72f8-3930-4b99-92fd-956bcc39ddec", "completedAt": "2026-10-29T14:39:57.390Z", "orderStatus": "Paid", "failureReason": null, "paymentStatus": "SUCCEEDED", "paymentAttemptId": 8}, "success": true}	2026-10-29 14:39:56.683	2026-10-29 14:39:57.414
38	15	PAY_ORDER	92bc77b5-57b8-4efa-b367-6d8081d5bff9	362356e085ce3bcad7ee47c01849f22133d2dcac1449d2d609d7e871bcca0bfa	10	200	{"data": {"orderId": 10, "gatewayRef": "64271e68-39dd-49d1-b90b-3120b69269e7", "completedAt": "2026-10-29T14:39:57.991Z", "orderStatus": "Paid", "failureReason": null, "paymentStatus": "SUCCEEDED", "paymentAttemptId": 7}, "success": true}	2026-10-29 14:39:56.682	2026-10-29 14:39:58.158
39	27	PAY_ORDER	e69a5033-1941-4d3f-b876-2dd404e4f80e	7a23bf21a3682f40cb5792b0dad2f98c78aaa2ac2660416471e5d02515705b39	7	200	{"data": {"orderId": 7, "gatewayRef": "37cf9f4e-ae57-40e3-9b1d-29114a60225b", "completedAt": "2026-10-29T14:39:58.766Z", "orderStatus": "Paid", "failureReason": null, "paymentStatus": "SUCCEEDED", "paymentAttemptId": 9}, "success": true}	2026-10-29 14:39:56.783	2026-10-29 14:39:58.803
40	20	PAY_ORDER	fc6d57af-bedf-4160-b370-e4b93112c742	82f964e7c57fa69b2066684ede6696265f1598838a3354a077301993c4545a7e	6	200	{"data": {"orderId": 6, "gatewayRef": "4a63da67-a3c8-45fc-a7c8-7e76367ad1a5", "completedAt": "2026-10-29T14:39:57.615Z", "orderStatus": "Paid", "failureReason": null, "paymentStatus": "SUCCEEDED", "paymentAttemptId": 10}, "success": true}	2026-10-29 14:39:56.798	2026-10-29 14:39:57.619
\.


--
-- Data for Name: inventories; Type: TABLE DATA; Schema: public; Owner: mw_user
--

COPY public.inventories (id, warehouse_id, product_id, on_hand, reserved, low_stock_threshold, version, updated_at) FROM stdin;
2	1	2	10	0	0	0	2026-10-29 14:39:53.187
3	1	3	10	0	0	0	2026-10-29 14:39:53.187
4	1	4	10	0	0	0	2026-10-29 14:39:53.187
5	1	5	10	0	0	0	2026-10-29 14:39:53.187
6	1	6	10	0	0	0	2026-10-29 14:39:53.187
7	1	7	10	0	0	0	2026-10-29 14:39:53.187
8	1	8	10	0	0	0	2026-10-29 14:39:53.187
9	1	9	10	0	0	0	2026-10-29 14:39:53.187
10	1	10	10	0	0	0	2026-10-29 14:39:53.187
11	1	11	10	0	0	0	2026-10-29 14:39:53.187
12	1	12	10	0	0	0	2026-10-29 14:39:53.187
13	1	13	10	0	0	0	2026-10-29 14:39:53.187
14	1	14	10	0	0	0	2026-10-29 14:39:53.187
15	1	15	10	0	0	0	2026-10-29 14:39:53.187
16	1	16	10	0	0	0	2026-10-29 14:39:53.187
17	1	17	10	0	0	0	2026-10-29 14:39:53.187
18	1	18	10	0	0	0	2026-10-29 14:39:53.187
19	1	19	10	0	0	0	2026-10-29 14:39:53.187
20	1	20	10	0	0	0	2026-10-29 14:39:53.187
21	1	21	10	0	0	0	2026-10-29 14:39:53.187
22	1	22	10	0	0	0	2026-10-29 14:39:53.187
23	1	23	10	0	0	0	2026-10-29 14:39:53.187
24	1	24	10	0	0	0	2026-10-29 14:39:53.187
25	1	25	10	0	0	0	2026-10-29 14:39:53.187
26	1	26	10	0	0	0	2026-10-29 14:39:53.187
27	1	27	10	0	0	0	2026-10-29 14:39:53.187
28	1	28	10	0	0	0	2026-10-29 14:39:53.187
29	1	29	10	0	0	0	2026-10-29 14:39:53.187
30	1	30	10	0	0	0	2026-10-29 14:39:53.187
31	1	31	10	0	0	0	2026-10-29 14:39:53.187
32	1	32	10	0	0	0	2026-10-29 14:39:53.187
33	1	33	10	0	0	0	2026-10-29 14:39:53.187
34	1	34	10	0	0	0	2026-10-29 14:39:53.187
35	1	35	10	0	0	0	2026-10-29 14:39:53.187
36	1	36	10	0	0	0	2026-10-29 14:39:53.187
37	1	37	10	0	0	0	2026-10-29 14:39:53.187
38	1	38	10	0	0	0	2026-10-29 14:39:53.187
39	1	39	10	0	0	0	2026-10-29 14:39:53.187
40	1	40	10	0	0	0	2026-10-29 14:39:53.187
41	1	41	10	0	0	0	2026-10-29 14:39:53.187
42	1	42	10	0	0	0	2026-10-29 14:39:53.187
43	1	43	10	0	0	0	2026-10-29 14:39:53.187
44	1	44	10	0	0	0	2026-10-29 14:39:53.187
45	1	45	10	0	0	0	2026-10-29 14:39:53.187
46	1	46	10	0	0	0	2026-10-29 14:39:53.187
47	1	47	10	0	0	0	2026-10-29 14:39:53.187
48	1	48	10	0	0	0	2026-10-29 14:39:53.187
49	1	49	10	0	0	0	2026-10-29 14:39:53.187
50	1	50	10	0	0	0	2026-10-29 14:39:53.187
51	1	51	10	0	0	0	2026-10-29 14:39:53.187
52	1	52	10	0	0	0	2026-10-29 14:39:53.187
53	1	53	10	0	0	0	2026-10-29 14:39:53.187
54	1	54	10	0	0	0	2026-10-29 14:39:53.187
55	1	55	10	0	0	0	2026-10-29 14:39:53.187
56	1	56	10	0	0	0	2026-10-29 14:39:53.187
57	1	57	10	0	0	0	2026-10-29 14:39:53.187
58	1	58	10	0	0	0	2026-10-29 14:39:53.187
59	1	59	10	0	0	0	2026-10-29 14:39:53.187
60	1	60	10	0	0	0	2026-10-29 14:39:53.187
61	1	61	10	0	0	0	2026-10-29 14:39:53.187
62	1	62	10	0	0	0	2026-10-29 14:39:53.187
63	1	63	10	0	0	0	2026-10-29 14:39:53.187
64	1	64	10	0	0	0	2026-10-29 14:39:53.187
65	1	65	10	0	0	0	2026-10-29 14:39:53.187
66	1	66	10	0	0	0	2026-10-29 14:39:53.187
67	1	67	10	0	0	0	2026-10-29 14:39:53.187
68	1	68	10	0	0	0	2026-10-29 14:39:53.187
69	1	69	10	0	0	0	2026-10-29 14:39:53.187
70	1	70	10	0	0	0	2026-10-29 14:39:53.187
71	1	71	10	0	0	0	2026-10-29 14:39:53.187
72	1	72	10	0	0	0	2026-10-29 14:39:53.187
73	1	73	10	0	0	0	2026-10-29 14:39:53.187
74	1	74	10	0	0	0	2026-10-29 14:39:53.187
75	1	75	10	0	0	0	2026-10-29 14:39:53.187
76	1	76	10	0	0	0	2026-10-29 14:39:53.187
77	1	77	10	0	0	0	2026-10-29 14:39:53.187
78	1	78	10	0	0	0	2026-10-29 14:39:53.187
79	1	79	10	0	0	0	2026-10-29 14:39:53.187
80	1	80	10	0	0	0	2026-10-29 14:39:53.187
81	1	81	10	0	0	0	2026-10-29 14:39:53.187
82	1	82	10	0	0	0	2026-10-29 14:39:53.187
83	1	83	10	0	0	0	2026-10-29 14:39:53.187
84	1	84	10	0	0	0	2026-10-29 14:39:53.187
85	1	85	10	0	0	0	2026-10-29 14:39:53.187
86	1	86	10	0	0	0	2026-10-29 14:39:53.187
87	1	87	10	0	0	0	2026-10-29 14:39:53.187
88	1	88	10	0	0	0	2026-10-29 14:39:53.187
89	1	89	10	0	0	0	2026-10-29 14:39:53.187
90	1	90	10	0	0	0	2026-10-29 14:39:53.187
91	1	91	10	0	0	0	2026-10-29 14:39:53.187
92	1	92	10	0	0	0	2026-10-29 14:39:53.187
93	1	93	10	0	0	0	2026-10-29 14:39:53.187
94	1	94	10	0	0	0	2026-10-29 14:39:53.187
95	1	95	10	0	0	0	2026-10-29 14:39:53.187
96	1	96	10	0	0	0	2026-10-29 14:39:53.187
97	1	97	10	0	0	0	2026-10-29 14:39:53.187
98	1	98	10	0	0	0	2026-10-29 14:39:53.187
99	1	99	10	0	0	0	2026-10-29 14:39:53.187
100	1	100	10	0	0	0	2026-10-29 14:39:53.187
101	1	101	10	0	0	0	2026-10-29 14:39:53.187
102	1	102	10	0	0	0	2026-10-29 14:39:53.187
103	1	103	10	0	0	0	2026-10-29 14:39:53.187
104	1	104	10	0	0	0	2026-10-29 14:39:53.187
105	1	105	10	0	0	0	2026-10-29 14:39:53.187
106	1	106	10	0	0	0	2026-10-29 14:39:53.187
107	1	107	10	0	0	0	2026-10-29 14:39:53.187
108	1	108	10	0	0	0	2026-10-29 14:39:53.187
109	1	109	10	0	0	0	2026-10-29 14:39:53.187
110	1	110	10	0	0	0	2026-10-29 14:39:53.187
111	1	111	10	0	0	0	2026-10-29 14:39:53.187
112	1	112	10	0	0	0	2026-10-29 14:39:53.187
113	1	113	10	0	0	0	2026-10-29 14:39:53.187
114	1	114	10	0	0	0	2026-10-29 14:39:53.187
115	1	115	10	0	0	0	2026-10-29 14:39:53.187
116	1	116	10	0	0	0	2026-10-29 14:39:53.187
117	1	117	10	0	0	0	2026-10-29 14:39:53.187
118	1	118	10	0	0	0	2026-10-29 14:39:53.187
119	1	119	10	0	0	0	2026-10-29 14:39:53.187
120	1	120	10	0	0	0	2026-10-29 14:39:53.187
121	2	1	0	0	0	0	2026-10-29 14:39:53.187
122	2	2	0	0	0	0	2026-10-29 14:39:53.187
123	2	3	0	0	0	0	2026-10-29 14:39:53.187
124	2	4	0	0	0	0	2026-10-29 14:39:53.187
125	2	5	0	0	0	0	2026-10-29 14:39:53.187
126	2	6	0	0	0	0	2026-10-29 14:39:53.187
127	2	7	0	0	0	0	2026-10-29 14:39:53.187
128	2	8	0	0	0	0	2026-10-29 14:39:53.187
129	2	9	0	0	0	0	2026-10-29 14:39:53.187
130	2	10	0	0	0	0	2026-10-29 14:39:53.187
131	2	11	0	0	0	0	2026-10-29 14:39:53.187
132	2	12	0	0	0	0	2026-10-29 14:39:53.187
133	2	13	0	0	0	0	2026-10-29 14:39:53.187
134	2	14	0	0	0	0	2026-10-29 14:39:53.187
135	2	15	0	0	0	0	2026-10-29 14:39:53.187
136	2	16	0	0	0	0	2026-10-29 14:39:53.187
137	2	17	0	0	0	0	2026-10-29 14:39:53.187
138	2	18	0	0	0	0	2026-10-29 14:39:53.187
139	2	19	0	0	0	0	2026-10-29 14:39:53.187
140	2	20	0	0	0	0	2026-10-29 14:39:53.187
141	2	21	0	0	0	0	2026-10-29 14:39:53.187
142	2	22	0	0	0	0	2026-10-29 14:39:53.187
143	2	23	0	0	0	0	2026-10-29 14:39:53.187
144	2	24	0	0	0	0	2026-10-29 14:39:53.187
145	2	25	0	0	0	0	2026-10-29 14:39:53.187
146	2	26	0	0	0	0	2026-10-29 14:39:53.187
147	2	27	0	0	0	0	2026-10-29 14:39:53.187
148	2	28	0	0	0	0	2026-10-29 14:39:53.187
149	2	29	0	0	0	0	2026-10-29 14:39:53.187
150	2	30	0	0	0	0	2026-10-29 14:39:53.187
151	2	31	0	0	0	0	2026-10-29 14:39:53.187
152	2	32	0	0	0	0	2026-10-29 14:39:53.187
153	2	33	0	0	0	0	2026-10-29 14:39:53.187
154	2	34	0	0	0	0	2026-10-29 14:39:53.187
155	2	35	0	0	0	0	2026-10-29 14:39:53.187
156	2	36	0	0	0	0	2026-10-29 14:39:53.187
157	2	37	0	0	0	0	2026-10-29 14:39:53.187
158	2	38	0	0	0	0	2026-10-29 14:39:53.187
159	2	39	0	0	0	0	2026-10-29 14:39:53.187
160	2	40	0	0	0	0	2026-10-29 14:39:53.187
161	2	41	0	0	0	0	2026-10-29 14:39:53.187
162	2	42	0	0	0	0	2026-10-29 14:39:53.187
163	2	43	0	0	0	0	2026-10-29 14:39:53.187
164	2	44	0	0	0	0	2026-10-29 14:39:53.187
165	2	45	0	0	0	0	2026-10-29 14:39:53.187
166	2	46	0	0	0	0	2026-10-29 14:39:53.187
167	2	47	0	0	0	0	2026-10-29 14:39:53.187
168	2	48	0	0	0	0	2026-10-29 14:39:53.187
169	2	49	0	0	0	0	2026-10-29 14:39:53.187
170	2	50	0	0	0	0	2026-10-29 14:39:53.187
171	2	51	0	0	0	0	2026-10-29 14:39:53.187
172	2	52	0	0	0	0	2026-10-29 14:39:53.187
173	2	53	0	0	0	0	2026-10-29 14:39:53.187
174	2	54	0	0	0	0	2026-10-29 14:39:53.187
175	2	55	0	0	0	0	2026-10-29 14:39:53.187
176	2	56	0	0	0	0	2026-10-29 14:39:53.187
177	2	57	0	0	0	0	2026-10-29 14:39:53.187
178	2	58	0	0	0	0	2026-10-29 14:39:53.187
179	2	59	0	0	0	0	2026-10-29 14:39:53.187
180	2	60	0	0	0	0	2026-10-29 14:39:53.187
181	2	61	0	0	0	0	2026-10-29 14:39:53.187
182	2	62	0	0	0	0	2026-10-29 14:39:53.187
183	2	63	0	0	0	0	2026-10-29 14:39:53.187
184	2	64	0	0	0	0	2026-10-29 14:39:53.187
185	2	65	0	0	0	0	2026-10-29 14:39:53.187
186	2	66	0	0	0	0	2026-10-29 14:39:53.187
187	2	67	0	0	0	0	2026-10-29 14:39:53.187
188	2	68	0	0	0	0	2026-10-29 14:39:53.187
189	2	69	0	0	0	0	2026-10-29 14:39:53.187
190	2	70	0	0	0	0	2026-10-29 14:39:53.187
191	2	71	0	0	0	0	2026-10-29 14:39:53.187
192	2	72	0	0	0	0	2026-10-29 14:39:53.187
193	2	73	0	0	0	0	2026-10-29 14:39:53.187
194	2	74	0	0	0	0	2026-10-29 14:39:53.187
195	2	75	0	0	0	0	2026-10-29 14:39:53.187
196	2	76	0	0	0	0	2026-10-29 14:39:53.187
197	2	77	0	0	0	0	2026-10-29 14:39:53.187
198	2	78	0	0	0	0	2026-10-29 14:39:53.187
199	2	79	0	0	0	0	2026-10-29 14:39:53.187
200	2	80	0	0	0	0	2026-10-29 14:39:53.187
201	2	81	0	0	0	0	2026-10-29 14:39:53.187
202	2	82	0	0	0	0	2026-10-29 14:39:53.187
203	2	83	0	0	0	0	2026-10-29 14:39:53.187
204	2	84	0	0	0	0	2026-10-29 14:39:53.187
205	2	85	0	0	0	0	2026-10-29 14:39:53.187
206	2	86	0	0	0	0	2026-10-29 14:39:53.187
207	2	87	0	0	0	0	2026-10-29 14:39:53.187
208	2	88	0	0	0	0	2026-10-29 14:39:53.187
209	2	89	0	0	0	0	2026-10-29 14:39:53.187
210	2	90	0	0	0	0	2026-10-29 14:39:53.187
211	2	91	0	0	0	0	2026-10-29 14:39:53.187
212	2	92	0	0	0	0	2026-10-29 14:39:53.187
213	2	93	0	0	0	0	2026-10-29 14:39:53.187
214	2	94	0	0	0	0	2026-10-29 14:39:53.187
215	2	95	0	0	0	0	2026-10-29 14:39:53.187
216	2	96	0	0	0	0	2026-10-29 14:39:53.187
217	2	97	0	0	0	0	2026-10-29 14:39:53.187
218	2	98	0	0	0	0	2026-10-29 14:39:53.187
219	2	99	0	0	0	0	2026-10-29 14:39:53.187
220	2	100	0	0	0	0	2026-10-29 14:39:53.187
221	2	101	0	0	0	0	2026-10-29 14:39:53.187
222	2	102	0	0	0	0	2026-10-29 14:39:53.187
223	2	103	0	0	0	0	2026-10-29 14:39:53.187
224	2	104	0	0	0	0	2026-10-29 14:39:53.187
225	2	105	0	0	0	0	2026-10-29 14:39:53.187
226	2	106	0	0	0	0	2026-10-29 14:39:53.187
227	2	107	0	0	0	0	2026-10-29 14:39:53.187
228	2	108	0	0	0	0	2026-10-29 14:39:53.187
229	2	109	0	0	0	0	2026-10-29 14:39:53.187
230	2	110	0	0	0	0	2026-10-29 14:39:53.187
231	2	111	0	0	0	0	2026-10-29 14:39:53.187
232	2	112	0	0	0	0	2026-10-29 14:39:53.187
233	2	113	0	0	0	0	2026-10-29 14:39:53.187
234	2	114	0	0	0	0	2026-10-29 14:39:53.187
235	2	115	0	0	0	0	2026-10-29 14:39:53.187
236	2	116	0	0	0	0	2026-10-29 14:39:53.187
237	2	117	0	0	0	0	2026-10-29 14:39:53.187
238	2	118	0	0	0	0	2026-10-29 14:39:53.187
239	2	119	0	0	0	0	2026-10-29 14:39:53.187
240	2	120	0	0	0	0	2026-10-29 14:39:53.187
241	3	1	0	0	0	0	2026-10-29 14:39:53.187
242	3	2	0	0	0	0	2026-10-29 14:39:53.187
243	3	3	0	0	0	0	2026-10-29 14:39:53.187
244	3	4	0	0	0	0	2026-10-29 14:39:53.187
245	3	5	0	0	0	0	2026-10-29 14:39:53.187
246	3	6	0	0	0	0	2026-10-29 14:39:53.187
247	3	7	0	0	0	0	2026-10-29 14:39:53.187
248	3	8	0	0	0	0	2026-10-29 14:39:53.187
249	3	9	0	0	0	0	2026-10-29 14:39:53.187
250	3	10	0	0	0	0	2026-10-29 14:39:53.187
251	3	11	0	0	0	0	2026-10-29 14:39:53.187
252	3	12	0	0	0	0	2026-10-29 14:39:53.187
253	3	13	0	0	0	0	2026-10-29 14:39:53.187
254	3	14	0	0	0	0	2026-10-29 14:39:53.187
255	3	15	0	0	0	0	2026-10-29 14:39:53.187
256	3	16	0	0	0	0	2026-10-29 14:39:53.187
257	3	17	0	0	0	0	2026-10-29 14:39:53.187
258	3	18	0	0	0	0	2026-10-29 14:39:53.187
259	3	19	0	0	0	0	2026-10-29 14:39:53.187
260	3	20	0	0	0	0	2026-10-29 14:39:53.187
261	3	21	0	0	0	0	2026-10-29 14:39:53.187
262	3	22	0	0	0	0	2026-10-29 14:39:53.187
263	3	23	0	0	0	0	2026-10-29 14:39:53.187
264	3	24	0	0	0	0	2026-10-29 14:39:53.187
265	3	25	0	0	0	0	2026-10-29 14:39:53.187
266	3	26	0	0	0	0	2026-10-29 14:39:53.187
267	3	27	0	0	0	0	2026-10-29 14:39:53.187
268	3	28	0	0	0	0	2026-10-29 14:39:53.187
269	3	29	0	0	0	0	2026-10-29 14:39:53.187
270	3	30	0	0	0	0	2026-10-29 14:39:53.187
271	3	31	0	0	0	0	2026-10-29 14:39:53.187
272	3	32	0	0	0	0	2026-10-29 14:39:53.187
273	3	33	0	0	0	0	2026-10-29 14:39:53.187
274	3	34	0	0	0	0	2026-10-29 14:39:53.187
275	3	35	0	0	0	0	2026-10-29 14:39:53.187
276	3	36	0	0	0	0	2026-10-29 14:39:53.187
277	3	37	0	0	0	0	2026-10-29 14:39:53.187
278	3	38	0	0	0	0	2026-10-29 14:39:53.187
279	3	39	0	0	0	0	2026-10-29 14:39:53.187
280	3	40	0	0	0	0	2026-10-29 14:39:53.187
281	3	41	0	0	0	0	2026-10-29 14:39:53.187
282	3	42	0	0	0	0	2026-10-29 14:39:53.187
283	3	43	0	0	0	0	2026-10-29 14:39:53.187
284	3	44	0	0	0	0	2026-10-29 14:39:53.187
285	3	45	0	0	0	0	2026-10-29 14:39:53.187
286	3	46	0	0	0	0	2026-10-29 14:39:53.187
287	3	47	0	0	0	0	2026-10-29 14:39:53.187
288	3	48	0	0	0	0	2026-10-29 14:39:53.187
289	3	49	0	0	0	0	2026-10-29 14:39:53.187
290	3	50	0	0	0	0	2026-10-29 14:39:53.187
291	3	51	0	0	0	0	2026-10-29 14:39:53.187
292	3	52	0	0	0	0	2026-10-29 14:39:53.187
293	3	53	0	0	0	0	2026-10-29 14:39:53.187
294	3	54	0	0	0	0	2026-10-29 14:39:53.187
295	3	55	0	0	0	0	2026-10-29 14:39:53.187
296	3	56	0	0	0	0	2026-10-29 14:39:53.187
297	3	57	0	0	0	0	2026-10-29 14:39:53.187
298	3	58	0	0	0	0	2026-10-29 14:39:53.187
299	3	59	0	0	0	0	2026-10-29 14:39:53.187
300	3	60	0	0	0	0	2026-10-29 14:39:53.187
301	3	61	0	0	0	0	2026-10-29 14:39:53.187
302	3	62	0	0	0	0	2026-10-29 14:39:53.187
303	3	63	0	0	0	0	2026-10-29 14:39:53.187
304	3	64	0	0	0	0	2026-10-29 14:39:53.187
305	3	65	0	0	0	0	2026-10-29 14:39:53.187
306	3	66	0	0	0	0	2026-10-29 14:39:53.187
307	3	67	0	0	0	0	2026-10-29 14:39:53.187
308	3	68	0	0	0	0	2026-10-29 14:39:53.187
309	3	69	0	0	0	0	2026-10-29 14:39:53.187
310	3	70	0	0	0	0	2026-10-29 14:39:53.187
311	3	71	0	0	0	0	2026-10-29 14:39:53.187
312	3	72	0	0	0	0	2026-10-29 14:39:53.187
313	3	73	0	0	0	0	2026-10-29 14:39:53.187
314	3	74	0	0	0	0	2026-10-29 14:39:53.187
315	3	75	0	0	0	0	2026-10-29 14:39:53.187
316	3	76	0	0	0	0	2026-10-29 14:39:53.187
317	3	77	0	0	0	0	2026-10-29 14:39:53.187
318	3	78	0	0	0	0	2026-10-29 14:39:53.187
319	3	79	0	0	0	0	2026-10-29 14:39:53.187
320	3	80	0	0	0	0	2026-10-29 14:39:53.187
321	3	81	0	0	0	0	2026-10-29 14:39:53.187
322	3	82	0	0	0	0	2026-10-29 14:39:53.187
323	3	83	0	0	0	0	2026-10-29 14:39:53.187
324	3	84	0	0	0	0	2026-10-29 14:39:53.187
325	3	85	0	0	0	0	2026-10-29 14:39:53.187
326	3	86	0	0	0	0	2026-10-29 14:39:53.187
327	3	87	0	0	0	0	2026-10-29 14:39:53.187
328	3	88	0	0	0	0	2026-10-29 14:39:53.187
329	3	89	0	0	0	0	2026-10-29 14:39:53.187
330	3	90	0	0	0	0	2026-10-29 14:39:53.187
331	3	91	0	0	0	0	2026-10-29 14:39:53.187
332	3	92	0	0	0	0	2026-10-29 14:39:53.187
333	3	93	0	0	0	0	2026-10-29 14:39:53.187
334	3	94	0	0	0	0	2026-10-29 14:39:53.187
335	3	95	0	0	0	0	2026-10-29 14:39:53.187
336	3	96	0	0	0	0	2026-10-29 14:39:53.187
337	3	97	0	0	0	0	2026-10-29 14:39:53.187
338	3	98	0	0	0	0	2026-10-29 14:39:53.187
339	3	99	0	0	0	0	2026-10-29 14:39:53.187
340	3	100	0	0	0	0	2026-10-29 14:39:53.187
341	3	101	0	0	0	0	2026-10-29 14:39:53.187
342	3	102	0	0	0	0	2026-10-29 14:39:53.187
343	3	103	0	0	0	0	2026-10-29 14:39:53.187
344	3	104	0	0	0	0	2026-10-29 14:39:53.187
345	3	105	0	0	0	0	2026-10-29 14:39:53.187
346	3	106	0	0	0	0	2026-10-29 14:39:53.187
347	3	107	0	0	0	0	2026-10-29 14:39:53.187
348	3	108	0	0	0	0	2026-10-29 14:39:53.187
349	3	109	0	0	0	0	2026-10-29 14:39:53.187
350	3	110	0	0	0	0	2026-10-29 14:39:53.187
351	3	111	0	0	0	0	2026-10-29 14:39:53.187
352	3	112	0	0	0	0	2026-10-29 14:39:53.187
353	3	113	0	0	0	0	2026-10-29 14:39:53.187
354	3	114	0	0	0	0	2026-10-29 14:39:53.187
355	3	115	0	0	0	0	2026-10-29 14:39:53.187
356	3	116	0	0	0	0	2026-10-29 14:39:53.187
357	3	117	0	0	0	0	2026-10-29 14:39:53.187
358	3	118	0	0	0	0	2026-10-29 14:39:53.187
359	3	119	0	0	0	0	2026-10-29 14:39:53.187
360	3	120	0	0	0	0	2026-10-29 14:39:53.187
1	1	1	0	0	0	20	2026-10-29 14:39:56.867
\.


--
-- Data for Name: inventory_movements; Type: TABLE DATA; Schema: public; Owner: mw_user
--

COPY public.inventory_movements (id, warehouse_id, product_id, type, quantity, on_hand_after, reserved_after, order_id, actor_user_id, note, created_at) FROM stdin;
1	1	1	RESERVE	1	10	1	1	24	\N	2026-10-29 14:39:54.206
2	1	1	RESERVE	1	10	2	2	2	\N	2026-10-29 14:39:54.554
3	1	1	RESERVE	1	10	3	3	16	\N	2026-10-29 14:39:55.007
4	1	1	RESERVE	1	10	4	4	30	\N	2026-10-29 14:39:55.436
5	1	1	RESERVE	1	10	5	5	5	\N	2026-10-29 14:39:55.622
6	1	1	RESERVE	1	10	6	6	20	\N	2026-10-29 14:39:55.806
7	1	1	RESERVE	1	10	7	7	27	\N	2026-10-29 14:39:55.91
8	1	1	RESERVE	1	10	8	8	3	\N	2026-10-29 14:39:55.987
9	1	1	RESERVE	1	10	9	9	26	\N	2026-10-29 14:39:56.09
10	1	1	RESERVE	1	10	10	10	15	\N	2026-10-29 14:39:56.221
11	1	1	CONSUME	1	9	9	1	24	\N	2026-10-29 14:39:56.937
12	1	1	CONSUME	1	8	8	5	5	\N	2026-10-29 14:39:57.083
13	1	1	CONSUME	1	7	7	9	26	\N	2026-10-29 14:39:57.156
14	1	1	CONSUME	1	6	6	3	16	\N	2026-10-29 14:39:57.232
15	1	1	CONSUME	1	5	5	6	20	\N	2026-10-29 14:39:57.529
16	1	1	CONSUME	1	4	4	10	15	\N	2026-10-29 14:39:57.724
17	1	1	CONSUME	1	3	3	2	2	\N	2026-10-29 14:39:58.327
18	1	1	CONSUME	1	2	2	8	3	\N	2026-10-29 14:39:58.523
19	1	1	CONSUME	1	1	1	7	27	\N	2026-10-29 14:39:58.695
20	1	1	CONSUME	1	0	0	4	30	\N	2026-10-29 14:39:58.913
\.


--
-- Data for Name: low_stock_alerts; Type: TABLE DATA; Schema: public; Owner: mw_user
--

COPY public.low_stock_alerts (id, warehouse_id, product_id, available_at_trigger, threshold, status, created_at, resolved_at) FROM stdin;
1	1	1	0	0	OPEN	2026-10-29 14:39:55.068	\N
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: mw_user
--

COPY public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total) FROM stdin;
1	1	1	Product 1	123.45	1	123.45
2	2	1	Product 1	123.45	1	123.45
3	3	1	Product 1	123.45	1	123.45
4	4	1	Product 1	123.45	1	123.45
5	5	1	Product 1	123.45	1	123.45
6	6	1	Product 1	123.45	1	123.45
7	7	1	Product 1	123.45	1	123.45
8	8	1	Product 1	123.45	1	123.45
9	9	1	Product 1	123.45	1	123.45
10	10	1	Product 1	123.45	1	123.45
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: mw_user
--

COPY public.orders (id, customer_id, fulfillment_warehouse_id, status, total_amount, version, created_at, updated_at, paid_at, cancelled_at) FROM stdin;
1	24	1	Paid	123.45	1	2026-10-29 14:39:54.071	2026-10-29 14:39:57.025	2026-10-29 14:39:57.023	\N
5	5	1	Paid	123.45	1	2026-10-29 14:39:55.576	2026-10-29 14:39:57.102	2026-10-29 14:39:57.1	\N
9	26	1	Paid	123.45	1	2026-10-29 14:39:56.072	2026-10-29 14:39:57.179	2026-10-29 14:39:57.177	\N
3	16	1	Paid	123.45	1	2026-10-29 14:39:54.914	2026-10-29 14:39:57.34	2026-10-29 14:39:57.338	\N
6	20	1	Paid	123.45	1	2026-10-29 14:39:55.797	2026-10-29 14:39:57.611	2026-10-29 14:39:57.61	\N
10	15	1	Paid	123.45	1	2026-10-29 14:39:56.196	2026-10-29 14:39:57.921	2026-10-29 14:39:57.919	\N
2	2	1	Paid	123.45	1	2026-10-29 14:39:54.474	2026-10-29 14:39:58.432	2026-10-29 14:39:58.43	\N
8	3	1	Paid	123.45	1	2026-10-29 14:39:55.965	2026-10-29 14:39:58.559	2026-10-29 14:39:58.557	\N
7	27	1	Paid	123.45	1	2026-10-29 14:39:55.891	2026-10-29 14:39:58.758	2026-10-29 14:39:58.756	\N
4	30	1	Paid	123.45	1	2026-10-29 14:39:55.399	2026-10-29 14:39:59.039	2026-10-29 14:39:59.037	\N
\.


--
-- Data for Name: payment_attempts; Type: TABLE DATA; Schema: public; Owner: mw_user
--

COPY public.payment_attempts (id, order_id, status, amount, gateway_ref, failure_reason, created_at, completed_at) FROM stdin;
2	1	SUCCEEDED	123.45	3f4db587-3342-4e30-bab1-e314b662518e	\N	2026-10-29 14:39:56.669	2026-10-29 14:39:57.034
3	5	SUCCEEDED	123.45	885de0a9-7af2-44f6-96e5-4bf843066df5	\N	2026-10-29 14:39:56.692	2026-10-29 14:39:57.116
5	9	SUCCEEDED	123.45	2e3e375e-aa3c-485e-9e05-683c0c8dbbef	\N	2026-10-29 14:39:56.753	2026-10-29 14:39:57.196
8	3	SUCCEEDED	123.45	534b72f8-3930-4b99-92fd-956bcc39ddec	\N	2026-10-29 14:39:56.787	2026-10-29 14:39:57.39
10	6	SUCCEEDED	123.45	4a63da67-a3c8-45fc-a7c8-7e76367ad1a5	\N	2026-10-29 14:39:56.866	2026-10-29 14:39:57.615
7	10	SUCCEEDED	123.45	64271e68-39dd-49d1-b90b-3120b69269e7	\N	2026-10-29 14:39:56.786	2026-10-29 14:39:57.991
6	2	SUCCEEDED	123.45	1d0751c0-8959-4bb3-bc41-9ac8c615b851	\N	2026-10-29 14:39:56.754	2026-10-29 14:39:58.436
4	8	SUCCEEDED	123.45	b39383a2-53d0-4af4-a2f8-3ed3d513a510	\N	2026-10-29 14:39:56.701	2026-10-29 14:39:58.576
9	7	SUCCEEDED	123.45	37cf9f4e-ae57-40e3-9b1d-29114a60225b	\N	2026-10-29 14:39:56.832	2026-10-29 14:39:58.766
1	4	SUCCEEDED	123.45	f888e214-3392-488f-98fe-5b4295ea988e	\N	2026-10-29 14:39:56.637	2026-10-29 14:39:59.061
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: mw_user
--

COPY public.products (id, sku, name, category, price, description, image_url, is_active, discontinued_at, created_at, updated_at) FROM stdin;
1	M4-1	Product 1	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
2	M4-2	Product 2	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
3	M4-3	Product 3	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
4	M4-4	Product 4	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
5	M4-5	Product 5	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
6	M4-6	Product 6	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
7	M4-7	Product 7	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
8	M4-8	Product 8	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
9	M4-9	Product 9	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
10	M4-10	Product 10	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
11	M4-11	Product 11	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
12	M4-12	Product 12	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
13	M4-13	Product 13	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
14	M4-14	Product 14	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
15	M4-15	Product 15	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
16	M4-16	Product 16	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
17	M4-17	Product 17	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
18	M4-18	Product 18	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
19	M4-19	Product 19	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
20	M4-20	Product 20	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
21	M4-21	Product 21	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
22	M4-22	Product 22	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
23	M4-23	Product 23	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
24	M4-24	Product 24	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
25	M4-25	Product 25	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
26	M4-26	Product 26	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
27	M4-27	Product 27	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
28	M4-28	Product 28	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
29	M4-29	Product 29	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
30	M4-30	Product 30	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
31	M4-31	Product 31	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
32	M4-32	Product 32	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
33	M4-33	Product 33	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
34	M4-34	Product 34	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
35	M4-35	Product 35	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
36	M4-36	Product 36	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
37	M4-37	Product 37	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
38	M4-38	Product 38	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
39	M4-39	Product 39	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
40	M4-40	Product 40	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
41	M4-41	Product 41	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
42	M4-42	Product 42	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
43	M4-43	Product 43	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
44	M4-44	Product 44	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
45	M4-45	Product 45	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
46	M4-46	Product 46	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
47	M4-47	Product 47	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
48	M4-48	Product 48	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
49	M4-49	Product 49	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
50	M4-50	Product 50	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
51	M4-51	Product 51	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
52	M4-52	Product 52	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
53	M4-53	Product 53	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
54	M4-54	Product 54	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
55	M4-55	Product 55	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
56	M4-56	Product 56	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
57	M4-57	Product 57	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
58	M4-58	Product 58	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
59	M4-59	Product 59	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
60	M4-60	Product 60	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
61	M4-61	Product 61	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
62	M4-62	Product 62	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
63	M4-63	Product 63	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
64	M4-64	Product 64	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
65	M4-65	Product 65	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
66	M4-66	Product 66	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
67	M4-67	Product 67	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
68	M4-68	Product 68	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
69	M4-69	Product 69	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
70	M4-70	Product 70	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
71	M4-71	Product 71	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
72	M4-72	Product 72	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
73	M4-73	Product 73	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
74	M4-74	Product 74	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
75	M4-75	Product 75	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
76	M4-76	Product 76	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
77	M4-77	Product 77	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
78	M4-78	Product 78	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
79	M4-79	Product 79	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
80	M4-80	Product 80	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
81	M4-81	Product 81	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
82	M4-82	Product 82	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
83	M4-83	Product 83	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
84	M4-84	Product 84	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
85	M4-85	Product 85	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
86	M4-86	Product 86	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
87	M4-87	Product 87	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
88	M4-88	Product 88	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
89	M4-89	Product 89	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
90	M4-90	Product 90	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
91	M4-91	Product 91	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
92	M4-92	Product 92	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
93	M4-93	Product 93	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
94	M4-94	Product 94	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
95	M4-95	Product 95	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
96	M4-96	Product 96	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
97	M4-97	Product 97	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
98	M4-98	Product 98	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
99	M4-99	Product 99	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
100	M4-100	Product 100	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
101	M4-101	Product 101	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
102	M4-102	Product 102	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
103	M4-103	Product 103	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
104	M4-104	Product 104	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
105	M4-105	Product 105	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
106	M4-106	Product 106	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
107	M4-107	Product 107	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
108	M4-108	Product 108	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
109	M4-109	Product 109	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
110	M4-110	Product 110	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
111	M4-111	Product 111	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
112	M4-112	Product 112	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
113	M4-113	Product 113	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
114	M4-114	Product 114	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
115	M4-115	Product 115	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
116	M4-116	Product 116	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
117	M4-117	Product 117	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
118	M4-118	Product 118	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
119	M4-119	Product 119	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
120	M4-120	Product 120	M4	123.45		\N	t	\N	2026-10-29 14:39:53.03	2026-10-29 14:39:53.03
\.


--
-- Data for Name: stock_reservations; Type: TABLE DATA; Schema: public; Owner: mw_user
--

COPY public.stock_reservations (id, order_id, warehouse_id, product_id, quantity, status, expires_at, created_at, released_at, consumed_at) FROM stdin;
1	1	1	1	1	CONSUMED	2026-10-29 14:54:54.065	2026-10-29 14:39:54.172	\N	2026-10-29 14:39:56.927
5	5	1	1	1	CONSUMED	2026-10-29 14:54:54.531	2026-10-29 14:39:55.616	\N	2026-10-29 14:39:57.061
9	9	1	1	1	CONSUMED	2026-10-29 14:54:55.391	2026-10-29 14:39:56.085	\N	2026-10-29 14:39:57.149
3	3	1	1	1	CONSUMED	2026-10-29 14:54:54.869	2026-10-29 14:39:54.966	\N	2026-10-29 14:39:57.223
6	6	1	1	1	CONSUMED	2026-10-29 14:54:54.952	2026-10-29 14:39:55.803	\N	2026-10-29 14:39:57.505
10	10	1	1	1	CONSUMED	2026-10-29 14:54:55.434	2026-10-29 14:39:56.215	\N	2026-10-29 14:39:57.691
2	2	1	1	1	CONSUMED	2026-10-29 14:54:54.066	2026-10-29 14:39:54.532	\N	2026-10-29 14:39:58.268
8	8	1	1	1	CONSUMED	2026-10-29 14:54:54.398	2026-10-29 14:39:55.977	\N	2026-10-29 14:39:58.511
7	7	1	1	1	CONSUMED	2026-10-29 14:54:55.385	2026-10-29 14:39:55.904	\N	2026-10-29 14:39:58.68
4	4	1	1	1	CONSUMED	2026-10-29 14:54:54.392	2026-10-29 14:39:55.41	\N	2026-10-29 14:39:58.85
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: mw_user
--

COPY public.users (id, username, password_hash, full_name, role, assigned_warehouse_id, is_active, created_at, updated_at) FROM stdin;
1	m4-1	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
2	m4-2	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
3	m4-3	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
4	m4-4	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
5	m4-5	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
6	m4-6	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
7	m4-7	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
8	m4-8	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
9	m4-9	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
10	m4-10	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
11	m4-11	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
12	m4-12	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
13	m4-13	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
14	m4-14	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
15	m4-15	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
16	m4-16	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
17	m4-17	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
18	m4-18	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
19	m4-19	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
20	m4-20	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
21	m4-21	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
22	m4-22	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
23	m4-23	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
24	m4-24	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
25	m4-25	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
26	m4-26	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
27	m4-27	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
28	m4-28	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
29	m4-29	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
30	m4-30	not-a-login-password	\N	CUSTOMER	\N	t	2026-10-29 14:39:52.785	2026-10-29 14:39:52.785
31	manager	not-a-login-password	\N	WAREHOUSE_MANAGER	1	t	2026-10-29 14:39:52.966	2026-10-29 14:39:52.966
\.


--
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: mw_user
--

COPY public.warehouses (id, code, name, address, created_at, updated_at) FROM stdin;
1	M4-1	Warehouse 1	\N	2026-10-29 14:39:52.488	2026-10-29 14:39:52.488
2	M4-2	Warehouse 2	\N	2026-10-29 14:39:52.488	2026-10-29 14:39:52.488
3	M4-3	Warehouse 3	\N	2026-10-29 14:39:52.488	2026-10-29 14:39:52.488
\.


--
-- Name: idempotency_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mw_user
--

SELECT pg_catalog.setval('public.idempotency_records_id_seq', 40, true);


--
-- Name: inventories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mw_user
--

SELECT pg_catalog.setval('public.inventories_id_seq', 360, true);


--
-- Name: inventory_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mw_user
--

SELECT pg_catalog.setval('public.inventory_movements_id_seq', 20, true);


--
-- Name: low_stock_alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mw_user
--

SELECT pg_catalog.setval('public.low_stock_alerts_id_seq', 11, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mw_user
--

SELECT pg_catalog.setval('public.order_items_id_seq', 10, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mw_user
--

SELECT pg_catalog.setval('public.orders_id_seq', 10, true);


--
-- Name: payment_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mw_user
--

SELECT pg_catalog.setval('public.payment_attempts_id_seq', 10, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mw_user
--

SELECT pg_catalog.setval('public.products_id_seq', 1, false);


--
-- Name: stock_reservations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mw_user
--

SELECT pg_catalog.setval('public.stock_reservations_id_seq', 10, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mw_user
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- Name: warehouses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mw_user
--

SELECT pg_catalog.setval('public.warehouses_id_seq', 1, false);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: idempotency_records idempotency_records_pkey; Type: CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.idempotency_records
    ADD CONSTRAINT idempotency_records_pkey PRIMARY KEY (id);


--
-- Name: inventories inventories_pkey; Type: CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.inventories
    ADD CONSTRAINT inventories_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: low_stock_alerts low_stock_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.low_stock_alerts
    ADD CONSTRAINT low_stock_alerts_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_attempts payment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: stock_reservations stock_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: idempotency_records_user_id_operation_key_key; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE UNIQUE INDEX idempotency_records_user_id_operation_key_key ON public.idempotency_records USING btree (user_id, operation, key);


--
-- Name: inventories_product_id_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX inventories_product_id_idx ON public.inventories USING btree (product_id);


--
-- Name: inventories_warehouse_id_product_id_key; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE UNIQUE INDEX inventories_warehouse_id_product_id_key ON public.inventories USING btree (warehouse_id, product_id);


--
-- Name: inventory_movements_order_id_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX inventory_movements_order_id_idx ON public.inventory_movements USING btree (order_id);


--
-- Name: inventory_movements_warehouse_id_product_id_created_at_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX inventory_movements_warehouse_id_product_id_created_at_idx ON public.inventory_movements USING btree (warehouse_id, product_id, created_at);


--
-- Name: low_stock_alerts_one_open_per_item; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE UNIQUE INDEX low_stock_alerts_one_open_per_item ON public.low_stock_alerts USING btree (warehouse_id, product_id) WHERE (status = 'OPEN'::public."AlertStatus");


--
-- Name: low_stock_alerts_warehouse_id_status_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX low_stock_alerts_warehouse_id_status_idx ON public.low_stock_alerts USING btree (warehouse_id, status);


--
-- Name: order_items_order_id_product_id_key; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE UNIQUE INDEX order_items_order_id_product_id_key ON public.order_items USING btree (order_id, product_id);


--
-- Name: orders_customer_id_created_at_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX orders_customer_id_created_at_idx ON public.orders USING btree (customer_id, created_at DESC);


--
-- Name: orders_status_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX orders_status_idx ON public.orders USING btree (status);


--
-- Name: payment_attempts_gateway_ref_key; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE UNIQUE INDEX payment_attempts_gateway_ref_key ON public.payment_attempts USING btree (gateway_ref);


--
-- Name: payment_attempts_one_pending_per_order; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE UNIQUE INDEX payment_attempts_one_pending_per_order ON public.payment_attempts USING btree (order_id) WHERE (status = 'PENDING'::public."PaymentAttemptStatus");


--
-- Name: payment_attempts_order_id_created_at_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX payment_attempts_order_id_created_at_idx ON public.payment_attempts USING btree (order_id, created_at);


--
-- Name: products_is_active_category_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX products_is_active_category_idx ON public.products USING btree (is_active, category);


--
-- Name: products_name_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX products_name_idx ON public.products USING btree (name);


--
-- Name: products_name_lower_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX products_name_lower_idx ON public.products USING btree (lower((name)::text));


--
-- Name: products_sku_key; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE UNIQUE INDEX products_sku_key ON public.products USING btree (sku);


--
-- Name: stock_reservations_one_active_per_item; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE UNIQUE INDEX stock_reservations_one_active_per_item ON public.stock_reservations USING btree (order_id, product_id) WHERE (status = 'ACTIVE'::public."ReservationStatus");


--
-- Name: stock_reservations_order_id_status_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX stock_reservations_order_id_status_idx ON public.stock_reservations USING btree (order_id, status);


--
-- Name: stock_reservations_status_expires_at_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX stock_reservations_status_expires_at_idx ON public.stock_reservations USING btree (status, expires_at);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: warehouses_code_key; Type: INDEX; Schema: public; Owner: mw_user
--

CREATE UNIQUE INDEX warehouses_code_key ON public.warehouses USING btree (code);


--
-- Name: idempotency_records idempotency_records_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.idempotency_records
    ADD CONSTRAINT idempotency_records_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: idempotency_records idempotency_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.idempotency_records
    ADD CONSTRAINT idempotency_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventories inventories_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.inventories
    ADD CONSTRAINT inventories_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventories inventories_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.inventories
    ADD CONSTRAINT inventories_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_movements inventory_movements_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_movements inventory_movements_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_movements inventory_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_movements inventory_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: low_stock_alerts low_stock_alerts_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.low_stock_alerts
    ADD CONSTRAINT low_stock_alerts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: low_stock_alerts low_stock_alerts_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.low_stock_alerts
    ADD CONSTRAINT low_stock_alerts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orders orders_fulfillment_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_fulfillment_warehouse_id_fkey FOREIGN KEY (fulfillment_warehouse_id) REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payment_attempts payment_attempts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_reservations stock_reservations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_reservations stock_reservations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_reservations stock_reservations_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: users users_assigned_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mw_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_assigned_warehouse_id_fkey FOREIGN KEY (assigned_warehouse_id) REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict AQg3LCkbrrBc57PqZd49ooRlyY5RFOPs5dsY37kBFPZi42GkTmm449hNnzTv99J

