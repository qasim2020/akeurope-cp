const WidgetSchema = new mongoose.Schema({
    style: String,
    userType: String,
    userId: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Widget', WidgetSchema);