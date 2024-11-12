const moment = require('moment');

// helpers/eqHelper.js
const eq = function(a, b) {
    return a === b;
};

const neq = function(a, b) {
    return a != b;
};


const inc = function(a) {
    return a + 1;
};

const formatDate = function(date) {
    return moment(date).format('MMMM Do, YYYY'); // Customize the format as needed
};

const browserDate = function(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

const resizeCloudinaryUrl = function (url, template) {
    return url.replace('/upload/', `/upload/${template}/`);
};

const capitalizeFirstLetter = function (str) {
    if (!str) return ''; // Return empty string if input is empty or undefined
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const checkInputType = function(input) {
    if (input == "file") {
        return "URL of the file"
    } else if (input == "image") {
        return "URL of the image"
    } else {
        return "String value"
    }
}

const findInArray = function(array, item) {
    if (array && Array.isArray(array) && array.includes(item)) {
        return true;
    } else {
        return false;
    }
}

const getFirstTwoLetters = function (name) {
    if (!name) return ''; 
    return name.slice(0, 2).toUpperCase();
}

module.exports = { eq , inc, formatDate, browserDate, resizeCloudinaryUrl, neq, capitalizeFirstLetter, checkInputType, findInArray, getFirstTwoLetters};