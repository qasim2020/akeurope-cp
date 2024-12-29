function toKebabCase(str) {
    return str
        .toLowerCase()                // Convert entire string to lowercase
        .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric characters with hyphens
        .replace(/(^-|-$)/g, '');     // Remove leading or trailing hyphens if any
}


module.exports = { toKebabCase }