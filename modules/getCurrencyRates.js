const axios = require('axios');
const { CurrencyRate } = require('../models/CurrencyRate');

const getCurrencyRates = async (baseCurrency = 'USD') => {

    const today = new Date().toISOString().split('T')[0];

    let currencyRates = await CurrencyRate.findOne({ baseCurrency, date: today }).lean();
    if (currencyRates) {
        return currencyRates;
    }

    try {
        const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
        const rates = response.data.rates;

        currencyRates = new CurrencyRate({ baseCurrency, rates, date: today });
        await currencyRates.save();

        return currencyRates;
    } catch (error) {
        console.error('Error fetching currency rates:', error.message);
        throw new Error('Failed to fetch currency rates.');
    }
};

module.exports = { getCurrencyRates };