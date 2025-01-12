const Project = require("../models/Project");
const Subscription = require("../models/Subscription");
const {createDynamicModel} = require("../models/createDynamicModel");


exports.stepOnePage = async(req,res) => {

    const myProjects = await Promise.all(
        req.session.user.projects.map(val => 
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
    
    return res.render('onboarding', {
        data: {
            activeMenu: "onboarding",
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            showStep: 'one',
            projects: myProjects.filter(val => val != null)
        }
    });

};

exports.stepOnePartial = async(req,res) => {
    const myProjects = await Promise.all(
        req.session.user.projects.map(val => 
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
    
    return res.render('partials/onboardingStepOne', {
        layout: false,
        data: {
            projects: myProjects.filter(val => val != null)
        }
    }); 
}

exports.stepTwoPage = async(req,res) => {
    const project = await Project.findOne({slug: req.params.slug});
    if (!project) res.status(404).send({message: 'No project found!'});

    const model = await createDynamicModel(project.slug);
    const entries = await model.find({isSubsubscribed: false});

    return res.render('onboarding', {
        data: {
            activeMenu: "onboarding",
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            showStep: 'two',
            project,
            entries,
        }
    }); 
};

exports.stepTwoPartial = async(req,res) => {
    const project = await Project.findOne({slug: req.params.slug});
    if (!project) res.status(404).send({message: 'No project found!'});

    const model = await createDynamicModel(project.slug);
    const entries = await model.find({isSubsubscribed: false});

    return res.render('partials/onboardingStepTwo', {
        layout: false,
        data: {
            project,
            entries,
        }
    }); 
};

exports.stepThreePage = async(req,res) => {
    return res.render('onboarding', {
        data: {
            activeMenu: "onboarding",
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            showStep: 'three'
        }
    }); 
};

exports.stepThreePartial = async(req,res) => {
    return res.render('partials/onboardingStepThree', {
        layout: false,
        data: {
            activeMenu: "onboarding",
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            showStep: 'three'
        }
    }); 
}

exports.stepFourPage = async(req,res) => {
    return res.render('onboarding', {
        data: {
            activeMenu: "onboarding",
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            showStep: 'four'
        }
    }); 
};

exports.stepFourPartial = async(req,res) => {
    return res.render('partials/onboardingStepFour', {
        layout: false,
        data: {
            activeMenu: "onboarding",
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            showStep: 'three'
        }
    }); 
}
