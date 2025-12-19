const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ConsumptionSchema = new Schema({
    fecha_simulacion: { type: Date, required: true },
    consumo_hoy: Number,
    consumo_ayer: Number,
    consumo_antes_ayer: Number,
    dia_semana: Number,
    mes: Number,
    dia_del_mes: Number,
    // Campo extra útil para saber cuándo se guardó el registro realmente
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Consumption', ConsumptionSchema);