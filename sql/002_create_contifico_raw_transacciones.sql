-- ============================================================
-- CONTIFICO RAW - TABLAS DE TRANSACCIONES (prefijo: trx_)
-- Schema: contifico_raw
-- ============================================================

-- ============================================================
-- 1. DOCUMENTOS (facturas, notas crédito, etc.) - CARGA PARALELA
-- Endpoint: GET /documento/?fecha_emision=DD/MM/YYYY
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.trx_documentos (
    id VARCHAR(16) PRIMARY KEY,
    pos TEXT,
    fecha_creacion VARCHAR(20),
    fecha_emision VARCHAR(20),
    hora_emision VARCHAR(10),
    fecha_vencimiento VARCHAR(20),
    tipo_documento VARCHAR(10), -- FAC, NCV, NDB, LIQ, GRE, RET
    tipo_registro VARCHAR(5), -- CLI, PRO
    documento VARCHAR(50), -- Numero secuencial 001-001-000000001
    estado VARCHAR(2), -- C (cobrado), P (pendiente), A (anulado)
    anulado BOOLEAN DEFAULT false,
    autorizacion TEXT,
    electronico BOOLEAN DEFAULT false,
    firmado BOOLEAN DEFAULT false,
    entregado BOOLEAN DEFAULT false,
    -- Personas
    persona_id VARCHAR(16),
    vendedor_id VARCHAR(16),
    vendedor_identificacion VARCHAR(20),
    caja_id VARCHAR(16),
    -- Montos
    subtotal_0 NUMERIC(13,2) DEFAULT 0,
    subtotal_12 NUMERIC(13,2) DEFAULT 0,
    subtotal NUMERIC(13,2) DEFAULT 0,
    iva NUMERIC(13,2) DEFAULT 0,
    ice NUMERIC(13,2) DEFAULT 0,
    servicio NUMERIC(13,2) DEFAULT 0,
    total NUMERIC(13,2) DEFAULT 0,
    saldo NUMERIC(13,2) DEFAULT 0,
    saldo_anticipo NUMERIC(13,2) DEFAULT 0,
    -- Descripcion y adicionales
    descripcion TEXT,
    adicional1 TEXT,
    adicional2 TEXT,
    referencia TEXT,
    -- Relaciones
    documento_relacionado_id VARCHAR(16),
    reserva_relacionada VARCHAR(16),
    tarjeta_consumo_id VARCHAR(16),
    -- URLs
    url_ TEXT,
    url_ride TEXT,
    url_xml TEXT,
    -- Logistica
    logistica JSONB,
    tipo_descuento VARCHAR(20),
    placa VARCHAR(30),
    -- Evento
    fecha_evento VARCHAR(20),
    hora_evento VARCHAR(10),
    direccion_evento TEXT,
    pax INTEGER,
    -- Domicilio
    tipo_domicilio VARCHAR(20),
    orden_domicilio_id VARCHAR(16),
    -- Datos embebidos (persona y vendedor completos como JSON)
    persona_data JSONB,
    vendedor_data JSONB,
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trx_documentos_fecha_emision ON contifico_raw.trx_documentos(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_trx_documentos_tipo_documento ON contifico_raw.trx_documentos(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_trx_documentos_tipo_registro ON contifico_raw.trx_documentos(tipo_registro);
CREATE INDEX IF NOT EXISTS idx_trx_documentos_documento ON contifico_raw.trx_documentos(documento);
CREATE INDEX IF NOT EXISTS idx_trx_documentos_estado ON contifico_raw.trx_documentos(estado);
CREATE INDEX IF NOT EXISTS idx_trx_documentos_persona_id ON contifico_raw.trx_documentos(persona_id);
CREATE INDEX IF NOT EXISTS idx_trx_documentos_vendedor_id ON contifico_raw.trx_documentos(vendedor_id);

-- ============================================================
-- 2. DOCUMENTO DETALLES (líneas de cada documento)
-- Embebido en /documento/ response como array "detalles"
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.trx_documento_detalles (
    id BIGSERIAL PRIMARY KEY,
    documento_id VARCHAR(16) NOT NULL,
    -- Producto
    producto_id VARCHAR(16),
    producto_nombre VARCHAR(500),
    cuenta_id VARCHAR(16),
    centro_costo_id VARCHAR(16),
    -- Cantidades y precios
    cantidad NUMERIC(13,6) DEFAULT 0,
    precio NUMERIC(13,6) DEFAULT 0,
    porcentaje_descuento NUMERIC(5,2) DEFAULT 0,
    -- Impuestos
    porcentaje_iva NUMERIC(5,2),
    porcentaje_ice NUMERIC(5,2),
    valor_ice NUMERIC(13,2) DEFAULT 0,
    base_cero NUMERIC(13,2) DEFAULT 0,
    base_gravable NUMERIC(13,2) DEFAULT 0,
    base_no_gravable NUMERIC(13,2) DEFAULT 0,
    ibpnr NUMERIC(13,2) DEFAULT 0,
    -- Campos adicionales
    serie VARCHAR(50),
    descripcion TEXT,
    color_id VARCHAR(16),
    nombre_manual VARCHAR(500),
    peso NUMERIC(13,6),
    volumen NUMERIC(13,6),
    adicional1 TEXT,
    codigo_bien VARCHAR(50),
    formula JSONB,
    formula_asociada TEXT,
    personas_asociadas JSONB,
    promocion_integracion_id VARCHAR(50),
    -- Metadata
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trx_doc_detalles_documento_id ON contifico_raw.trx_documento_detalles(documento_id);
CREATE INDEX IF NOT EXISTS idx_trx_doc_detalles_producto_id ON contifico_raw.trx_documento_detalles(producto_id);
CREATE INDEX IF NOT EXISTS idx_trx_doc_detalles_centro_costo ON contifico_raw.trx_documento_detalles(centro_costo_id);

-- ============================================================
-- 3. DOCUMENTO COBROS (pagos de cada documento)
-- Embebido en /documento/ response como array "cobros"
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.trx_documento_cobros (
    id VARCHAR(16) PRIMARY KEY,
    documento_id VARCHAR(16) NOT NULL,
    caja_id VARCHAR(16),
    forma_cobro VARCHAR(10), -- EFE (efectivo), TRA (transferencia), TAR (tarjeta), CHE (cheque)
    monto NUMERIC(13,2) DEFAULT 0,
    cuenta_bancaria_id VARCHAR(16),
    numero_comprobante VARCHAR(100),
    numero_cheque VARCHAR(50),
    numero_tarjeta VARCHAR(50),
    lote VARCHAR(50),
    tipo_ping VARCHAR(20),
    fecha VARCHAR(20),
    monto_propina NUMERIC(13,2),
    bin_tarjeta VARCHAR(20),
    nombre_tarjeta VARCHAR(100),
    tipo_banco VARCHAR(20),
    fecha_cheque VARCHAR(20),
    -- Metadata
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trx_doc_cobros_documento_id ON contifico_raw.trx_documento_cobros(documento_id);
CREATE INDEX IF NOT EXISTS idx_trx_doc_cobros_forma_cobro ON contifico_raw.trx_documento_cobros(forma_cobro);
CREATE INDEX IF NOT EXISTS idx_trx_doc_cobros_fecha ON contifico_raw.trx_documento_cobros(fecha);

-- ============================================================
-- 4. MOVIMIENTOS DE INVENTARIO - CARGA PARALELA
-- Endpoint: GET /movimiento-inventario/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.trx_movimientos_inventario (
    id VARCHAR(16) PRIMARY KEY,
    codigo VARCHAR(50),
    tipo VARCHAR(3), -- ING (ingreso), EGR (egreso), TRA (transferencia), AJU (ajuste)
    fecha VARCHAR(20),
    estado VARCHAR(1), -- G (generado), P (pendiente)
    descripcion TEXT,
    generar_asiento BOOLEAN DEFAULT false,
    codigo_interno VARCHAR(50),
    -- Bodegas
    bodega_id VARCHAR(16),
    bodega_destino_id VARCHAR(16),
    pos VARCHAR(50),
    -- Montos
    total NUMERIC(13,2) DEFAULT 0,
    maneja_venta BOOLEAN DEFAULT false,
    -- Detalles embebidos
    detalles JSONB, -- Array de {producto_id, cantidad, precio, serie, edicion}
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trx_mov_inv_tipo ON contifico_raw.trx_movimientos_inventario(tipo);
CREATE INDEX IF NOT EXISTS idx_trx_mov_inv_fecha ON contifico_raw.trx_movimientos_inventario(fecha);
CREATE INDEX IF NOT EXISTS idx_trx_mov_inv_estado ON contifico_raw.trx_movimientos_inventario(estado);
CREATE INDEX IF NOT EXISTS idx_trx_mov_inv_bodega_id ON contifico_raw.trx_movimientos_inventario(bodega_id);

-- ============================================================
-- 5. MOVIMIENTOS BANCARIOS (12,956 registros) - CARGA PARALELA
-- Endpoint: GET /banco/movimiento/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.trx_bancos_movimientos (
    id VARCHAR(16) PRIMARY KEY,
    tipo_registro VARCHAR(2), -- E (egreso), I (ingreso)
    tipo VARCHAR(2), -- T (transferencia), C (cheque), D (deposito)
    fecha_emision VARCHAR(20),
    numero_comprobante VARCHAR(100),
    persona VARCHAR(16), -- persona_id
    cuenta_bancaria_id VARCHAR(16),
    detalles JSONB, -- Array de {cuenta_id, monto, centro_costo_id}
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trx_bancos_mov_tipo_registro ON contifico_raw.trx_bancos_movimientos(tipo_registro);
CREATE INDEX IF NOT EXISTS idx_trx_bancos_mov_fecha ON contifico_raw.trx_bancos_movimientos(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_trx_bancos_mov_cuenta ON contifico_raw.trx_bancos_movimientos(cuenta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_trx_bancos_mov_persona ON contifico_raw.trx_bancos_movimientos(persona);

-- ============================================================
-- 6. ASIENTOS CONTABLES
-- Endpoint: GET /contabilidad/asiento/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.trx_asientos_contables (
    id VARCHAR(16) PRIMARY KEY,
    fecha VARCHAR(20),
    descripcion TEXT,
    tipo VARCHAR(10),
    numero VARCHAR(50),
    estado VARCHAR(1),
    detalles JSONB, -- Array de lineas contables
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trx_asientos_fecha ON contifico_raw.trx_asientos_contables(fecha);
CREATE INDEX IF NOT EXISTS idx_trx_asientos_tipo ON contifico_raw.trx_asientos_contables(tipo);

-- ============================================================
-- 7. GUIAS DE REMISION
-- Endpoint: GET /inventario/guia/
-- ============================================================
CREATE TABLE IF NOT EXISTS contifico_raw.trx_guias_remision (
    id VARCHAR(16) PRIMARY KEY,
    cedula_chofer VARCHAR(20),
    transportista_id VARCHAR(16),
    nombre_chofer VARCHAR(100),
    nombre_despachador VARCHAR(100),
    placa VARCHAR(30),
    fecha_emision VARCHAR(20),
    fecha_inicio VARCHAR(20),
    fecha_fin VARCHAR(20),
    electronico BOOLEAN DEFAULT false,
    autorizacion VARCHAR(60),
    numero_documento VARCHAR(20),
    pos VARCHAR(16),
    bodega_id VARCHAR(16),
    ordencompraventa_id VARCHAR(16),
    descripcion TEXT,
    direccion_partida VARCHAR(200),
    estado VARCHAR(1), -- E (emitido), A (anulado)
    adicional1 TEXT,
    adicional2 TEXT,
    -- Destinatario y detalles embebidos
    destinatario JSONB,
    -- Metadata de sincronizacion
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trx_guias_fecha ON contifico_raw.trx_guias_remision(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_trx_guias_estado ON contifico_raw.trx_guias_remision(estado);
CREATE INDEX IF NOT EXISTS idx_trx_guias_bodega ON contifico_raw.trx_guias_remision(bodega_id);
