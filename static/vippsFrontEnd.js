let vippsOverlayStatus;
const vippsBtnOneTime = $('#vipps-btn-one-time').html();
const vippsBtnMonthly = $('#vipps-btn-monthly').html();

const getVisibleBtnFirstSlide = function () {
    let visibleBtn;
    const countryCode = localStorage.getItem('countryCode');
    const freqExists = $('[freq]').length > 0;
    if (freqExists) {
        const monthly = $('[freq].active').attr('freq') === 'once' ? false : true;
        if (countryCode === 'NO') {
            if (monthly) {
                visibleBtn = $('#vipps-btn-monthly');
            } else {
                visibleBtn = $('#vipps-btn-one-time');
            }
        } else {
            if (monthly) {
                visibleBtn = $('#global-monthly-donation');
            } else {
                visibleBtn = $('#global-one-time-donation');
            }
        }
    } else {
        if (countryCode === 'NO') {
            visibleBtn = $('#vipps-btn-one-time');
        } else {
            visibleBtn = $('#global-one-time-donation');
        }
    }

    return visibleBtn;
}

const showCardError = (elem, message, currentBtnHtml) => {
    $(elem).addClass('bg-danger').html(`<i class="ti ti-credit-card-off me-1"></i> Error!`);
    $(elem).popover('dispose');
    $(elem)
        .popover({
            content: `<div class="text-red fw-bold m-0" 
                        style="border-radius: 4px; padding: 10px;">
                        ${message}
                        </div>`,
            placement: 'top',
            trigger: 'manual',
            html: true,
            template: `<div class="popover bg-danger-lt border-0 shadow-md" role="tooltip">
                         <div class="popover-arrow d-none"></div>
                         <div class="popover-body p-2"></div>
                       </div>`,
        })
        .popover('show');
    setTimeout(function () {
        const isProcessingBtn = $(elem).attr('id') === 'processing-btn';
        $(elem).popover('hide');
        if (isProcessingBtn) {
            $(elem).addClass('d-none');
            $(elem).removeClass('bg-danger').html(currentBtnHtml);
            $('#express-checkout-element').removeClass('d-none');
        } else {
            $(elem).removeClass('bg-danger').html(currentBtnHtml);
        }
    }, 10000);
    return;
};

const handleVippsDropdown = (countryCode) => {
    if (countryCode === 'NO') {
        $('#vipps-checkout').removeClass('d-none');
        $('#global-checkout').addClass('d-none');
    } else {
        $('#vipps-checkout').addClass('d-none');
        $('#global-checkout').removeClass('d-none');
    }
};

const validateDonationForm = (elem) => {
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

const isMobileDevice = () => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

const checkVippsPaymentStatus = async (elem, currentBtnHtml, reference) => {
    const projectName = localStorage.getItem('projectName');
    const statusUrl = `/poll-vipps-payment-intent/${reference}`;
    if (window._vippsPollingInterval) clearInterval(window._vippsPollingInterval);
    function checkPaymentStatus() {
        $.ajax({
            url: statusUrl,
            method: 'GET',
            success: function (data) {
                $(elem).html(`<span class="text-white fs-3" style="padding: 11px 0px !important">Payment ${data.status}</span>`);
                if (data.status === 'draft' && vippsOverlayStatus === 'closed') {
                    clearInterval(interval);
                    $(elem).html(currentBtnHtml);
                }
                if (data.status === 'aborted' || data.status === 'cancelled') {
                    clearInterval(interval);
                    $(elem).html(currentBtnHtml);
                }
                if (data.status === 'paid') {
                    clearInterval(interval);
                    $('#slide-container').css({ transform: `translateX(-${3 * 100}%)` });
                    $('.back-btn').attr({ index: 3 });
                    $('#show-dashboard').attr({
                        href: data.dashboardLink,
                        target: '_blank',
                    });
                    triggerEvent('paymentSuccessful', {
                        project: projectName,
                        transaction_id: data.orderNo,
                        amount: data.total || data.totalCost,
                        currency: data.currency,
                        orderType: data.monthlySubscription ? 'Monthly Subscription' : 'One Time Payment',
                        date: Date.now(),
                    });
                    if (data.projects?.length > 0 || data.products?.length > 0) {
                        drawOrderEntries();
                    }
                }
            },
            error: function (xhr, status, error) {
                clearInterval(interval);
                throw new Error(error.responseText || error.message || 'Server Error - please refresh window');
            },
        });
    }
    checkPaymentStatus();
    const interval = setInterval(checkPaymentStatus, 1000);
    window._vippsPollingInterval = interval;
    return interval;
};

const checkVippsSetupStatus = async (elem, currentBtnHtml, orderId, agreementId) => {
    const projectName = localStorage.getItem('projectName');
    const statusUrl = `/poll-vipps-setup-intent/${orderId}/${agreementId}`;
    if (window._vippsPollingInterval) clearInterval(window._vippsPollingInterval);
    function checkPaymentStatus() {
        $.ajax({
            url: statusUrl,
            method: 'GET',
            success: function (data) {
                $(elem).html(`<span class="text-white fs-3" style="padding: 11px 0px !important">Processing ${data.status}...</span>`);
                if (data.status === 'draft' && vippsOverlayStatus === 'closed') {
                    clearInterval(interval);
                    $(elem).html(currentBtnHtml);
                }
                if (data.status === 'aborted') {
                    clearInterval(interval);
                    $(elem).html(currentBtnHtml);
                }
                if (data.status === 'paid') {
                    if (data.projects?.length > 0) {
                        drawOrderEntries();
                    };
                    clearInterval(interval);
                    $('#slide-container').css({ transform: `translateX(-${3 * 100}%)` });
                    $('.back-btn').attr({ index: 3 });
                    $('#show-dashboard').attr({
                        href: data.dashboardLink,
                        target: '_blank',
                    });
                    triggerEvent('paymentSuccessful', {
                        project: projectName,
                        transaction_id: data.orderNo,
                        amount: data.total || data.totalCost,
                        currency: data.currency,
                        orderType: data.monthlySubscription ? 'Monthly Subscription' : 'One Time Payment',
                        date: Date.now(),
                    });
                }
            },
            error: function (xhr, status, error) {
                clearInterval(interval);
                throw new Error(error.responseText || error.message || 'Server Error - please refresh window');
            },
        });
    }
    checkPaymentStatus();
    const interval = setInterval(checkPaymentStatus, 1000);
    window._vippsPollingInterval = interval;
    return interval;
};

const showVippsPaymentOverlay = (paymentUrl) => {
    const overlay = $(`
        <div id="vipps-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); display: flex; justify-content: center; align-items: center; z-index: 9999;">
            <button id="close-vipps-overlay" class="btn rounded-circle btn-icon text-dark p-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-x">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                    <path d="M18 6l-12 12"></path>
                    <path d="M6 6l12 12"></path>
                </svg>
            </button>
            <div style="position: relative; width: 400px; height: 600px; background: black; border-radius: 10px;">
                <iframe src="${paymentUrl}" 
                style="background: black; width: 100%; height: 100%; border: none; overflow: hidden; border-radius: 9px;"></iframe>
            </div>
        </div>
    `);

    $('body').append(overlay);

    $('#close-vipps-overlay').on('click', function () {
        $('#vipps-overlay').remove();
        vippsOverlayStatus = 'closed';
    });
};

const showVippsOrderStatus = (orderId) => {
    const overlay = $(`
        <div id="vipps-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); display: flex; justify-content: center; align-items: center; z-index: 9999;">
            <button id="close-vipps-overlay" class="btn rounded-circle btn-icon text-dark p-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-x">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                    <path d="M18 6l-12 12"></path>
                    <path d="M6 6l12 12"></path>
                </svg>
            </button>
            <div style="position: relative; width: 400px; height: 600px; background: black; border-radius: 10px;">
                <iframe src="/vipps-payment-status/${orderId}" 
                style="background: black; width: 100%; height: 100%; border: none; overflow: hidden; border-radius: 9px;"></iframe>
            </div>
        </div>
    `);

    $('body').append(overlay);

    $('#close-vipps-overlay').on('click', function () {
        $('#vipps-overlay').remove();
    });
};

const handleMonthlyVipps = async (elem, type) => {
    let currentBtnHtml;
    try {
        if (type === 'overlay') {
            const isValid = validateDonationForm();
            if (!isValid) return;
            $(elem).html(`
                <span class="spinner-border spinner-border-sm me-2 text-white" role="status"></span>
                <span class="text-white fs-3 py-2">Processing</span>
            `).attr({disabled: true});
            currentBtnHtml = vippsBtnMonthly;
            const url = `/create-vipps-setup-intent`;
            const body = {
                total: $('#monthly-products-list').find('input.donation-amount').val(),
                currency: 'NOK',
                project: $('#project-card').attr('project-slug'),
            };
            const data = await ajaxPost(url, body);
            $(elem).attr({disabled: false}); 
            if (data) {
                if (!isMobileDevice()) {
                    vippsOverlayStatus = 'opened';
                    showVippsPaymentOverlay(data.redirectUrl);
                } else {
                    vippsOverlayStatus = 'opened';
                    const newWindow = window.open(data.redirectUrl, '_blank');
                    if (!newWindow) {
                        showVippsPaymentOverlay(data.redirectUrl);
                    }
                }
                await checkVippsSetupStatus(elem, currentBtnHtml, data.orderId, data.agreementId);
            }
            $(window).on('message', function (event) {
                if (event.originalEvent.data === 'close-vipps-overlay') {
                    $('#vipps-overlay').remove();
                    vippsOverlayStatus = 'closed';
                    $(elem).html(currentBtnHtml);
                }
            });
        }
        if (type === 'widget') {
            $(elem).html(`
                <span class="spinner-border spinner-border-sm me-2 text-white" role="status"></span>
                <span class="text-white fs-3 py-2">Processing</span>
            `).attr({disabled: true});
            currentBtnHtml = vippsBtnMonthly;
            const url = `/create-vipps-setup-intent-widget`;
            const body = {
                orderId: $('#project-entries').attr('order-id'),
            };
            const data = await ajaxPost(url, body);
            $(elem).attr({disabled: false}); 
            if (data) {
                if (!isMobileDevice()) {
                    vippsOverlayStatus = 'opened';
                    showVippsPaymentOverlay(data.redirectUrl);
                } else {
                    vippsOverlayStatus = 'opened';
                    window.open(data.redirectUrl, '_blank');
                }
                await checkVippsSetupStatus(elem, currentBtnHtml, data.orderId, data.agreementId);
            }
            $(window).on('message', function (event) {
                if (event.originalEvent.data === 'close-vipps-overlay') {
                    $('#vipps-overlay').remove();
                    vippsOverlayStatus = 'closed';
                    $(elem).html(currentBtnHtml);
                }
            });
        }
    } catch (error) {
        console.log(error);
        showCardError(elem, error.message || error.responseText || 'Order expired. Please refresh your window', currentBtnHtml);
    }
};

const handleOneTimeVipps = async (elem, type) => {
    let currentBtnHtml;
    try {

        if (type === 'overlay') {
            const isValid = validateDonationForm();
            if (!isValid) return;
            $(elem).html(`
                <span class="spinner-border spinner-border-sm me-2 text-white" role="status"></span>
                <span class="text-white fs-3 py-2">Processing</span>
            `).attr({disabled: true});
            currentBtnHtml = vippsBtnOneTime;
            const url = `/create-vipps-payment-intent`;
            const body = {
                total: $('#one-time-products-list').find('input.donation-amount').val(),
                currency: 'NOK',
                project: $('#project-card').attr('project-slug'),
            };
            const data = await ajaxPost(url, body);
            $(elem).attr({disabled: false});
            if (data) {
                if (!isMobileDevice()) {
                    vippsOverlayStatus = 'opened';
                    showVippsPaymentOverlay(data.redirectUrl);
                } else {
                    vippsOverlayStatus = 'opened';
                    window.open(data.redirectUrl, '_blank');
                }
                await checkVippsPaymentStatus(elem, currentBtnHtml, data.reference);
            }
            $(window).on('message', function (event) {
                if (event.originalEvent.data === 'close-vipps-overlay') {
                    $('#vipps-overlay').remove();
                    vippsOverlayStatus = 'closed';
                    $(elem).html(currentBtnHtml);
                }
            });
        }
        if (type === 'widget') {
            $(elem).html(`
                <span class="spinner-border spinner-border-sm me-2 text-white" role="status"></span>
                <span class="text-white fs-3 py-2">Processing</span>
            `).attr({disabled: true});
            currentBtnHtml = vippsBtnOneTime;
            const url = `/create-vipps-payment-intent-widget`;
            const body = {
                orderId: $('#project-entries').attr('order-id'),
            };
            const data = await ajaxPost(url, body);
            $(elem).attr({disabled: false}); 
            if (data) {
                if (!isMobileDevice()) {
                    vippsOverlayStatus = 'opened';
                    showVippsPaymentOverlay(data.redirectUrl);
                } else {
                    vippsOverlayStatus = 'opened';
                    window.open(data.redirectUrl, '_blank');
                }
                await checkVippsPaymentStatus(elem, currentBtnHtml, data.reference);
            }
            $(window).on('message', function (event) {
                if (event.originalEvent.data === 'close-vipps-overlay') {
                    $('#vipps-overlay').remove();
                    vippsOverlayStatus = 'closed';
                    $(elem).html(currentBtnHtml);
                }
            });
        }
        if (type === 'product') {
            $(elem).html(`
                <span class="spinner-border spinner-border-sm me-2 text-white" role="status"></span>
                <span class="text-white fs-3 py-2">Processing</span>
            `).attr({disabled: true});
            currentBtnHtml = vippsBtnOneTime;
            const url = `/create-vipps-payment-intent-product`;
            const body = {
                orderId: $('#product-entries').attr('order-id'),
            };
            const data = await ajaxPost(url, body);
            $(elem).attr({disabled: false});
            if (data) {
                if (!isMobileDevice()) {
                    vippsOverlayStatus = 'opened';
                    showVippsPaymentOverlay(data.redirectUrl);
                } else {
                    vippsOverlayStatus = 'opened';
                    window.open(data.redirectUrl, '_blank');
                }
                await checkVippsPaymentStatus(elem, currentBtnHtml, data.reference);
            }
            $(window).on('message', function (event) {
                if (event.originalEvent.data === 'close-vipps-overlay') {
                    $('#vipps-overlay').remove();
                    vippsOverlayStatus = 'closed';
                    $(elem).html(currentBtnHtml);
                }
            });
        }
    } catch (error) {
        console.log(error);
        showCardError(elem, error.message || error.responseText || 'Order expired. Please refresh your window', currentBtnHtml);
    }
};

const ajaxPost = async function (url, data) {
    const response = await $.ajax({
        url,
        data: JSON.stringify(data),
        method: 'POST',
        contentType: 'application/json',
    });
    return response;
};