import {
    auth,
    getAuthActionCodeSettings
} from "../firebase/firebase.js";

import {
    browserLocalPersistence,
    browserSessionPersistence,
    setPersistence,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification,
    signOut
} from "firebase/auth";


const loginForm =
    document.getElementById("loginForm");

const loginMessage =
    document.getElementById("loginMessage");

const rememberMe =
    document.getElementById("rememberMe");


/* =========================================================
   LOGIN
========================================================= */

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();


    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;


    const persistence =
        rememberMe.checked
            ? browserLocalPersistence
            : browserSessionPersistence;


    /* Show loading */

    setLoading(true);


    try {

        await setPersistence(
            auth,
            persistence
        );


        /* Firebase login */

        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            userCredential.user;


        console.log(
            "Logged in user:",
            user.uid
        );


        /* =================================================
           EMAIL VERIFICATION CHECK
        ================================================= */

        if (!user.emailVerified) {

            /*
             * User has successfully entered the
             * correct email and password, but has
             * not verified their email yet.
             */

            await signOut(auth);


            setLoading(false);


            showVerificationError(
                user.email
            );


            return;

        }


        /* =================================================
           VERIFIED USER
        ================================================= */

        showSuccess(
            "Login successful!",
            "Welcome back to HomeVault. Redirecting..."
        );


        /* Automatic redirect */

        setTimeout(() => {

            window.location.href =
                "./dashboard.html";

        }, 1800);


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        setLoading(false);

        handleLoginError(error);

    }

});


/* =========================================================
   MODAL FUNCTIONS
========================================================= */

function getModalElements() {

    return {

        modal:
            document.getElementById("authModal"),

        icon:
            document.getElementById("authModalIcon"),

        title:
            document.getElementById("authModalTitle"),

        text:
            document.getElementById("authModalText")

    };

}


/* =========================================================
   ERROR OK BUTTON
========================================================= */

function getErrorButton() {

    const {
        modal
    } = getModalElements();


    const modalBox =
        modal.querySelector(".auth-modal-box");


    let button =
        document.getElementById(
            "authModalOkButton"
        );


    if (!button) {

        button =
            document.createElement("button");


        button.id =
            "authModalOkButton";


        button.type =
            "button";


        button.textContent =
            "OK";

        button.className =
            "auth-modal-ok";


        button.addEventListener(
            "click",
            () => {

                hideModal();

            }
        );


        modalBox.appendChild(
            button
        );

    }


    return button;

}


/* =========================================================
   LOADING
========================================================= */

function showLoading() {

    const {
        modal,
        icon,
        title,
        text
    } = getModalElements();


    modal.className =
        "auth-modal active loading";


    icon.innerHTML =
        '<div class="modal-spinner"></div>';


    title.textContent =
        "Signing you in...";


    text.textContent =
        "Please wait while we verify your account.";


    const errorButton =
        document.getElementById(
            "authModalOkButton"
        );


    if (errorButton) {

        errorButton.style.display =
            "none";

    }


    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


/* =========================================================
   SUCCESS
========================================================= */

function showSuccess(
    titleText,
    messageText
) {

    const {
        modal,
        icon,
        title,
        text
    } = getModalElements();


    modal.className =
        "auth-modal active success";


    icon.innerHTML =
        "";


    title.textContent =
        titleText;


    text.textContent =
        messageText;


    const errorButton =
        document.getElementById(
            "authModalOkButton"
        );


    if (errorButton) {

        errorButton.style.display =
            "none";

    }


    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


/* =========================================================
   ERROR
========================================================= */

function showError(
    titleText,
    messageText
) {

    const {
        modal,
        icon,
        title,
        text
    } = getModalElements();


    modal.className =
        "auth-modal active error";


    icon.innerHTML =
        "";


    title.textContent =
        titleText;


    text.textContent =
        messageText;


    const errorButton =
        getErrorButton();


    errorButton.style.display =
        "inline-block";


    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


/* =========================================================
   EMAIL NOT VERIFIED
========================================================= */

function showVerificationError(
    email
) {

    const {
        modal,
        icon,
        title,
        text
    } = getModalElements();


    modal.className =
        "auth-modal active error";


    icon.innerHTML =
        "";


    title.textContent =
        "Email not verified";


    text.textContent =
    "Your email address has not been verified yet. Please verify your email to access the dashboard.";


    const modalBox =
        modal.querySelector(
            ".auth-modal-box"
        );


    let resendButton =
        document.getElementById(
            "resendVerificationButton"
        );


    if (!resendButton) {

        resendButton =
            document.createElement("button");


        resendButton.id =
            "resendVerificationButton";


        resendButton.type =
            "button";


        resendButton.textContent =
            "Resend Verification Email";


        /* Styling */

        resendButton.className =
    "auth-modal-action";

        modalBox.appendChild(
            resendButton
        );


        resendButton.addEventListener(
            "click",
            () => {

                resendVerificationEmail(
                    email
                );

            }
        );

    }


    resendButton.style.display =
        "inline-block";


    /* Get/create OK button */

    const errorButton =
        getErrorButton();


    errorButton.style.display =
        "inline-block";


    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


/* =========================================================
   RESEND VERIFICATION EMAIL
========================================================= */

let verificationCooldown =
    null;


async function resendVerificationEmail(
    email
) {

    const resendButton =
        document.getElementById(
            "resendVerificationButton"
        );


    if (
        !resendButton ||
        resendButton.disabled
    ) {

        return;

    }


    try {

        resendButton.disabled =
            true;


        resendButton.textContent =
            "Sending...";


        /*
         * Sign-in was already successful before
         * we detected that the email wasn't verified.
         *
         * We signed the user out for security/flow
         * reasons, so sign in again temporarily
         * in order to obtain the Firebase user object
         * required by sendEmailVerification().
         */

        const password =
            document.getElementById(
                "password"
            ).value;


        const credential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            credential.user;


        if (user.emailVerified) {

            await signOut(auth);


            showError(
                "Email already verified",
                "Your email is already verified. Please log in again."
            );


            return;

        }


        await sendEmailVerification(
            user,
            getAuthActionCodeSettings()
        );


        await signOut(auth);


        startVerificationCooldown();


    } catch (error) {

        console.error(
            "Verification email error:",
            error
        );


        resendButton.disabled =
            false;


        resendButton.textContent =
            "Resend Verification Email";


        if (
            error.code ===
            "auth/invalid-credential"
        ) {

            showError(
                "Unable to resend email",
                "Your login details could not be verified. Please enter your password again and try."
            );

        } else if (
            error.code ===
            "auth/too-many-requests"
        ) {

            showError(
                "Too many requests",
                "Please wait a while before requesting another verification email."
            );

        } else if (
            error.code ===
            "auth/network-request-failed"
        ) {

            showError(
                "Network error",
                "Please check your internet connection and try again."
            );

        } else {

            showError(
                "Unable to send email",
                "We couldn't send the verification email right now. Please try again later."
            );

        }

    }

}


/* =========================================================
   VERIFICATION COOLDOWN
========================================================= */

function startVerificationCooldown() {

    const resendButton =
        document.getElementById(
            "resendVerificationButton"
        );


    if (!resendButton) {

        return;

    }


    if (verificationCooldown) {

        clearInterval(
            verificationCooldown
        );

    }


    let secondsLeft =
        30;


    resendButton.disabled =
        true;


    resendButton.textContent =
        `Resend in ${secondsLeft}s`;


    verificationCooldown =
        setInterval(() => {

            secondsLeft--;


            if (secondsLeft <= 0) {

                clearInterval(
                    verificationCooldown
                );


                verificationCooldown =
                    null;


                resendButton.disabled =
                    false;


                resendButton.textContent =
                    "Resend Verification Email";


                return;

            }


            resendButton.textContent =
                `Resend in ${secondsLeft}s`;

        }, 1000);

}


/* =========================================================
   HIDE MODAL
========================================================= */

function hideModal() {

    const {
        modal
    } = getModalElements();


    modal.classList.remove(
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================================
   BUTTON LOADING STATE
========================================================= */

function setLoading(
    isLoading
) {

    const button =
        loginForm.querySelector(
            "button[type='submit']"
        );


    if (isLoading) {

        button.disabled =
            true;


        button.innerHTML =
            "<span>Signing In...</span>";


        showLoading();

    } else {

        button.disabled =
            false;


        button.innerHTML =
            "<span>Log In</span>" +
            "<span>→</span>";

        /*
         * Do NOT automatically hide
         * the modal here.
         *
         * Error messages need to remain
         * visible until the user dismisses them.
         */

    }

}


/* =========================================================
   LOGIN ERROR HANDLING
========================================================= */

function handleLoginError(
    error
) {

    switch (
        error.code
    ) {


        case "auth/invalid-credential":

            showError(
                "Login failed",
                "Incorrect email or password."
            );

            break;


        case "auth/user-not-found":

            showError(
                "Account not found",
                "No account was found with this email."
            );

            break;


        case "auth/wrong-password":

            showError(
                "Incorrect password",
                "Please check your password and try again."
            );

            break;


        case "auth/invalid-email":

            showError(
                "Invalid email address",
                "Please enter a valid email address."
            );

            break;


        case "auth/too-many-requests":

            showError(
                "Too many attempts",
                "Please wait a while before trying again."
            );

            break;


        case "auth/network-request-failed":

            showError(
                "Network error",
                "Please check your internet connection and try again."
            );

            break;


        default:

            showError(
                "Login failed",
                "Please check your details and try again."
            );

    }

}


/* =========================================================
   FORGOT PASSWORD
========================================================= */

const forgotPassword =
    document.getElementById(
        "forgotPassword"
    );

const forgotPasswordModal =
    document.getElementById(
        "forgotPasswordModal"
    );

const closeForgotPassword =
    document.getElementById(
        "closeForgotPassword"
    );

const cancelForgotPassword =
    document.getElementById(
        "cancelForgotPassword"
    );

const doneForgotPassword =
    document.getElementById(
        "doneForgotPassword"
    );

const sendResetLink =
    document.getElementById(
        "sendResetLink"
    );

const resendResetLink =
    document.getElementById(
        "resendResetLink"
    );

const resetEmail =
    document.getElementById(
        "resetEmail"
    );

const resetEmailDisplay =
    document.getElementById(
        "resetEmailDisplay"
    );

const resetEmailError =
    document.getElementById(
        "resetEmailError"
    );

const forgotRequestSection =
    document.getElementById(
        "forgotRequestSection"
    );

const forgotSuccessSection =
    document.getElementById(
        "forgotSuccessSection"
    );

const resendCountdown =
    document.getElementById(
        "resendCountdown"
    );


let resetEmailValue =
    "";

let resendTimer =
    null;


/* =========================================================
   OPEN FORGOT PASSWORD POPUP
========================================================= */

forgotPassword.addEventListener(
    "click",
    function (event) {

        event.preventDefault();


        forgotPasswordModal.classList.add(
            "active"
        );


        forgotPasswordModal.setAttribute(
            "aria-hidden",
            "false"
        );


        forgotRequestSection.style.display =
            "block";


        forgotSuccessSection.classList.remove(
            "active"
        );


        resetEmailError.textContent =
            "";


        resetEmail.focus();

    }
);


/* =========================================================
   CLOSE FORGOT PASSWORD POPUP
========================================================= */

function closeForgotModal() {

    forgotPasswordModal.classList.remove(
        "active"
    );


    forgotPasswordModal.setAttribute(
        "aria-hidden",
        "true"
    );


    resetEmailError.textContent =
        "";

}


closeForgotPassword.addEventListener(
    "click",
    closeForgotModal
);


cancelForgotPassword.addEventListener(
    "click",
    closeForgotModal
);


doneForgotPassword.addEventListener(
    "click",
    closeForgotModal
);


/* =========================================================
   EMAIL VALIDATION
========================================================= */

function isValidEmail(
    email
) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
    );

}


/* =========================================================
   SEND PASSWORD RESET EMAIL
========================================================= */

async function sendResetEmail() {

    const email =
        resetEmail.value.trim();


    resetEmailError.textContent =
        "";


    if (!email) {

        resetEmailError.textContent =
            "Please enter your email address.";


        resetEmail.focus();


        return;

    }


    if (!isValidEmail(email)) {

        resetEmailError.textContent =
            "Please enter a valid email address.";


        resetEmail.focus();


        return;

    }


    resetEmailValue =
        email;


    sendResetLink.disabled =
        true;


    sendResetLink.textContent =
        "Sending...";


    try {

        await sendPasswordResetEmail(
            auth,
            email,
            getAuthActionCodeSettings()
        );


        /* Show exact email entered */

        resetEmailDisplay.textContent =
            resetEmailValue;


        /* Change popup section */

        forgotRequestSection.style.display =
            "none";


        forgotSuccessSection.classList.add(
            "active"
        );


        /* Start 30 second resend timer */

        startResendCooldown();


    } catch (error) {

        console.error(
            "Password reset error:",
            error
        );


        if (
            error.code ===
            "auth/invalid-email"
        ) {

            resetEmailError.textContent =
                "Please enter a valid email address.";


            resetEmail.focus();

        } else if (
            error.code ===
            "auth/network-request-failed"
        ) {

            resetEmailError.textContent =
                "Network error. Please check your internet connection and try again.";

        } else {

            resetEmailError.textContent =
                "We couldn't process the request right now. Please check the email address and try again.";

        }

    } finally {

        sendResetLink.disabled =
            false;


        sendResetLink.textContent =
            "Send Reset Link";

    }

}


sendResetLink.addEventListener(
    "click",
    sendResetEmail
);


/* =========================================================
   PASSWORD RESET RESEND COOLDOWN
========================================================= */

function startResendCooldown() {

    if (resendTimer) {

        clearInterval(
            resendTimer
        );

    }


    let secondsLeft =
        30;


    resendResetLink.disabled =
        true;


    resendResetLink.textContent =
        `Resend in ${secondsLeft}s`;


    resendCountdown.textContent =
        "You can request another email after the countdown.";


    resendTimer =
        setInterval(() => {

            secondsLeft--;


            if (secondsLeft <= 0) {

                clearInterval(
                    resendTimer
                );


                resendTimer =
                    null;


                resendResetLink.disabled =
                    false;


                resendResetLink.textContent =
                    "Resend Reset Link";


                resendCountdown.textContent =
                    "";


                return;

            }


            resendResetLink.textContent =
                `Resend in ${secondsLeft}s`;

        }, 1000);

}


/* =========================================================
   RESEND PASSWORD RESET EMAIL
========================================================= */

resendResetLink.addEventListener(
    "click",
    async function () {

        /* Extra protection */

        if (
            resendResetLink.disabled
        ) {

            return;

        }


        if (!resetEmailValue) {

            forgotSuccessSection.classList.remove(
                "active"
            );


            forgotRequestSection.style.display =
                "block";


            resetEmail.focus();


            return;

        }


        resendResetLink.disabled =
            true;


        resendResetLink.textContent =
            "Sending...";


        try {

            await sendPasswordResetEmail(
                auth,
                resetEmailValue,
                getAuthActionCodeSettings()
            );


            /* Restart 30 second cooldown */

            startResendCooldown();


        } catch (error) {

            console.error(
                "Resend reset error:",
                error
            );


            resendResetLink.disabled =
                false;


            resendResetLink.textContent =
                "Resend Reset Link";


            resendCountdown.textContent =
                "We couldn't send the email. Please try again.";

        }

    }
);