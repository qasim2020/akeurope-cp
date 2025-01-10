const letterIcons = {
    a: `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-letter-a-small"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 16v-6a2 2 0 1 1 4 0v6" /><path d="M10 13h4" /></svg>`,
    p: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icon-tabler-letter-p-small"> <path stroke="none" d="M0 0h24v24H0z" fill="none"/> <path d="M10 12h2a2 2 0 1 0 0 -4h-2v8" /> </svg>`,
    n: `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-letter-n-small"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 16v-8l4 8v-8" /></svg>`,
    i: `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-letter-i-small"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 8v8" /></svg>`,
    s: `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-letter-s-small"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 15a1 1 0 0 0 1 1h2a1 1 0 0 0 1 -1v-2a1 1 0 0 0 -1 -1h-2a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1" /></svg>`,
    o: `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-letter-o-small"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 8a2 2 0 0 1 2 2v4a2 2 0 1 1 -4 0v-4a2 2 0 0 1 2 -2z" /></svg>`
};

function getLetterIcon(letter) {
    const lowerLetter = letter.toLowerCase();
    return letterIcons[lowerLetter] || `<svg></svg>`;
}

module.exports = getLetterIcon;
