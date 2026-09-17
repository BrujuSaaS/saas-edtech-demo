"use client";

import { useState, useRef } from "react";
import { API_BASE_URL } from "./config";
//import { API_BASE_URL } from "../config";



export default function Page() {
  const [solapaActive, setSolapaActive] = useState("alumno");
  const [subTabAlumno, setSubTabAlumno] = useState("acad");
  
  // Estado para el tipo de entrega (Oral o Escrito) exigido por Adrián
  const [tipoEntrega, setTipoEntrega] = useState("oral"); 
  const [textoEscritoInput, setTextoEscritoInput] = useState("");

  // Estado de la consola de tráfico en vivo (Teatro de Ingeniería)
  const [logsConsola, setLogsConsola] = useState([
    "🔌 [SaaS SYSTEM] Inicializando entorno de Marca Blanca...",
    "📊 [POSTGRES] Handshake con edtech_postgres OK en puerto 5432."
  ]);

  // Formulario ABM Express de Alumnos (Panel Instituto)
  const [formNombre, setFormNombre] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formEmpresa, setFormEmpresa] = useState("Globant");

  // Estados Base de la Demo
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [statusText, setStatusText] = useState("Tocá el micrófono para grabar tu respuesta en vivo");
  const [editorFeedback, setEditorFeedback] = useState("");
  const [feedbackRecibido, setFeedbackRecibido] = useState("");
  const [statusAlumno, setStatusAlumno] = useState("✔ AL DÍA");
  const [tutorAsignado, setTutorAsignado] = useState("Prof. Laura M.");
  const [alumnoActual, setAlumnoActual] = useState({ nombre: "Martín Dev", empresa: "Globant" });
  // const [entregasReal, setEntregasReal] = useState([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ESTADOS DEL DOCENTE QUE FALTABAN DECLARAR PARA QUE NO SE CONGELE LA PANTALLA
  const [entregaSeleccionada, setEntregaSeleccionada] = useState(null);
  const [entregasReal, setEntregasReal] = useState([]);


  // Utilidad para inyectar líneas en la consola negra en tiempo real
  const pushLog = (texto) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogsConsola((prev) => [`[${timestamp}] ${texto}`, ...prev.slice(0, 8)]);
  };

  // 1. GET: Cargar la cola de entregas de Postgres
  const cargarEntregasDesdePostgres = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/lista-entregas`);
     if (response.ok) {
        const datos = await response.json();
        setEntregasReal(datos);
        pushLog("📊 [SQL SELECT] Traídas " + datos.length + " entregas desde PostgreSQL.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2. POST ABM USUARIOS: Registrar Alumno Real en Docker
  const ejecutarInscripcionABM = async (e) => {
    e.preventDefault();
    if (!formNombre.trim() || !formEmail.trim()) {
      return alert("Por favor, completa los campos.");
    }
    pushLog("👤 [ABM TRIGGER] Despachando inserción a /crear-usuario...");
    try {
      const response = await fetch(`${API_BASE_URL}/crear-usuario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: formNombre, email: formEmail, empresa_cliente: formEmpresa })
      });
      
      const resData = await response.json();

      if (!response.ok) {
        if (resData.error === "comercial_duplicado") {
          pushLog("⚠️ [ABM WARN] Intento de duplicación de email bloqueado.");
          return alert("ℹ️ Registro Duplicado: " + resData.mensaje);
        }
        throw new Error(resData.mensaje || "Error en transacción");
      }

      setAlumnoActual({ nombre: formNombre, empresa: formEmpresa });
      pushLog("💾 [POSTGRES SUCCESS] Nuevo Alumno ID #" + resData.id + " guardado en Docker.");
      alert("✅ Alumno registrado con éxito. La demo mutó con su nombre.");
      setFormNombre(""); 
      setFormEmail(""); 
      await cargarEntregasDesdePostgres();
      setSolapaActive("alumno");
    } catch (err) { 
      pushLog("❌ [ABM FAILED] Error en transacción SQL."); 
    }
  };

  // 3. POST TEXTO: Transmitir TP Escrito (Requerimiento Adrián)
  const enviarTpEscrito = async () => {
    if (!textoEscritoInput.trim()) return alert("Escribe algo en el correo.");
    pushLog("📤 [TRANSMIT] Despachando string de texto a la API del puerto 5000...");
    try {
      const response = await fetch(`${API_BASE_URL}/guardar-texto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumno_nombre: alumnoActual.nombre,
          empresa_cliente: alumnoActual.empresa,
          texto_entrega: textoEscritoInput
        })
      });
      if (response.ok) {
        pushLog("💾 [POSTGRES INSERT] Texto plano indexado en tabla 'entregas_audio'.");
        setStatusText("✅ ¡Trabajo Escrito guardado de punta a punta!");
        setTextoEscritoInput("");
      }
    } catch (err) {
      pushLog("❌ [NET ERROR] Falla de puente relacional.");
    }
  };
  // 4. POST AUDIO: Pipeline del Micrófono Nativo conectado a la Consola
  const toggleRecording = async () => {
    if (!isRecording) {
      audioChunksRef.current = [];
      try {
        pushLog("🎙️ [HARDWARE] Capturando micrófono nativo en el navegador...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mediaRecorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
          setAudioUrl(URL.createObjectURL(blob));
          pushLog("📤 [TRANSMIT] Empaquetando binario .wav y disparando por CORS...");
          setStatusText("📤 Transmitiendo audio al backend...");

          const formData = new FormData();
          formData.append("audio", blob, "grabacion.wav");

          try {
            const response = await fetch("https://tiling-graceful-alike.ngrok-free.dev/guardar-audio", { method: "POST", body: formData });
            if (response.ok) {
              const resData = await response.json();
              pushLog("💾 [POSTGRES INSERT] Registro ID #" + resData.id_registro + " clavado en Docker.");
              setStatusText("✅ ¡Audio guardado en la carpeta del disco D!");
            }
          } catch (err) {
            pushLog("❌ [NET ERROR] Falla de conexión con puerto 5000.");
            setStatusText("❌ Error de conexión con el backend.");
          }
        };
        mediaRecorder.start(); setIsRecording(true); setStatusText("🛑 Grabando audio nativo...");
      } catch (err) { alert("Error de micrófono: " + err); }
    } else { mediaRecorderRef.current.stop(); setIsRecording(false); }
  };

  // 5. POST FEEDBACK: Enviar la plantilla fonética de Gastón
  const enviarCorreccionDocente = async (entregaId) => {
    if (!editorFeedback.trim()) return alert("Selecciona un atajo.");
    pushLog("📝 [SQL UPDATE] Inyectando corrección en el registro ID #" + (entregaId || 1) + "...");
    try {
      const response = await fetch("https://tiling-graceful-alike.ngrok-free.dev/enviar-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entrega_id: entregaId || 1, feedback_texto: editorFeedback })
      });
      if (response.ok) {
        pushLog("✅ [POSTGRES UPDATE SUCCESS] Fila actualizada en tabla 'entregas_audio'.");
        alert("✅ Corrección guardada en Docker con el Método Gastón.");
        setEditorFeedback(""); setSolapaActive("alumno"); setSubTabAlumno("acad");
        cargarEntregasDesdePostgres();
      }
    } catch (err) { pushLog("❌ [NET ERROR] Falla al enviar feedback."); }
  };

  // 6. FORO REAL DESDE POSTGRES
  const [foroMensajes, setForoMensajes] = useState([]);
  const [foroInput, setForoInput] = useState("");

  const cargarForoDesdePostgres = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/foro-mensajes`);
      if (response.ok) { setForoMensajes(await response.json()); pushLog("💬 [FORO SELECT] Sincronizados hilos de chat."); }
    } catch (err) { console.error(err); }
  };

  const sendForo = async () => {
    if (!foroInput.trim()) return;
    pushLog("💬 [FORO POST] Insertando nuevo comentario en caliente...");
    try {
      const response = await fetch(`${API_BASE_URL}/foro-mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_nombre: alumnoActual.nombre, mensaje_texto: foroInput })
      });
      if (response.ok) { setForoInput(""); await cargarForoDesdePostgres(); }
    } catch (err) { console.error(err); }
  };

  const [bibliotecaReal, setBibliotecaReal] = useState([]);
  const cargarBibliotecaDesdePostgres = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/biblioteca`);
      if (response.ok) { setBibliotecaReal(await response.json()); pushLog("📖 [BIBLIO SELECT] Jalados materiales de Gastón."); }
    } catch (err) { console.error(err); }
  };

  const [alarmasReal, setAlarmasReal] = useState([]);

  const cargarAlarmasDesdePostgres = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/alarmas-educativas`);
      if (response.ok) {
        const datos = await response.json();
        setAlarmasReal(datos);
        pushLog("🔔 [ALARMAS SELECT] Sincronizados recordatorios de Gastón.");
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  // Opciones de la base pedagógica de Gastón (Botonera)
  const baseErroresGaston = {
    vocals: "⚠️ #VOCAL_CORTA_LARGA\n\n- Error detectado: Confusión fonética.\n- Ejemplo: Pronunciaste 'Shit' (corta) en lugar de 'Sheet' (larga).\n- 🎯 TIP: Sonreí de forma exagerada al hablar.",
    r_soft: "⚠️ #R_SOFT_SOUND\n\n- Error detectado: Arrastre tosco de la letra 'R'.\n- Corrección: La lengua nunca toca el paladar; se curva hacia atrás.\n- 🎯 EJERCICIO: Practicá: 'Sprint Retrospective'.",
    h_sound: "⚠️ #H_SOUND_J\n\n- Error detectado: Pronunciación de la 'H' como 'J'.\n- Corrección: Es una aspiración suave, como cuando empañás un vidrio.",
    adjective: "⚠️ #ADJECTIVE_ORDER\n\n- Error detectado: Inversión gramatical del adjetivo.\n- Ejemplo: Dijiste 'bug critical' en lugar de 'critical bug'."
  };

  const [clasesVirtuales, setClasesVirtuales] = useState([
    { id: 1, tipo_clase: 'Presencial', registro_bitacora: 'Core Multi-Level: Práctica intensa de conectores formales y debate de Business Idioms en grupos.', fecha_clase: new Date().toISOString() },
    { id: 2, tipo_clase: 'Remota', registro_bitacora: 'Clase Online en vivo: Simulación de llamadas comerciales. Pizarra técnica compartida: https://edtech.com', fecha_clase: new Date(Date.now() - 86400000).toISOString() }
  ]);


  return (
    <div className="flex flex-col min-h-screen bg-[#0b0f19] text-white font-sans p-4 space-y-4 justify-between">
      
      {/* CHASIS PRINCIPAL CENTRAL */}
      <div className="w-full max-w-xl bg-[#111827] p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-6 mx-auto mt-4">
        
          {/* CABECERA DINÁMICA DE MARCA BLANCA */}
          <div className="flex flex-col gap-4 border-b border-slate-800 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="bg-blue-950 text-blue-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase border border-blue-900/50 tracking-wider">
                  White-Label Active
                </span>
                <h1 className="text-xl font-black text-white tracking-tight mt-1">🎯 EDTECH SAAS MULTI-TENANT</h1>
              </div>
              <img src="https://unsplash.com" alt="Logo Tenant" className="w-8 h-8 rounded-full border border-slate-700 object-cover" />
            </div>
            
            {/* SELECTOR DE SOLAPAS CORPORATIVAS */}
            <div className="flex bg-[#1f2937]/60 p-1 rounded-xl gap-0.5 w-full border border-slate-800/80 overflow-x-auto">
              {["alumno", "profesor", "rrhh", "instituto"].map((t) => (
                <button 
                  key={t} 
                  onClick={() => {
                    setSolapaActive(t);
                    if (t === "profesor") cargarEntregasDesdePostgres();
                  }} 
                  className={`flex-1 min-w-[75px] text-center py-2 text-xs font-bold rounded-lg transition-all uppercase ${solapaActive === t ? "bg-[#111827] text-blue-400 border border-slate-800 shadow-xl" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {t === "instituto" ? "🏛️ Inst" : t === "rrhh" ? "💼 RRHH" : t}
                </button>
              ))}
            </div>
          </div>

        {/* CONTAINER DINÁMICO CENTRAL */}
        <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-800/60 min-h-[120px]">
          
          {/* PANEL 1: PORTAL DEL ALUMNO */}
          {solapaActive === "alumno" && (
            <div className="space-y-4 w-full">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <h2 className="text-sm font-bold text-white">📱 Portal Alumno: <span className="text-blue-400 font-black">{alumnoActual.nombre}</span></h2>
                  <p className="text-slate-400 mt-0.5">Organización: {alumnoActual.empresa} | <span className="font-bold text-slate-300">Tutor: {tutorAsignado}</span></p>
                </div>
                <span className={`font-bold px-3 py-1 rounded-full border text-[10px] ${statusAlumno === "✔ AL DÍA" ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50" : "bg-red-950 text-red-400 border-red-900"}`}>{statusAlumno}</span>
              </div>

              {/* REQUERIMIENTO ADRIÁN: CONMUTADOR DE TAREA ORAL / ESCRITA */}
              <div className="bg-slate-800/60 p-6 rounded-xl border border-slate-800 text-center space-y-4">
                <div className="flex bg-[#111827] p-1 rounded-lg border border-slate-800 gap-1 w-2/3 mx-auto">
                  <button onClick={() => setTipoEntrega("oral")} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded ${tipoEntrega === "oral" ? "bg-blue-600 text-white" : "text-slate-500"}`}>🎙️ Oral</button>
                  <button onClick={() => setTipoEntrega("escrito")} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded ${tipoEntrega === "escrito" ? "bg-blue-600 text-white" : "text-slate-500"}`}>📝 Escrito</button>
                  <button onClick={() => setTipoEntrega("escucha")} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded ${tipoEntrega === "escucha" ? "bg-blue-600 text-white" : "text-slate-500"}`}>🎧 Escucha</button>
                  <button onClick={() => setTipoEntrega("lectura")} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded ${tipoEntrega === "lectura" ? "bg-blue-600 text-white" : "text-slate-500"}`}>📖 Lectura</button>
                </div>

                <div className="bg-blue-950/40 border-l-4 border-blue-500 p-3.5 text-left text-xs text-blue-300 rounded-r-xl">
                  <strong>Desafío Semanal de Negocios:</strong> {tipoEntrega === "oral" ? "Explica en 45 segundos por qué el sprint se va a demorar 2 días debido al bug crítico." : "Redacta el correo formal notificando la demora del sprint para los Product Managers."}
                </div>

                {/* RENDERIZADO CONDICIONAL MULTI-HABILIDAD REQUERIMIENTO GASTÓN */}
                {tipoEntrega === "oral" && (
                  <div className="space-y-2">
                    <button onClick={toggleRecording} className={`w-14 h-14 rounded-full text-2xl mx-auto shadow-lg flex items-center justify-center cursor-pointer transition-all ${isRecording ? "bg-slate-800 border border-slate-700 animate-pulse text-red-500" : "bg-red-500 text-white hover:scale-105"}`}>🎙️</button>
                    <p className="text-[11px] font-bold text-slate-400">{statusText}</p>
                    {audioUrl && <div className="mt-2 p-2 bg-slate-950 rounded-xl border border-slate-800"><audio src={audioUrl} controls className="w-full h-8" /></div>}
                  </div>
                )}

                {tipoEntrega === "escrito" && (
                  <div className="space-y-2 text-left">
                    <textarea value={textoEscritoInput} onChange={(e) => setTextoEscritoInput(e.target.value)} placeholder="Escribí tu tarea o correo formal acá..." className="w-full h-24 p-2.5 bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono resize-none"></textarea>
                    <button type="button" onClick={enviarTpEscrito} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black py-2 rounded-lg uppercase tracking-wide">Enviar Trabajo Escrito</button>
                    <p className="text-[11px] font-bold text-center text-slate-400 mt-1">{statusText}</p>
                  </div>
                )}

                {tipoEntrega === "escucha" && (
                  <div className="space-y-2 text-center py-2">
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs font-mono italic">
                      🎧 Módulo de Comprensión Auditiva (Listening): El instituto cargará un audio piloto desde la biblioteca corporativa para evaluar tu pre-escucha.
                    </div>
                  </div>
                )}

                {tipoEntrega === "lectura" && (
                  <div className="space-y-2 text-center py-2">
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs font-mono italic">
                      📖 Módulo de Comprensión Lector (Reading): Textos técnicos avanzados asignados por el coordinador pedagógico listos para análisis de IA.
                    </div>
                  </div>
                )}

              </div>

              {/* NAV INTERNA SUB-TABS */}
              <div className="flex gap-1 bg-slate-800 p-1 rounded-lg text-[10px] font-bold">
                <button onClick={() => setSubTabAlumno("acad")} className={`flex-1 py-1.5 rounded uppercase ${subTabAlumno === "acad" ? "bg-[#111827] text-blue-400 border border-slate-700" : "text-slate-400"}`}>📚 Devolución</button>
                <button onClick={() => setSubTabAlumno("foro")} className={`flex-1 py-1.5 rounded uppercase ${subTabAlumno === "foro" ? "bg-[#111827] text-blue-400 border border-slate-700" : "text-slate-400"}`}>💬 Foro</button>
                {/*<button onClick={() => setSubTabAlumno("biblio")} className={`flex-1 py-1.5 rounded uppercase ${subTabAlumno === "biblio" ? "bg-[#111827] text-blue-400 border border-slate-700" : "text-slate-400"}`}>📖 Biblioteca</button>*/}
                <button type="button" onClick={() => { setSubTabAlumno("biblio"); cargarBibliotecaDesdePostgres(); }} className={`flex-1 py-1.5 rounded uppercase ${subTabAlumno === "biblio" ? "bg-[#111827] text-blue-400 border border-slate-700" : "text-slate-400"}`}>📖 Biblioteca</button>
                <button type="button" onClick={() => setSubTabAlumno("eval")} className={`flex-1 py-1.5 rounded uppercase ${subTabAlumno === "eval" ? "bg-[#111827] text-blue-400 border border-slate-700" : "text-slate-400"}`}>📝 TPs</button>

              </div>

              {subTabAlumno === "acad" && (
                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">📥 Último Feedback Recibido (Método Gastón)</h4>
                  <textarea value={entregasReal[0]?.feedback_docente || "No tienes correcciones pendientes."} readOnly className="w-full h-24 p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 resize-none focus:outline-none" placeholder="El feedback del profesor aparecerá acá..."></textarea>
                </div>
              )}

              {subTabAlumno === "foro" && (
                <div className="space-y-2">
                  <div className="h-24 bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs overflow-y-auto space-y-1">
                    {foroMensajes.map((m, idx) => (
                      <p key={idx}><strong className={m.usuario_nombre === alumnoActual.nombre ? "text-blue-400" : "text-slate-400"}>{m.usuario_nombre}:</strong> {m.mensaje_texto}</p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={foroInput} onChange={(e) => setForoInput(e.target.value)} placeholder="Escribí en el foro..." className="flex-1 p-1.5 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none" />
                    <button onClick={sendForo} className="bg-blue-600 text-white px-3 text-xs font-bold rounded-lg uppercase">Post</button>
                  </div>
                </div>
              )}

              {subTabAlumno === "biblio" && (
                <div className="space-y-1 text-xs">
                  {bibliotecaReal.map((archivo) => (
                    <div key={archivo.id} className="bg-slate-800/40 p-3 rounded-lg flex justify-between items-center border border-slate-800">
                      <span>{archivo.titulo_archivo}</span>
                      <button type="button" onClick={() => alert("Descargando: " + archivo.archivo_ruta_fisica)} className="text-blue-400 font-black uppercase text-[10px]">Bajar</button>
                    </div>
                  ))}
                </div>
              )}

              {subTabAlumno === "eval" && (
                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                  <div><strong>📑 Trabajo Práctico Escrito Semanal</strong><span className="block text-[10px] text-amber-500 font-bold mt-0.5">⚠️ Pendiente de evaluación</span></div>
                  <span className="bg-blue-950 text-blue-400 px-3 py-1 rounded text-[10px] font-bold border border-blue-900/50">Core Multi-Level</span>
                </div>
              )}

              {/* SUB-TAB NUEVA REQUERIMIENTO GASTÓN: AULA VIRTUAL (PRESENCIAL Y REMOTA) */}
              <div className="mt-4 bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider mb-1">💻 Aula Virtual & Historial de Clases:</p>
                {clasesVirtuales.map((clase) => (
                  <div key={clase.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${clase.tipo_clase === 'Presencial' ? 'bg-teal-950/40 text-teal-400 border-teal-900/50' : 'bg-purple-950/40 text-purple-400 border-purple-900/50'}`}>
                        {clase.tipo_clase === 'Presencial' ? '🏛️ Presencial' : '🌐 Remota'}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {new Date(clase.fecha_clase).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed font-sans">{clase.registro_bitacora}</p>
                    {clase.tipo_clase === 'Remota' && (
                      <a href="#" onClick={(e) => { e.preventDefault(); alert("Abriendo Pizarra Interactiva de Gastón..."); }} className="inline-block text-[10px] text-blue-400 font-bold underline mt-1 hover:text-blue-300">
                        🔗 Entrar a la Pizarra / Ver Pantalla Compartida
                      </a>
                    )}
                  </div>
                ))}
              </div>


              {/* SUB-TAB NUEVA REQUERIMIENTO GASTÓN: ALARMAS Y RECORDATORIOS */}
              <div className="mt-4 bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider">🔔 Alarmas y Eventos Educativos:</p>
                  <button type="button" onClick={cargarAlarmasDesdePostgres} className="text-amber-500 text-[9px] uppercase font-bold hover:underline">🔄 Sincronizar</button>
                </div>
                {alarmasReal.length === 0 ? (
                  <p className="text-center italic text-slate-500 text-[10px] py-1">Haga clic en Sincronizar para traer alarmas activas corporativas...</p>
                ) : (
                  alarmasReal.map((alarma) => (
                    <div key={alarma.id} className="p-2 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center gap-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200">
                          {alarma.tipo_evento === 'TP' ? '📑' : alarma.tipo_evento === 'Examen' ? '🔥' : '⚠️'} {alarma.titulo}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">{alarma.descripcion}</span>
                      </div>
                      <span className="text-[9px] bg-amber-950/40 text-amber-400 px-2 py-0.5 rounded border border-amber-900/50 font-mono font-bold">
                        {new Date(alarma.fecha_limite).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* SUB-TAB NUEVA REQUERIMIENTO GASTÓN: ADMINISTRACIÓN ALUMNO */}
              <div className="mt-4 bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
                <p className="text-[10px] font-black text-purple-400 uppercase tracking-wider mb-1">💳 Datos del Alumno & Legajo Administrativo:</p>
                
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="bg-slate-900/60 p-2 rounded border border-slate-800/50">
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">Nro Legajo</span>
                      <strong className="text-slate-300">AL-2026-0941</strong>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded border border-slate-800/50">
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">Inquilino (Tenant)</span>
                      <strong className="text-blue-400">{alumnoActual?.empresa || "Oxford Business"}</strong>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-base">💰</span>
                      <div>
                        <span className="block font-bold text-slate-200">Estado de Cuota Mensual</span>
                        <span className="text-[10px] text-slate-400">Vence el 10 de este mes</span>
                      </div>
                    </div>
                    <span className="bg-emerald-950 text-emerald-400 border border-emerald-900 px-2.5 py-0.5 rounded text-[10px] font-black uppercase">
                      Al Día
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* PANEL 2: PORTAL DOCENTE COMPLETO */}
          {solapaActive === "profesor" && (
            <div className="space-y-4 w-full">
              <div className="bg-white p-4 rounded-xl border border-slate-200 text-slate-900 flex justify-between items-center">
                <h2 className="text-sm font-bold">💻 Panel Docente: <span className="text-blue-600 font-black">Prof. Laura M.</span></h2>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-black uppercase">
                  En Cola: {entregasReal.length} Alumno(s)
                </span>
              </div>
              
              <div className="bg-emerald-950/40 border border-dashed border-emerald-800 p-4 rounded-xl text-xs text-emerald-300">
                <strong className="block font-bold">🤖 Asistente IA (Pre-Escucha Fonética):</strong>
                <p className="mt-1 text-slate-400">Se detectó desorden gramatical y arrastre en la letra "R".</p>
                <button onClick={() => { setEditorFeedback(baseErroresGaston.r_soft); pushLog("🤖 [IA SUGGESTION] Cargada plantilla fonética del error #R_SOFT."); }} className="bg-emerald-600 text-white font-bold px-2.5 py-1 rounded text-[10px] mt-2 tracking-wide hover:bg-emerald-500 transition-all">Aplicar Sugerencia IA</button>
              </div>

              {/* COLA DE REGISTROS DE POSTGRES (ORALES Y ESCRITOS REQUERIMIENTO ADRIÁN) */}
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">🎯 Seleccione la entrega a corregir de la lista:</p>
                {entregasReal.length === 0 ? <p className="text-center italic text-slate-500 text-[11px] py-1">No hay entregas.</p> : (
                  entregasReal.slice(0, 3).map((entrega) => (
                    <button 
                      type="button"
                      key={entrega.id} 
                      onClick={() => { setEntregaSeleccionada(entrega); pushLog("👤 [UI] Seleccionada para corregir la entrega ID #" + entrega.id); }}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1 ${entregaSeleccionada?.id === entrega.id ? "bg-blue-950/40 border-blue-500 text-blue-300 shadow-xl" : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"}`}
                    >
                      <div className="flex justify-between items-center text-[11px] w-full">
                        <span>👤 <strong>{entrega.alumno_nombre}</strong> ({entrega.empresa_cliente || "Particular"})</span>
                        <span className="font-mono text-[9px] bg-slate-800 px-1.5 py-0.5 rounded">ID #{entrega.id}</span>
                      </div>
                      {entrega.archivo_ruta.includes("[TEXTO_ESCRITO]:") ? (
                        <div className="p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[10px] w-full text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">{entrega.archivo_ruta.replace("[TEXTO_ESCRITO]:", "📝 ENTRY:")}</div>
                      ) : (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">🎙️ Audio Grabado (Haga clic para cargar en el reproductor)</div>
                      )}
                    </button>
                  ))
                )}
              </div>
              {/* VISUALIZADOR DINÁMICO DE LA ENTREGA SELECCIONADA */}
              {entregaSeleccionada && (
                <div className="bg-slate-900 p-3 rounded-xl border border-blue-900/40 space-y-2 mt-2">
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
                    📂 Evaluando Registro ID #{entregaSeleccionada.id} - {entregaSeleccionada.alumno_nombre}
                  </div>
                  {entregaSeleccionada.archivo_ruta.includes("[TEXTO_ESCRITO]:") ? (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-300 whitespace-pre-wrap">
                      {entregaSeleccionada.archivo_ruta.replace("[TEXTO_ESCRITO]:", "")}
                    </div>
                  ) : (
                    <audio src={`${API_BASE_URL}/grabaciones/${entregaSeleccionada.archivo_ruta.split('\\').pop()}`} controls className="w-full h-8" />
                  )}
                </div>
              )}

              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">🧰 Atajos Rápidos (Método Gastón):</p>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-900">
                  <button type="button" onClick={() => { setEditorFeedback(baseErroresGaston.vocals); pushLog("🧰 [UI] Atajo #VOCAL_C_L seleccionado."); }} className="p-2 bg-slate-100 border rounded-lg text-left hover:bg-slate-200 transition-all">❌ #VOCAL_C_L</button>
                  <button type="button" onClick={() => { setEditorFeedback(baseErroresGaston.r_soft); pushLog("🧰 [UI] Atajo #R_SOFT seleccionado."); }} className="p-2 bg-slate-100 border rounded-lg text-left hover:bg-slate-200 transition-all">❌ #R_SOFT</button>
                  <button type="button" onClick={() => { setEditorFeedback(baseErroresGaston.h_sound); pushLog("🧰 [UI] Atajo #H_SOUND seleccionado."); }} className="p-2 bg-slate-100 border rounded-lg text-left hover:bg-slate-200 transition-all">❌ #H_SOUND</button>
                  <button type="button" onClick={() => { setEditorFeedback(baseErroresGaston.adjective); pushLog("🧰 [UI] Atajo #ADJECTIVE seleccionado."); }} className="p-2 bg-slate-100 border rounded-lg text-left hover:bg-slate-200 transition-all">❌ #ADJECTIVE_ORDER</button>
                </div>
              </div>

              <textarea value={editorFeedback} onChange={(e) => setEditorFeedback(e.target.value)} className="w-full h-24 p-3 bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 rounded-xl focus:outline-none" placeholder="Seleccioná un error arriba..."></textarea>
              <button type="button" onClick={() => enviarCorreccionDocente(entregasReal[0]?.id)} className="w-full bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wide hover:bg-emerald-400 transition-all">Enviar Corrección al Alumno</button>

              {/* === NUEVOS MÓDULOS ERP DOCENTE (REQUERIMIENTO ADRIÁN & GASTÓN) === */}
              
              {/* 1. GRILLA DE SEGUIMIENTO Y ALUMNOS A CARGO */}
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">📊 Grilla de Seguimiento & Asistencias:</p>
                <div className="p-2 bg-slate-900 rounded-lg space-y-1 text-[11px]">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-1 text-slate-500 font-bold uppercase text-[9px]">
                    <span>Estudiante</span>
                    <span>Asistencia</span>
                    <span>Nota Conceptual</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-200">👤 Elena Rostova</span>
                    <span className="text-emerald-400 font-bold">✔️ 100% Presente</span>
                    <span className="bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">A expert</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-200">👤 Martín Dev</span>
                    <span className="text-amber-500 font-bold">⚠️ 75% Al Límite</span>
                    <span className="bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">B2 Upper</span>
                  </div>
                </div>
              </div>

              {/* 2. ALARMAS Y RECORDATORIOS DEL PROFESOR */}
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider">🔔 Alarmas de Calendario Académico:</p>
                <div className="p-2 bg-slate-900 rounded-lg space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                    <span>🔥 Cierre de Notas Trimestrales</span>
                    <span className="bg-amber-950/40 text-amber-400 border border-amber-900 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">15/09/2026</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                    <span>📝 4 Trabajos Prácticos en Cola</span>
                    <span className="bg-red-950/40 text-red-400 border border-red-900 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">Urgente</span>
                  </div>
                </div>
              </div>

              {/* 3. PARTE ADMINISTRATIVA Y LIQUIDACIÓN DOCENTE */}
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
                <p className="text-[10px] font-black text-purple-400 uppercase tracking-wider">💳 Ficha Administrativa & Liquidación de Sueldo:</p>
                <div className="p-3 bg-slate-900 rounded-lg space-y-2 text-[11px]">
                  <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                    <div className="bg-slate-950 p-2 rounded border border-slate-800/40">
                      <span className="text-slate-500 block text-[8px] uppercase font-bold">Legajo Interno</span>
                      <strong className="text-slate-300">PROF-0042</strong>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800/40">
                      <span className="text-slate-500 block text-[8px] uppercase font-bold">Remuneración Configurada</span>
                      <strong className="text-purple-400">Por Hora / Clase</strong>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-300">📄 Recibo de Haberes MOCK (Agosto)</span>
                    <button type="button" onClick={() => alert("Descargando PDF simulado del recibo de sueldo...")} className="text-blue-400 font-bold underline text-[10px] hover:text-blue-300">Visualizar</button>
                  </div>
                </div>
              </div>


            </div>

          )}

          {/* PANEL 3: GANCHO DE RRHH */}
          {solapaActive === "rrhh" && (
            <div className="space-y-4 w-full text-xs">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <h3 className="font-bold text-slate-200">💼 Panel de Auditoría para Empresas</h3>
                <p className="text-slate-400 mt-0.5">Organización Indexada: <span className="text-blue-400 font-black">{alumnoActual.empresa}</span></p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="block font-black text-blue-400 text-base">94.5%</span><span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Adopción</span></div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="block font-black text-emerald-400 text-base">18.2h</span><span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Práctica</span></div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="block font-black text-purple-400 text-base">92/100</span><span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Score ROI</span></div>
              </div>
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                <span>👤 <strong>{alumnoActual.nombre}</strong></span>
                <span className="text-emerald-400 font-bold">Fluidez Avanzada</span>
              </div>
            </div>
          )}
          {/* PANEL 4: INSTITUTO (ABM EXPRESS) */}
          {/* PANEL 4: CONFIGURACIÓN MÓDULOS SAAS (REQUERIMIENTO ADRIÁN DE ARQUITECTURA MULTI-TENANT) */}
          {solapaActive === "instituto" && (
            <div className="space-y-4 w-full">
              
              {/* INTERRUPTOR ARQUITECTÓNICO DE CONFIGURACIÓN SAAS */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black text-blue-400">⚙️ Configuración del Inquilino (SaaS Tenant Settings)</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Definí el chasis operativo y la escala de tu infraestructura.</p>
                  </div>
                  <span className="text-[9px] bg-blue-950 text-blue-400 border border-blue-900 px-2 py-0.5 rounded font-mono font-bold">Plan: Corporativo</span>
                </div>

                {/* SELECTOR DE TIPO DE INQUILINO */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 space-y-2 text-[11px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">🏢 Tipo de Estructura Organizacional:</span>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                    <button type="button" onClick={() => { alert("Configuración SaaS Conmutada: Modo Profesor Independiente (Chasis compacto activado, se ocultan jerarquías de secretaría y directores)."); pushLog("⚙️ [SaaS CONFIG] Tenant reconfigurado a Modo Freelancer."); }} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-left text-slate-300 hover:border-slate-700 transition-all">👤 Prof. Independiente</button>
                    <button type="button" onClick={() => { alert("Configuración SaaS Conmutada: Modo Instituto Tradicional (Activado búnker ERP con jerarquías jerárquicas completas y liquidación de haberes por roles)."); pushLog("⚙️ [SaaS CONFIG] Tenant reconfigurado a Modo Academia Multicanal."); }} className="p-2 bg-blue-950 border border-blue-500 rounded-lg text-left text-blue-300 transition-all">🏛️ Instituto / Academia</button>
                  </div>
                </div>
              </div>

              {/* 1. MÓDULO JERARQUÍAS CONFIGURABLES (MÉTODO ADRIÁN) */}
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
                <p className="text-[10px] font-black text-purple-400 uppercase tracking-wider">👑 Configuración de Jerarquías & Roles Pedagógicos:</p>
                <div className="p-2.5 bg-slate-900 rounded-lg space-y-2 text-[11px]">
                  <p className="text-slate-400 text-[10px] leading-relaxed">Arrastrá y configurá los niveles de mando autorizados para tu base de datos relacional:</p>
                  <div className="space-y-1 font-mono text-[10px]">
                    <div className="p-1.5 bg-slate-950 border border-slate-800 rounded flex justify-between items-center text-slate-300"><span>🥇 Nivel 1: Dueño / Socio Fundador</span> <span className="text-[9px] text-slate-600 font-sans font-bold">Acceso Total</span></div>
                    <div className="p-1.5 bg-slate-950 border border-slate-800 rounded flex justify-between items-center text-slate-300"><span>🥈 Nivel 2: Director Académico / Vicedirector</span> <span className="text-[9px] text-slate-600 font-sans font-bold">Firma Pedagógica</span></div>
                    <div className="p-1.5 bg-slate-950 border border-slate-800 rounded flex justify-between items-center text-slate-300"><span>🥉 Nivel 3: Coordinador (Jefe de Profesores)</span> <span className="text-[9px] text-slate-600 font-sans font-bold">Asignar Aulas</span></div>
                    <div className="p-1.5 bg-slate-950 border border-slate-800 rounded flex justify-between items-center text-slate-300"><span>🌟 Nivel 4: TAE / MAE (Profesores en Inclusión)</span> <span className="text-[9px] text-emerald-500 font-sans font-bold">Habilitado</span></div>
                    <div className="p-1.5 bg-slate-950 border border-slate-800 rounded flex justify-between items-center text-slate-300"><span>💼 Nivel 5: Secretaria Administrativa</span> <span className="text-[9px] text-purple-400 font-sans font-bold">Caja y Cuotas</span></div>
                  </div>
                  <button type="button" onClick={() => alert("Guardando mapa de jerarquías en la tabla tenant_config de Postgres...")} className="w-full bg-purple-600 text-white font-bold py-1.5 rounded text-[10px] uppercase tracking-wide hover:bg-purple-500 transition-all">Actualizar Estructura de Roles</button>
                </div>
              </div>

              {/* 2. CONTRATACIONES Y METODOLOGÍA DE REMUNERACIÓN */}
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">📝 Contrataciones & Parametrización Financiera de Personal:</p>
                <div className="p-2.5 bg-slate-900 rounded-lg space-y-2 text-[11px]">
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-slate-950 p-2 rounded border border-slate-800/40">
                      <span className="text-slate-500 block text-[8px] uppercase font-bold">Metodología Fiscal</span>
                      <strong className="text-slate-300">Monotributista / Factura</strong>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800/40">
                      <span className="text-slate-500 block text-[8px] uppercase font-bold">Tipo de Remuneración</span>
                      <strong className="text-emerald-400">Por Clase / Alumno Variable</strong>
                    </div>
                  </div>
                  <button type="button" onClick={() => alert("Abriendo panel de alta de personal homologado...")} className="w-full bg-slate-800 border border-slate-700 text-slate-300 font-bold py-1.5 rounded text-[10px] uppercase tracking-wide hover:bg-slate-700 transition-all">Contratar Nuevo Personal Administrativo</button>
                </div>
              </div>

              {/* ANTIGUO ABM DE ALUMNOS (SE MANTIENE PERFECTO ABAJO) */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">👤 Inscripción de Alumnos (Estructura de Datos Viva):</h3>
                <form onSubmit={ejecutarInscripcionABM} className="space-y-2 text-left text-slate-900">
                  <input type="text" placeholder="Nombre completo del alumno..." value={formNombre} onChange={(e) => setFormNombre(e.target.value)} className="w-full p-2 bg-white text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
                  <input type="email" placeholder="Email corporativo único..." value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full p-2 bg-white text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
                  <select value={formEmpresa} onChange={(e) => setFormEmpresa(e.target.value)} className="w-full p-2 bg-white text-xs rounded-lg focus:outline-none font-medium">
                    <option value="Globant">Giga-Tenant: Globant</option>
                    <option value="Mercado Libre">Giga-Tenant: Mercado Libre</option>
                  </select>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black py-2 rounded-lg uppercase tracking-wide transition-all shadow-md">Dar de Alta Alumno en el Sistema</button>
                </form>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* MONITOR DE TRÁFICO VISUAL */}
      <div className="w-full max-w-xl bg-black border border-slate-800 rounded-xl p-3 shadow-2xl mx-auto font-mono text-[10px] text-emerald-400/90 box-border">
        <div className="flex justify-between items-center border-b border-slate-900 pb-1.5 mb-1.5 text-slate-500 font-bold">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            CONSOLE MONITOR: SYSTEM LOGS
          </span>
          <span>127.0.0.1</span>
        </div>
        <div className="h-24 overflow-y-auto space-y-1 scrollbar-none flex flex-col">
          {logsConsola.map((log, idx) => (
            <p key={idx} className={log.includes("❌") ? "text-red-400" : log.includes("💾") || log.includes("✅") ? "text-blue-400 font-bold" : "text-emerald-500/80"}>
              {log}
            </p>
          ))}
        </div>
      </div>

    </div>
  );
}
