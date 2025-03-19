(function () {
    document.addEventListener('DOMContentLoaded', function () {
        if (typeof jQuery === 'undefined') {
            var script = document.createElement('script');
            script.src = 'https://code.jquery.com/jquery-3.7.1.min.js';
            script.integrity = 'sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=';
            script.crossOrigin = 'anonymous';
            script.onload = function () {
                __PROJECT_CAMEL_CASE__();
            };
            document.body.appendChild(script);
        } else {
            __PROJECT_CAMEL_CASE__();
        }
    });

    function __PROJECT_CAMEL_CASE__() {

        var $iframe = $('<iframe id="iframe-__PROJECT_SLUG__" allow="payment"></iframe>').attr('src', '__OVERLAY_URL__').css({
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

        console.log('iframe __PROJECT_SLUG__ attached');

    }
})();
