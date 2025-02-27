document.addEventListener('DOMContentLoaded', function () {
    if (typeof jQuery === 'undefined') {
        var script = document.createElement('script');
        script.src = 'https://code.jquery.com/jquery-3.7.1.min.js';
        script.integrity = 'sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=';
        script.crossOrigin = 'anonymous';
        script.onload = function () {
            initOverlay();
        };
        document.body.appendChild(script);
    } else {
        initOverlay();
    }
    console.log('webflow script loaded');
});

async function initOverlay() {
    let countryCode;
    try {
        const response = await fetch('https://ipwho.is?fields=country_code', { mode: 'cors' });
        const data = await response.json();
        countryCode = data.country_code ? data.country_code : 'NO';
    } catch (error) {
        console.log(error);
        countryCode = 'NO';
    }
    $('.project-selector').each((index, element) => {
        attachIframe(element, countryCode);
    });
}

function attachIframe(elem, code) {
    const partnerPortal = $(elem).attr('partnerSlug');

    if (partnerPortal) return console.log('partner portal');

    const slug = encodeURIComponent($(elem).attr('projectSlug'));
    const name = encodeURIComponent($(elem).attr('projectName'));
    const hdg = encodeURIComponent($(elem).attr('projectHeading'));
    const cover = encodeURIComponent($(elem).siblings('img').attr('src'));
    const desc = encodeURIComponent($(elem).siblings('.project-desc').html());

    const url = `http://localhost:3009/overlay/${slug}?name=${name}&heading=${hdg}&cover=${cover}&description=${desc}&countryCode=${code}&webflow=true`;

    var $iframe = $(`<iframe id="iframe-${slug}" allow="payment"></iframe>`).attr('src', url).css({
        display: 'none',
        margin: '0',
        padding: '0',
        border: '0',
        width: '100%',
        height: '100%',
        position: 'fixed',
        opacity: 1,
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        transform: 'translateZ(100px)',
        'z-index': '9999',
    });

    $('body').append($iframe);
}

function showOverlay(elem) {

    const partnerPortal = $(elem).attr('partnerSlug');

    if (partnerPortal) return loadDonationOverlay(partnerPortal);

    const slug = $(elem).attr('projectSlug');
    const $iframe = $(`#iframe-${slug}`);

    $('#iframe-loading-overlay').remove();

    var $loadingOverlay = $('<div id="iframe-loading-overlay"></div>').css({
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.7)',
        opacity: 0,
        zIndex: '9998',
        color: 'white',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
    });

    function showLoadingOverlay() {
        $loadingOverlay.stop().animate({ opacity: 1 }, 300);
        $iframe.css({ display: 'block' });
    }

    function hideLoadingOverlay() {
        $iframe.css({ display: 'none' });
        $loadingOverlay.stop().fadeOut(300);
        $loadingOverlay.remove();
    }

    $('body').append($loadingOverlay);
    showLoadingOverlay();

    $('body').css({
        overflow: 'hidden',
        height: '100vh',
    });

    $(window).on('message', function (event) {
        if (event.originalEvent.data === 'close-overlay') {
            $('body').css({
                overflow: 'scroll',
                height: 'auto',
            });
            hideLoadingOverlay();
        }
    });
}

const loadDonationOverlay = function (slug) {
    const $iframe = $(`#iframe-${slug}`);

    $('#iframe-loading-overlay').remove();

    var $loadingOverlay = $('<div id="iframe-loading-overlay"></div>').css({
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.7)',
        opacity: 0,
        zIndex: '9998',
        color: 'white',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
    });

    function showLoadingOverlay() {
        $loadingOverlay.stop().animate({ opacity: 1 }, 300);
        $iframe.css({ display: 'block' });
    }

    function hideLoadingOverlay() {
        $iframe.css({ display: 'none' });
        $loadingOverlay.stop().fadeOut(300);
        $loadingOverlay.remove();
    }

    $('body').append($loadingOverlay);
    showLoadingOverlay();

    $('body').css({
        overflow: 'hidden',
        height: '100vh',
    });

    $(window).on('message', function (event) {
        if (event.originalEvent.data === 'close-overlay') {
            $('body').css({
                overflow: 'scroll',
                height: 'auto',
            });
            hideLoadingOverlay();
        }
    });
};