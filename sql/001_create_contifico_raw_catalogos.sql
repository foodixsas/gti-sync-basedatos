-- ============================================================
-- CONTIFICO RAW - TABLAS DE CATALOGOS (prefijo: cat_)
-- Schema: contifico_raw (ya existe en Supabase)
-- Fuente: API Contifico v1 - FOODIX S.A.S.
-- ============================================================

-- ============================================================
-- 1. CATEGORIAS (88 registros)
-- Endpoint: GET /categoria/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.cat_categorias (
    id VARCHAR(16) PRIMARY KEY,
    nombre VARCHAR(300) NOT NULL,
    padre_id VARCHAR(16),
    agrupar BOOLEAN DEFAULT false,
    tipo_producto VARCHAR(4), -- PROD, SERV
    cuenta_venta VARCHAR(16),
    cuenta_compra VARCHAR(16),
    cuenta_inventario VARCHAR(16),
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cat_categorias_nombre ON contifico_raw.cat_categorias(nombre);
CREATE INDEX IF NOT EXISTS idx_cat_categorias_padre_id ON contifico_raw.cat_categorias(padre_id);
CREATE INDEX IF NOT EXISTS idx_cat_categorias_tipo_producto ON contifico_raw.cat_categorias(tipo_producto);

-- ============================================================
-- 2. BODEGAS (11 registros)
-- Endpoint: GET /bodega/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.cat_bodegas (
    id VARCHAR(16) PRIMARY KEY,
    codigo VARCHAR(300) NOT NULL,
    nombre VARCHAR(300) NOT NULL,
    venta BOOLEAN DEFAULT false,
    compra BOOLEAN DEFAULT false,
    produccion BOOLEAN DEFAULT false,
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cat_bodegas_codigo ON contifico_raw.cat_bodegas(codigo);

-- ============================================================
-- 3. MARCAS (114 registros)
-- Endpoint: GET /marca/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.cat_marcas (
    id VARCHAR(16) PRIMARY KEY,
    nombre VARCHAR(300),
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. VARIANTES (0 registros actualmente)
-- Endpoint: GET /variante/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.cat_variantes (
    id VARCHAR(16) PRIMARY KEY,
    nombre VARCHAR(100),
    valores JSONB, -- Array de {id, valor}
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. CUENTAS CONTABLES (1,012 registros)
-- Endpoint: GET /contabilidad/cuenta-contable/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.cat_cuentas_contables (
    id VARCHAR(16) PRIMARY KEY,
    nombre VARCHAR(300) NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    tipo VARCHAR(1), -- G (grupo), D (detalle)
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cat_cuentas_contables_codigo ON contifico_raw.cat_cuentas_contables(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_cuentas_contables_tipo ON contifico_raw.cat_cuentas_contables(tipo);

-- ============================================================
-- 6. CENTROS DE COSTO (27 registros)
-- Endpoint: GET /contabilidad/centro-costo/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.cat_centros_costo (
    id VARCHAR(16) PRIMARY KEY,
    nombre VARCHAR(300) NOT NULL,
    codigo VARCHAR(50),
    tipo VARCHAR(1), -- G (grupo), D (detalle)
    padre_id VARCHAR(16),
    estado VARCHAR(1) DEFAULT 'A', -- A (activo), I (inactivo)
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cat_centros_costo_codigo ON contifico_raw.cat_centros_costo(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_centros_costo_padre_id ON contifico_raw.cat_centros_costo(padre_id);

-- ============================================================
-- 7. CUENTAS BANCARIAS (9 registros)
-- Endpoint: GET /banco/cuenta/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.cat_bancos_cuentas (
    id VARCHAR(16) PRIMARY KEY,
    nombre VARCHAR(300) NOT NULL,
    numero VARCHAR(50),
    tipo_cuenta VARCHAR(2), -- CC (corriente), CA (ahorro)
    cuenta_contable VARCHAR(16),
    saldo_inicial NUMERIC(13,2) DEFAULT 0,
    fecha_corte VARCHAR(20),
    estado VARCHAR(1) DEFAULT 'A',
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cat_bancos_cuentas_numero ON contifico_raw.cat_bancos_cuentas(numero);

-- ============================================================
-- 8. PRODUCTOS (635+ registros)
-- Endpoint: GET /producto/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.cat_productos (
    id VARCHAR(16) PRIMARY KEY,
    codigo VARCHAR(50),
    codigo_barra VARCHAR(100),
    codigo_proveedor VARCHAR(100),
    nombre VARCHAR(500) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(3), -- PRO, SER
    tipo_producto VARCHAR(3), -- SIM, COM, COP, PRO
    estado VARCHAR(1) DEFAULT 'A', -- A (activo), I (inactivo)
    -- Clasificacion
    categoria_id VARCHAR(16),
    marca_id VARCHAR(16),
    marca_nombre VARCHAR(300),
    -- Precios
    pvp1 NUMERIC(13,6),
    pvp2 NUMERIC(13,6),
    pvp3 NUMERIC(13,6),
    pvp4 NUMERIC(13,6),
    pvp_manual BOOLEAN DEFAULT false,
    pvp_peso NUMERIC(13,6),
    costo_maximo NUMERIC(13,6),
    -- Impuestos
    porcentaje_iva NUMERIC(5,2),
    -- Inventario
    cantidad_stock NUMERIC(13,6),
    minimo NUMERIC(13,6),
    peso_desde NUMERIC(13,6),
    peso_hasta NUMERIC(13,6),
    lead_time INTEGER DEFAULT 0,
    para_pos BOOLEAN DEFAULT false,
    -- Cuentas contables
    cuenta_venta_id VARCHAR(16),
    cuenta_compra_id VARCHAR(16),
    cuenta_costo_id VARCHAR(16),
    -- Producto base / variantes
    producto_base_id VARCHAR(16),
    nombre_producto_base VARCHAR(500),
    variantes TEXT,
    detalle_variantes JSONB,
    -- Campos adicionales
    imagen TEXT,
    personalizado1 TEXT,
    personalizado2 TEXT,
    generacion_automatica BOOLEAN DEFAULT false,
    id_integracion_proveedor VARCHAR(50),
    fecha_creacion VARCHAR(20),
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cat_productos_codigo ON contifico_raw.cat_productos(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_productos_codigo_barra ON contifico_raw.cat_productos(codigo_barra);
CREATE INDEX IF NOT EXISTS idx_cat_productos_nombre ON contifico_raw.cat_productos(nombre);
CREATE INDEX IF NOT EXISTS idx_cat_productos_categoria_id ON contifico_raw.cat_productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_cat_productos_estado ON contifico_raw.cat_productos(estado);
CREATE INDEX IF NOT EXISTS idx_cat_productos_tipo ON contifico_raw.cat_productos(tipo);

-- ============================================================
-- 9. PERSONAS (135,230 registros) - CARGA PARALELA
-- Endpoint: GET /persona/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.cat_personas (
    id VARCHAR(16) PRIMARY KEY,
    ruc VARCHAR(20),
    cedula VARCHAR(20),
    placa VARCHAR(20),
    razon_social VARCHAR(500),
    nombre_comercial VARCHAR(500),
    telefonos VARCHAR(200),
    direccion TEXT,
    email VARCHAR(300),
    tipo VARCHAR(2), -- J (juridica), N (natural)
    -- Roles
    es_cliente BOOLEAN DEFAULT false,
    es_proveedor BOOLEAN DEFAULT false,
    es_empleado BOOLEAN DEFAULT false,
    es_corporativo BOOLEAN DEFAULT false,
    es_vendedor BOOLEAN DEFAULT false,
    es_extranjero BOOLEAN DEFAULT false,
    aplicar_cupo BOOLEAN DEFAULT false,
    -- Comercial
    porcentaje_descuento NUMERIC(5,2) DEFAULT 0,
    pvp_default VARCHAR(10),
    -- Campos adicionales cliente
    adicional1_cliente TEXT,
    adicional2_cliente TEXT,
    adicional3_cliente TEXT,
    adicional4_cliente TEXT,
    -- Campos adicionales proveedor
    adicional1_proveedor TEXT,
    adicional2_proveedor TEXT,
    adicional3_proveedor TEXT,
    adicional4_proveedor TEXT,
    -- Bancario
    banco_codigo_id VARCHAR(16),
    tipo_cuenta VARCHAR(2),
    numero_tarjeta VARCHAR(50),
    -- Relaciones
    personaasociada_id VARCHAR(16),
    origen VARCHAR(50),
    id_categoria VARCHAR(16),
    categoria_nombre VARCHAR(300),
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cat_personas_ruc ON contifico_raw.cat_personas(ruc);
CREATE INDEX IF NOT EXISTS idx_cat_personas_cedula ON contifico_raw.cat_personas(cedula);
CREATE INDEX IF NOT EXISTS idx_cat_personas_razon_social ON contifico_raw.cat_personas(razon_social);
CREATE INDEX IF NOT EXISTS idx_cat_personas_tipo ON contifico_raw.cat_personas(tipo);
CREATE INDEX IF NOT EXISTS idx_cat_personas_es_cliente ON contifico_raw.cat_personas(es_cliente);
CREATE INDEX IF NOT EXISTS idx_cat_personas_es_proveedor ON contifico_raw.cat_personas(es_proveedor);
CREATE INDEX IF NOT EXISTS idx_cat_personas_es_empleado ON contifico_raw.cat_personas(es_empleado);

-- ============================================================
-- 10. TABLAS DE CONTROL DE SINCRONIZACION (prefijo: sys_)
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.sys_sync_jobs (
    id BIGSERIAL PRIMARY KEY,
    modulo VARCHAR(50) NOT NULL, -- cat_categorias, cat_bodegas, trx_documentos, etc.
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, en_proceso, completado, error
    registros_total INTEGER DEFAULT 0,
    registros_procesados INTEGER DEFAULT 0,
    registros_error INTEGER DEFAULT 0,
    pagina_actual INTEGER DEFAULT 0,
    paginas_total INTEGER DEFAULT 0,
    error_mensaje TEXT,
    iniciado_at TIMESTAMPTZ,
    completado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sys_sync_jobs_modulo ON contifico_raw.sys_sync_jobs(modulo);
CREATE INDEX IF NOT EXISTS idx_sys_sync_jobs_estado ON contifico_raw.sys_sync_jobs(estado);

CREATE TABLE IF NOT EXISTS contifico_raw.sys_sync_logs (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT REFERENCES contifico_raw.sys_sync_jobs(id),
    nivel VARCHAR(10) DEFAULT 'info', -- info, warning, error
    mensaje TEXT,
    detalle JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sys_sync_logs_job_id ON contifico_raw.sys_sync_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_sys_sync_logs_nivel ON contifico_raw.sys_sync_logs(nivel);
