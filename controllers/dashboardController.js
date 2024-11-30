const Project = require("../models/Project");
const Subscription = require("../models/Subscription");
const {createDynamicModel} = require("../models/createDynamicModel");

exports.dashboard = async (req, res) => {
    
    const myProjects = await Promise.all(
        req.session.customer.projects.map(val => 
            Project.findOne({ slug: val, status: 'active' }).lean()
        )
    );
    
    await Promise.all(
        myProjects.map(async project => {
            const model = await createDynamicModel(project.slug);
            project.entryCount = await model.countDocuments();
            project.entryPaid = await Subscription.countDocuments({projectId: project._id});
        })
    );
    
    return res.render('dashboard', {
        layout: 'dashboard',
        data: {
            activeMenu: "dashboard",
            userName: req.session.customer.name,
            userRole: req.session.customer.role.charAt(0).toUpperCase() + req.session.customer.role.slice(1),
            projects: myProjects.filter(val => val != null)
        }
    });
};

