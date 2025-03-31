const handleVippsDropdown = function (countryCode) {
    if (countryCode === 'NO') {
        $('#vipps-checkout').removeClass('d-none');
        $('#global-checkout').addClass('d-none');
    } else {
        $('#vipps-checkout').addClass('d-none');
        $('#global-checkout').removeClass('d-none');
    }
};

const validateDonationForm = function (elem) {
    const total = $('.donation-amount.active').val();

    $('.shake').removeClass('shake');

    if (!total || total == 0) {
        $('.donation-amount.active').addClass('is-invalid');
        $('.donation-amount').closest('.body').addClass('shake');
        $('.shake').one('animationend', function () {
            $('.donation-amount.active').closest('.body').removeClass('shake');
        });
        return false;
    }
    return true;
};

const handleOneTimeVipps = async function (type) {
    const isValid = validateDonationForm();
    if (!isValid) return;
    if (type === 'overlay') {
        const url = `/create-vipps-payment-intent`;
        const body = {
            total: $('#one-time-products-list').find('input.donation-amount').val(),
            currency: 'NOK',
            project: $('#project-card').attr('project-slug'),
        };
        const data = await createVippsPaymentIntent(url, body);
        console.log(data);
        if (data) window.open(data, '_blank');
    }
};

const handleMonthlyVipps = async function (elem, type) {
    const isValid = validateDonationForm();
    if (!isValid) return;
    const currentBtnHtml = $(elem).html();
    $(elem).html(`
        <span class="spinner-border spinner-border-sm me-2 text-white" role="status"></span>
        <span class="text-white fw-bold py-2">Processing</span>
    `);
    if (type === 'overlay') {
        try {
            const url = `/create-vipps-setup-intent`;
            const body = {
                total: $('#monthly-products-list').find('input.donation-amount').val(),
                currency: 'NOK',
                project: $('#project-card').attr('project-slug'),
            };
            const data = await createVippsSetupIntent(url, body);
            if (data) window.open(data, '_blank');
        } catch (error) {
            console.log(error);
            showCardError(error.message || error.responseText || error);
        }
    }
};

const createVippsPaymentIntent = async function (url, data) {
    const response = await $.ajax({
        url,
        data: JSON.stringify(data),
        method: 'POST',
        contentType: 'application/json',
    });
    return response;
};

const createVippsSetupIntent = async function (url, data) {
    const response = await $.ajax({
        url,
        data: JSON.stringify(data),
        method: 'POST',
        contentType: 'application/json',
    });
    console.log(response);
    return response;
};
