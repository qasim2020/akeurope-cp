const Project = require("../models/Project");

const oneProject = async (req, res, next) => {
    let oneProject = await Project.findOne({slug: req.params.slug}).lean();
    req.oneProject = oneProject;
    next();
};

const allProjects = async (req, res, next) => {
    let allProjects = await Project.find().lean();
    req.allProjects = allProjects;
    next();
};

module.exports = { allProjects, oneProject };