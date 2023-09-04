const mongoose = require('mongoose');

const Code = new mongoose.Schema({
    code: { type: Number, required: true },
    type: { type: String, required: true }
});

module.exports = mongoose.model('Code', Code);