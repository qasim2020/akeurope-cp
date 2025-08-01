const moment = require('moment');
const getLetterIcon = require('../modules/iconLetter');
const getOrderIcon = require('../modules/iconOrder');
const cheerio = require('cheerio');

const eq = function (a, b) {
    return a === b;
};

const gt = function (a, b) {
    return a > b;
};

const or = function (a, b) {
    return a || b;
};

const hasAny = function (a, b) {
    const isTruthy = val => {
        if (Array.isArray(val)) return val.length > 0;
        if (val && typeof val === 'object') return Object.keys(val).length > 0;
        return !!val;
    };

    return isTruthy(a) || isTruthy(b);
};

const and = function (a, b) {
    return a && b;
};

const compareIds = function (a, b) {
    if (!a || !b) return false;
    return a.toString() === b.toString();
};

const neq = function (a, b) {
    return a != b;
};

const inc = function (a) {
    return a + 1;
};

const dec = function (a) {
    return a - 1;
};

const formatDate = function (date) {
    return moment(date).format('D MMM YYYY');
};

const getMonth = function(date) {
    return moment(date).format('MMM-YY'); 
}

const getMonthYear = function (date) {
    return moment(date).format('MM-YYYY');
};

const getAgeInYearsAndMonths = function (date) {
    const birthDate = moment(date);
    const today = moment();

    const years = today.diff(birthDate, 'years');
    const months = today.diff(birthDate.add(years, 'years'), 'months');

    if (years === 0) {
        return `${months} months`;
    } else {
        return `${years} years`;
    }
};

const formatTime = function (timestamp) {
    return moment(timestamp).format('D MMM YYYY [at] h:mm A');
};

const browserDate = function (dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const resizeCloudinaryUrl = function (url, template) {
    if (!url) return '/static/images/no-photo-placement.png';
    return url.replace('/upload/', `/upload/${template}/`);
};

function transformCloudinaryUrl(url) {
    if (!url) return '/static/images/no-photo-placement.png';
    const transformation = 'ar_1:1,c_fill,g_auto:face,h_550,w_550';
    return url.replace('/upload/', `/upload/${transformation}/`);
}

function circleCloudinaryUrl(url) {
    console.log('url', url);
    if (!url) return '/static/images/no-photo-placement.png';

    const transformation = 'ar_1:1,c_fill,e_improve,g_auto,h_250,r_max,w_250,z_1.0';
    return url.replace('/upload/', `/upload/${transformation}/`);
}

const capitalizeFirstLetter = function (str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const capitalizeAll = function (str) {
    if (!str) return '';
    return str.toUpperCase();
};

const lowerCaseFirstLetter = function (str) {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toLowerCase() + str.slice(1);
};

const checkInputType = function (input) {
    if (input == 'file') {
        return 'URL of the file';
    } else if (input == 'image') {
        return 'URL of the image';
    } else {
        return 'String value';
    }
};

const findInArray = function (array, item) {
    if (array && Array.isArray(array) && array.includes(item)) {
        return true;
    } else {
        return false;
    }
};

const getFirstTwoLetters = function (name) {
    if (!name) return '';
    const words = name.trim().split(' ');
    const firstLetters = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase());
    return firstLetters.join('');
};

const arrayToCsv = function (array) {
    return array.join(', ');
};

const getOptionsFromValues = function (options) {
    return options.map((option) => option.value).join(', ');
};

const getKey = function (obj) {
    return Object.keys(obj)[0];
};

const getValue = function (obj) {
    return Object.values(obj)[0];
};

const transformArrayOfObjects = function (arrayOfObjects) {
    return arrayOfObjects.flatMap((obj) => Object.entries(obj).map(([key, value]) => ({ key, value })));
};

const getValueOfFieldInArray = function (array, fieldName) {
    const fieldObject = array.find((item) => item.fieldName === fieldName);
    return fieldObject ? fieldObject.value : null;
};

const isEmptyObject = function (obj) {
    if (Object.keys(obj).length === 0) {
        return false;
    } else {
        return true;
    }
};

const findPrimaryKey = function (fields) {
    const primaryField = fields.find((field) => field.primary === true);
    return primaryField ? primaryField.name : null;
};

const timeAgo = function (timestamp) {
    const now = moment();
    const date = moment(timestamp);

    const seconds = now.diff(date, 'seconds');
    const minutes = now.diff(date, 'minutes');
    const hours = now.diff(date, 'hours');
    const days = now.diff(date, 'days');

    if (seconds < 60) return 'few seconds ago';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

    return date.format('DD MMM YYYY');
};

const camelCaseToNormalString = function (string) {
    string = string ? string : '';
    return string.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (str) => str.toUpperCase());
};

const camelCaseWithCommaToNormalString = function (string) {
    string = string ? string : '';
    return string
        .split(',')
        .map((part) =>
            part
                .trim()
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/^./, (str) => str.toUpperCase()),
        )
        .join(', ');
};

const getSvgForFirstLetter = function (str) {
    if (!str || typeof str !== 'string') return '<svg></svg>';
    const firstLetter = str.trim().charAt(0).toLowerCase();
    return getLetterIcon(firstLetter);
};

const regexMatch = function (value, pattern) {
    let regex = new RegExp(pattern);
    return regex.test(value);
};

const stringifyDate = function (query) {
    // Check for date operators in the query
    const operators = ['$gt', '$gte', '$lt', '$lte', '$eq'];

    // Iterate over the operators to find the matching operator
    for (let operator of operators) {
        if (query[operator]) {
            const dateValue = query[operator];

            // Ensure that the dateValue is a valid Date object
            if (dateValue instanceof Date || !isNaN(Date.parse(dateValue))) {
                const date = new Date(dateValue);
                const formattedDate = date.toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                });

                // Convert the operator to the string equivalent
                let operatorString = '';
                switch (operator) {
                    case '$gt':
                        operatorString = '> ';
                        break;
                    case '$gte':
                        operatorString = '>= ';
                        break;
                    case '$lt':
                        operatorString = '< ';
                        break;
                    case '$lte':
                        operatorString = '<= ';
                        break;
                    case '$eq':
                        operatorString = '= ';
                        break;
                    default:
                        break;
                }

                // Return the formatted string
                return operatorString + formattedDate;
            } else {
                console.error('Invalid date in query:', dateValue);
                return null;
            }
        }
    }

    // If no valid date operator is found, return null
    return null;
};

const json = function (value) {
    return JSON.stringify(value);
};

const expiresOn = (createdAt, months) => {
    if (!createdAt || !months || months <= 0) {
        throw new Error('Invalid input: createdAt and months must be valid');
    }
    return moment(createdAt).add(months, 'months').format('DD-MM-YYYY');
};

function removeLinks(htmlString) {
    try {
        const parameters = ['project', 'user', 'customer'];
        const $ = cheerio.load(htmlString);

        parameters.forEach((param) => {
            $(`a[href*="/${param}/"]`).each(function () {
                $(this).replaceWith($(this).text());
            });
        });

        return $.html();
    } catch (error) {
        return htmlString;
    }
}

const shortenFileName = function (string) {
    if (string.length <= 10) {
        return string;
    }
    const start = string.slice(0, 5);
    const end = string.slice(-4);
    return `${start}...${end}`;
};

const shortenName = function (string) {
    if (string.length <= 40) {
        return string;
    }
    const start = string.slice(0, 37);
    return `${start}...`;
};

const shieldName = function (name) {
    if (!name || typeof name !== 'string' || name.length < 2) return 'H***';

    return name
        .split('')
        .map((char, index) => (index === 0 || char === ' ' ? char : '*'))
        .join('');
};

const slugToCamelCase = function (slug) {
    if (!slug) return "";
    return slug
        .split('-')
        .map((word, index) => 
            index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');
};

const slugToString = function (slug) {
    if (!slug) return "";
    return slug
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const divide = function(a, b) {
    return a / b;
};

const dynamicRound = (value) => {
    let magnitude;

    if (value < 10) {
        magnitude = 1;
    } else if (value < 100) {
        magnitude = 10;
    } else if (value < 1000) {
        magnitude = 100;
    } else {
        magnitude = 1000;
    }

    return Math.ceil(value / magnitude) * magnitude;
};

const vippsStatusMap = {
    draft: ['PENDING', 'CREATED'],
    aborted: ['ABORTED', 'EXPIRED', 'CANCELLED', 'STOPPED', 'FAILED'],
    due: ['DUE'],
    authorized: ['AUTHORIZED', 'ACTIVE'],
    paid: ['CAPTURED', 'CHARGED'],
    refunded: 'REFUNDED',
};


const roundToNearest = (amount) => {
    if (amount < 50) return 50;
    if (amount < 100) return 100;
    if (amount < 500) return 500;
    if (amount < 1000) return 1000;
    if (amount < 5000) return 5000;
    if (amount < 10000) return 10000;
    return Math.ceil(amount / 10000) * 10000;
}

const convertDaysToMonths = function (days) {
  const daysInMonth = 30.44; 
  const daysInYear = 365.25; 

  const years = Math.floor(days / daysInYear);
  days %= daysInYear;

  const months = Math.floor(days / daysInMonth);
  days = Math.floor(days % daysInMonth);

  const parts = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(', ').replace(/,([^,]*)$/, ' and$1') : '0 days';
}

module.exports = {
    convertDaysToMonths,
    roundToNearest,
    vippsStatusMap,
    dynamicRound,
    divide,
    slugToString,
    slugToCamelCase,
    shieldName,
    eq,
    gt,
    compareIds,
    or,
    hasAny,
    and,
    inc,
    dec,
    formatDate,
    formatTime,
    getMonth,
    getMonthYear,
    getAgeInYearsAndMonths,
    browserDate,
    resizeCloudinaryUrl,
    transformCloudinaryUrl,
    circleCloudinaryUrl,
    neq,
    capitalizeAll,
    capitalizeFirstLetter,
    lowerCaseFirstLetter,
    checkInputType,
    findInArray,
    getFirstTwoLetters,
    arrayToCsv,
    getOptionsFromValues,
    getKey,
    getValue,
    transformArrayOfObjects,
    isEmptyObject,
    findPrimaryKey,
    timeAgo,
    camelCaseToNormalString,
    camelCaseWithCommaToNormalString,
    getSvgForFirstLetter,
    regexMatch,
    getValueOfFieldInArray,
    stringifyDate,
    json,
    expiresOn,
    getOrderIcon,
    removeLinks,
    shortenFileName,
    shortenName,
};
