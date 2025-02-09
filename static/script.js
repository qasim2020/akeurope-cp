(function () {
    document.addEventListener("DOMContentLoaded", function () {
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

    function initOverlay() {
        const css = `
        <style akeurope-script="true">
            #donate-button-akeurope {
                position: fixed;
                right: -67px;
                top: 80%;
                transform: translateY(-50%) rotate(-90deg);
                background: #ff4757;
                color: #fff;
                padding: 13px 22px;
                font-size: 18px;
                font-weight: bold;
                border-radius: 10px 10px 0 0;
                cursor: pointer;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                z-index: 9997;
                display: flex;
                align-items: center;
                gap: 10px;
                font-family: Arial, sans-serif;
                white-space: nowrap;
            }


            @keyframes heartbeat {
                0% { transform: scale(1); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }

            #donate-button svg {
                animation: heartbeat 1s infinite;
            }
        </style>
        `;

        var $button = $(`
            <div id="donate-button-akeurope" akeurope-script="true">
                <svg width="30px" 
                viewBox="-2.4 -2.4 28.80 28.80" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"><rect x="-2.4" y="-2.4" width="28.80" height="28.80" rx="14.4" fill="#ff4757" strokewidth="0"></rect></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 2V4" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M12 20V22" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M2 12L4 12" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M20 12L22 12" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M6 18L6.34305 17.657" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M17.6567 6.34326L18 6" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M18 18L17.657 17.657" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M6.34326 6.34326L6 6" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M10.7847 15.3538L10.3157 15.9391L10.7847 15.3538ZM7.25 11.3796C7.25 11.7938 7.58579 12.1296 8 12.1296C8.41421 12.1296 8.75 11.7938 8.75 11.3796H7.25ZM12 9.90096L11.4554 10.4166C11.597 10.5662 11.794 10.651 12 10.651C12.206 10.651 12.403 10.5662 12.5446 10.4166L12 9.90096ZM13.2153 15.3538L13.6843 15.9391L13.2153 15.3538ZM10.2909 14.0016C9.97317 13.7358 9.50016 13.7779 9.23437 14.0956C8.96858 14.4133 9.01065 14.8863 9.32835 15.1521L10.2909 14.0016ZM8.75 11.3796C8.75 10.6647 9.14671 10.0958 9.64107 9.86605C10.0847 9.65992 10.7461 9.66744 11.4554 10.4166L12.5446 9.3853C11.454 8.23345 10.1154 7.99162 9.00898 8.50573C7.95333 8.99626 7.25 10.1171 7.25 11.3796H8.75ZM10.3157 15.9391C10.5164 16.0999 10.7605 16.2953 11.0151 16.4465C11.269 16.5974 11.6065 16.75 12 16.75V15.25C11.9935 15.25 11.931 15.2459 11.7811 15.1569C11.6318 15.0682 11.4683 14.9406 11.2537 14.7686L10.3157 15.9391ZM13.6843 15.9391C14.2286 15.5029 15.0074 14.9422 15.6138 14.248C16.2459 13.5245 16.75 12.5983 16.75 11.3796H15.25C15.25 12.1383 14.9502 12.7276 14.4842 13.2611C13.9925 13.8239 13.379 14.2616 12.7463 14.7686L13.6843 15.9391ZM16.75 11.3796C16.75 10.1171 16.0467 8.99626 14.991 8.50573C13.8846 7.99162 12.546 8.23345 11.4554 9.3853L12.5446 10.4166C13.2539 9.66744 13.9153 9.65992 14.3589 9.86605C14.8533 10.0958 15.25 10.6647 15.25 11.3796H16.75ZM12.7463 14.7686C12.5317 14.9406 12.3682 15.0682 12.2189 15.1569C12.069 15.2459 12.0065 15.25 12 15.25V16.75C12.3935 16.75 12.731 16.5974 12.9849 16.4465C13.2395 16.2953 13.4836 16.0999 13.6843 15.9391L12.7463 14.7686ZM11.2537 14.7686C10.9194 14.5007 10.6163 14.2739 10.2909 14.0016L9.32835 15.1521C9.66331 15.4323 10.0345 15.7138 10.3157 15.9391L11.2537 14.7686Z" fill="#ffffff"></path> </g></svg>
                Donate Now
            </div>
        `);

        $('body').find('[akeurope-script="true"]').remove();
        $('body').append(css);
        $('body').append($button);

        $button.on('click', function () {
            
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
            });

            function showLoadingOverlay() {
                $loadingOverlay.stop().animate({ opacity: 1 }, 300);
            }
            
            function hideLoadingOverlay() {
                $loadingOverlay.stop().fadeOut(300);
                $loadingOverlay.remove();
            }

            $('body').append($loadingOverlay);
            showLoadingOverlay();

            var $iframe = $('<iframe id="iframe-loaded" allow="payment"></iframe>')
                .attr('src', '__OVERLAY_URL__')
                .css({
                    "display": "block",
                    "margin": "0",
                    "padding": "0",
                    "border": "0",
                    "width": "100%",
                    "height": "100%",
                    "position": "fixed",
                    "opacity": 0,
                    "top": "0",
                    "left": "0",
                    "right": "0",
                    "bottom": "0",
                    "transform": "translateZ(100px)",
                    "z-index": "9999"
                })
                .on('load', function () {
                    $(this).animate({ opacity: 1 }, 300);
                });

            $('body').append($iframe);
            $('body').css({
                overflow: 'hidden',
                height: '100vh'
            })

            $(window).on('message', function (event) {
                if (event.originalEvent.data === 'close-overlay') {
                    $iframe.remove();
                    $('body').css({
                        overflow: 'scroll',
                        height: 'auto'
                    })
                    hideLoadingOverlay();
                }
            });
        });

        // $button.click();
    }
})();
