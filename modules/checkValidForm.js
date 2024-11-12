function isValidName(name) {
    // Check if name contains only letters and spaces and is at least three characters long
    const nameRegex = /^[A-Za-z\s]{3,}$/;
    return nameRegex.test(name);
  }
  
function isValidEmail(email) {
    // Basic email pattern check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
  
function isStrongPassword(password) {
    // Check for minimum 8 characters, at least one uppercase letter, one lowercase letter, one number, and one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return passwordRegex.test(password);
}

module.exports = {isValidEmail, isValidName, isStrongPassword};