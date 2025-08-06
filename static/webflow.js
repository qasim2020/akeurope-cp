initOverlay();

async function initOverlay() {
    let countryCode = '__COUNTRY_CODE__';
    runGlobal(countryCode);
    await tracker();
}

function runGlobal(countryCode) {

    const products = $('body').attr('productSlug');
    const productsOpened = products !== 'random' && products !== '';
    if (productsOpened) {
        attachProductTable(products);
    }

    if (countryCode === 'NO') {
        $('.vipps-number').css({ display: 'none' });
        $('.vipps-banner').css({ display: "block" });
    } else {
        $('.vipps-banner').css({ display: "none" });
    }

    $('.donate').on('click', function (e) {
        $('.donation-overlay').css({ display: 'flex' });
    });

    $('.donate-specific').on('click', function (e) {
        const projectSlug = $('body').attr('projectSlug') || $(this).attr('projectSlug');
        const elem = $('#donation-overlay').find(`[projectSlug=${projectSlug}]`);
        showOverlay(elem);
    });

    $('.qurbani-btn').on('click', function (e) {
        const projectSlug = 'qurbani';
        const elem = $('#donation-overlay').find(`[projectSlug=${projectSlug}]`);
        showOverlay(elem);
    });

    $('.orphan-btn').on('click', function (e) {
        const projectSlug = 'orphans-care';
        const elem = $('#donation-overlay').find(`[projectSlug=${projectSlug}]`);
        showOverlay(elem);
    });

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
            $('.projects-container').css({ display: 'none' });
            $('.frequency-container').css({ display: 'flex' });
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

    if (partnerPortal) {
        return;
    }

    const slug = encodeURIComponent($(elem).attr('projectSlug'));
    const products = encodeURIComponent($(elem).attr('projectProducts'));
    const name = encodeURIComponent($(elem).attr('projectName'));
    const hdg = encodeURIComponent($(elem).attr('projectHeading'));
    const cover = encodeURIComponent($(elem).siblings('img').attr('src'));
    const desc = encodeURIComponent($(elem).siblings('.project-desc').html());
    let url;

    if (products === 'random') {
        url = `__CUSTOMER_PORTAL_URL__/overlay/${slug}?name=${name}&heading=${hdg}&cover=${cover}&description=${desc}&countryCode=${code}&webflow=true&products=${products}`;
    }

    const allowedProducts = ['qurbani', 'water-pakistan'];

    if (allowedProducts.includes(products)) {
        url = `__CUSTOMER_PORTAL_URL__/overlay/${slug}?countryCode=${code}&webflow=true&products=${products}`;
    }

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

    $iframe[0].contentWindow.postMessage('goingVisible', '*');

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

async function tracker() {

    const params = new URLSearchParams(window.location.search);

    const utm = {
        source: params.get('utm_source'),
        medium: params.get('utm_medium'),
        campaign: params.get('utm_campaign'),
        term: params.get('utm_term'),
        content: params.get('utm_content')
    };

    const data = {
        referrer: document.referrer || null,
        fullUrl: window.location.href,
        hostname: window.location.hostname,
        path: window.location.pathname,
        utm: Object.fromEntries(new URLSearchParams(window.location.search)),
        language: navigator.language,
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: {
            width: window.innerWidth,
            height: window.innerHeight,
        },
        platform: navigator.platform,
        utm,
    };

    $.ajax({
        url: '__CUSTOMER_PORTAL_URL__/widget-loader',
        type: 'POST',
        data,
        success: function (response) {
        },
        error: function (error) {
            console.error(error);
        }
    })
}

function attachProductTable(page) {

    $('body').prepend(`
        <style>
            button.product-btn {
                display: flex;
                align-items: center;
                background-color: var(--base-color-brand--orange);
                color: var(--base-color-neutral--white);
                text-align: center;
                border-radius: 1.5rem;
                padding: 13px 14px;
                font-size: 1rem;
                font-weight: 900;
                line-height: 0;
                text-decoration: none;
                margin-bottom: 4px;
                height: fit-content;
            }
            button.product-btn > svg {
                margin-right: 2px;
                margin-left: -2px;
            }
            button.product-btn > .pricing {
                font-size: 0.6rem;
                padding-left: 4px;
            }
        </style>
    `)

    const pageTable = $('body').find('.products-table');

    const attachProducts = function (order) {
        for (const product of order.products) {
            const wrapper = $(`#${product.id}`);
            let btns = [];
            for (const variant of product.variants) {
                btns.push(`
                    <button class="product-btn" data-id="${variant.id}">
                        <svg  xmlns="http://www.w3.org/2000/svg"  width="12"  height="12"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                        ${variant.name} 
                        <span class="pricing">${variant.price} ${order.currency}</span>
                    </button>`);
            };
            const html = btns.join('');
            wrapper.html(html);
        }
        $('.product-btn').on('click', function (elem) {
            // add this variant to order
            const iframeEl = $(`#iframe-${page}`)[0]; // DOM element

            const message = {
                action: 'addVariant',
                productId: 'abc123',
                variant: {
                    name: 'Color',
                    value: 'Red'
                }
            };

            const targetOrigin = new URL(iframeEl.src).origin;

            iframeEl.contentWindow.postMessage(message, targetOrigin);

            // open overlay
        });
    }

    $(window).on('message', function (event) {
        const e = event.originalEvent;
        if (e.data?.products) {
            const order = e.data;

            const iframes = document.getElementsByTagName('iframe');
            for (const iframe of iframes) {
                if (iframe.contentWindow === e.source) {
                    console.log('Message from this iframe:', iframe);
                    break;
                }
            }

            attachProducts(order);
        }
    });

}