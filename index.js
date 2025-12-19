require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose"); // 1. Importar mongoose
const Consumption = require("./models/consumptionModel"); // 2. Importar el modelo

const app = express();

const PORT = process.env.PORT || 3001;
// Usamos la misma URI que en el otro servicio (definida en .env.docker)
const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:27017/prediction";
const ALIAS = "6339651";

// --- (Misma función getSimulationDate que tenías) ---
function getSimulationDate() {
    const now = new Date();
    if (now.getHours() >= 23) {
        now.setDate(now.getDate() + 1);
        now.setHours(0, 0, 0, 0); 
    }
    return now;
}


async function fetchKunna(timeStart, timeEnd) {
    const url = process.env.KUNNA_URL;
    if (!url) throw new Error("KUNNA_URL no está definida en el .env");

    const headers = { "Content-Type": "application/json" };
    const body = {
        time_start: timeStart.toISOString(),
        time_end: timeEnd.toISOString(),
        filters: [
            { filter: "name", values: ["1d"] },
            { filter: "alias", values: [ALIAS] }
        ],
        limit: 100, count: false, order: "DESC"
    };

    const response = await fetch(url, {
        method: "POST", headers: headers, body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`KUNNA_BAD_STATUS:${response.status}`);
    const json = await response.json();
    return json.result; 
}


function parseKunnaData(rawResult, targetDate) {
    const { columns, values } = rawResult;
    const valueIndex = columns.indexOf('value'); 
    
    if (!values || values.length === 0) return null; // Manejo de error si no hay datos

    const consumoHoy = values[0] ? values[0][valueIndex] : 0;
    const consumoAyer = values[1] ? values[1][valueIndex] : 0;
    const consumoAntesAyer = values[2] ? values[2][valueIndex] : 0;

    return {
        consumo_hoy: consumoHoy,
        consumo_ayer: consumoAyer,
        consumo_antes_ayer: consumoAntesAyer,
        dia_semana: targetDate.getDay(),
        mes: targetDate.getMonth() + 1,
        dia_del_mes: targetDate.getDate()
    };
}

// --- ENDPOINT ---
app.get("/acquire", async (req, res) => {
    try {
        const fechaSimulada = getSimulationDate();

        // Pedimos datos (5 días atrás para asegurar)
        const timeEnd = new Date(fechaSimulada);
        const timeStart = new Date(fechaSimulada);
        timeStart.setDate(timeStart.getDate() - 5);

        const rawData = await fetchKunna(timeStart, timeEnd);
        const datosLimpios = parseKunnaData(rawData, fechaSimulada);

        if (!datosLimpios) {
            return res.status(404).json({ error: "No data found from Kunna" });
        }

        // 3. GUARDAR EN MONGODB
        const nuevoConsumo = new Consumption({
            fecha_simulacion: fechaSimulada,
            ...datosLimpios // Esparce las propiedades (consumo_hoy, etc.)
        });

        await nuevoConsumo.save();
        console.log("[ACQUIRE] Datos guardados en Mongo con ID:", nuevoConsumo._id);

        res.json({
            status: "ok",
            db_id: nuevoConsumo._id, // Devolvemos el ID generado
            simulationDate: fechaSimulada.toISOString(),
            data: datosLimpios
        });

    } catch (error) {
        console.error("[ACQUIRE] Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- ARRANQUE Y CONEXIÓN ---
app.listen(PORT, async () => {
    console.log(`[ACQUIRE] Servicio escuchando en puerto ${PORT}`);
    
    // 4. Conectar a Mongo al arrancar
    try {
        await mongoose.connect(MONGO_URI);
        console.log("[ACQUIRE] Conectado a MongoDB");
    } catch (err) {
        console.error("[ACQUIRE] Error conectando a MongoDB:", err);
    }
});