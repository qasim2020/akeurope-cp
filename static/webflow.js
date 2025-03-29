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
});

async function initOverlay() {
    
    let countryCode;
    try {
        const response = await fetch('https://ipwho.is?fields=country_code', { mode: 'cors' });
        const data = await response.json();
        countryCode = data.country_code ? data.country_code : 'US';
    } catch (error) {
        console.log(error);
        countryCode = 'US';
    }

    if (countryCode === 'NO') {
        // runNorway(countryCode);
        runGlobal(countryCode);
    } else {
        runGlobal(countryCode);
    }
}

function runGlobal(countryCode) {
    $('.donate').on('click', function (e) {
        $('.donation-overlay').css({ display: 'flex' });
    });

    const projectSlug = $('body').attr('projectSlug');
    if (projectSlug) {
        $('.donate-specific').on('click', function (e) {
            const elem = $('#donation-overlay').find(`[projectSlug=${projectSlug}]`);
            showOverlay(elem);
        });
    } 

    const processedSlugs = new Set();

    $('.project-selector').each((index, element) => {
        const projectSlug = $(element).attr('projectSlug');
        if (projectSlug && !processedSlugs.has(projectSlug)) {
            processedSlugs.add(projectSlug);
            attachIframe(element, countryCode);
        }
    });

    $('.project-selector').on('click', function (e) {
        showOverlay($(this));
    });
}

function runNorway(countryCode) {
    $('.donate, .donate-specific').on('click', function (e) {
        const projectSlug = $('body').attr('projectSlug');
        if (projectSlug) {
            $('#donation-overlay-no').css({ display: 'flex' });
            $('.projects-container').css({display: 'none'});
            $('.frequency-container').css({display: 'flex'});
        } else {
            $('#donation-overlay-no').css({ display: 'flex' });
        }
    });

    let updateNextButtonURL = function () {
        $('.button-selector').text('...');
        let currencySelected = 'NOK';
        let freqSelected = $('.selected.freq-selector').text();
        let connectedURL = '';
        if (freqSelected == 'one time') {
            connectedURL = $('.selected.project-selector-no').attr(currencySelected);
        } else {
            connectedURL = $('.selected.project-selector-no').attr(`${currencySelected}MONTHLY`);
        }
        $('.button-selector').attr({ myURL: connectedURL });
    };

    let currentProj = $('body').attr('projectSlug');

    if (currentProj) {
        const projectSelector = $(`.project-selector-no[projectSlug=${currentProj}]`);
        projectSelector.addClass('selected');
        const projectName = projectSelector.attr('projectName');
        $('.project-label').html(projectName);
        updateNextButtonURL();
    } 

    $('.project-selector-no').on('click', function (e) {
        $('.project-selector-no').removeClass('selected');
        $(this).addClass('selected');
        const projectName = $(this).attr('projectName');
        $('.project-label').html(projectName);
        updateNextButtonURL();
    });

    $('.freq-selector').on('click', function (e) {
        $('.freq-selector').removeClass('selected');
        $(this).addClass('selected');
        updateNextButtonURL();
        $('.button-selector').click();
        $(this).removeClass('selected');
    });

    $('.button-selector').on('click', function (e) {
        let url = $(this).attr('myURL');
        window.open(url, '_blank');
    });
}

function attachIframe(elem, code) {
    const partnerPortal = $(elem).attr('partnerSlug');

    if (partnerPortal){
        console.log(partnerPortal);
        return;
    } 

    const slug = encodeURIComponent($(elem).attr('projectSlug'));
    const name = encodeURIComponent($(elem).attr('projectName'));
    const hdg = encodeURIComponent($(elem).attr('projectHeading'));
    const cover = encodeURIComponent($(elem).siblings('img').attr('src'));
    const desc = encodeURIComponent($(elem).siblings('.project-desc').html());

    const url = `__CUSTOMER_PORTAL_URL__/overlay/${slug}?name=${name}&heading=${hdg}&cover=${cover}&description=${desc}&countryCode=${code}&webflow=true`;

    var $iframe = $(`<iframe id="iframe-${slug}" allow="payment"></iframe>`)
    .attr('src', url)
    .css({
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

    const slug = $(elem).attr('partnerSlug') || $(elem).attr('projectSlug');
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