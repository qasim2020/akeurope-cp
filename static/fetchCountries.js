const axios = require('axios');
const mongoose = require('mongoose');
const Country = require('../models/Country');

const MONGO_URI = 'mongodb://localhost:27017/akeurope_orphans'; 
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const fetchAndStoreCountries = async () => {
  try {
    const response = await axios.get('https://restcountries.com/v3.1/all');
    const countries = response.data;

    const countryData = countries.map(country => ({
      name: country.name.common,
      code: country.cca2,  
      flag: country.flags.svg,
      currency: {
        code: country.currencies ? Object.keys(country.currencies)[0] : 'N/A',
        symbol: country.currencies 
          ? Object.values(country.currencies)[0].symbol || 'N/A'
          : 'N/A'
      }
    }));

    await Country.insertMany(countryData);
    console.log('Countries successfully saved to the database!');
  } catch (error) {
    console.error('Error fetching country data:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

fetchAndStoreCountries();