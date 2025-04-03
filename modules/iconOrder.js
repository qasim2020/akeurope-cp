const icons = {
    paid: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" class="icon icon-tabler icons-tabler-filled icon-tabler-rosette-discount-check"> <defs> <linearGradient id="paidGradient" x1="0%" y1="0%" x2="100%" y2="100%"> <stop offset="0%" stop-color="#4CAF50" /> <!-- Green --> <stop offset="100%" stop-color="#81C784" /> <!-- Light Green --> </linearGradient> </defs> <path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M12.01 2.011a3.2 3.2 0 0 1 2.113 .797l.154 .145l.698 .698a1.2 1.2 0 0 0 .71 .341l.135 .008h1a3.2 3.2 0 0 1 3.195 3.018l.005 .182v1c0 .27 .092 .533 .258 .743l.09 .1l.697 .698a3.2 3.2 0 0 1 .147 4.382l-.145 .154l-.698 .698a1.2 1.2 0 0 0 -.341 .71l-.008 .135v1a3.2 3.2 0 0 1 -3.018 3.195l-.182 .005h-1a1.2 1.2 0 0 0 -.743 .258l-.1 .09l-.698 .697a3.2 3.2 0 0 1 -4.382 .147l-.154 -.145l-.698 -.698a1.2 1.2 0 0 0 -.71 -.341l-.135 -.008h-1a3.2 3.2 0 0 1 -3.195 -3.018l-.005 -.182v-1a1.2 1.2 0 0 0 -.258 -.743l-.09 -.1l-.697 -.698a3.2 3.2 0 0 1 -.147 -4.382l.145 -.154l.698 -.698a1.2 1.2 0 0 0 .341 -.71l.008 -.135v-1l.005 -.182a3.2 3.2 0 0 1 3.013 -3.013l.182 -.005h1a1.2 1.2 0 0 0 .743 -.258l.1 -.09l.698 -.697a3.2 3.2 0 0 1 2.269 -.944zm3.697 7.282a1 1 0 0 0 -1.414 0l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.32 1.497l2 2l.094 .083a1 1 0 0 0 1.32 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" fill="url(#paidGradient)" /> </svg>`,
    processing: `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-progress-check"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 20.777a8.942 8.942 0 0 1 -2.48 -.969" /><path d="M14 3.223a9.003 9.003 0 0 1 0 17.554" /><path d="M4.579 17.093a8.961 8.961 0 0 1 -1.227 -2.592" /><path d="M3.124 10.5c.16 -.95 .468 -1.85 .9 -2.675l.169 -.305" /><path d="M6.907 4.579a8.954 8.954 0 0 1 3.093 -1.356" /><path d="M9 12l2 2l4 -4" /></svg>`,
    'pending payment': `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-loader"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 6l0 -3" /><path d="M16.25 7.75l2.15 -2.15" /><path d="M18 12l3 0" /><path d="M16.25 16.25l2.15 2.15" /><path d="M12 18l0 3" /><path d="M7.75 16.25l-2.15 2.15" /><path d="M6 12l-3 0" /><path d="M7.75 7.75l-2.15 -2.15" /></svg>`,
    draft: `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-circle-dotted"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7.5 4.21l0 .01" /><path d="M4.21 7.5l0 .01" /><path d="M3 12l0 .01" /><path d="M4.21 16.5l0 .01" /><path d="M7.5 19.79l0 .01" /><path d="M12 21l0 .01" /><path d="M16.5 19.79l0 .01" /><path d="M19.79 16.5l0 .01" /><path d="M21 12l0 .01" /><path d="M19.79 7.5l0 .01" /><path d="M16.5 4.21l0 .01" /><path d="M12 3l0 .01" /></svg>`,
    done: `<svg style="position: absolute; left: -6px; z-index: 10;" xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="currentColor"  class="icon icon-tabler icons-tabler-filled icon-tabler-circle-check text-primary"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" /> <path d="M9 12l2 2l4 -4" stroke="white"/> </svg>`,
    circleCheck: `<svg style="position: absolute; left: -6px; z-index: 10;" xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-circle-check text-primary"> <path stroke="none" d="M0 0h24v24H0z" fill="none"/> <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" fill="white"/> <path d="M9 12l2 2l4 -4" /> </svg>`,
    vipps: `<svg xmlns="http://www.w3.org/2000/svg" height="45" width="100" xml:space="preserve" y="0" x="0" id="Layer_1" version="1.1" viewBox="-24.525 -16.525 212.55 99.15"><style id="style147" type="text/css">.st0{fill:#ffffff}.st1{fill:none}</style><path id="path149" d="M28 22l5.1 14.9 5-14.9H44l-8.8 22.1h-4.4L22 22z" class="st0"/><path id="path151" d="M141.4 38.1l14.9-5.1-14.9-5v-6l22.1 8.8v4.4L141.4 44z" class="st1"/><path id="path153" d="M28 44l5.1 14.9 5-14.9H44l-8.8 22.1h-4.4L22 44z" class="st1"/><path id="path155" d="M38.1 22.1L33 7.2l-5 14.9h-6L30.9 0h4.4l8.8 22.1z" class="st1"/><path id="path157" d="M22.1 28L7.2 33.1l14.9 5.1v5.9L0 35.3v-4.4L22.1 22z" class="st1"/><path id="path159" d="M57.3 40.6c3.7 0 5.8-1.8 7.8-4.4 1.1-1.4 2.5-1.7 3.5-.9 1 .8 1.1 2.3 0 3.7-2.9 3.8-6.6 6.1-11.3 6.1-5.1 0-9.6-2.8-12.7-7.7-.9-1.3-.7-2.7.3-3.4 1-.7 2.5-.4 3.4 1 2.2 3.3 5.2 5.6 9 5.6zm6.9-12.3c0 1.8-1.4 3-3 3s-3-1.2-3-3 1.4-3 3-3 3 1.3 3 3z" class="st0"/><path id="path161" d="M78.3 22v3c1.5-2.1 3.8-3.6 7.2-3.6 4.3 0 9.3 3.6 9.3 11.3 0 8.1-4.8 12-9.8 12-2.6 0-5-1-6.8-3.5v10.6h-5.4V22zm0 11c0 4.5 2.6 6.9 5.5 6.9 2.8 0 5.6-2.2 5.6-6.9 0-4.6-2.8-6.8-5.6-6.8s-5.5 2.1-5.5 6.8z" class="st0"/><path id="path163" d="M104.3 22v3c1.5-2.1 3.8-3.6 7.2-3.6 4.3 0 9.3 3.6 9.3 11.3 0 8.1-4.8 12-9.8 12-2.6 0-5-1-6.8-3.5v10.6h-5.4V22zm0 11c0 4.5 2.6 6.9 5.5 6.9 2.8 0 5.6-2.2 5.6-6.9 0-4.6-2.8-6.8-5.6-6.8-2.9 0-5.5 2.1-5.5 6.8z" class="st0"/><path id="path165" d="M132.3 21.4c4.5 0 7.7 2.1 9.1 7.3l-4.9.8c-.1-2.6-1.7-3.5-4.1-3.5-1.8 0-3.2.8-3.2 2.1 0 1 .7 2 2.8 2.4l3.7.7c3.6.7 5.6 3.1 5.6 6.3 0 4.8-4.3 7.2-8.4 7.2-4.3 0-9.1-2.2-9.8-7.6l4.9-.8c.3 2.8 2 3.8 4.8 3.8 2.1 0 3.5-.8 3.5-2.1 0-1.2-.7-2.1-3-2.5l-3.4-.6c-3.6-.7-5.8-3.2-5.8-6.4.1-5 4.6-7.1 8.2-7.1z" class="st0"/></svg>`,
    heart: `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img"
        class="iconify iconify--noto" preserveAspectRatio="xMidYMid meet"
        fill="#000000" style="width: 17px; margin-right: 8px;">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round"
            stroke-linejoin="round">
        </g>
        <g id="SVGRepo_iconCarrier">
            <path
                d="M93.99 8.97c-21.91 0-29.96 22.39-29.96 22.39s-7.94-22.39-30-22.39c-16.58 0-35.48 13.14-28.5 43.01c6.98 29.87 58.56 67.08 58.56 67.08s51.39-37.21 58.38-67.08c6.98-29.87-10.56-43.01-28.48-43.01z"
                fill="#f44336"> </path>
            <g fill="#c33">
                <path
                    d="M30.65 11.2c17.2 0 25.74 18.49 28.5 25.98c.39 1.07 1.88 1.1 2.33.06L64 31.35C60.45 20.01 50.69 8.97 34.03 8.97c-6.9 0-14.19 2.28-19.86 7.09c5.01-3.29 10.88-4.86 16.48-4.86z">
                </path>
                <path
                    d="M93.99 8.97c-5.29 0-10.11 1.15-13.87 3.47c2.64-1.02 5.91-1.24 9.15-1.24c16.21 0 30.72 12.29 24.17 40.7c-5.62 24.39-38.46 53.98-48.49 65.27c-.64.72-.86 1.88-.86 1.88s51.39-37.21 58.38-67.08c6.98-29.86-10.53-43-28.48-43z">
                </path>
            </g>
            <path
                d="M17.04 24.82c3.75-4.68 10.45-8.55 16.13-4.09c3.07 2.41 1.73 7.35-1.02 9.43c-4 3.04-7.48 4.87-9.92 9.63c-1.46 2.86-2.34 5.99-2.79 9.18c-.18 1.26-1.83 1.57-2.45.46c-4.22-7.48-5.42-17.78.05-24.61z"
                fill="#ff8a80"> </path>
            <path
                d="M77.16 34.66c-1.76 0-3-1.7-2.36-3.34c1.19-3.02 2.73-5.94 4.58-8.54c2.74-3.84 7.95-6.08 11.25-3.75c3.38 2.38 2.94 7.14.57 9.44c-5.09 4.93-11.51 6.19-14.04 6.19z"
                fill="#ff8a80"> </path>
        </g>
    </svg>`,
    secure_donation: `<svg fill="none" height="28" viewBox="0 0 28 28" width="28" style="color: #1bc31b"
        xmlns="http://www.w3.org/2000/svg"
        class="icon-fill shrink-0 font-size-28 text-green-80 me-2" aria-hidden="true">
        <g fill="currentColor">
            <path clip-rule="evenodd"
                d="m15.0393 2.44995c-.6707-.24772-1.4079-.24772-2.0786 0l-8.30715 3.06797c-.39274.14504-.65355.51939-.65355.93807v7.54411c0 3.6861 1.95965 6.6874 4.28911 8.8073 1.16017 1.0557 2.38789 1.8689 3.45309 2.4137 1.1081.5668 1.9145.779 2.2578.779s1.1497-.2122 2.2578-.779c1.0652-.5448 2.2929-1.358 3.4531-2.4137 2.3294-2.1199 4.2891-5.1212 4.2891-8.8073v-7.54411c0-.41868-.2608-.79303-.6536-.93807zm-2.7715-1.876139c1.1179-.412868 2.3465-.412868 3.4644 0l8.3071 3.067969c1.1783.43514 1.9607 1.55819 1.9607 2.81421v7.54411c0 4.4389-2.3618 7.9375-4.943 10.2865-1.2952 1.1786-2.6702 2.092-3.8885 2.7151-1.1754.6012-2.3332.9984-3.1685.9984s-1.9931-.3972-3.1685-.9984c-1.21831-.6231-2.59328-1.5365-3.88847-2.7151-2.58125-2.349-4.94303-5.8476-4.94303-10.2865v-7.54411c0-1.25602.78243-2.37907 1.96066-2.81421z"
                fill-rule="evenodd"></path>
            <path
                d="m18.2906 11.75h-.2535v-1.1855c0-2.19278-1.7415-4.02451-3.9182-4.06361-.0595-.00107-.1783-.00107-.2378 0-2.1767.0391-3.91819 1.87083-3.91819 4.06361v1.1855h-.25354c-.39069 0-.70937.4028-.70937.9003v5.9463c0 .4969.31868.9035.7094.9035h8.5812c.3907 0 .7094-.4066.7094-.9035v-5.9463c0-.4974-.3187-.9003-.7094-.9003zm-3.4867 3.8674v1.7967c0 .2058-.1723.3799-.3784.3799h-.8509c-.2061 0-.3785-.1741-.3785-.3799v-1.7967c-.1999-.1966-.3162-.4684-.3162-.7691 0-.5698.4408-1.0594 1.0013-1.082.0594-.0024.1783-.0024.2377 0 .5605.0226 1.0013.5122 1.0013 1.082 0 .3007-.1164.5725-.3163.7691zm1.5623-3.8674h-4.7323v-1.1855c0-1.30621 1.0623-2.38623 2.3661-2.38623s2.3662 1.08002 2.3662 2.38623z">
            </path>
        </g>
    </svg>`,
    aborted: `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-x"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>`,
    cancelled: `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-x"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>`,
    failed: `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-x"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>`,
    expired: `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-x"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>`,
    authorized: `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-focus-auto"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 8v-2a2 2 0 0 1 2 -2h2" /><path d="M4 16v2a2 2 0 0 0 2 2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M16 20h2a2 2 0 0 0 2 -2v-2" /><path d="M10 15v-4a2 2 0 1 1 4 0v4" /><path d="M10 13h4" /></svg>`,
};

function getOrderIcon(status) {
    return icons[status] || `Logo not found`;
}

module.exports = getOrderIcon;
