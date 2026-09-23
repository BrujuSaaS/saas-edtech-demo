const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
//const { Pool } = require('pg'); // Driver nativo de Postgres

const app = express();
// app.use(cors()); // <--- NUEVO: Habilitar que Next.js le mande datos

// CONFIGURACIÓN DE ACCESO SEGURO A POSTGRESQL EN LA NUBE (NEON.TECH)
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_7kBGDRE4OToP@ep-late-cell-b65wnvnf-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    ssl: { rejectUnauthorized: false } // Candado obligatorio para conexiones https cifradas en la nube
});

// Liberar CORS absoluto para que los dos túneles de ngrok se hablen en internet
// CORRECCIÓN INYECTOR DE CABECERAS (HACKEO DE ENTRADA)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning");
    
    // Saltarse la pantalla gris intermedia de Ngrok gratis
    res.header("ngrok-skip-browser-warning", "true");

    // Camuflaje de Host local
    req.headers['host'] = 'localhost:5000'; 

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});


app.use(express.json());

// Hacer pública la carpeta de grabaciones para el reproductor
app.use('/grabaciones', express.static('grabaciones'));

app.use(express.json()); // Habilitar lectura de JSON corporativo

// Configuración del Pool de conexión al Docker (Puerto estándar 5432)
//const pool = new Pool({
//    user: 'adrian_cto',
//    host: 'localhost',
//    database: 'edtech_core_db',
//    password: 'bariloche_saas_2026', // <--- Poné tu contraseña real del Día 1
//    port: 5432,
//});

async function iniciarTablasRelacionales() {
    try {
        // Validar conexión base con Docker
        await pool.query('SELECT NOW()');
        console.log('🔌 [STATUS: 200] HANDSHAKE EXITOSO CON POSTGRESQL EN DOCKER');

        // 1. Tabla de Institutos (Tenants Base)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tenants (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Tabla de Configuración de Marca Blanca (Flexibilidad Visual JSONB)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tenant_config (
                tenant_id INT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
                logo_url TEXT DEFAULT NULL,
                color_primario VARCHAR(20) DEFAULT '#0b0f19',
                color_secundario VARCHAR(20) DEFAULT '#1e3a8a',
                tipo_botones VARCHAR(20) DEFAULT 'redondos',
                permisos_dinamicos JSONB DEFAULT '{"solapas": ["alumno", "profesor", "rrhh", "instituto"]}'::jsonb
            );
        `);

        // 3. Tabla de Usuarios (La base de la Jerarquía Flexible)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                rol_nombre VARCHAR(50) NOT NULL, -- Director, Secretario, Docente, Alumno, Preceptor
                fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Tabla de Entregas de Audio (Módulo Oral)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS entregas_audio (
                id SERIAL PRIMARY KEY,
                tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
                alumno_nombre VARCHAR(100) NOT NULL,
                empresa_cliente VARCHAR(100) DEFAULT 'Globant',
                archivo_ruta TEXT NOT NULL,
                feedback_docente TEXT DEFAULT NULL,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 5. Tabla del Foro de Discusión (Mensajes Persistidos de Daily Standups)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS foro_mensajes (
                id SERIAL PRIMARY KEY,
                tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
                usuario_nombre VARCHAR(100) NOT NULL,
                mensaje_texto TEXT NOT NULL,
                fecha_post TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 6. Tabla de Biblioteca Virtual (Archivos Compartidos por Gastón)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS biblioteca_archivos (
                id SERIAL PRIMARY KEY,
                tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
                titulo_archivo VARCHAR(200) NOT NULL,
                archivo_ruta_fisica TEXT NOT NULL,
                rol_permitido VARCHAR(50) DEFAULT 'alumno'
            );
        `);

    console.log('📊 [DATABASE] ESQUEMA MULTI-TENANT COMPLETO VERIFICADO EN DOCKER');
        // Gatillar el sembrado de datos piloto
    await inyectarDatosPiloto();

    // INYECTÁ ESTAS TRES LÍNEAS JUSTO ACÁ ADENTRO:
    await expandirEsquemaErp();
    await sembrarDatosErp();
    console.log("⚙️ [SYSTEM] Inicialización de submódulos ERP completada en producción.");

    } catch (err) {
        console.error('❌ [DATABASE ERROR] Falló el aprovisionamiento de tablas:', err.message);
    }
}

// EXPANSIÓN EDTECH ERP: MIGRACIÓN AUTOMÁTICA DE TABLAS NUEVAS
async function expandirEsquemaErp() {
    try {
        // 1. Ampliación de Habilidades en la tabla real de entregas_audio (CORREGIDO)
        await pool.query(`
            ALTER TABLE entregas_audio 
            ADD COLUMN IF NOT EXISTS hability_tipo VARCHAR(20) DEFAULT 'oral' 
            CHECK (hability_tipo IN ('oral', 'escrito', 'escucha', 'lectura'));
        `);

        // 2. Tabla de Jerarquías Organizacionales (Requerimiento Estricto Instituto)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS jerarquias_instituto (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                nombre_rol VARCHAR(50) NOT NULL, -- 'Dueño', 'Director', 'Coordinador', 'TAE/MAE', 'Secretaria', 'Profesor'
                nivel_rango INTEGER NOT NULL -- Jerarquía numérica para control de permisos
            );
        `);

        // 3. Tabla de Datos de Contratación y Remuneración Administrativa
        await pool.query(`
            CREATE TABLE IF NOT EXISTS contratos_personal (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL, -- ID del profesor o administrativo
                modalidad_contrato VARCHAR(30) NOT NULL, -- 'Monotributo', 'Empleado Relacion Dependencia'
                tipo_remuneracion VARCHAR(30) NOT NULL, -- 'Por Alumno', 'Por Clase', 'Por Semana', 'Por Mes', 'Sueldo Fijo'
                monto_base NUMERIC(10, 2) DEFAULT 0.00,
                legajo_numero VARCHAR(30) UNIQUE NOT NULL
            );
        `);

        // 4. Tabla de Clases del Aula Virtual (Presenciales y Remotas con Pizarra)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS aula_virtual_clases (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                profesor_id INTEGER NOT NULL,
                tipo_clase VARCHAR(20) NOT NULL, -- 'Presencial', 'Remota'
                registro_bitacora TEXT, -- Resumen de clase o link a la pizarra/pantalla compartida
                fecha_clase TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 5. Tabla de Asistencias y Calificaciones (Grilla del Profesor)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS grilla_seguimiento (
                id SERIAL PRIMARY KEY,
                clase_id INTEGER REFERENCES aula_virtual_clases(id) ON DELETE CASCADE,
                alumno_id INTEGER NOT NULL,
                asistio BOOLEAN DEFAULT TRUE,
                nota_conceptual NUMERIC(4,2) DEFAULT NULL
            );
        `);

        // 6. Sistema Central de Alarmas y Recordatorios Educativos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS alarmas_educativas (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                titulo VARCHAR(100) NOT NULL,
                descripcion TEXT,
                tipo_evento VARCHAR(30) NOT NULL, -- 'Foro', 'Examen', 'TP', 'Cuota Vencida'
                fecha_limite TIMESTAMP NOT NULL,
                visto BOOLEAN DEFAULT FALSE
            );
        `);

        console.log("🚀 [DATABASE] Expansión ERP Multi-Tenant completada con éxito en Docker.");
    } catch (err) {
        console.error("❌ [DATABASE MIGRATION ERROR] Falló la inyección del esquema ERP:", err);
    }
}


// Función para inyectar el Instituto Oxford y sus usuarios de prueba si la base está vacía
async function inyectarDatosPiloto() {
    try {
        // Verificar si ya existe el Tenant ID #1
        const checkTenant = await pool.query('SELECT id FROM tenants WHERE id = 1');
        if (checkTenant.rows.length === 0) {
            console.log('🌱 [SEED] BASE DE DATOS VACÍA. INICIANDO INYECCIÓN DE DATOS PILOTO...');

            // 1. Insertar Instituto Base
            await pool.query(`INSERT INTO tenants (id, nombre) VALUES (1, 'Oxford International Academy');`);

            // 2. Insertar Configuración de Marca Blanca (Botones redondos, logo y paleta espacial)
            await pool.query(`
                INSERT INTO tenant_config (tenant_id, logo_url, color_primario, color_secundario, tipo_botones)
                VALUES (1, 'https://unsplash.com', '#0b0f19', '#2563eb', 'redondos');
            `);

            // 3. Insertar la Jerarquía de Usuarios reales vinculados a este Instituto
            // Contraseñas en texto plano para el MVP de preventa rápido
            await pool.query(`
                INSERT INTO usuarios (tenant_id, nombre, email, password_hash, rol_nombre) VALUES
                (1, 'Elena Rostova', 'elena@oxford.com', 'admin123', 'Director'),
                (1, 'Laura Martínez', 'laura@oxford.com', 'docente123', 'Docente'),
                (1, 'Martín Dev', 'martin@globant.com', 'alumno123', 'Alumno');
            `);

            // 4. Insertar un mensaje inicial en el Foro
            await pool.query(`
                INSERT INTO foro_mensajes (tenant_id, usuario_nombre, mensaje_texto)
                VALUES (1, 'Gastón (Pedagogía)', 'Bienvenidos al foro multi-tenant. Recuerden mitigar el vicio de la R soft.');
            `);
            // 5. Insertar Material de Estudio real en la Biblioteca Virtual
            await pool.query(`
                INSERT INTO biblioteca_archivos (tenant_id, titulo_archivo, archivo_ruta_fisica) VALUES
                (1, '📕 Guía de Idioms de Negocios Avanzados (Método Gastón)', 'Guia_Idioms_Tech.pdf'),
                (1, '📘 Plantillas de Correos para Product Managers & Devs', 'Plantillas_Mails_PM.docx');
            `);

            console.log('✅ [SEED SUCCESS] INSTITUTO OXFORD Y JERARQUÍAS VIVAS EN POSTGRES');
        } else {
            console.log('✨ [SEED] DATOS PILOTO YA EXISTENTES EN EL CONTENEDOR DOCKER');
        }
    } catch (err) {
        console.error('❌ [SEED ERROR] Falló la inyección automatizada:', err.message);
    }
}

async function sembrarDatosErp() {
    try {
        // Validamos si ya existen datos para no duplicar en las semillas
        const verificar = await pool.query("SELECT COUNT(*) FROM jerarquias_instituto;");
        if (parseInt(verificar.rows[0].count) === 0) {
            // Semillas de Jerarquía Configurable para Oxford (Tenant 1)
            await pool.query(`
                INSERT INTO jerarquias_instituto (tenant_id, nombre_rol, nivel_rango) VALUES 
                (1, 'Mg. Elena Rostova (Director)', 1),
                (1, 'Prof. Laura M. (Coordinador)', 2),
                (1, 'Lic. Carlos P. (TAE/MAE Inclusión)', 3),
                (1, 'Marta G. (Secretaria Administrativa)', 4);
            `);

            // Semillas de Alarmas Educativas
            await pool.query(`
                INSERT INTO alarmas_educativas (tenant_id, titulo, descripcion, tipo_evento, fecha_limite) VALUES 
                (1, '📝 Entrega de TP Escrito Semanal', 'Revisión fonética método Gastón.', 'TP', NOW() + INTERVAL '2 days'),
                (1, '🔥 Examen Oral Trimestral', 'Audición presencial en el aula magna.', 'Examen', NOW() + INTERVAL '5 days'),
                (1, '⚠️ Vencimiento de Matrícula Corporativa', 'Control de caja administrativa.', 'Cuota Vencida', NOW() + INTERVAL '1 day');
            `);

            console.log("✨ [SEED] Módulos ERP sembrados con datos comerciales piloto.");
        }
    } catch (err) {
        console.error("❌ Error al sembrar datos ERP:", err);
    }
}


// Modificamos la ejecución final para que corra el seed justo después de validar las tablas


iniciarTablasRelacionales();

// Crear la carpeta de grabaciones automáticamente si no existe
if (!fs.existsSync('./grabaciones')) {
    fs.mkdirSync('./grabaciones', { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, './grabaciones/'); },
    filename: (req, file, cb) => { cb(null, 'alumno_martin_' + Date.now() + '.wav'); }
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <link href="https://googleapis.com" rel="stylesheet">
    <meta charset="UTF-8">
    <title>Core EdTech SaaS</title>
    <script src="https://tailwindcss.com"></script>
    <style>.pantalla, .subtab { display: none; } .pantalla.active, .subtab.active { display: block; }</style>
</head>
<body class="bg-[#0b0f19] text-slate-100 font-sans tracking-tight p-4 md:p-8 flex justify-center">
<div class="w-full max-w-xl bg-[#111827] p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-6">
    
    <div class="flex flex-col sm:flex-row justify-between items-center border-b border-slate-800 pb-4 gap-4">
        <div>
            <span class="bg-blue-950/60 text-blue-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-blue-900/50">Entorno Alfa V1.0</span>
            <h1 class="text-xl font-black text-white tracking-tight mt-1">🎯 CORE EDTECH</h1>
        </div>
        <div class="flex bg-[#1f2937] p-1 rounded-xl gap-1 w-full sm:w-auto" id="role-selector">
            <button onclick="r('a')" class="flex-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-500/10 uppercase">Alumno</button>
            <button onclick="r('p')" class="flex-1 px-3 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:bg-slate-700 uppercase">Docente</button>
            <button onclick="r('i')" class="flex-1 px-3 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:bg-slate-700 uppercase">🏛️ Inst</button>
        </div>
    </div>

    <!-- PANTALLA ALUMNO -->
    <div id="v-a" class="pantalla active space-y-4">
        <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
            <div>
                <h2 class="text-sm font-bold text-white">📱 Portal Alumno: <span class="text-blue-400 font-black">Martín</span></h2>
                <p class="text-slate-400 mt-0.5">Globant International | <span id="al-tut" class="font-bold text-slate-300">Tutor: Prof. Laura M.</span></p>
            </div>
            <span id="alumno-status-badge" class="bg-emerald-950/60 text-emerald-400 font-bold px-3 py-1 rounded-full border border-emerald-900/50">✔ AL DÍA</span>
        </div>
        <div class="bg-slate-800/60 p-6 rounded-xl border border-slate-800 text-center space-y-4">
            <div class="bg-blue-950/40 border-l-4 border-blue-500 p-3.5 text-left text-xs text-blue-300 rounded-r-xl"><strong>Desafío Oral Semanal:</strong> Explica en 45 segundos por qué el sprint se va a demorar 2 días debido al bug crítico detectado en producción.</div>
            <button id="m-btn" onclick="tMic()" class="w-16 h-16 bg-red-500 text-white rounded-full text-2xl mx-auto shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center">🎙️</button>
            <p id="m-status" class="text-xs font-bold text-slate-400">Tocá el micrófono para grabar tu respuesta en vivo</p>
            <div id="audio-box" class="mt-2" style="display:none;"></div>
        </div>
        <div class="flex gap-1 bg-slate-800 p-1 rounded-xl text-xs font-bold overflow-x-auto">
            <button onclick="s('acad')" class="flex-1 py-2 px-3 rounded-lg bg-blue-600 text-white uppercase">📚 Devolución</button>
            <button onclick="s('foro')" class="flex-1 py-2 px-3 rounded-lg text-slate-400 uppercase hover:bg-slate-700">💬 Foro</button>
            <button onclick="s('biblio')" class="flex-1 py-2 px-3 rounded-lg text-slate-400 uppercase hover:bg-slate-700">📖 Biblioteca</button>
            <button onclick="s('eval')" class="flex-1 py-2 px-3 rounded-lg text-slate-400 uppercase hover:bg-slate-700">📝 TPs</button>
        </div>
        <div id="sb-acad" class="subtab active"><div class="bg-slate-800/40 p-5 rounded-xl border border-slate-800"><h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">📥 Último Feedback Recibido</h4><textarea id="alumno-view" readonly class="w-full h-32 p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 resize-none" placeholder="La corrección estructurada aparecerá acá al instante..."></textarea></div></div>


                <div id="sb-foro" class="subtab space-y-3"><div class="p-2.5 bg-amber-950/40 border-l-4 border-amber-500 text-xs rounded-r-xl text-amber-300">📢 <strong>Webinar Jueves:</strong> Negociación Corporativa Avanzada.</div><div id="foro-box" class="h-24 bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs overflow-y-auto"><strong>Prof. Laura M.:</strong> Bienvenidos al foro de vocabulario técnico de metodologías ágiles.</div><div class="flex gap-2"><input type="text" id="foro-input" placeholder="Escribí tu consulta..." class="flex-1 p-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none"><button onclick="sendForo()" class="bg-blue-600 text-white px-4 py-2 text-xs font-bold rounded-lg uppercase">Post</button></div></div>
        <div id="sb-biblio" class="subtab"><div class="bg-slate-800/40 p-5 rounded-xl border border-slate-800 flex justify-between items-center text-xs"><div><strong class="text-slate-200">📕 Guía de Idioms de Negocios</strong><span class="block text-[10px] text-slate-500 mt-0.5">PDF | 2.4 MB</span></div><button onclick="alert('Descargando de Biblioteca Virtual...')" class="bg-blue-950 text-blue-400 font-bold px-3 py-1.5 rounded-lg border border-blue-900/50">Descargar</button></div></div>
        <div id="sb-eval" class="subtab"><div class="bg-slate-800/40 p-5 rounded-xl border border-slate-800 flex justify-between items-center text-xs"><div><strong class="text-slate-200">📑 TP 1: Redacción de Mails Corporativos</strong><span class="block text-[10px] text-amber-500 font-bold mt-0.5">⚠️ Pendiente Entrega</span></div><button onclick="alert('TP de evaluación entregado con éxito.')" class="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg uppercase">Entregar</button></div></div>
    </div>

    <!-- PANTALLA DOCENTE -->
    <div id="v-p" class="pantalla space-y-4">
        <div class="bg-white p-5 rounded-xl border border-slate-200 text-slate-900"><h2 class="text-base font-bold">💻 Panel del Docente: <span class="text-blue-600 font-black">Prof. Laura Martínez</span></h2></div>
        <div class="bg-emerald-950/40 border border-dashed border-emerald-800 p-4 rounded-xl text-xs text-emerald-300"><strong class="block font-bold">🤖 Asistente IA (Pre-Escucha Analítica):</strong><p class="mt-1 text-slate-300">Se detectó vicio fonético tosco en la letra "R" y desorden en el adjetivo.</p><div class="flex gap-2 mt-2"><button onclick="document.getElementById('ed').value='⚠️ #R_SOFT: La lengua no toca el paladar; se curva hacia atrás flotando en el medio.'" class="bg-emerald-600 text-white font-bold px-2.5 py-1 rounded text-[11px]">Aplicar #R_SOFT</button></div></div>
        <div class="bg-slate-800/40 p-5 rounded-xl border border-slate-800 space-y-3"><div id="p-play" class="bg-slate-950 p-4 border border-slate-800 rounded-xl text-center text-xs text-slate-500 italic">Esperando la grabación del alumno en la pestaña 1...</div></div>
        <div class="bg-slate-800/40 p-5 rounded-xl border border-slate-800 space-y-3"><p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Botonera Inteligente (Material de Gastón):</p><button class="w-full p-2.5 bg-slate-100 text-slate-900 border rounded-xl text-left font-bold text-xs" onclick="document.getElementById('ed').value='⚠️ #VOCAL_CORTA_LARGA:\nCambiar la duración cambia el significado. Ejemplo: Sheet (larga) con Shit (corta).'">❌ #VOCAL_CORTA_LARGA</button><textarea id="ed" class="w-full h-32 p-3 bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 rounded-xl mt-3 focus:outline-none" placeholder="Seleccioná un error arriba o usa la IA..."></textarea><button onclick="sendFeedback()" class="w-full bg-emerald-500 text-white font-bold py-3 rounded-lg text-sm uppercase mt-2 tracking-wide">Enviar Corrección al Alumno</button></div>
    </div>

    <!-- PANTALLA INSTITUTO -->
    <div id="v-i" class="pantalla text-xs space-y-4"><div class="bg-slate-800/40 p-5 rounded-xl border border-slate-800"><h2 class="text-base font-black text-white">🏛️ Panel de Gestión del Instituto</h2><p class="text-slate-400 mt-0.5">Módulo Administrativo Multi-tenant corporativo.</p></div><div class="bg-slate-800/40 p-5 rounded-xl border border-slate-800"><h3 class="font-bold text-slate-400 uppercase tracking-wider mb-2">👥 Jerarquía del Equipo Directivo</h3><div class="p-3 bg-slate-950 border border-slate-800 rounded-lg flex justify-between"><span><strong>Directora Académica:</strong> Mg. Elena Rostova</span><span class="text-slate-500 font-bold">SuperAdmin</span></div></div><div class="bg-slate-800/40 p-5 rounded-xl border border-slate-800"><h3 class="font-bold text-slate-400 uppercase tracking-wider mb-2">📋 Asignación y Control Docente</h3><div class="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-xl"><span>Martín (Globant)</span><button onclick="triggerMora()" class="bg-red-950/60 text-red-400 border border-red-900/50 px-3 py-1 rounded-lg font-bold">Forzar Mora</button></div></div></div>
</div>

<div id="wa" class="hidden fixed bottom-4 right-4 z-50 bg-[#25D366] text-white p-4 rounded-xl shadow-2xl max-w-[260px] text-xs"></div>

<script>
    let rec; let chunks = []; let isRec = false;
    function r(p) {
        document.getElementById('v-a').style.setProperty('display', (p === 'a') ? 'block' : 'none', 'important');
        document.getElementById('v-p').style.setProperty('display', (p === 'p') ? 'block' : 'none', 'important');
        document.getElementById('v-i').style.setProperty('display', (p === 'i') ? 'block' : 'none', 'important');
    }
    function s(t) {
        document.getElementById('sb-acad').style.setProperty('display', (t === 'acad') ? 'block' : 'none', 'important');
        document.getElementById('sb-foro').style.setProperty('display', (t === 'foro') ? 'block' : 'none', 'important');
        document.getElementById('sb-biblio').style.setProperty('display', (t === 'biblio') ? 'block' : 'none', 'important');
        document.getElementById('sb-eval').style.setProperty('display', (t === 'eval') ? 'block' : 'none', 'important');
    }

    function wa(m) { const p = document.getElementById('wa'); p.innerHTML = "<strong>💬 WhatsApp API</strong><br>" + m; p.className = 'fixed bottom-4 right-4 z-50 bg-[#25D366] text-white p-4 rounded-xl shadow-2xl max-w-[220px] text-xs block'; setTimeout(() => p.className = 'hidden', 3500); }
    function sendFeedback() { const t = document.getElementById('ed').value; if(!t) return; document.getElementById('alumno-view').value = t; alert("Corrección enviada al Alumno."); r('a'); s('acad'); }
    function sendForo() { const t = document.getElementById('foro-input').value; if(!t) return; document.getElementById('foro-box').innerHTML += '<br><strong>Martín:</strong> ' + t; document.getElementById('foro-input').value = ""; }
    function triggerMora() { alert("Mora forzada: Alumno bloqueado."); document.getElementById('alumno-status-badge').innerText = "❌ SUSPENDIDO"; document.getElementById('alumno-status-badge').className = "bg-red-950 text-red-400 font-bold px-3 py-1 rounded-full border border-red-900"; r('a'); }
    async function tMic() {
        const btn = document.getElementById('m-btn'); const status = document.getElementById('m-status');
        if (!isRec) {
            chunks = [];
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                rec = new MediaRecorder(stream);
                rec.ondataavailable = e => chunks.push(e.data);
                rec.onstop = async () => {
                    const blob = new Blob(chunks, { type: 'audio/wav' }); const url = URL.createObjectURL(blob);
                    document.getElementById('audio-box').innerHTML = '<audio controls src="' + url + '" class="w-full"></audio>';
                    document.getElementById('audio-box').style.display = 'block';
                    document.getElementById('p-play').innerHTML = '<audio controls src="' + url + '" class="w-full"></audio>';
                    
                    // CABLEADO REAL: Enviar el archivo físico al servidor por la red local
                    status.innerText = "📤 Transmitiendo audio a la carpeta física...";
                    const formData = new FormData(); formData.append('audio', blob, 'grabacion.wav');
                    try {
                        const response = await fetch('/guardar-audio', { method: 'POST', body: formData });
                        const resData = await response.json();
                        status.innerText = "✅ ¡Audio guardado en el pipeline del disco D!";
                    } catch (err) { status.innerText = "❌ Error de transmisión al servidor."; }
                };
                rec.start(); isRec = true; btn.className = 'w-16 h-16 bg-slate-800 text-white rounded-full text-2xl mx-auto block animate-pulse flex items-center justify-center'; status.innerText = '🛑 Grabando...';
            } catch (err) { alert("Error mic: " + err); }
        } else { rec.stop(); isRec = false; btn.className = 'w-16 h-16 bg-red-500 text-white rounded-full text-2xl mx-auto block flex items-center justify-center'; status.innerText = '✅ Grabado.'; }
    }
</script>
</body>
</html>
    `);
});
// Endpoint de API para recibir el archivo de sonido e insertarlo en Postgres
app.post('/guardar-audio', upload.single('audio'), async (req, res) => {
    if (!req.file) { return res.status(400).json({ error: 'No se recibió ningún audio.' }); }
    
    const archivoRuta = req.file.path;
    const alumnoNombre = 'Martín'; // Simulado para el MVP de la preventa
    const empresaCliente = 'Globant';
    const tenantId = 1; // Primer instituto por defecto

    console.log('📥 ARCHIVO FÍSICO ASENTADO EN DISCO: ' + archivoRuta);

    // CABLEADO RELACIONAL: Inserción directa en el contenedor de Docker
    const queryInsert = `
        INSERT INTO entregas_audio (tenant_id, alumno_nombre, empresa_cliente, archivo_ruta)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
    `;
    
    try {
        const resultado = await pool.query(queryInsert, [tenantId, alumnoNombre, empresaCliente, archivoRuta]);
        const idInsertado = resultado.rows[0].id;
        console.log(`💾 [POSTGRES] REGISTRO COLEGIAL ID #${idInsertado} INSERTADO CON ÉXITO`);
        
        res.json({ 
            mensaje: 'Audio persistido de punta a punta', 
            id_registro: idInsertado,
            ruta: archivoRuta 
        });
    } catch (err) {
        console.error('❌ [DATABASE INSERT ERROR] Falló la persistencia en Postgres:', err.message);
        res.status(500).json({ error: 'Error interno al guardar en la base de datos.' });
    }
});

// 1. ENDPOINT GET: Traer los mensajes reales del Foro guardados en Postgres
app.get('/foro-mensajes', async (req, res) => {
    const querySelect = `
        SELECT id, usuario_nombre, mensaje_texto, fecha_post 
        FROM foro_mensajes 
        ORDER BY fecha_post ASC;
    `;
    try {
        const resultado = await pool.query(querySelect);
        res.json(resultado.rows);
    } catch (err) {
        console.error('❌ [FORO GET ERROR] Falló la lectura en Postgres:', err.message);
        res.status(500).json({ error: 'Error al consultar el foro.' });
    }
});

// 2. ENDPOINT POST: Insertar un nuevo mensaje del Foro en caliente dentro de Docker
app.post('/foro-mensajes', async (req, res) => {
    const { usuario_nombre, mensaje_texto } = req.body;
    if (!usuario_nombre || !mensaje_texto) {
        return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }

    const queryInsert = `
        INSERT INTO foro_mensajes (tenant_id, usuario_nombre, mensaje_texto)
        VALUES (1, $1, $2)
        RETURNING id, fecha_post;
    `;
    try {
        const resultado = await pool.query(queryInsert, [usuario_nombre, mensaje_texto]);
        console.log(`💬 [FORO] NUEVO COMENTARIO DE ${usuario_nombre} PERSISTIDO EN DOCKER`);
        res.json({ mensaje: 'Post publicado con éxito', id: resultado.rows[0].id });
    } catch (err) {
        console.error('❌ [FORO POST ERROR] Falló la inserción en Postgres:', err.message);
        res.status(500).json({ error: 'Error al guardar en el foro.' });
    }
});

// Endpoint de API para que el panel docente consulte las entregas reales en Postgres
app.get('/lista-entregas', async (req, res) => {
    const querySelect = `
        SELECT id, alumno_nombre, empresa_cliente, archivo_ruta, fecha_creacion, feedback_docente 
        FROM entregas_audio 
        ORDER BY fecha_creacion DESC;
    `;
    
    try {
        const resultado = await pool.query(querySelect);
        // Devolvemos el array de filas de la base de datos de Docker de forma nativa en JSON
        res.json(resultado.rows);
    } catch (err) {
        console.error('❌ [DATABASE SELECT ERROR] Falló la lectura en Postgres:', err.message);
        res.status(500).json({ error: 'Error interno al consultar la base de datos.' });
    }
});
// Endpoint de API para consultar el material didáctico real de la Biblioteca en Postgres
app.get('/biblioteca', async (req, res) => {
    const querySelect = `
        SELECT id, titulo_archivo, archivo_ruta_fisica, rol_permitido 
        FROM biblioteca_archivos 
        ORDER BY id ASC;
    `;
    try {
        const resultado = await pool.query(querySelect);
        res.json(resultado.rows);
    } catch (err) {
        console.error('❌ [BIBLIOTECA GET ERROR] Falló la lectura en Postgres:', err.message);
        res.status(500).json({ error: 'Error al consultar la biblioteca.' });
    }
});

app.get('/alarmas-educativas', async (req, res) => {
    try {
        const resultado = await pool.query("SELECT * FROM alarmas_educativas ORDER BY fecha_limite ASC;");
        res.json(resultado.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error de lectura de alarmas");
    }
});


// Endpoint temporal para forzar la inserción de la biblioteca y ver el error
app.get('/forzar-seed-biblioteca', async (req, res) => {
    try {
        await pool.query(`
            INSERT INTO biblioteca_archivos (tenant_id, titulo_archivo, archivo_ruta_fisica) VALUES
            (1, '📕 Guía de Idioms de Negocios Avanzados (Método Gastón)', 'Guia_Idioms_Tech.pdf'),
            (1, '📘 Plantillas de Correos para Product Managers & Devs', 'Plantillas_Mails_PM.docx');
        `);
        res.json({ mensaje: 'Biblioteca sembrada con éxito' });
    } catch (err) {
        console.error('❌ ERROR AL INSERTAR BIBLIOTECA:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint POST: Guardar la corrección del docente en la base relacional
app.post('/enviar-feedback', async (req, res) => {
    const { entrega_id, feedback_texto } = req.body;
    
    if (!entrega_id || !feedback_texto) {
        return res.status(400).json({ error: 'Faltan parámetros obligatorios.' });
    }

    const queryUpdate = `
        UPDATE entregas_audio 
        SET feedback_docente = $1 
        WHERE id = $2 
        RETURNING id;
    `;

    try {
        const resultado = await pool.query(queryUpdate, [feedback_texto, entrega_id]);
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontró la entrega especificada.' });
        }
        console.log(`📝 [POSTGRES] FEEDBACK ACTUALIZADO PARA LA ENTREGA ID #${entrega_id}`);
        res.json({ mensaje: 'Feedback guardado con éxito en la base de datos' });
    } catch (err) {
        console.error('❌ [FEEDBACK POST ERROR] Falló el UPDATE en Postgres:', err.message);
        res.status(500).json({ error: 'Error interno al guardar la corrección.' });
    }
});

// 1. ABM USUARIOS: Endpoint real para inscribir alumnos desde el panel de Instituto
app.post('/crear-usuario', async (req, res) => {
    const { nombre, email, empresa_cliente } = req.body;
    try {
        // Mapeo rápido de negocio para simular los IDs de tus Tenants en la base de datos
        let tenantIdReal = 3; // Particular / Sin Empresa por defecto
        if (empresa_cliente === "Globant") tenantIdReal = 1;
        if (empresa_cliente === "Mercado Libre") tenantIdReal = 2;

        const query = `
            INSERT INTO usuarios (nombre, email, tenant_id, rol_nombre, password_hash) 
            VALUES ($1, $2, $3, 'alumno', 'pbkdf2_sha256_mock_hash_123') 
            RETURNING id;
        `;
        const resultado = await pool.query(query, [nombre, email, tenantIdReal]);
        res.status(201).json({ id: resultado.rows[0].id, mensaje: "Usuario creado" });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "comercial_duplicado", mensaje: "Este correo corporativo ya se encuentra registrado." });
        }
        console.error(err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});


// 2. TRABAJOS ESCRITOS: Recibir y persistir respuestas de texto (No orales)
app.post('/guardar-texto', async (req, res) => {
    const { alumno_nombre, empresa_cliente, texto_entrega } = req.body;
    if (!texto_entrega) {
        return res.status(400).json({ error: 'El contenido del trabajo escrito no puede estar vacío.' });
    }

    // Usamos la misma tabla reutilizando la columna de ruta para guardar el string de texto
    const queryInsert = `
        INSERT INTO entregas_audio (tenant_id, alumno_nombre, empresa_cliente, archivo_ruta)
        VALUES (1, $1, $2, $3)
        RETURNING id;
    `;
    try {
        const resultado = await pool.query(queryInsert, [alumno_nombre || 'Martín Dev', empresa_cliente || 'Globant', '[TEXTO_ESCRITO]: ' + texto_entrega]);
        console.log(`📝 [POSTGRES] TRABAJO ESCRITO PERSISTIDO. ID #${resultado.rows[0].id}`);
        res.json({ mensaje: 'Texto guardado en el motor relacional', id: resultado.rows[0].id });
    } catch (err) {
        console.error('❌ [TEXT INSERT ERROR] Falló en Postgres:', err.message);
        res.status(500).json({ error: 'Error al guardar el trabajo escrito.' });
    }
});

// 3. SEED TEMPORAL PARA AUDIOS DE PRONUNCIACIÓN DE GASTÓN
// Simulamos las rutas de los audios nativos de ejemplo cargados en el búnker relacional
app.get('/audio-ejemplo/:codigo', (req, res) => {
    const { codigo } = req.params;
    console.log(`🔊 [AUDIO EMULATOR] Sirviendo ejemplo nativo para error fonético: #${codigo}`);
    // En producción esto leerá la columna audio_ejemplo_ruta de la tabla
    res.json({ 
        url_audio_correcto: `http://localhost:5000/grabaciones/ejemplo_nativo_${codigo}.wav`,
        tip_fonetico: "Escuchá cómo el nativo curva la lengua hacia atrás sin tocar el paladar."
    });
});

// RUTA TEMPORAL DE AUDITORÍA DE BOXES
app.get('/auditar-usuarios', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'usuarios';
        `);
        res.json(resultado.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// RUTA TEMPORAL DE AUDITORÍA DE BOXES - TABLAS
app.get('/auditar-tablas', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        `);
        res.json(resultado.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});


app.listen(5000, () => {
    console.log('🚀 Servidor Backend EdTech corriendo en http://localhost:5000');
});
