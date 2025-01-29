document.addEventListener('click', function (event) {
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
    popoverTriggerList.forEach(function (popoverTriggerEl) {
        const popover = bootstrap.Popover.getInstance(popoverTriggerEl);
        if (popover && popover._isShown && !popoverTriggerEl.contains(event.target)) {
            popover.hide();
        }
    });
});

document.getElementById('close-overlay').addEventListener('click', function () {
    document.getElementById('payment-overlay').remove();
    window.parent.postMessage('close-overlay', '*');
});

const priorityCurrencies = [
    {
        currency: 'NOK',
        country: 'Norway',
        countryCode: 'NO',
    },
    {
        currency: 'USD',
        country: 'United States',
        countryCode: 'US',
    },
    {
        currency: 'EUR',
        country: 'Europian Union',
        countryCode: 'DE',
    },
    {
        currency: 'GBP',
        country: 'United Kingdom',
        countryCode: 'GB',
    },
];

const otherCurrencies = [
    'AUD',
    'BRL',
    'CAD',
    'CHF',
    'CZK',
    'DKK',
    'EUR',
    'GBP',
    'HKD',
    'HUF',
    'INR',
    'JPY',
    'MXN',
    'NOK',
    'NZD',
    'PHP',
    'PLN',
    'SEK',
    'SGD',
    'THB',
    'TRY',
    'USD',
    'ZAR',
];

function populateCurrencyDropdown(currencies) {
    const priorityGroup = document.createElement('optgroup');

    priorityCurrencies.forEach((country) => {
        const option = document.createElement('option');
        option.value = country.countryCode;
        option.textContent = `${country.currency} · ${country.country}`;
        priorityGroup.appendChild(option);
    });

    $('.currency-dropdown').append(priorityGroup);

    const otherGroup = document.createElement('optgroup');

    currencies.forEach((country) => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = `${country.currency.code} · ${country.name}`;
        otherGroup.appendChild(option);
    });

    $('.currency-dropdown').append(otherGroup);
}

const currencySymbols = {
    NOK: 'kr',
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF',
    CNY: '¥',
    SEK: 'kr',
    DKK: 'kr',
};

function getCurrencySymbol(currencyCode, locale = 'en-US') {
    currencyCode = currencyCode.toUpperCase();

    if (currencySymbols[currencyCode]) {
        return currencySymbols[currencyCode];
    }

    try {
        const formatter = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            currencyDisplay: 'symbol',
            minimumFractionDigits: 0,
        });

        const parts = formatter.formatToParts(0);
        const symbolPart = parts.find((part) => part.type === 'currency');

        return symbolPart ? symbolPart.value : currencyCode;
    } catch (error) {
        return currencyCode;
    }
}

function formatNumberToShortenedVersion(number) {
    if (number >= 1000) {
        const suffixes = ['k', 'M', 'B', 'T'];
        const orderOfMagnitude = Math.floor(Math.log10(number) / 3);
        const shortNumber = (number / Math.pow(1000, orderOfMagnitude)).toFixed(0);

        return `${shortNumber}${suffixes[orderOfMagnitude - 1]}`;
    }

    return number.toString();
}

$('[freq]').on('click', function (e) {
    const freq = $(this).attr('freq');
    $('.donation-amount').removeClass('active');
    if (freq === 'once') {
        $('#donate-btn').find('span').html('Donate Once');
        $('.donation-amount').first().addClass('active');
    } else {
        $('#donate-btn').find('span').html('Donate Monthly');
        $('.donation-amount').last().addClass('active');
    }
});

$('.back-btn').on('click', function (e) {
    console.log('clicked back');
    const index = $(this).attr('index');
    $('.back-btn').attr({ index: index - 1 });
    $('#slide-container').css({ transform: `translateX(-${(index - 1) * 100}%)` });
});

// async function fetchClientSecret() {
//     const response = await fetch('/create-payment-intent', { method: 'POST' });
//     const data = await response.json();
//     console.log(data);
//     return data.clientSecret;
// }

// fetchClientSecret().then((clientSecret) => {
//     const stripe = Stripe(
//         'pk_test_51Ql5j1CseHPTMVKXQ3CgyCMLWgDYOZ4dELVM5UThFX4Xn9Q6tefAOgJAuccm0pf7c0SynsE67C0s8UshXy9v9xdG00szhZK9BM',
//     );
//     const elements = stripe.elements();
//     const cardElement = elements.create('card');
//     cardElement.mount('#card-element');

//     document.getElementById('payment-form').addEventListener('submit', async (e) => {
//         e.preventDefault();

//         const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
//             payment_method: {
//                 card: cardElement,
//             },
//         });

//         if (error) {
//             console.error('Payment failed:', error.message);
//         } else if (paymentIntent.status === 'succeeded') {
//             console.log('Payment successful!');
//         }
//     });
// });

async function getCurrencyByLocation() {
    try {
        const response = await fetch('https://ipwho.is?fields=country_code', { mode: 'cors' });
        const data = await response.json();
        if (!data.country_code) {
            getPrices('NO');
        } else {
            getPrices(data.country_code);
        }
    } catch (error) {
        console.error('Error fetching location:', error);
    }
}

window.onload = getCurrencyByLocation;

async function getPrices(userCountry) {
    fetch(`/get-prices/${userCountry}`)
        .then((response) => response.json())
        .then((data) => {
            $('#monthly-products-list, #one-time-products-list').html('');

            const createPriceButton = (product) => {
                return `
                        <div class="col-4">
                            <button class="btn py-2 w-100 fs-3 amount" value="${product.amount}">
                                ${data.country.currency.symbol} ${formatNumberToShortenedVersion(product.amount)}
                            </button>
                        </div>
                    `;
            };

            const inputGroup = `
                        <div class="col-12">
                            <div class="currency-input-container border-1 rounded-2">
                                <input type="number" class="donation-amount amount form-control py-2 fs-2" min="0">
                                <div class="currency-selector">
                                    ${data.country.currency.code}
                                    <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="ms-1 icon icon-tabler icons-tabler-outline icon-tabler-chevron-down"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 9l6 6l6 -6" /></svg>
                                </div>
                                <select class="currency-dropdown">
                                </select>
                            </div>
                        </div>
                    `;

            const sortedMonthly = data.monthly.sort((a, b) => a.price - b.price);

            let monthlyHTML = '';
            sortedMonthly.forEach((product) => {
                monthlyHTML += createPriceButton(product);
            });
            monthlyHTML += inputGroup;
            $('#monthly-products-list').prepend(monthlyHTML);

            const sortedOneTime = data.oneTime.sort((a, b) => a.price - b.price);

            let oneTimeHTML = '';
            sortedOneTime.forEach((product) => {
                oneTimeHTML += createPriceButton(product);
            });
            oneTimeHTML += inputGroup;
            $('#one-time-products-list').prepend(monthlyHTML);

            populateCurrencyDropdown(data.countries);

            $('.donation-amount').first().addClass('active');

            $('.currency-dropdown').val(data.country.code);

            $('#tel-toggle').html(`
                <span class="flag flag-country-${data.country.code.toLowerCase()} me-1"></span>
                <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-chevron-down"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 9l6 6l6 -6" /></svg>
            `);

            $('#tel-toggle').data({ value: data.country.code.toLowerCase() });

            $('#contact-number').val(data.country.callingCodes[0].toString());

            $('.btn.amount').on('click', function (e) {
                $(this).closest('.body').find('input.active, button.active').removeClass('active');
                $(this).toggleClass('active');
                const value = $(this).attr('value');
                const input = $(this).closest('.row').find('input');
                input.val(value);
                input.removeClass('is-invalid');
                input.addClass('active');
            });

            $('input.amount').on('keyup', function (e) {
                $('.donation-amount').removeClass('active');
                $(this).addClass('active');
                const value = $(this).val();
                const btns = $(this).closest('.row').find('.btn.amount');
                for (const btn of btns) {
                    $(btn).removeClass('active');
                    if ($(btn).attr('value') === value) {
                        $(btn).addClass('active');
                    }
                }
            });

            $('.currency-dropdown').on('change', function (e) {
                const value = $(this).val();
                getPrices(value);
            });
        })
        .catch((error) => {
            console.error('Error fetching pricing data:', error);
        });
}

$('#organizationCheckbox').on('change', function () {
    const inputContainer = $('#organizationInputContainer');
    if ($(this).prop('checked')) {
        inputContainer.removeClass('d-none');
        inputContainer.html(`
        <div class="form-floating">
            <input type="text" class="user-info form-control" id="organizationName" placeholder="Organization Name">
            <label for="organizationName">Organization Name</label>
        </div>
    `);
    } else {
        inputContainer.addClass('d-none');
        inputContainer.html('');
    }
});

const saveDonationAmount = function (elem) {
    let isValid = true;

    $('.shake').removeClass('shake');

    const value = $('.donation-amount.active').val();
    $('.donation-amount.active').removeClass('is-invalid');

    if (!value) {
        isValid = false;
        $('.donation-amount.active').addClass('is-invalid');
        $('.donation-amount.active').closest('.body').addClass('shake');
    }

    $('.shake').one('animationend', function () {
        $(this).removeClass('shake');
    });

    if (isValid) {
        $('#slide-container').css({ transform: `translateX(-${1 * 100}%)` });
        $('.back-btn').attr({ index: 1 });
    }
};

const saveUserInfo = function (elem) {
    let isValid = true;

    $('.shake').removeClass('shake');

    $('.user-info').each(function () {
        $(this).removeClass('is-invalid');
        const value = $(this).val();
        if (!value) {
            isValid = false;
            $(this).addClass('is-invalid');
            $(this).closest('.body').addClass('shake');
        }
    });

    $('.shake').one('animationend', function () {
        $(this).removeClass('shake');
    });

    if (isValid) {
        $('#slide-container').css({ transform: `translateX(-${2 * 100}%)` });
        $('.back-btn').attr({ index: 2 });
    }
};

$.get('/countries', function (countries) {
    const dropdown = $('#tel-codes');
    const shortenCountryName = (str) => {
        return str.length > 15 ? str.slice(0, 15) + '...' : str;
    };
    countries.forEach((country) => {
        const countryItem = $('<a>', {
            class: 'dropdown-item',
            'data-value': country.code.toLowerCase(),
            href: '#',
        });

        countryItem.html(`
            ${shortenCountryName(country.name)} (${country.callingCodes[0]})
            <span class="flag flag-country-${country.code.toLowerCase()}"></span>
        `);

        dropdown.append(countryItem);

        countryItem.on('click', function () {
            $('#tel-toggle').data({ value: country.code.toLowerCase() });
            $('#tel-toggle').html(`<span class="flag flag-country-${country.code.toLowerCase()}"></span>
            <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-chevron-down"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 9l6 6l6 -6" /></svg>
            `);
            $('#contact-number').val(country.callingCodes[0].toString());
        });

        countryItem.on('mouseover', function() {
            $(this).siblings().removeClass('bg-hover');
            $(this).addClass('bg-hover');
        })
    });
}).fail(function (err) {
    console.error('Error fetching countries:', err);
});

$('#tel-toggle').on('show.bs.dropdown', function () {
    $('#tel-toggle').find('svg').replaceWith(`
        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-chevron-up"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 15l6 -6l6 6" /></svg>
    `);
});

$('#tel-toggle').on('shown.bs.dropdown', function () {
    const selectedCountryCode = $('#tel-toggle').data('value');
    const selectedCountryItem = $(`.dropdown-item[data-value="${selectedCountryCode}"]`);
    $('#tel-codes').find('.bg-hover').removeClass('bg-hover');
    if (selectedCountryItem.length > 0) {
        $('#tel-codes').scrollTop(selectedCountryItem[0].offsetTop - $('#tel-codes')[0].offsetTop - 150);
        $('#tel-codes').find('.bg-hover').removeClass('bg-hover');
        $(selectedCountryItem).addClass('bg-hover');
    }
});

$('#tel-toggle').on('hidden.bs.dropdown', function () {
    $('#tel-toggle').find('svg').replaceWith(`
        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-chevron-down"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 9l6 6l6 -6" /></svg>
    `);
});

$(document).on('input change', 'input', function (e) {
    $('.is-invalid').removeClass('is-invalid');
});
