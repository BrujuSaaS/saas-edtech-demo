// INTERRUPTOR CENTRAL DE HARDWARE
// Cambialo a true cuando le vayas a mostrar la demo a Gastón por internet
const MODO_PRODUCCION = false; 

const TUNEL_FRONTEND = "https://ngrok-free.dev";
const TUNEL_BACKEND  = "https://ngrok-free.dev";
// https://tiling-graceful-alike.ngrok-free.dev

const LOCAL_FRONTEND = "http://localhost:3000";
const LOCAL_BACKEND  = "http://localhost:5000";

export const API_BASE_URL = MODO_PRODUCCION ? TUNEL_BACKEND : LOCAL_BACKEND;
export const FRONT_BASE_URL = MODO_PRODUCCION ? TUNEL_FRONTEND : LOCAL_FRONTEND;
