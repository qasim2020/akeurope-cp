const axios = require('axios');
const { CurrencyRate } = require('../models/CurrencyRate');

const getCurrencyRates = async (baseCurrency = 'USD', orderDate = null) => {

    const date = orderDate || new Date();;
    const givenDate = date.toISOString().split('T')[0];

    let currencyRates = await CurrencyRate.findOne({ baseCurrency, date: givenDate }).lean();
    
    if (currencyRates) {
        return currencyRates;
    }

    try {
        const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
        const rates = response.data.rates;

        currencyRates = await CurrencyRate.findOneAndUpdate(
            { baseCurrency, date: today }, 
            { baseCurrency, rates, date: today }, 
            { upsert: true, new: true, lean: true }, 
        );

        return currencyRates;
    } catch (error) {
        console.error('Error fetching currency rates:', error.message);
        throw new Error('Failed to fetch currency rates.');
    }
};

module.exports = { getCurrencyRates };
