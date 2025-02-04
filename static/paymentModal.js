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

async function fetchClientSecret() {
    const response = await fetch('/create-payment-intent', { method: 'POST' });
    const data = await response.json();
    console.log(data);
    return data.clientSecret;
}

fetchClientSecret().then((clientSecret) => {
    const stripe = Stripe(
        'pk_test_51OzgG82KJohMNjOSieXVuRBiBI6TFbXkZkWOF4Qsr2H563351MojVy7tE8arnbFbr6zJEPlKA1Nl2H6AZY9cZphg00zG07zi2A',
    );

    const elementStyles = {
        base: {
            fontFamily: 'Roboto',
            fontSize: '15px',
            fontWeight: 'normal',
            '::placeholder': { color: 'transparent' },
        },
        invalid: { color: '#e3342f' },
    };

    const elementClasses = {
        base: 'form-control stripe-input',
        focus: 'form-control-focus',
        invalid: 'is-invalid',
    };

    const elements = stripe.elements({clientSecret});
    const cardNumber = elements.create('cardNumber', {
        style: elementStyles,
        classes: elementClasses,
        placeholder: '1234 1234 1234 1234',
    });
    const cardExpiry = elements.create('cardExpiry', { style: elementStyles, classes: elementClasses, placeholder: '12 / 34' });
    const cardCvc = elements.create('cardCvc', { style: elementStyles, classes: elementClasses, placeholder: '123' });
    const expressCheckoutElement = elements.create('expressCheckout')
    expressCheckoutElement.mount('#express-checkout-element')

    cardNumber.mount('#card-number-element');
    cardExpiry.mount('#card-expiry-element');
    cardCvc.mount('#card-cvc-element');

    function showPlaceholder(element) {
        element.update({ style: { base: { '::placeholder': { color: 'lightgrey' } } } });
    }

    function hidePlaceholder(element) {
        element.update({ style: { base: { '::placeholder': { color: 'transparent' } } } });
    }

    function handleFloatingLabel(element, parentSelector) {
        let isFilled = false;
        element.on('focus', function () {
            $(parentSelector).addClass('active');
            $(parentSelector).addClass('typing');
            showPlaceholder(element);
        });

        element.on('blur', function () {
            $(parentSelector).removeClass('typing');
            if (isFilled) {
                return;
            }
            hidePlaceholder(element);
            $(parentSelector).removeClass('active');
        });

        element.on('change', function (event) {
            if (event.empty) {
                isFilled = false;
            } else {
                isFilled = true;
                $(parentSelector).addClass('active');
                showPlaceholder(element);
            }
        });
    }

    handleFloatingLabel(cardNumber, '#card-number-element');
    handleFloatingLabel(cardExpiry, '#card-expiry-element');
    handleFloatingLabel(cardCvc, '#card-cvc-element');

    $('#payment-form').on('submit', async function (event) {
        event.preventDefault();

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardNumber,
            },
        });

        if (error) {
            $('#payment-message').text(error.message).removeClass('d-none');
        } else {
            window.location.href = `/success?payment_intent=${paymentIntent.id}`;
        }
    });
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

function findCommonPrefix(callingCodes) {
    if (!callingCodes.length) return '';

    let prefix = callingCodes[0]; // Start with the first code

    for (let i = 1; i < callingCodes.length; i++) {
        while (!callingCodes[i].startsWith(prefix)) {
            prefix = prefix.slice(0, -1); // Shorten prefix character by character
            if (prefix.length === 0) return ''; // No common prefix
        }
    }

    return prefix;
}

const populateTelephoneDropdown = function (countries) {
    const dropdown = $('#tel-codes');
    const shortenCountryName = (str) => {
        return str.length > 15 ? str.slice(0, 15) + '...' : str;
    };
    countries = countries.filter((country) => country.callingCodes.length > 0 && country.callingCodes[0] !== '');

    countries.forEach((country) => {
        const countryItem = $('<a>', {
            class: 'dropdown-item',
            'data-value': country.code.toLowerCase(),
            href: '#',
        });

        country.telCode = findCommonPrefix(country.callingCodes);

        countryItem.html(`
                ${shortenCountryName(country.name)} (${country.telCode})
                <span class="flag flag-country-${country.code.toLowerCase()}"></span>
            `);

        dropdown.append(countryItem);

        countryItem.on('click', function () {
            $('#tel-toggle').data({ value: country.code.toLowerCase() });
            $('#tel-toggle').html(`<span class="flag flag-country-${country.code.toLowerCase()}"></span>
                <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-chevron-down"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 9l6 6l6 -6" /></svg>
                `);
            let currentValue = $('#contact-number').val();
            if (currentValue.length > 0) {
                currentValue = currentValue.replace(' ', '');
                let oldMask = maskList.find((mask) => currentValue.startsWith(mask.code.split(' ')[0]));
                let oldCode = oldMask ? oldMask.code.split(' ')[0] : '';
                let remainingNumber = currentValue.replace(oldCode, '').trim();
                $('#contact-number').val(country.telCode + remainingNumber);
                $('#contact-number').trigger('input');
            } else {
                $('#contact-number').val(country.telCode);
            }
        });

        countryItem.on('mouseover', function () {
            $(this).siblings().removeClass('bg-hover');
            $(this).addClass('bg-hover');
        });
    });

    $('#contact-number').on('input', function () {
        let inputVal = $(this).val().trim();

        if (inputVal.startsWith('00')) {
            inputVal = '+' + inputVal.slice(2);
        }

        let matchedCountry = countries
            .filter((country) => country.callingCodes.some((code) => inputVal.startsWith(code)))
            .sort((a, b) => {
                let maxCodeA = Math.max(...a.callingCodes.map((code) => code.length));
                let maxCodeB = Math.max(...b.callingCodes.map((code) => code.length));
                return maxCodeB - maxCodeA;
            })[0];

        if (matchedCountry) {
            $('#tel-toggle').data({ value: matchedCountry.code.toLowerCase() });
            $('#tel-toggle').html(`<span class="flag flag-country-${matchedCountry.code.toLowerCase()}"></span>
                <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-chevron-down"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 9l6 6l6 -6" /></svg>
                `);

            let phoneMask = maskList.find((mask) => inputVal.startsWith(mask.code.split(' ')[0]));

            if (phoneMask) {
                let formattedNumber = formatPhoneNumber(inputVal, phoneMask.code);
                $(this).val(formattedNumber);
            }
        } else {
            console.log('match not found');
        }
    });
};

function formatPhoneNumber(number, mask) {
    let digits = number.replace(/\D/g, ''); // Remove non-numeric characters
    let maskParts = mask.split(' ');
    let dialingCode = maskParts[0]; // Extract country dialing code (e.g., "+47")

    // Extract only the dialing code part from the input
    let dialingCodeInInput = dialingCode;
    let remainingDigits = digits.slice(dialingCodeInInput.length - 1); // Remove the dialing code from input

    let formattedNumber = dialingCodeInInput; // Start with the dialing code

    // Apply the rest of the mask formatting
    let remainingMask = ' ' + maskParts.slice(1).join(' '); // Everything after the dialing code
    let digitIndex = 0;

    let remainingMaskWithOutSpaces = maskParts.slice(1).join('');

    if (remainingDigits.length > remainingMaskWithOutSpaces.length) {
        formattedNumber = `${dialingCode} ${remainingDigits}`;
        return formattedNumber.trim();
    }

    for (let i = 0; i < remainingMask.length; i++) {
        if (remainingMask[i] === '#') {
            if (digitIndex < remainingDigits.length) {
                formattedNumber += remainingDigits[digitIndex];
                digitIndex++;
            } else {
                return formattedNumber.trim();
            }
        } else {
            formattedNumber += remainingMask[i];
        }
    }

    return formattedNumber.trim();
}

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

const populateCurrencyDropdown = function (currencies) {
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
};

const getPrices = async function (userCountry) {
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
            populateTelephoneDropdown(data.countries);

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
};

const getCurrencyByLocation = async function () {
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
};

window.onload = getCurrencyByLocation;

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
        let isValidInput = true;
        $(this).removeClass('is-invalid');
        const type = $(this).attr('type');
        const value = $(this).val();
        if (type === 'email') {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(value)) {
                isValidInput = false;
            }
        }

        if (type === 'tel') {
            console.log('tel');
            const phoneDigits = value.replace(/\D/g, '');
            if (phoneDigits.length < 5) {
                isValidInput = false;
            }
        }

        if (type === 'text') {
            if (value.length < 3) {
                isValidInput = false;
            }
        }

        if (!isValidInput) {
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

$('#slide-container').css({ transform: `translateX(-${2 * 100}%)` });
$('.back-btn').attr({ index: 2 });

$(document).on('input change', 'input', function (e) {
    $('.is-invalid').removeClass('is-invalid');
});

const selectPaymentBtn = function(elem) {
    $(elem).siblings('.btn').removeClass('active');
    $(elem).addClass('active');
}
