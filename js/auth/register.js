import {
    auth,
    db,
    getAuthActionCodeSettings
} from "../firebase/firebase.js";

import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut
} from "firebase/auth";

import {
    doc,
    setDoc,
    serverTimestamp
} from "firebase/firestore";


const registerForm =
    document.getElementById("registerForm");

const message =
    document.getElementById("message");


/* =========================================================
   REGISTER
========================================================= */

registerForm.addEventListener("submit", async (event) => {

    event.preventDefault();


    const name =
        document.getElementById("name").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;


    /* -------------------------
       Validation
    ------------------------- */

    if (!name) {

        showError(
            "Please enter your full name.",
            "Your name is required to create an account."
        );

        return;
    }


    if (!email) {

        showError(
            "Email address required",
            "Please enter your email address."
        );

        return;
    }


    if (password.length < 6) {

        showError(
            "Password is too short",
            "Password must be at least 6 characters."
        );

        return;
    }


    if (password !== confirmPassword) {

        showError(
            "Passwords do not match",
            "Please make sure both passwords are the same."
        );

        return;
    }


    /* -------------------------
       Show loading popup
    ------------------------- */

    setLoading(true);


    try {

        /* -------------------------
           Create Firebase account
        ------------------------- */

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            userCredential.user;


        /* -------------------------
           Store user profile
        ------------------------- */

        await setDoc(
            doc(db, "users", user.uid),
            {
                uid: user.uid,
                name: name,
                email: email,
                createdAt: serverTimestamp()
            }
        );


        /* -------------------------
           Send verification email
        ------------------------- */

        await sendEmailVerification(
            user,
            getAuthActionCodeSettings()
        );


        /* -------------------------
           Verification popup
        ------------------------- */

        showSuccess(
            "Verify your email",
            "A verification link has been sent to your email. Please verify your email before logging in."
        );


        /* -------------------------
           Sign out newly created user
        ------------------------- */

        setTimeout(async () => {

            await signOut(auth);

            window.location.href =
                "./login.html";

        }, 2500);


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );


        /*
         * IMPORTANT:
         * First reset the Create Account button
         * and close the loading state.
         *
         * Then show the error popup.
         *
         * Otherwise setLoading(false) would
         * immediately hide the error popup.
         */

        setLoading(false);

        handleFirebaseError(error);

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
   CREATE ERROR OK BUTTON
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


        button.className = "auth-modal-ok";

        button.addEventListener(
            "click",
            () => {

                hideModal();

            }
        );


        modalBox.appendChild(button);

    }


    return button;

}


/* =========================================================
   SHOW LOADING
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
        "Creating your account...";


    text.textContent =
        "Please wait while we securely create your account.";


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
   SHOW SUCCESS
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
   SHOW ERROR
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


    const errorButton =
        document.getElementById(
            "authModalOkButton"
        );


    if (errorButton) {

        errorButton.style.display =
            "none";

    }

}


/* =========================================================
   BUTTON LOADING STATE
========================================================= */

function setLoading(isLoading) {

    const button =
        registerForm.querySelector(
            "button[type='submit']"
        );


    if (isLoading) {

        button.disabled =
            true;


        button.innerHTML =
            "<span>Creating Account...</span>";


        showLoading();

    } else {

        button.disabled =
            false;


        button.innerHTML =
            "<span>Create Account</span>" +
            "<span class='submit-arrow'>→</span>";


        /*
         * IMPORTANT:
         *
         * We don't automatically hide
         * an error here anymore.
         *
         * The error popup is controlled
         * by showError() and the OK button.
         */

    }

}


/* =========================================================
   FIREBASE ERROR HANDLING
========================================================= */

function handleFirebaseError(error) {

    switch (error.code) {


        /* -------------------------
           Email already exists
        ------------------------- */

        case "auth/email-already-in-use":

            showError(
                "Account already exists",
                "An account with this email already exists. Please log in instead."
            );

            break;


        /* -------------------------
           Invalid email
        ------------------------- */

        case "auth/invalid-email":

            showError(
                "Invalid email address",
                "Please enter a valid email address."
            );

            break;


        /* -------------------------
           Weak password
        ------------------------- */

        case "auth/weak-password":

            showError(
                "Password is too weak",
                "Please choose a stronger password."
            );

            break;


        /* -------------------------
           Network error
        ------------------------- */

        case "auth/network-request-failed":

            showError(
                "Network error",
                "Please check your internet connection and try again."
            );

            break;


        /* -------------------------
           Default
        ------------------------- */

        default:

            showError(
                "Registration failed",
                "Something went wrong. Please try again."
            );

    }

}