import { auth } from "../firebase/firebase.js";

import {
    verifyPasswordResetCode,
    confirmPasswordReset,
    applyActionCode
} from "firebase/auth";


/* =========================================================
   ELEMENTS
========================================================= */

const loadingState =
    document.getElementById("loadingState");

const resetState =
    document.getElementById("resetState");

const resetSuccessState =
    document.getElementById("resetSuccessState");

const verifyState =
    document.getElementById("verifyState");

const verifySuccessState =
    document.getElementById("verifySuccessState");

const errorState =
    document.getElementById("errorState");

const errorTitle =
    document.getElementById("errorTitle");

const errorMessage =
    document.getElementById("errorMessage");

const resetPasswordForm =
    document.getElementById("resetPasswordForm");

const newPassword =
    document.getElementById("newPassword");

const confirmPassword =
    document.getElementById("confirmPassword");

const resetError =
    document.getElementById("resetError");

const resetPasswordButton =
    document.getElementById("resetPasswordButton");

const verifyEmailButton =
    document.getElementById("verifyEmailButton");


/* =========================================================
   URL PARAMETERS
========================================================= */

const urlParams =
    new URLSearchParams(
        window.location.search
    );

const mode =
    urlParams.get("mode");

const oobCode =
    urlParams.get("oobCode");

const testMode =
    urlParams.get("test");


/* =========================================================
   SHOW STATE
========================================================= */

function showState(state) {

    const states = [
        loadingState,
        resetState,
        resetSuccessState,
        verifyState,
        verifySuccessState,
        errorState
    ];

    states.forEach(item => {

        item.classList.remove("active");

    });

    state.classList.add("active");

}


/* =========================================================
   SHOW ERROR
========================================================= */

function showError(
    title,
    message
) {

    errorTitle.textContent =
        title;

    errorMessage.textContent =
        message;

    showState(errorState);

}


/* =========================================================
   PASSWORD TOGGLE
========================================================= */

document
    .querySelectorAll(".password-toggle")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const target =
                    document.getElementById(
                        button.dataset.target
                    );

                if (
                    target.type ===
                    "password"
                ) {

                    target.type =
                        "text";

                    button.textContent =
                        "Hide";

                } else {

                    target.type =
                        "password";

                    button.textContent =
                        "Show";

                }

            }
        );

    });


/* =========================================================
   INITIAL ACTION CHECK
========================================================= */

async function initializeAction() {


    /* =====================================================
       REAL FIREBASE ACTION
    ===================================================== */

    /*
     * Real Firebase action links must contain
     * both mode and oobCode.
     */

    if (!mode || !oobCode) {

        showError(
            "Invalid link",
            "This HomeVault link is incomplete or invalid."
        );

        return;

    }


    /* =====================================================
       PASSWORD RESET
    ===================================================== */

    if (mode === "resetPassword") {

        await initializePasswordReset();

        return;

    }


    /* =====================================================
       EMAIL VERIFICATION
    ===================================================== */

    if (mode === "verifyEmail") {

        await initializeEmailVerification();

        return;

    }


    /* =====================================================
       UNKNOWN ACTION
    ===================================================== */

    showError(
        "Unsupported action",
        "This HomeVault link is not supported."
    );

}


/* =========================================================
   PASSWORD RESET INITIALIZATION
========================================================= */

async function initializePasswordReset() {

    try {

        /*
         * Verify that the Firebase reset code is valid.
         */

        await verifyPasswordResetCode(
            auth,
            oobCode
        );


        /*
         * Code is valid.
         * Show password reset form.
         */

        showState(resetState);


    } catch (error) {

        console.error(
            "Password reset code error:",
            error
        );

        handleFirebaseActionError(
            error,
            "password reset"
        );

    }

}


/* =========================================================
   PASSWORD RESET
========================================================= */

resetPasswordForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        resetError.textContent = "";


        const password =
            newPassword.value;

        const confirm =
            confirmPassword.value;


        /* =================================================
           VALIDATION
        ================================================= */

        if (password.length < 6) {

            resetError.textContent =
                "Password must be at least 6 characters.";

            newPassword.focus();

            return;

        }


        if (password !== confirm) {

            resetError.textContent =
                "Passwords do not match.";

            confirmPassword.focus();

            return;

        }


        /* =================================================
           LOADING
        ================================================= */

        resetPasswordButton.disabled =
            true;

        resetPasswordButton.innerHTML =
            "Updating password...";


        try {

            /*
             * Firebase changes the user's password.
             */

            await confirmPasswordReset(
                auth,
                oobCode,
                password
            );


            /*
             * Password successfully changed.
             */

            showState(
                resetSuccessState
            );


        } catch (error) {

            console.error(
                "Password reset error:",
                error
            );

            handleFirebaseActionError(
                error,
                "password reset"
            );


        } finally {

            resetPasswordButton.disabled =
                false;

            resetPasswordButton.innerHTML =
                'Reset Password <span>→</span>';

        }

    }
);


/* =========================================================
   EMAIL VERIFICATION INITIALIZATION
========================================================= */

async function initializeEmailVerification() {

    /*
     * For the real Firebase flow, we first show the
     * verification confirmation screen.
     */

    showState(verifyState);

}


/* =========================================================
   VERIFY EMAIL
========================================================= */

verifyEmailButton.addEventListener(
    "click",
    async () => {

        verifyEmailButton.disabled =
            true;

        verifyEmailButton.innerHTML =
            "Confirming email...";


        try {

            /*
             * Firebase marks the user's email
             * address as verified.
             */

            await applyActionCode(
                auth,
                oobCode
            );


            /*
             * Email successfully verified.
             */

            showState(
                verifySuccessState
            );


        } catch (error) {

            console.error(
                "Email verification error:",
                error
            );

            handleFirebaseActionError(
                error,
                "email verification"
            );


        } finally {

            verifyEmailButton.disabled =
                false;

            verifyEmailButton.innerHTML =
                'Confirm Email Address <span>→</span>';

        }

    }
);


/* =========================================================
   FIREBASE ERROR HANDLING
========================================================= */

function handleFirebaseActionError(
    error,
    actionName
) {

    switch (error.code) {


        /* -----------------------------------------------
           EXPIRED LINK
        ----------------------------------------------- */

        case "auth/expired-action-code":

            showError(
                "Link expired",
                `This ${actionName} link has expired. Please request a new one.`
            );

            break;


        /* -----------------------------------------------
           INVALID LINK
        ----------------------------------------------- */

        case "auth/invalid-action-code":

            showError(
                "Invalid link",
                `This ${actionName} link is no longer valid. Please request a new one.`
            );

            break;


        /* -----------------------------------------------
           DISABLED ACCOUNT
        ----------------------------------------------- */

        case "auth/user-disabled":

            showError(
                "Account unavailable",
                "This HomeVault account has been disabled."
            );

            break;


        /* -----------------------------------------------
           USER NOT FOUND
        ----------------------------------------------- */

        case "auth/user-not-found":

            showError(
                "Account not found",
                "We couldn't find the HomeVault account associated with this link."
            );

            break;


        /* -----------------------------------------------
           NETWORK ERROR
        ----------------------------------------------- */

        case "auth/network-request-failed":

            showError(
                "Connection problem",
                "Please check your internet connection and try again."
            );

            break;


        /* -----------------------------------------------
           OTHER ERROR
        ----------------------------------------------- */

        default:

            showError(
                "Something went wrong",
                `We couldn't complete the ${actionName}. Please try again.`
            );

            break;

    }

}


/* =========================================================
   START ACTION HANDLER
========================================================= */

initializeAction();