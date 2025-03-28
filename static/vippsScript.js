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
}

const handleOneTimeVipps = async function(elem) {
    const isValid = validateDonationForm(elem);
    if (!isValid) return;
}

const handleMonthlyVipps = async function(elem) {
    const isValid = validateDonationForm(elem);
    if (!isValid) return;
}