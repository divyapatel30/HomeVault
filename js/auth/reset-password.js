import {
    verifyPasswordResetCode,
    confirmPasswordReset
} from "firebase/auth";

import { auth } from "../firebase/firebase.js";


/* =========================================================
   ELEMENTS
========================================================= */

const resetPasswordForm =
    document.getElementById("resetPasswordForm");

const newPassword =
    document.getElementById("newPassword");

const confirmPassword =
    document.getElementById("confirmPassword");

const resetPasswordButton =
    document.getElementById("resetPasswordButton");

const resetMessage =
    document.getElementById("resetMessage");


/* =========================================================
   MODAL ELEMENTS
========================================================= */

const authModal =
    document.getElementById("authModal");

const authModalIcon =
    document.getElementById("authModalIcon");

const authModalTitle =
    document.getElementById("authModalTitle");

const authModalText =
    document.getElementById("authModalText");


/* =========================================================
   GET RESET CODE FROM URL
========================================================= */

const urlParams =
    new URLSearchParams(window.location.search);

const mode =
    urlParams.get("mode");

const actionCode =
    urlParams.get("oobCode");


/* =========================================================
   MODAL FUNCTIONS
========================================================= */

function showModal(title, text) {

    authModalTitle.textContent = title;

    authModalText.textContent = text;

    authModal.classList.add("active");

    authModal.setAttribute(
        "aria-hidden",
        "false"
    );

}


function hideModal() {

    authModal.classList.remove("active");

    authModal.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(message) {

    resetMessage.textContent = message;

    resetMessage.hidden = false;

}


/* =========================================================
   VERIFY RESET LINK
========================================================= */

async function verifyResetLink() {

    /*
       Firebase reset links contain:

       ?mode=resetPassword
       &oobCode=XXXXXXXX

       We need the oobCode to verify
       that the password-reset link is valid.
    */

    if (
        mode !== "resetPassword" ||
        !actionCode
    ) {

        showMessage(
            "This password reset link is invalid or incomplete."
        );

        resetPasswordButton.disabled = true;

        return;

    }


    try {

        /*
           Firebase checks whether the reset
           code is valid and not expired.
        */

        await verifyPasswordResetCode(
            auth,
            actionCode
        );

        console.log(
            "Password reset link verified successfully."
        );


    } catch (error) {

        console.error(
            "Password reset verification error:",
            error
        );


        showMessage(
            "This password reset link is invalid or has expired. Please request a new reset link."
        );


        resetPasswordButton.disabled = true;

    }

}


/* =========================================================
   RESET PASSWORD
========================================================= */

resetPasswordForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const password =
            newPassword.value;

        const confirm =
            confirmPassword.value;


        /* Clear previous message */

        resetMessage.hidden = true;

        resetMessage.textContent = "";


        /* =================================================
           VALIDATE PASSWORD
        ================================================= */

        if (password.length < 6) {

            showMessage(
                "Password must be at least 6 characters long."
            );

            newPassword.focus();

            return;

        }


        if (password !== confirm) {

            showMessage(
                "Passwords do not match."
            );

            confirmPassword.focus();

            return;

        }


        /* =================================================
           DISABLE BUTTON
        ================================================= */

        resetPasswordButton.disabled = true;

        resetPasswordButton.innerHTML =
            `<span>Updating...</span><span>...</span>`;


        try {

            /*
               Firebase changes the user's password.
            */

            await confirmPasswordReset(
                auth,
                actionCode,
                password
            );


            /* =================================================
               SUCCESS
            ================================================= */

            showModal(
                "Password Reset Successful",
                "Your HomeVault password has been updated successfully."
            );


            /*
               Give the user enough time to see
               the success message, then return
               to Login.
            */

            setTimeout(() => {

                window.location.href =
                    "login.html";

            }, 2200);


        } catch (error) {

            console.error(
                "Password reset error:",
                error
            );


            resetPasswordButton.disabled = false;

            resetPasswordButton.innerHTML =
                `<span>Reset Password</span><span>→</span>`;


            /* =================================================
               ERROR HANDLING
            ================================================= */

            if (
                error.code ===
                "auth/expired-action-code"
            ) {

                showMessage(
                    "This password reset link has expired. Please request a new one."
                );

            }

            else if (
                error.code ===
                "auth/invalid-action-code"
            ) {

                showMessage(
                    "This password reset link is invalid or has already been used."
                );

            }

            else if (
                error.code ===
                "auth/weak-password"
            ) {

                showMessage(
                    "This password is too weak. Please choose a stronger password."
                );

            }

            else {

                showMessage(
                    "Something went wrong while resetting your password. Please try again."
                );

            }

        }

    }
);


/* =========================================================
   CHECK RESET LINK WHEN PAGE OPENS
========================================================= */

verifyResetLink();