
const generateSearchQuery = function(req, project) {
    const search = req.query.search || '';
    const fieldFilters = {};

    project.fields.forEach(field => {
        if (req.query[field.name]) {
            fieldFilters[field.name] = req.query[field.name];
        }
    });

    const stringFields = project.fields.filter(field => /string|boolean|image|file|dropdown/i.test(field.type)).map(field => ({ [field.name]: new RegExp(search, 'i') }));
    const numberFields = project.fields.filter(field => field.type === 'number');
    const dateFields = project.fields.filter(field => field.type === 'date');

    let searchQuery = {};

    if (Object.keys(fieldFilters).length > 0) {
        Object.assign(searchQuery, fieldFilters);
    }

    if (search) {
        const searchConditions = [];

        if (stringFields.length > 0) {
            searchConditions.push({ $or: stringFields });
        }

        const searchAsNumber = parseFloat(search);
        if (!isNaN(searchAsNumber)) {
            searchConditions.push({
                $or: numberFields.map(field => ({ [field.name]: searchAsNumber }))
            });
        }

        const searchAsDate = new Date(search);
        if (!isNaN(searchAsDate.getTime())) {
            searchConditions.push({
                $or: dateFields.map(field => ({ [field.name]: searchAsDate }))
            });
        }

        if (searchConditions.length > 0) {
            searchQuery.$or = searchConditions;
        }
    }

    return { searchQuery, fieldFilters };
};

module.exports = { generateSearchQuery };