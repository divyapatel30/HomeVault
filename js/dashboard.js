/* =========================================================
   HOMEVAULT DASHBOARD
   ========================================================= */

import {
    auth,
    db
} from "./firebase/firebase.js";

import {
    documentStorageBucket,
    getSupabaseClient
} from "./supabase/supabase.js";

import {
    onAuthStateChanged,
    signOut
} from "firebase/auth";

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    getDocs,
    collection,
    query,
    where,
    arrayUnion,
    arrayRemove,
    runTransaction,
    serverTimestamp,
    orderBy,
    writeBatch
} from "firebase/firestore";



/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const welcomeName =
    document.getElementById("welcomeName");

const profileName =
    document.getElementById("profileName");

const profileAvatar =
    document.getElementById("profileAvatar");

const dropdownName =
    document.getElementById("dropdownName");

const dropdownEmail =
    document.getElementById("dropdownEmail");

const profileButton =
    document.getElementById("profileButton");

const profileDropdown =
    document.getElementById("profileDropdown");

const logoutBtn =
    document.getElementById("logoutBtn");

const confirmLogoutBtn =
    document.getElementById("confirmLogoutBtn");

const totalDocuments =
    document.getElementById("totalDocuments");

const expiringDocuments =
    document.getElementById("expiringDocuments");

const sharedDocuments =
    document.getElementById("sharedDocuments");

const recentDocuments =
    document.getElementById("recentDocuments");

const storageUsed =
    document.getElementById("storageUsed");

const storageProgress =
    document.getElementById("storageProgress");

const storagePercent =
    document.getElementById("storagePercent");

const expiryBadge =
    document.getElementById("expiryBadge");

const familyBanner =
    document.getElementById("familyBanner");

const familyName =
    document.getElementById("familyName");

const familyRole =
    document.getElementById("familyRole");

const familyCodeDisplay =
    document.getElementById("familyCodeDisplay");

const noFamilyNav =
    document.getElementById("noFamilyNav");

const hasFamilyNav =
    document.getElementById("hasFamilyNav");

const sharedStatCard =
    document.getElementById("sharedStatCard");

const allDocumentsList =
    document.getElementById("allDocumentsList");

const expiryDocumentsList =
    document.getElementById("expiryDocumentsList");

const trashDocumentsList =
    document.getElementById("trashDocumentsList");

const sharedByMeDocumentsList =
    document.getElementById("sharedByMeDocumentsList");

const sharedDocumentsList =
    document.getElementById("sharedDocumentsList");

const familyMembersList =
    document.getElementById("familyMembersList");

const documentSearch =
    document.getElementById("documentSearch");

const sidebar =
    document.querySelector(".sidebar");

let userDocuments = [];



/* =========================================================
   MODALS
   ========================================================= */

const familyModal =
    document.getElementById("familyModal");

const createFamilyModal =
    document.getElementById("createFamilyModal");

const joinFamilyModal =
    document.getElementById("joinFamilyModal");

const leaveFamilyModal =
    document.getElementById("leaveFamilyModal");

const transferFamilyOwnershipModal =
    document.getElementById("transferFamilyOwnershipModal");

const logoutModal =
    document.getElementById("logoutModal");



/* =========================================================
   CURRENT USER DATA
   ========================================================= */

let currentUser = null;
let currentUserData = null;
let currentFamilyData = null;
let currentFamilyMembers = [];
let familyAccessWarningShown = false;
let pendingOwnershipTransfer = null;
let pendingFamilyMemberRemoval = null;
let pendingRemovalNotifications = [];
const modalCloseTimers = new Map();


function showDashboardView(viewName) {

    const views =
        document.querySelectorAll("[data-view-panel]");

    if (!document.querySelector(`[data-view-panel="${viewName}"]`)) {

        viewName = "dashboard";

    }


    views.forEach(
        view => {

            view.classList.toggle(
                "hidden",
                view.dataset.viewPanel !== viewName
            );

        }
    );


    document
        .querySelectorAll(".sidebar-nav [data-view]")
        .forEach(
            link => {

                const isCurrent =
                    link.dataset.view === viewName;

                link.classList.toggle("active", isCurrent);

                if (isCurrent) {
                    link.setAttribute("aria-current", "page");
                } else {
                    link.removeAttribute("aria-current");
                }

            }
        );


    const pageTitle = {
        dashboard: "Dashboard",
        documents: "My Documents",
        expiry: "Expiry Alerts",
        trash: "Trash",
        shared: "Shared With Me",
        members: "Family Members",
        settings: "Settings"
    }[viewName] || "Dashboard";

    document.title = `${pageTitle} | HomeVault`;

}


document.addEventListener(
    "click",
    event => {

        const viewLink =
            event.target.closest("[data-view]");

        if (!viewLink) {
            return;
        }


        const viewName =
            viewLink.dataset.view;

        if (!document.querySelector(`[data-view-panel="${viewName}"]`)) {
            return;
        }


        event.preventDefault();
        history.pushState(null, "", `#${viewName}`);
        showDashboardView(viewName);
        profileDropdown.classList.add("hidden");

        if (sidebar.contains(viewLink)) {
            closeMobileMenu();
        }

    }
);


window.addEventListener(
    "popstate",
    () => showDashboardView(window.location.hash.slice(1) || "dashboard")
);


showDashboardView(
    window.location.hash.slice(1) || "dashboard"
);



/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "./login.html";

        return;
    }


    currentUser = user;


    try {

        await loadDashboard();

    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

    }

});



/* =========================================================
   LOAD DASHBOARD
   ========================================================= */

async function loadDashboard() {

    const userRef =
        doc(db, "users", currentUser.uid);

    const userSnapshot =
        await getDoc(userRef);


    if (userSnapshot.exists()) {

        currentUserData =
            userSnapshot.data();

    } else {

        currentUserData = {};

    }


    updateProfileUI();

    await loadFamily();

    await loadDocuments();

    await loadRemovalNotifications();

}



/* =========================================================
   PROFILE
   ========================================================= */

function updateProfileUI() {

    const savedName =
        (currentUserData.name || currentUser.displayName || "").trim();

    const nameParts =
        savedName.split(/\s+/).filter(Boolean);

    const firstName =
        currentUserData.firstName ||
        nameParts[0] ||
        currentUser.email?.split("@")[0] ||
        "User";

    const lastName =
        currentUserData.lastName ||
        nameParts.slice(1).join(" ");


    const fullName =
        `${firstName} ${lastName}`.trim();


    welcomeName.textContent =
        firstName;

    profileName.textContent =
        fullName;

    dropdownName.textContent =
        fullName;

    dropdownEmail.textContent =
        currentUser.email ||
        "";

    document.getElementById("settingsFirstName").value =
        firstName;

    document.getElementById("settingsLastName").value =
        lastName;

    document.getElementById("settingsEmail").value =
        currentUser.email || "";


    const initials =
        getInitials(
            firstName,
            lastName
        );


    profileAvatar.textContent =
        initials;

}


document
    .getElementById("settingsForm")
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const firstName =
                document.getElementById("settingsFirstName").value.trim();

            const lastName =
                document.getElementById("settingsLastName").value.trim();

            const name =
                `${firstName} ${lastName}`.trim();

            const saveButton =
                document.getElementById("saveSettingsBtn");

            const message =
                document.getElementById("settingsMessage");

            if (!firstName) {

                message.textContent = "First name is required.";
                return;

            }


            saveButton.disabled = true;
            message.textContent = "Saving changes...";


            try {

                await setDoc(
                    doc(db, "users", currentUser.uid),
                    { firstName, lastName, name },
                    { merge: true }
                );

                currentUserData = {
                    ...currentUserData,
                    firstName,
                    lastName,
                    name
                };

                updateProfileUI();
                message.textContent = "Your profile has been updated.";

            } catch (error) {

                console.error("Profile update error:", error);
                message.textContent = "Couldn't save your changes. Please try again.";

            } finally {

                saveButton.disabled = false;

            }

        }
    );



/* =========================================================
   INITIALS
   ========================================================= */

function getInitials(
    firstName,
    lastName
) {

    const first =
        firstName?.charAt(0) || "";

    const last =
        lastName?.charAt(0) || "";


    return (
        first + last
    ).toUpperCase();

}



/* =========================================================
   FAMILY
   ========================================================= */

async function callSupabaseAccessRpc(functionName, parameters) {
    const { error } =
        await getSupabaseClient().rpc(functionName, parameters);

    if (error) {
        throw new Error(error.message);
    }
}


async function syncSupabaseFamilyMemberships(familyId, memberIds) {
    await callSupabaseAccessRpc(
        "sync_family_members",
        {
            p_family_id: familyId,
            p_member_ids: [...new Set(memberIds)]
        }
    );
}

async function syncSupabaseFamilyMembershipsFromFirestore(familyId) {
    const { error } =
        await getSupabaseClient()
            .functions
            .invoke(
                "sync-family-membership",
                {
                    body: { familyId }
                }
            );

    if (error) {
        throw new Error(
            `Secure family sharing could not be synchronized: ${error.message}`
        );
    }
}

async function revokeOrphanedFamilyDocuments(familyId, memberIds) {
    const sharedDocumentsQuery =
        query(
            collection(db, "documents"),
            where("familyId", "==", familyId),
            where("accessLevel", "in", ["family", "selected"]),
            where("sharedWithFamily", "==", true)
        );

    const sharedDocumentsSnapshot =
        await getDocs(sharedDocumentsQuery);
    const activeMemberIds =
        new Set(memberIds);
    const orphanedDocuments =
        sharedDocumentsSnapshot.docs.filter(
            documentSnapshot =>
                !activeMemberIds.has(documentSnapshot.data().ownerId)
        );

    for (let index = 0; index < orphanedDocuments.length; index += 500) {
        const batch =
            writeBatch(db);

        orphanedDocuments
            .slice(index, index + 500)
            .forEach(documentSnapshot => {
                batch.update(documentSnapshot.ref, {
                    accessLevel: "private",
                    familyId: null,
                    sharedWithMemberIds: [],
                    sharedWithFamily: false,
                    updatedAt: serverTimestamp()
                });
            });

        await batch.commit();
    }
}


function showFamilyAccessSetupWarning(error) {
    console.error("Unable to synchronize Supabase family access:", error);

    if (familyAccessWarningShown) {
        return;
    }

    familyAccessWarningShown = true;
    showMessageModal(
        "Family membership is saved in Firebase, but secure file-sharing access could not be synchronized. Confirm supabase/family-sharing.sql has been applied and the sync-family-membership Edge Function is deployed. Details: " +
            (error instanceof Error ? error.message : String(error)),
        "Family file sharing needs setup"
    );
}


function getSharedDocumentRecipients(accessLevel, familyId, selectedMemberIds = []) {
    if (
        !familyId ||
        familyId !== currentUserData?.familyId ||
        !currentFamilyData
    ) {
        return [];
    }

    const familyMemberIds =
        new Set(
            currentFamilyMembers
                .filter(member => member.id !== currentUser?.uid)
                .map(member => member.id)
        );

    if (accessLevel === "family") {
        return [...familyMemberIds];
    }

    if (accessLevel === "selected") {
        return [...new Set(selectedMemberIds)]
            .filter(memberId => familyMemberIds.has(memberId));
    }

    return [];
}


async function syncSupabaseDocumentAccess(
    documentRecord,
    accessLevel,
    familyId,
    selectedMemberIds = []
) {
    if (!documentRecord.storagePath) {
        return false;
    }

    const recipientIds =
        getSharedDocumentRecipients(
            accessLevel,
            familyId,
            selectedMemberIds
        );

    try {
        await callSupabaseAccessRpc(
            "sync_document_access",
            {
                p_bucket_id:
                    documentRecord.storageBucket || documentStorageBucket,
                p_object_name: documentRecord.storagePath,
                p_family_id: recipientIds.length ? familyId : null,
                p_recipient_ids: recipientIds
            }
        );
    } catch (error) {
        if (
            recipientIds.length &&
            error instanceof Error &&
            error.message.includes("active members")
        ) {
            throw new Error(
                "Secure family membership could not be verified. Refresh the dashboard and try again. If the problem persists, contact support."
            );
        }

        throw error;
    }

    return true;
}


async function syncExistingSupabaseDocumentAccess(documentRecord) {
    if (documentRecord.isDeleted === true) {
        return syncSupabaseDocumentAccess(
            documentRecord,
            "private",
            null
        );
    }

    return syncSupabaseDocumentAccess(
        documentRecord,
        documentRecord.accessLevel || "private",
        documentRecord.familyId,
        documentRecord.sharedWithMemberIds || []
    );
}


async function loadFamily() {

    const familyId =
        currentUserData.familyId;


    /* -----------------------------------------
       NO FAMILY
    ----------------------------------------- */

    if (!familyId) {

        currentFamilyData = null;
        currentFamilyMembers = [];
        updateSelectedMembersPicker();
        document.getElementById("leaveFamilyActionLabel").textContent =
            "Leave Family";

        noFamilyNav.classList.remove(
            "hidden"
        );

        hasFamilyNav.classList.add(
            "hidden"
        );

        familyBanner.classList.add(
            "hidden"
        );

        sharedStatCard.classList.add(
            "hidden"
        );

        return;
    }



    /* -----------------------------------------
       FAMILY EXISTS
    ----------------------------------------- */

    const familyRef =
        doc(
            db,
            "families",
            familyId
        );


    const familySnapshot =
        await getDoc(familyRef);


    if (!familySnapshot.exists()) {

        /*
         * Family ID exists in the user document
         * but the family document no longer exists.
         */

        currentFamilyData = null;
        currentFamilyMembers = [];
        updateSelectedMembersPicker();
        document.getElementById("leaveFamilyActionLabel").textContent =
            "Leave Family";

        noFamilyNav.classList.remove(
            "hidden"
        );

        hasFamilyNav.classList.add(
            "hidden"
        );

        familyBanner.classList.add(
            "hidden"
        );

        sharedStatCard.classList.add(
            "hidden"
        );

        return;
    }


    currentFamilyData =
        familySnapshot.data();

    const isSoleFamilyOwner =
        currentFamilyData.ownerId === currentUser.uid &&
        currentFamilyData.members?.length === 1 &&
        currentFamilyData.members[0] === currentUser.uid;

    document.getElementById("leaveFamilyActionLabel").textContent =
        isSoleFamilyOwner
            ? "Delete Family"
            : "Leave Family";


    noFamilyNav.classList.add(
        "hidden"
    );

    hasFamilyNav.classList.remove(
        "hidden"
    );

    familyBanner.classList.remove(
        "hidden"
    );

    sharedStatCard.classList.remove(
        "hidden"
    );


    familyName.textContent =
        currentFamilyData.name ||
        "My Family";

    familyCodeDisplay.textContent =
        familyId;


    const role =
        currentUserData.familyRole ||
        "member";


    familyRole.textContent =
        role === "owner"
            ? "Family Owner"
            : "Family Member";

    await renderFamilyMembers();

}


async function renderFamilyMembers() {

    const memberIds =
        currentFamilyData?.members || [];

    const membersDescription =
        document.getElementById("membersDescription");

    if (!memberIds.length) {

        currentFamilyMembers = [];
        updateSelectedMembersPicker();

        familyMembersList.innerHTML = `
            <div class="view-empty">
                <h2>No family members found</h2>
                <p>Family members will appear here when they join.</p>
            </div>
        `;

        return;

    }


    try {

        const memberRecords =
            await Promise.all(
                memberIds.map(
                    async memberId => {

                        const memberSnapshot =
                            await getDoc(doc(db, "users", memberId));

                        return {
                            id: memberId,
                            ...(memberSnapshot.exists() ? memberSnapshot.data() : {})
                        };

                    }
                )
            );

        currentFamilyMembers = memberRecords;
        updateSelectedMembersPicker();

        membersDescription.textContent =
            `${currentFamilyData.name || "Your family"} · ${memberRecords.length} ${memberRecords.length === 1 ? "member" : "members"}`;

        familyMembersList.innerHTML =
            memberRecords.map(
                member => {

                    const email = member.email || "Family account";
                    const savedName = (member.name || "").trim();
                    const nameParts = savedName.split(/\s+/).filter(Boolean);
                    const emailName = email.includes("@")
                        ? email.slice(0, email.indexOf("@"))
                        : "";
                    const firstName =
                        member.firstName ||
                        nameParts[0] ||
                        emailName ||
                        "HomeVault";
                    const lastName =
                        member.lastName ||
                        nameParts.slice(1).join(" ");
                    const displayName =
                        savedName ||
                        `${firstName} ${lastName}`.trim();
                    const role = member.id === currentFamilyData.ownerId
                        ? "owner"
                        : "member";
                    const transferButton =
                        currentFamilyData.ownerId === currentUser.uid &&
                        member.id !== currentUser.uid
                            ? `<button type="button" class="secondary-button transfer-owner-button" data-transfer-owner-id="${escapeHTML(member.id)}" data-transfer-owner-name="${escapeHTML(displayName)}">Make owner</button>`
                            : "";
                    const removeButton =
                        currentFamilyData.ownerId === currentUser.uid &&
                        member.id !== currentUser.uid
                            ? `<button type="button" class="remove-family-member-button" data-remove-member-id="${escapeHTML(member.id)}" data-remove-member-name="${escapeHTML(displayName)}">Remove</button>`
                            : "";

                    return `
                        <article class="member-row">
                            <span class="member-avatar">${escapeHTML(getInitials(firstName, lastName) || "HV")}</span>
                            <span class="member-details">
                                <strong>${escapeHTML(displayName)}${member.id === currentUser.uid ? " (you)" : ""}</strong>
                                <small>${escapeHTML(email)}</small>
                            </span>
                            <span class="member-role">${role === "owner" ? "Owner" : "Member"}</span>
                            ${transferButton}
                            ${removeButton}
                        </article>
                    `;

                }
            ).join("");

        if (currentFamilyData.ownerId === currentUser.uid) {
            try {
                await syncSupabaseFamilyMemberships(
                    currentUserData.familyId,
                    memberIds
                );
            } catch (error) {
                showFamilyAccessSetupWarning(error);
            }

            try {
                await revokeOrphanedFamilyDocuments(
                    currentUserData.familyId,
                    memberIds
                );
            } catch (error) {
                console.error(
                    "Unable to revoke shared documents from removed family members:",
                    error
                );
                showMessageModal(
                    "Some documents shared by former family members could not be made private. Check that the latest Firestore rules are deployed, then refresh the dashboard. Details: " +
                        (error instanceof Error ? error.message : String(error)),
                    "Family document access could not be revoked"
                );
            }
        } else {
            try {
                await syncSupabaseFamilyMembershipsFromFirestore(
                    currentUserData.familyId
                );
            } catch (error) {
                showFamilyAccessSetupWarning(error);
            }
        }

    } catch (error) {

        console.error("Unable to load family members:", error);
        currentFamilyMembers = [];
        updateSelectedMembersPicker();

        familyMembersList.innerHTML = `
            <div class="view-empty">
                <h2>Family list unavailable</h2>
                <p>We couldn't load member details right now.</p>
            </div>
        `;

    }

}



/* =========================================================
   LOAD DOCUMENTS
   ========================================================= */

async function fetchSharedDocuments() {
    if (!currentUserData?.familyId) {
        return {
            documents: [],
            unavailable: false
        };
    }

    const documentsRef =
        collection(db, "documents");

    const familyQueries = [
        query(
            documentsRef,
            where("familyId", "==", currentUserData.familyId),
            where("accessLevel", "==", "family"),
            where("sharedWithFamily", "==", true),
            where("isDeleted", "==", false)
        ),
        query(
            documentsRef,
            where("familyId", "==", currentUserData.familyId),
            where("accessLevel", "==", "selected"),
            where("sharedWithFamily", "==", true),
            where("sharedWithMemberIds", "array-contains", currentUser.uid),
            where("isDeleted", "==", false)
        )
    ];

    const results =
        await Promise.allSettled(
            familyQueries.map(familyQuery => getDocs(familyQuery))
        );

    const documents = [];
    let unavailable = false;

    results.forEach(result => {
        if (result.status === "fulfilled") {
            result.value.docs.forEach(documentSnapshot => {
                documents.push({
                    id: documentSnapshot.id,
                    ...documentSnapshot.data()
                });
            });
        } else {
            unavailable = true;
            console.error(
                "Unable to load shared family documents:",
                result.reason
            );
        }
    });

    return {
        documents,
        unavailable
    };
}


async function loadDocuments() {

    /*
     * This expects:
     *
     * documents/{documentId}
     *
     * with fields such as:
     *
     * ownerId
     * fileName
     * category
     * expiryDate
     * createdAt
     * updatedAt
     * sharedWithFamily
     * fileSize
     */

    try {

        const documentsRef =
            collection(
                db,
                "documents"
            );


        const ownerQuery =
            query(
                documentsRef,
                where(
                    "ownerId",
                    "==",
                    currentUser.uid
                )
            );

        const ownerSnapshot =
            await getDocs(ownerQuery);

        const documentsById = new Map();

        ownerSnapshot.docs.forEach(documentSnapshot => {
            documentsById.set(documentSnapshot.id, {
                id: documentSnapshot.id,
                ...documentSnapshot.data()
            });
        });

        const sharedDocumentsResult =
            await fetchSharedDocuments();

        sharedDocumentsResult.documents.forEach(documentRecord => {
            documentsById.set(documentRecord.id, documentRecord);
        });

        const familyDocumentsUnavailable =
            sharedDocumentsResult.unavailable;

        const documents =
            [...documentsById.values()].sort(
                (first, second) =>
                    (convertToDate(second.createdAt)?.getTime() || 0) -
                    (convertToDate(first.createdAt)?.getTime() || 0)
            );

        const sharedDocumentsNeedingSync =
            documents.filter(
                document =>
                    document.ownerId === currentUser.uid &&
                    document.storagePath &&
                    (
                        document.sharedWithFamily === true ||
                        document.isDeleted === true
                    )
            );

        if (sharedDocumentsNeedingSync.length) {
            const accessSyncResults =
                await Promise.allSettled(
                    sharedDocumentsNeedingSync.map(
                        syncExistingSupabaseDocumentAccess
                    )
                );

            const failedAccessSync =
                accessSyncResults.find(
                    result => result.status === "rejected"
                );

            if (failedAccessSync?.status === "rejected") {
                showFamilyAccessSetupWarning(failedAccessSync.reason);
            }
        }

        userDocuments = documents;

        const activeDocuments =
            documents.filter(document => !document.isDeleted);

        const trashedDocuments =
            documents.filter(
                document =>
                    document.isDeleted === true &&
                    document.ownerId === currentUser.uid
            );

        const ownedActiveDocuments =
            activeDocuments.filter(
                document => document.ownerId === currentUser.uid
            );


        updateDocumentStats(ownedActiveDocuments);

        renderRecentDocuments(
            activeDocuments
        );

        calculateStorage(
            ownedActiveDocuments
        );

        renderDocumentViews(activeDocuments, trashedDocuments);

        if (familyDocumentsUnavailable) {
            showMessageModal(
                "Your documents are shown, but some family-shared documents could not be loaded. Check Firestore rules and deploy the composite indexes.",
                "Family documents unavailable"
            );
        }


    } catch (error) {

        console.error(
            "Unable to load documents:",
            error
        );
        showMessageModal(
            error?.message ||
                "Check your connection and try again.",
            "Unable to load documents"
        );

        totalDocuments.textContent = "0";

        expiringDocuments.textContent = "0";

        sharedDocuments.textContent = "0";

        userDocuments = [];

        renderEmptyDocuments();

        renderRecentDocuments([]);

        renderDocumentViews([], []);

    }

}



/* =========================================================
   DOCUMENT STATISTICS
   ========================================================= */

function updateDocumentStats(documents) {

    totalDocuments.textContent =
        documents.length;


    const today =
        new Date();

    const futureDate =
        new Date();

    futureDate.setDate(
        today.getDate() + 30
    );


    const expiring =
        documents.filter(
            document => {

                if (!document.expiryDate) {
                    return false;
                }


                const expiry =
                    convertToDate(
                        document.expiryDate
                    );


                return (
                    expiry &&
                    expiry >= today &&
                    expiry <= futureDate
                );

            }
        );


    expiringDocuments.textContent =
        expiring.length;


    if (expiring.length > 0) {

        expiryBadge.textContent =
            expiring.length;

        expiryBadge.classList.remove(
            "hidden"
        );

    } else {

        expiryBadge.classList.add(
            "hidden"
        );

    }


    const shared =
        documents.filter(
            document =>
                document.sharedWithFamily === true &&
                !document.isDeleted
        );


    sharedDocuments.textContent =
        shared.length;

}



/* =========================================================
   RECENT DOCUMENTS
   ========================================================= */

function renderRecentDocuments(
    documents
) {

    const activeDocuments =
        documents.filter(
            document => document.isDeleted !== true
        );

    if (!activeDocuments.length) {

        renderEmptyDocuments();

        return;
    }


    const sorted =
        [...activeDocuments].sort(
            (a, b) => {

                const dateA =
                    convertToDate(
                        a.updatedAt ||
                        a.createdAt
                    );

                const dateB =
                    convertToDate(
                        b.updatedAt ||
                        b.createdAt
                    );


                return (
                    (dateB?.getTime() || 0) -
                    (dateA?.getTime() || 0)
                );

            }
        );


    const recent =
        sorted.slice(
            0,
            5
        );


    recentDocuments.innerHTML =
        recent.map(
            createDocumentRow
        ).join("");

}



/* =========================================================
   DOCUMENT ROW
   ========================================================= */

function applyFilters(docsList, filters, memberFilterMode = "") {
    const searchTerm =
        (filters.search || "").trim().toLocaleLowerCase();
    const selectedMember =
        (filters.member || "").trim();
    const selectedFamilyMember =
        currentFamilyMembers.find(member => member.id === selectedMember);
    const referenceDate =
        new Date(filters.referenceDate);
    referenceDate.setHours(0, 0, 0, 0);

    const expiryLimit =
        new Date(referenceDate);
    expiryLimit.setDate(expiryLimit.getDate() + 30);

    return docsList.filter(documentRecord => {
        if (documentRecord.isDeleted === true) {
            return false;
        }

        if (selectedMember && !selectedFamilyMember) {
            return false;
        }

        const fileName =
            (documentRecord.fileName || "").toLocaleLowerCase();

        if (searchTerm && !fileName.includes(searchTerm)) {
            return false;
        }

        if (
            filters.category &&
            documentRecord.category !== filters.category
        ) {
            return false;
        }

        if (selectedMember && memberFilterMode) {
            if (memberFilterMode === "shared-by-you") {
                const isSharedWithMember =
                    (
                        documentRecord.accessLevel === "family" &&
                        documentRecord.familyId === currentUserData?.familyId
                    ) ||
                    (
                        documentRecord.accessLevel === "selected" &&
                        Array.isArray(documentRecord.sharedWithMemberIds) &&
                        documentRecord.sharedWithMemberIds.includes(selectedMember)
                    );

                if (!isSharedWithMember) {
                    return false;
                }
            } else if (
                memberFilterMode === "shared-with-you" &&
                documentRecord.ownerId !== selectedMember
            ) {
                return false;
            }
        }

        const contentType =
            (documentRecord.contentType || "").toLocaleLowerCase();

        if (
            filters.fileType === "pdf" &&
            contentType !== "application/pdf"
        ) {
            return false;
        }

        if (
            filters.fileType === "image" &&
            !contentType.startsWith("image/")
        ) {
            return false;
        }

        if (filters.expiry) {
            const parsedExpiry =
                convertToDate(documentRecord.expiryDate);

            if (!parsedExpiry) {
                return false;
            }

            const expiryDate =
                new Date(
                    parsedExpiry.getFullYear(),
                    parsedExpiry.getMonth(),
                    parsedExpiry.getDate()
                );

            if (
                filters.expiry === "expired" &&
                expiryDate >= referenceDate
            ) {
                return false;
            }

            if (
                filters.expiry === "expiring" &&
                (
                    expiryDate < referenceDate ||
                    expiryDate > expiryLimit
                )
            ) {
                return false;
            }
        }

        return true;
    });
}


function readDocumentFilters(filterBar) {
    const filterScope =
        filterBar.closest("[data-view-panel]") || filterBar;

    const getValue =
        filterName =>
            filterScope.querySelector(
                `[data-document-filter="${filterName}"]`
            )?.value || "";

    return {
        search: getValue("search"),
        direction: getValue("direction"),
        category: getValue("category"),
        member: getValue("member"),
        fileType: getValue("fileType"),
        expiry: getValue("expiry"),
        referenceDate: new Date().toISOString()
    };
}


function hasActiveDocumentFilters(filters) {
    return Boolean(
        filters.search.trim() ||
        (filters.direction && filters.direction !== "all") ||
        filters.category ||
        filters.member ||
        filters.fileType ||
        filters.expiry
    );
}


function updateFilterCount(filterBar, filters) {
    const activeCount =
        [
            filters.search.trim(),
            filters.direction === "all" ? "" : filters.direction,
            filters.category,
            filters.member,
            filters.fileType,
            filters.expiry
        ].filter(Boolean).length;

    const countBadge =
        filterBar.closest("details")
            ?.querySelector("[data-filter-count]");

    if (!countBadge) {
        return;
    }

    countBadge.textContent =
        activeCount ? String(activeCount) : "";

    countBadge.classList.toggle(
        "hidden",
        activeCount === 0
    );
}


function updateDocumentMemberFilters() {
    document
        .querySelectorAll(
            '#sharedDocumentFilterBar [data-document-filter="member"]'
        )
        .forEach(select => {
            const currentValue = select.value;
            const options = [
                '<option value="">All</option>',
                ...currentFamilyMembers
                    .filter(member => member.id !== currentUser?.uid)
                    .map(member => ({
                        id: member.id,
                        name: getFamilyMemberDisplayName(member).trim()
                    }))
                    .filter(member => member.name)
                    .sort((first, second) =>
                        first.name.localeCompare(second.name)
                    )
                    .map(
                        member =>
                            `<option value="${escapeHTML(member.id)}">${escapeHTML(member.name)}</option>`
                    )
            ];

            select.innerHTML = options.join("");

            if (
                currentFamilyMembers.some(
                    member =>
                        member.id === currentValue &&
                        member.id !== currentUser?.uid
                )
            ) {
                select.value = currentValue;
            }
        });
}


function renderDocumentViews(
    activeDocuments,
    trashedDocuments
) {

    updateDocumentMemberFilters();

    const myDocumentFilters =
        readDocumentFilters(
            document.getElementById("documentFilterBar")
        );

    const sharedDocumentFilters =
        readDocumentFilters(
            document.getElementById("sharedDocumentFilterBar")
        );
    const sharedDirection =
        sharedDocumentFilters.direction || "all";

    document
        .querySelectorAll("[data-shared-direction]")
        .forEach(section => {
            section.classList.toggle(
                "hidden",
                sharedDirection !== "all" &&
                    section.dataset.sharedDirection !== sharedDirection
            );
        });

    updateFilterCount(
        document.getElementById("documentFilterBar"),
        myDocumentFilters
    );
    updateFilterCount(
        document.getElementById("sharedDocumentFilterBar"),
        sharedDocumentFilters
    );

    const ownedDocuments =
        activeDocuments.filter(
            document => document.ownerId === currentUser.uid
        );

    const sharedByMeDocuments =
        ownedDocuments.filter(
            document =>
                document.sharedWithFamily === true &&
                document.familyId === currentUserData?.familyId &&
                (
                    document.accessLevel === "family" ||
                    document.accessLevel === "selected"
                )
        );

    const sharedWithMeDocuments =
        activeDocuments.filter(
            document =>
                document.ownerId !== currentUser.uid &&
                document.familyId === currentUserData?.familyId &&
                document.sharedWithFamily === true &&
                (
                    document.accessLevel === "family" ||
                    (
                        document.accessLevel === "selected" &&
                        document.sharedWithMemberIds?.includes(currentUser.uid)
                    )
                )
        );

    const filteredDocuments =
        applyFilters(ownedDocuments, myDocumentFilters);

    const filteredSharedByMeDocuments =
        applyFilters(
            sharedByMeDocuments,
            sharedDocumentFilters,
            "shared-by-you"
        );

    const filteredSharedDocuments =
        applyFilters(
            sharedWithMeDocuments,
            sharedDocumentFilters,
            "shared-with-you"
        );

    const emptyDocumentsMessage = (documents, filters, emptyMessage) => {
        if (hasActiveDocumentFilters(filters)) {
            return "No documents found matching the selected filters.";
        }

        return documents.length
            ? "No documents found."
            : emptyMessage;
    };

    const emptyList = `
        <div class="view-empty">
            <h2>${emptyDocumentsMessage(
                ownedDocuments,
                myDocumentFilters,
                "No documents yet. Upload your first document to get started."
            )}</h2>
        </div>
    `;

    allDocumentsList.innerHTML =
        filteredDocuments.length
            ? filteredDocuments.map(createDocumentRow).join("")
            : emptyList;

    const hasSharedByMeDocuments =
        filteredSharedByMeDocuments.length > 0;

    sharedByMeDocumentsList.classList.toggle(
        "view-empty",
        !hasSharedByMeDocuments
    );

    sharedByMeDocumentsList.innerHTML =
        hasSharedByMeDocuments
            ? filteredSharedByMeDocuments.map(createDocumentRow).join("")
            : `
                <div class="view-empty">
                <h2>${emptyDocumentsMessage(
                    sharedByMeDocuments,
                    sharedDocumentFilters,
                    "You haven't shared any documents with your family yet."
                )}</h2>
            </div>
        `;

    const hasSharedDocuments =
        filteredSharedDocuments.length > 0;

    sharedDocumentsList.classList.toggle(
        "view-empty",
        !hasSharedDocuments
    );

    sharedDocumentsList.innerHTML =
        hasSharedDocuments
            ? filteredSharedDocuments.map(createDocumentRow).join("")
            : `
                <div class="view-empty">
                <h2>${emptyDocumentsMessage(
                    sharedWithMeDocuments,
                    sharedDocumentFilters,
                    "No family members have shared documents with you yet."
                )}</h2>
            </div>
        `;


    const now = new Date();
    const upcomingLimit = new Date();
    upcomingLimit.setDate(now.getDate() + 30);

    const expiringDocuments =
        ownedDocuments
            .map(document => ({
                document,
                expiry: convertToDate(document.expiryDate)
            }))
            .filter(item => item.expiry && item.expiry <= upcomingLimit)
            .sort((first, second) => first.expiry - second.expiry);

    const expiredCount =
        expiringDocuments.filter(item => item.expiry < now).length;

    const upcomingCount =
        expiringDocuments.filter(item => item.expiry >= now).length;

    document.getElementById("expiredCount").textContent = expiredCount;
    document.getElementById("upcomingExpiryCount").textContent = upcomingCount;

    expiryDocumentsList.innerHTML =
        expiringDocuments.length
            ? expiringDocuments.map(
                ({ document }) => createDocumentRow(document)
            ).join("")
            : `
                <div class="view-empty">
                    <h2>You're all caught up</h2>
                    <p>No documents expire in the next 30 days.</p>
                </div>
            `;


    trashDocumentsList.innerHTML =
        trashedDocuments.length
            ? trashedDocuments.map(createDocumentRow).join("")
            : `
                <div class="view-empty">
                    <h2>Trash is empty</h2>
                    <p>Documents you move to Trash can be restored from here.</p>
                </div>
            `;

}


document
    .querySelectorAll("[data-document-filter]")
    .forEach(filterControl => {
        filterControl.addEventListener(
            filterControl.tagName === "INPUT" ? "input" : "change",
            () => renderDocumentViews(
                userDocuments.filter(document => !document.isDeleted),
                userDocuments.filter(document => document.isDeleted === true)
            )
        );
    });


function createDocumentRow(
    document
) {

    const isTrashed =
        document.isDeleted === true;

    const contentType =
        (document.contentType || "").toLowerCase();
    const storedFileName =
        document.originalFileName ||
        document.storagePath?.split("/").pop() ||
        document.fileName ||
        document.name ||
        "";
    const fileExtension =
        storedFileName.match(/\.([^.]+)$/)?.[1]?.toUpperCase();
    const fileFormat =
        (contentType === "application/pdf"
            ? "PDF"
            : contentType === "image/jpeg"
                ? "JPEG"
                : contentType === "image/png"
                    ? "PNG"
                    : fileExtension || "FILE");
    const isImageFile =
        contentType.startsWith("image/") ||
        ["JPG", "JPEG", "PNG"].includes(fileFormat);

    const name =
        escapeHTML(
            document.fileName ||
            document.name ||
            "Untitled Document"
        );


    const category =
        escapeHTML(
            document.category ||
            "Other"
        );


    const owner =
        document.uploaderName || document.ownerName
            ? escapeHTML(
                document.uploaderName ||
                document.ownerName
            )
            : "You";
    const isDocumentOwner =
        document.ownerId === currentUser?.uid;
    const isSharedWithCurrentUser =
        document.familyId === currentUserData?.familyId &&
        document.sharedWithFamily === true &&
        (
            document.accessLevel === "family" ||
            (
                document.accessLevel === "selected" &&
                document.sharedWithMemberIds?.includes(currentUser?.uid)
            )
        );
    const canAccessFile =
        Boolean(
            document.downloadURL ||
            document.storagePath?.split("/")[0] === currentUser?.uid ||
            isSharedWithCurrentUser
        );
    const fileAccessUnavailable =
        !isTrashed && !canAccessFile;


    let statusText =
        formatDate(
            document.updatedAt ||
            document.createdAt
        );


    let statusClass = "";


    if (document.expiryDate) {

        const expiry =
            convertToDate(
                document.expiryDate
            );


        if (expiry) {

            const today =
                new Date();

            today.setHours(0, 0, 0, 0);

            const expiryDay =
                new Date(expiry);
            expiryDay.setHours(0, 0, 0, 0);

            const days =
                Math.round(
                    (expiryDay - today) /
                    (1000 * 60 * 60 * 24)
                );

            if (days < 0) {
                statusText = "Expired";
                statusClass = "expired";
            } else if (
                days <= 30
            ) {

                statusText =
                    days === 0
                        ? "Expires today"
                        : `Expires in ${days} days`;

                statusClass =
                    "warning";

            }

        }

    }


    return `
        <div class="document-row">

            <div class="document-icon ${isImageFile ? "image" : "pdf"}">

                <svg viewBox="0 0 24 24" aria-hidden="true">
                    ${isImageFile
                        ? `
                    <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                    <circle cx="8.5" cy="9" r="1.5"></circle>
                    <path d="m4 17 5-5 3 3 3-4 5 6"></path>
                        `
                        : `
                    <path d="M6 3h9l4 4v14H6z"></path>
                    <path d="M14 3v5h5"></path>
                    <path d="M9 13h6"></path>
                    <path d="M9 17h6"></path>
                        `}
                </svg>

            </div>


            <div class="document-main">

                <span class="document-name">
                    ${name}
                </span>

                <div class="document-subline">
                    <span class="document-category">
                        ${category}
                    </span>
                    <span class="document-format-badge ${isImageFile ? "image" : "pdf"}">
                        ${escapeHTML(fileFormat)}
                    </span>
                </div>

            </div>


            <div class="document-meta">

                <span class="document-status ${statusClass}">
                    ${statusText}
                </span>

                <span class="document-owner">
                    ${owner}
                </span>

            </div>

            <div class="document-actions">
                <button
                    type="button"
                    class="document-menu-toggle"
                    aria-label="More actions for ${name}"
                    aria-haspopup="true"
                    aria-expanded="false"
                    data-document-menu-toggle
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                    </svg>
                </button>
                <div class="document-actions-menu hidden" aria-label="Document actions">
                    ${isTrashed ? `
                        ${isDocumentOwner ? `<button
                            type="button"
                            class="document-action document-restore-button"
                            data-restore-document="${escapeHTML(document.id)}"
                        >
                            Restore
                        </button>` : ""}
                        ${isDocumentOwner ? `<button
                            type="button"
                            class="document-action document-permanent-delete-button"
                            data-permanent-delete-document="${escapeHTML(document.id)}"
                        >
                            Delete permanently
                        </button>` : ""}
                    ` : `
                    ${isDocumentOwner ? `
                        <button
                            type="button"
                            class="document-action document-edit-button"
                            data-edit-document="${escapeHTML(document.id)}"
                        >
                            Edit details
                        </button>
                    ` : ""}
                    ${fileAccessUnavailable ? `
                        <span class="document-action-hint">
                            This private file is not shared with your account
                        </span>
                    ` : `
                        <button
                            type="button"
                            class="document-action document-open-button"
                            data-view-document="${escapeHTML(document.id)}"
                        >
                            View
                        </button>
                        <button
                            type="button"
                            class="document-action document-download-button"
                            data-download-document="${escapeHTML(document.id)}"
                        >
                            Download
                        </button>
                    `}
                    ${isDocumentOwner ? `
                        <button
                            type="button"
                            class="document-action document-trash-button"
                            data-trash-document="${escapeHTML(document.id)}"
                        >
                            Move to trash
                        </button>
                    ` : ""}
                    `}
                </div>
            </div>

        </div>
    `;

}


async function moveToTrash(documentRecord) {
    if (
        documentRecord.ownerId !== currentUser?.uid ||
        documentRecord.isDeleted === true
    ) {
        throw new Error("Only the owner can move an active document to Trash.");
    }

    let accessRevoked = false;

    try {
        accessRevoked =
            await syncSupabaseDocumentAccess(
                documentRecord,
                "private",
                null
            );

        await updateDoc(
            doc(db, "documents", documentRecord.id),
            {
                isDeleted: true,
                deletedAt: serverTimestamp()
            }
        );
    } catch (error) {
        if (accessRevoked) {
            try {
                await syncExistingSupabaseDocumentAccess(documentRecord);
            } catch (rollbackError) {
                console.error(
                    "Unable to restore document sharing after move-to-trash failed:",
                    rollbackError
                );
            }
        }

        throw error;
    }
}


async function restoreDocument(documentRecord) {
    if (
        documentRecord.ownerId !== currentUser?.uid ||
        documentRecord.isDeleted !== true
    ) {
        throw new Error("Only the owner can restore this trashed document.");
    }

    let accessGranted = false;

    try {
        accessGranted =
            await syncSupabaseDocumentAccess(
                documentRecord,
                documentRecord.accessLevel || "private",
                documentRecord.familyId,
                documentRecord.sharedWithMemberIds || []
            );

        await updateDoc(
            doc(db, "documents", documentRecord.id),
            {
                isDeleted: false,
                deletedAt: null
            }
        );
    } catch (error) {
        if (accessGranted) {
            try {
                await syncSupabaseDocumentAccess(
                    documentRecord,
                    "private",
                    null
                );
            } catch (rollbackError) {
                console.error(
                    "Unable to revoke document sharing after restore failed:",
                    rollbackError
                );
            }
        }

        throw error;
    }
}


async function permanentlyDeleteDocument(documentRecord) {
    if (
        documentRecord.ownerId !== currentUser?.uid ||
        documentRecord.isDeleted !== true
    ) {
        throw new Error(
            "Only the owner can permanently delete a document from Trash."
        );
    }

    if (documentRecord.storagePath) {
        await syncSupabaseDocumentAccess(
            documentRecord,
            "private",
            null
        );

        const storage =
            getSupabaseClient()
                .storage
                .from(documentRecord.storageBucket || documentStorageBucket);
        const { data: removedFiles, error } =
            await storage.remove([documentRecord.storagePath]);

        if (error) {
            throw new Error(
                `The file could not be deleted from Supabase Storage: ${error.message}`
            );
        }

        if (
            !removedFiles?.some(
                file => file.name === documentRecord.storagePath
            )
        ) {
            const lastSlash =
                documentRecord.storagePath.lastIndexOf("/");
            const folder =
                lastSlash === -1
                    ? ""
                    : documentRecord.storagePath.slice(0, lastSlash);
            const fileName =
                documentRecord.storagePath.slice(lastSlash + 1);
            const { data: remainingFiles, error: listError } =
                await storage.list(
                    folder,
                    {
                        search: fileName,
                        limit: 100
                    }
                );

            if (listError) {
                throw new Error(
                    `The file deletion could not be verified in Supabase Storage: ${listError.message}`
                );
            }

            if (
                remainingFiles?.some(file => file.name === fileName)
            ) {
                throw new Error(
                    "Supabase Storage still contains this file. Check the bucket's DELETE and SELECT policies, then try again."
                );
            }
        }
    }

    const documentRef =
        doc(db, "documents", documentRecord.id);
    const documentNameKey =
        documentRecord.documentNameKey ||
        encodeURIComponent(
            normalizeDocumentName(
                documentRecord.fileName || documentRecord.name || ""
            )
        );
    const reservationRef =
        doc(
            db,
            "users",
            currentUser.uid,
            "documentNameReservations",
            documentNameKey
        );

    try {
        await runTransaction(db, async transaction => {
            const [documentSnapshot, reservationSnapshot] =
                await Promise.all([
                    transaction.get(documentRef),
                    transaction.get(reservationRef)
                ]);

            if (
                !documentSnapshot.exists() ||
                documentSnapshot.data().ownerId !== currentUser.uid ||
                documentSnapshot.data().isDeleted !== true
            ) {
                throw new Error(
                    "This trashed document is no longer available to delete."
                );
            }

            if (
                reservationSnapshot.exists() &&
                reservationSnapshot.data().documentId !== documentRecord.id
            ) {
                throw new Error(
                    "The document name reservation does not match this file. Contact support before deleting it."
                );
            }

            transaction.delete(documentRef);

            if (reservationSnapshot.exists()) {
                transaction.delete(reservationRef);
            }
        });
    } catch (error) {
        if (documentRecord.storagePath) {
            const details =
                error instanceof Error ? error.message : String(error);
            const needsRulesDeployment =
                error?.code === "permission-denied" ||
                details.includes("Missing or insufficient permissions");

            throw new Error(
                needsRulesDeployment
                    ? `The Supabase file was deleted, but Firestore denied removal of its record. Deploy the updated Firestore rules, then retry permanent deletion from Trash. Details: ${details}`
                    : `The Supabase file was deleted, but its Firestore record could not be removed. Retry permanent deletion from Trash. Details: ${details}`
            );
        }

        throw error;
    }
}



document.addEventListener(
    "click",
    async event => {
        const menuToggle =
            event.target.closest("[data-document-menu-toggle]");

        if (menuToggle) {
            const menu =
                menuToggle.nextElementSibling;

            const shouldOpen =
                menu.classList.contains("hidden");

            closeDocumentActionMenus();

            if (shouldOpen) {
                menu.classList.remove("hidden");
                menuToggle.setAttribute("aria-expanded", "true");

                const row =
                    menuToggle.closest(".document-row");
                const appShell =
                    menuToggle.closest(".app-shell");
                const toggleBounds =
                    menuToggle.getBoundingClientRect();
                const menuBounds =
                    menu.getBoundingClientRect();
                const shellBounds =
                    appShell?.getBoundingClientRect();
                const availableBelow =
                    (shellBounds?.bottom ?? window.innerHeight) -
                    toggleBounds.bottom;
                const availableAbove =
                    toggleBounds.top -
                    (shellBounds?.top ?? 0);

                row.classList.add("document-menu-open");

                if (
                    menuBounds.height + 7 > availableBelow &&
                    availableAbove > availableBelow
                ) {
                    row.classList.add("document-menu-open-up");
                }
            }

            return;
        }

        closeDocumentActionMenus();

        const viewButton =
            event.target.closest("[data-view-document]");

        const downloadButton =
            event.target.closest("[data-download-document]");

        const trashButton =
            event.target.closest("[data-trash-document]");

        const restoreButton =
            event.target.closest("[data-restore-document]");

        const permanentDeleteButton =
            event.target.closest("[data-permanent-delete-document]");

        const editButton =
            event.target.closest("[data-edit-document]");

        if (editButton) {
            const selectedDocument =
                userDocuments.find(
                    item => item.id === editButton.dataset.editDocument
                );

            if (!selectedDocument || selectedDocument.ownerId !== currentUser?.uid) {
                showMessageModal(
                    "Only the document owner can update its details.",
                    "Unable to edit document"
                );
                return;
            }

            openEditDocumentModal(selectedDocument);
            return;
        }

        if (viewButton || downloadButton) {
            const button = viewButton || downloadButton;
            const documentId =
                button.dataset[
                    viewButton ? "viewDocument" : "downloadDocument"
                ];

            button.disabled = true;

            try {
                const selectedDocument =
                    userDocuments.find(item => item.id === documentId);

                if (!selectedDocument) {
                    throw new Error("This document is no longer available.");
                }

                const url =
                    await getDocumentUrl(
                        selectedDocument,
                        Boolean(downloadButton)
                    );

                if (downloadButton) {
                    window.location.assign(url);
                } else {
                    const downloadUrl =
                        await getDocumentUrl(selectedDocument, true);

                    openDocumentViewer(
                        selectedDocument,
                        url,
                        downloadUrl
                    );
                }
            } catch (error) {
                console.error("Unable to open document:", error);
                showMessageModal(
                    error instanceof Error
                        ? error.message
                        : "Unable to open this document. Please try again.",
                    "Document unavailable"
                );
            } finally {
                button.disabled = false;
            }

            return;
        }

        if (!trashButton && !restoreButton && !permanentDeleteButton) {
            return;
        }

        const button =
            trashButton || restoreButton || permanentDeleteButton;
        const documentId = button.dataset[
            trashButton
                ? "trashDocument"
                : restoreButton
                    ? "restoreDocument"
                    : "permanentDeleteDocument"
        ];

        button.disabled = true;
        const affectedDocument =
            userDocuments.find(item => item.id === documentId);

        try {

            if (!affectedDocument) {
                throw new Error("This document is no longer available.");
            }

            if (trashButton) {
                await moveToTrash(affectedDocument);
            } else if (restoreButton) {
                await restoreDocument(affectedDocument);
            } else {
                if (
                    affectedDocument.ownerId !== currentUser?.uid ||
                    affectedDocument.isDeleted !== true
                ) {
                    throw new Error(
                        "Only the owner can permanently delete a document from Trash."
                    );
                }

                const confirmed =
                    await requestPermanentDeleteConfirmation(
                        affectedDocument.fileName || "this document"
                    );

                if (!confirmed) {
                    button.disabled = false;
                    return;
                }

                await permanentlyDeleteDocument(affectedDocument);
            }

            await loadDocuments();

            if (permanentDeleteButton) {
                showTemporaryMessage(
                    "The document was permanently deleted."
                );
            }

        } catch (error) {
            console.error("Unable to update document:", error);
            button.disabled = false;
            showMessageModal(
                error instanceof Error
                    ? error.message
                    : "Unable to update this document. Please try again.",
                permanentDeleteButton
                    ? "Permanent delete failed"
                    : "Document update failed"
            );

        }

    }
);


function closeDocumentActionMenus() {
    document
        .querySelectorAll(".document-actions-menu:not(.hidden)")
        .forEach(menu => {
            menu.classList.add("hidden");
            menu.previousElementSibling?.setAttribute(
                "aria-expanded",
                "false"
            );
            menu.closest(".document-row")
                ?.classList.remove(
                    "document-menu-open",
                    "document-menu-open-up"
                );
        });
}


document.addEventListener(
    "keydown",
    event => {
        if (event.key === "Escape") {
            if (resolvePermanentDeleteConfirmation) {
                finishPermanentDeleteConfirmation(false);
            }

            closeDocumentActionMenus();
        }
    }
);


async function getDocumentUrl(documentRecord, download) {
    if (!documentRecord.storagePath) {
        if (documentRecord.downloadURL) {
            return documentRecord.downloadURL;
        }

        throw new Error(
            "This document has no stored file path. Older Firebase Storage files must be migrated to Supabase Storage."
        );
    }

    const bucket =
        documentRecord.storageBucket || documentStorageBucket;

    const { data, error } =
        await getSupabaseClient()
            .storage
            .from(bucket)
            .createSignedUrl(
                documentRecord.storagePath,
                300,
                download
                    ? {
                        download:
                            documentRecord.originalFileName ||
                            documentRecord.fileName
                    }
                    : undefined
            );

    if (error) {
        throw error;
    }

    if (!data?.signedUrl) {
        throw new Error("Supabase did not return a document link.");
    }

    return data.signedUrl;
}


function openDocumentViewer(documentRecord, signedUrl, downloadUrl) {
    const viewer =
        document.getElementById("documentViewerFrame");

    const title =
        document.getElementById("documentViewerTitle");

    const downloadLink =
        document.getElementById("documentViewerDownload");

    title.textContent =
        documentRecord.fileName ||
        documentRecord.originalFileName ||
        "Document";

    viewer.src = signedUrl;
    downloadLink.href = downloadUrl;

    openModal("documentViewerModal");
}


/* =========================================================
   EMPTY DOCUMENTS
   ========================================================= */

function renderEmptyDocuments() {

    recentDocuments.innerHTML = `

        <div class="empty-state">

            <div class="empty-icon">

                <svg viewBox="0 0 24 24">
                    <path d="M6 3h9l4 4v14H6z"></path>
                    <path d="M14 3v5h5"></path>
                    <path d="M9 13h6"></path>
                    <path d="M9 17h4"></path>
                </svg>

            </div>

            <h3>
                No documents yet
            </h3>

            <p>
                Upload your first document to get started.
            </p>

            <button
                type="button"
                class="secondary-button"
                id="dynamicUploadBtn"
            >
                Upload Document
            </button>

        </div>
    `;


    document
        .getElementById(
            "dynamicUploadBtn"
        )
        ?.addEventListener(
            "click",
            openUploadModal
        );

}



/* =========================================================
   STORAGE
   ========================================================= */

function calculateStorage(
    documents
) {
    let totalBytes = 0;

    documents.forEach(
        document => {
            if (typeof document.fileSize === "number") {
                totalBytes +=
                    document.fileSize;
            }
        }
    );

    const bytesPerKB = 1024;
    const bytesPerMB = bytesPerKB * 1024;
    const bytesPerGB = bytesPerMB * 1024;
    const totalGB =
        totalBytes / bytesPerGB;

    const maxGB = 10;
    const maxBytes = maxGB * bytesPerGB;
    const percentage =
        Math.min(
            (totalBytes / maxBytes) * 100,
            100
        );

    let formattedUsage;
    if (totalBytes === 0) {
        formattedUsage = "0 MB";
    } else if (totalBytes < bytesPerKB) {
        formattedUsage = `${Math.round(totalBytes)} B`;
    } else if (totalBytes < bytesPerMB) {
        formattedUsage = `${(totalBytes / bytesPerKB).toFixed(1)} KB`;
    } else if (totalBytes < bytesPerGB) {
        formattedUsage = `${(totalBytes / bytesPerMB).toFixed(2)} MB`;
    } else {
        formattedUsage = `${totalGB.toFixed(2)} GB`;
    }

    storageUsed.textContent =
        formattedUsage;

    storageProgress.style.width =
        `${totalBytes > 0 ? Math.max(percentage, 0.25) : 0}%`;

    storagePercent.textContent =
        totalBytes > 0 && percentage < 1
            ? "<1%"
            : `${Math.round(percentage)}%`;
}



/* =========================================================
   CREATE FAMILY
   ========================================================= */

async function createFamily(
    name
) {

    if (!currentUser) {
        throw new Error(
            "You must be signed in to create a family."
        );
    }


    const familyId =
        generateFamilyCode();

    const familyRef =
        doc(
            db,
            "families",
            familyId
        );

    const userRef =
        doc(
            db,
            "users",
            currentUser.uid
        );

    await runTransaction(
        db,
        async transaction => {

            const familySnapshot =
                await transaction.get(familyRef);

            if (familySnapshot.exists()) {
                throw new Error(
                    "Unable to generate a unique family code. Please try again."
                );
            }

            transaction.set(
                familyRef,
                {
                    name: name.trim(),
                    ownerId: currentUser.uid,
                    members: [currentUser.uid],
                    createdAt: serverTimestamp()
                }
            );

            transaction.set(
                userRef,
                {
                    familyId,
                    familyRole: "owner"
                },
                { merge: true }
            );
        }
    );


    currentUserData = {
        ...currentUserData,
        familyId,
        familyRole: "owner"
    };


    closeModal(
        "createFamilyModal"
    );


    await loadFamily();

    history.pushState(null, "", "#members");
    showDashboardView("members");

    showTemporaryMessage(
        `Family created. Share code ${familyId} to invite members.`
    );

}



/* =========================================================
   JOIN FAMILY
   ========================================================= */

async function joinFamily(
    familyCode
) {

    if (!currentUser) {
        throw new Error(
            "You must be signed in to join a family."
        );
    }


    const code =
        familyCode
            .trim()
            .toUpperCase();


    const familyRef =
        doc(
            db,
            "families",
            code
        );

    const userRef =
        doc(
            db,
            "users",
            currentUser.uid
        );

    let familyName;
    let familyRole;

    await runTransaction(
        db,
        async transaction => {

            const familySnapshot =
                await transaction.get(familyRef);

            if (!familySnapshot.exists()) {
                throw new Error(
                    "Family code not found."
                );
            }

            const userSnapshot =
                await transaction.get(userRef);

            const familyData =
                familySnapshot.data();

            const userData =
                userSnapshot.exists()
                    ? userSnapshot.data()
                    : {};

            familyName =
                familyData.name || "the family";

            familyRole =
                familyData.ownerId === currentUser.uid
                    ? "owner"
                    : "member";

            if (
                userData.familyId &&
                userData.familyId !== code
            ) {
                throw new Error(
                    "You already belong to another family. Leave it before joining this one."
                );
            }

            const members =
                familyData.members || [];

            const isAlreadyMember =
                members.includes(currentUser.uid);

            if (
                isAlreadyMember &&
                userData.familyId === code
            ) {
                throw new Error(
                    "You are already a member of this family."
                );
            }

            if (!isAlreadyMember) {
                transaction.update(
                    familyRef,
                    {
                        members:
                            arrayUnion(currentUser.uid)
                    }
                );
            }

            transaction.set(
                userRef,
                {
                    familyId: code,
                    familyRole
                },
                { merge: true }
            );
        }
    );


    currentUserData = {
        ...currentUserData,
        familyId: code,
        familyRole
    };


    closeModal(
        "joinFamilyModal"
    );


    await loadFamily();

    showTemporaryMessage(
        `You joined ${familyName}.`
    );

}



/* =========================================================
   LEAVE FAMILY
========================================================= */

async function leaveFamily() {

    if (
        !currentUser ||
        !currentUserData?.familyId
    ) {

        return;

    }


    const familyId =
        currentUserData.familyId;


    const familyRef =
        doc(
            db,
            "families",
            familyId
        );

    const userRef =
        doc(
            db,
            "users",
            currentUser.uid
        );

    let deletedFamily = false;

    await runTransaction(
        db,
        async transaction => {

            const familySnapshot =
                await transaction.get(familyRef);

            const userSnapshot =
                await transaction.get(userRef);

            if (!userSnapshot.exists()) {
                throw new Error(
                    "Unable to find your account. Refresh the page and try again."
                );
            }

            if (familySnapshot.exists()) {

                const familyData =
                    familySnapshot.data();

                if (
                    familyData.ownerId === currentUser.uid
                ) {

                    const members =
                        familyData.members || [];

                    if (
                        members.length !== 1 ||
                        members[0] !== currentUser.uid
                    ) {
                        throw new Error(
                            "Transfer ownership to another family member before leaving."
                        );
                    }

                    transaction.delete(familyRef);
                    deletedFamily = true;

                } else {

                    if (!familyData.members?.includes(currentUser.uid)) {
                        throw new Error(
                            "You are no longer a member of this family. Refresh the page and try again."
                        );
                    }

                    transaction.update(
                        familyRef,
                        {
                            members:
                                arrayRemove(
                                    currentUser.uid
                                )
                        }
                    );
                }

            }

            transaction.update(
                userRef,
                {
                    familyId: null,
                    familyRole: null
                }
            );
        }
    );

    try {
        await callSupabaseAccessRpc(
            deletedFamily
                ? "delete_family_access_group"
                : "leave_family_access",
            { p_family_id: familyId }
        );
    } catch (error) {
        showFamilyAccessSetupWarning(error);
    }

    currentUserData.familyId =
        null;

    currentUserData.familyRole =
        null;


    closeModal(
        "leaveFamilyModal"
    );


    await loadFamily();

    history.pushState(null, "", "#dashboard");
    showDashboardView("dashboard");

    showTemporaryMessage(
        deletedFamily
            ? "Your family has been deleted."
            : "You have left the family."
    );

}


async function removeFamilyMember(memberId) {

    if (
        !currentUser ||
        !currentUserData?.familyId ||
        !currentFamilyData
    ) {
        throw new Error(
            "You must belong to a family to remove a member."
        );
    }

    const familyId =
        currentUserData.familyId;

    const familyRef =
        doc(db, "families", familyId);

    const memberRef =
        doc(db, "users", memberId);

    const notificationRef =
        doc(collection(db, "userNotifications"));

    let remainingMemberIds = [];

    await runTransaction(
        db,
        async transaction => {

            const familySnapshot =
                await transaction.get(familyRef);

            const memberSnapshot =
                await transaction.get(memberRef);

            if (
                !familySnapshot.exists() ||
                !memberSnapshot.exists()
            ) {
                throw new Error(
                    "Unable to find the family or member. Refresh the page and try again."
                );
            }

            const familyData =
                familySnapshot.data();

            const memberData =
                memberSnapshot.data();

            if (familyData.ownerId !== currentUser.uid) {
                throw new Error(
                    "Only the family owner can remove members."
                );
            }

            if (
                memberId === currentUser.uid ||
                !(familyData.members || []).includes(memberId) ||
                memberData.familyId !== familyId
            ) {
                throw new Error(
                    "Choose another current member of this family."
                );
            }

            remainingMemberIds =
                familyData.members.filter(
                    familyMemberId => familyMemberId !== memberId
                );

            transaction.update(
                familyRef,
                {
                    members:
                        arrayRemove(memberId)
                }
            );

            transaction.update(
                memberRef,
                {
                    familyId: null,
                    familyRole: null
                }
            );

            transaction.set(
                notificationRef,
                {
                    recipientId: memberId,
                    familyId,
                    familyName: familyData.name || "your family",
                    type: "family-member-removed",
                    dismissed: false,
                    createdAt: serverTimestamp()
                }
            );
        }
    );

    try {
        await syncSupabaseFamilyMemberships(
            familyId,
            remainingMemberIds
        );
    } catch (error) {
        console.error(
            "Family member was removed in Firestore, but Supabase access revocation failed:",
            error
        );

        throw new Error(
            "The member was removed from the family, but their Supabase access could not be revoked yet. Apply the latest supabase/family-sharing.sql, then refresh the owner's dashboard to synchronize the family roster. Details: " +
                (error instanceof Error ? error.message : String(error))
        );
    }

    await loadFamily();

    showTemporaryMessage(
        "Family member removed."
    );

}


async function loadRemovalNotifications() {

    try {

        const notificationsQuery =
            query(
                collection(db, "userNotifications"),
                where("recipientId", "==", currentUser.uid)
            );

        const notificationSnapshot =
            await getDocs(notificationsQuery);

        pendingRemovalNotifications =
            notificationSnapshot.docs
                .filter(notification => notification.data().dismissed !== true)
                .map(notification => ({
                    id: notification.id,
                    ...notification.data()
                }));

        showNextRemovalNotification();

    } catch (error) {

        console.error("Unable to load family removal notifications:", error);

        showTemporaryMessage(
            "Couldn't check for family access updates. Please refresh the dashboard to try again."
        );

    }

}


function showNextRemovalNotification() {

    const notification =
        pendingRemovalNotifications[0];

    if (!notification) {
        closeModal("familyRemovalNotificationModal");
        return;
    }

    document.getElementById("familyRemovalNotificationText").textContent =
        `Your access to ${notification.familyName || "your family"} has ended. Your account and personal documents are not affected.`;
    document.getElementById("familyRemovalNotificationError").classList.add("hidden");

    openModal("familyRemovalNotificationModal");

}


async function transferFamilyOwnership(
    newOwnerId
) {

    if (
        !currentUser ||
        !currentUserData?.familyId ||
        !currentFamilyData
    ) {
        throw new Error(
            "You must be a family member to transfer ownership."
        );
    }

    const familyId =
        currentUserData.familyId;

    const familyRef =
        doc(db, "families", familyId);

    const currentUserRef =
        doc(db, "users", currentUser.uid);

    const newOwnerRef =
        doc(db, "users", newOwnerId);

    await runTransaction(
        db,
        async transaction => {

            const familySnapshot =
                await transaction.get(familyRef);

            const currentUserSnapshot =
                await transaction.get(currentUserRef);

            const newOwnerSnapshot =
                await transaction.get(newOwnerRef);

            if (
                !familySnapshot.exists() ||
                !currentUserSnapshot.exists() ||
                !newOwnerSnapshot.exists()
            ) {
                throw new Error(
                    "Unable to find the family or member. Refresh the page and try again."
                );
            }

            const familyData =
                familySnapshot.data();

            const newOwnerData =
                newOwnerSnapshot.data();

            if (familyData.ownerId !== currentUser.uid) {
                throw new Error(
                    "Only the current family owner can transfer ownership."
                );
            }

            if (
                newOwnerId === currentUser.uid ||
                !(familyData.members || []).includes(newOwnerId) ||
                newOwnerData.familyId !== familyId
            ) {
                throw new Error(
                    "Choose a current member of this family."
                );
            }

            transaction.update(
                familyRef,
                { ownerId: newOwnerId }
            );

            transaction.update(
                currentUserRef,
                { familyRole: "member" }
            );

            transaction.update(
                newOwnerRef,
                { familyRole: "owner" }
            );
        }
    );

    try {
        await callSupabaseAccessRpc(
            "transfer_family_access_ownership",
            {
                p_family_id: familyId,
                p_new_owner_uid: newOwnerId
            }
        );
    } catch (error) {
        showFamilyAccessSetupWarning(error);
    }

    currentUserData = {
        ...currentUserData,
        familyRole: "member"
    };

    closeModal(transferFamilyOwnershipModal.id);
    pendingOwnershipTransfer = null;

    await loadFamily();

    showTemporaryMessage(
        "Family ownership transferred successfully."
    );

}



/* =========================================================
   GENERATE FAMILY CODE
========================================================= */

function generateFamilyCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    const randomValues =
        crypto.getRandomValues(
            new Uint8Array(8)
        );

    const code =
        Array.from(
            randomValues,
            value => characters[value & 31]
        ).join("");


    return code;

}



/* =========================================================
   DATE HELPERS
========================================================= */

function convertToDate(
    value
) {

    if (!value) {
        return null;
    }


    if (
        typeof value.toDate ===
        "function"
    ) {

        return value.toDate();

    }


    if (
        value instanceof Date
    ) {

        return value;

    }


    const date =
        new Date(value);


    return isNaN(
        date.getTime()
    )
        ? null
        : date;

}



function formatDate(
    value
) {

    const date =
        convertToDate(value);


    if (!date) {
        return "Recently updated";
    }


    const today =
        new Date();


    const yesterday =
        new Date();


    yesterday.setDate(
        today.getDate() - 1
    );


    if (
        date.toDateString() ===
        today.toDateString()
    ) {

        return "Updated today";

    }


    if (
        date.toDateString() ===
        yesterday.toDateString()
    ) {

        return "Updated yesterday";

    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );

}



/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}



/* =========================================================
   MODAL HELPERS
========================================================= */

function openModal(
    id
) {

    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    const closeTimer =
        modalCloseTimers.get(id);

    if (closeTimer) {
        window.clearTimeout(closeTimer);
        modalCloseTimers.delete(id);
    }

    modal.classList.remove("is-closing");
    modal.classList.remove("hidden");

}



function closeModal(
    id
) {

    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    if (id === "documentViewerModal") {
        document.getElementById("documentViewerFrame").src =
            "about:blank";
    }

    if (modal.classList.contains("hidden")) {
        return;
    }

    const existingTimer =
        modalCloseTimers.get(id);

    if (existingTimer) {
        window.clearTimeout(existingTimer);
        modalCloseTimers.delete(id);
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        modal.classList.remove("is-closing");
        modal.classList.add("hidden");
        return;
    }

    modal.classList.add("is-closing");

    const closeTimer =
        window.setTimeout(
            () => {
                modal.classList.add("hidden");
                modal.classList.remove("is-closing");
                modalCloseTimers.delete(id);
            },
            160
        );

    modalCloseTimers.set(id, closeTimer);

}



/* =========================================================
   FAMILY MODAL
========================================================= */

document
    .getElementById(
        "createJoinFamilyBtn"
    )
    ?.addEventListener(
        "click",
        () => {

            openModal(
                "familyModal"
            );

        }
    );


document
    .getElementById("copyFamilyCodeBtn")
    ?.addEventListener(
        "click",
        async () => {

            const familyCode =
                currentUserData?.familyId;

            if (!familyCode) {
                return;
            }

            try {

                await navigator.clipboard.writeText(familyCode);
                showTemporaryMessage("Family code copied.");

            } catch (error) {

                console.error("Unable to copy family code:", error);
                showMessageModal("Couldn't copy the family code. Please select and copy it manually.");

            }

        }
    );


document
    .getElementById(
        "openCreateFamilyBtn"
    )
    ?.addEventListener(
        "click",
        () => {

            closeModal(
                "familyModal"
            );

            openModal(
                "createFamilyModal"
            );

        }
    );


document
    .getElementById(
        "openJoinFamilyBtn"
    )
    ?.addEventListener(
        "click",
        () => {

            closeModal(
                "familyModal"
            );

            openModal(
                "joinFamilyModal"
            );

        }
    );



/* =========================================================
   CREATE FAMILY FORM
========================================================= */

document
    .getElementById(
        "createFamilyForm"
    )
    ?.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const input =
                document.getElementById(
                    "familyNameInput"
                );


            const name =
                input.value.trim();


            if (!name) {
                return;
            }


            try {

                await createFamily(
                    name
                );

                input.value = "";

            } catch (error) {

                console.error(error);

                showMessageModal(
                    error.message ||
                    "Unable to create family."
                );

            }

        }
    );



/* =========================================================
   JOIN FAMILY FORM
========================================================= */

document
    .getElementById(
        "joinFamilyForm"
    )
    ?.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const input =
                document.getElementById(
                    "familyCodeInput"
                );


            const code =
                input.value.trim();


            if (!code) {
                return;
            }


            try {

                await joinFamily(
                    code
                );

                input.value = "";

            } catch (error) {

                console.error(error);

                showMessageModal(
                    error.message ||
                    "Unable to join family."
                );

            }

        }
    );



/* =========================================================
   LEAVE FAMILY
========================================================= */

document
    .getElementById(
        "leaveFamilyBtn"
    )
    ?.addEventListener(
        "click",
        () => {

            const isFamilyOwner =
                currentFamilyData?.ownerId === currentUser?.uid;
            const isSoleFamilyOwner =
                isFamilyOwner &&
                currentFamilyData?.members?.length === 1 &&
                currentFamilyData.members[0] === currentUser.uid;

            document.getElementById("leaveFamilyHeading").textContent =
                isSoleFamilyOwner
                    ? "Delete Family?"
                    : "Leave Family?";

            document.getElementById("leaveFamilyDescription").textContent =
                isSoleFamilyOwner
                    ? "This will permanently delete your family. Your account and personal documents will remain safe."
                    : "You will lose access to documents shared with this family. Your personal documents will remain safe.";

            const ownerLeaveNotice =
                document.getElementById("ownerLeaveNotice");

            ownerLeaveNotice.textContent =
                isSoleFamilyOwner
                    ? "You are the only family member. Leaving will permanently delete this family."
                    : "Family owners can't leave while other members remain. Transfer ownership to another member first.";
            ownerLeaveNotice.classList.toggle("hidden", !isFamilyOwner);

            document
                .getElementById("leaveFamilyError")
                .classList.add("hidden");

            document
                .getElementById("confirmLeaveFamilyBtn")
                .classList.toggle("hidden", isFamilyOwner && !isSoleFamilyOwner);

            document.getElementById("confirmLeaveFamilyBtn").textContent =
                isSoleFamilyOwner
                    ? "Delete Family"
                    : "Leave Family";

            openModal(
                "leaveFamilyModal"
            );

        }
    );


familyMembersList
    ?.addEventListener(
        "click",
        event => {

            const removeButton =
                event.target.closest("[data-remove-member-id]");

            if (removeButton) {
                pendingFamilyMemberRemoval = {
                    userId: removeButton.dataset.removeMemberId,
                    name: removeButton.dataset.removeMemberName
                };

                document.getElementById("removeFamilyMemberName").textContent =
                    pendingFamilyMemberRemoval.name;
                document.getElementById("removeFamilyMemberError").classList.add("hidden");

                openModal("removeFamilyMemberModal");

                return;
            }

            const transferButton =
                event.target.closest("[data-transfer-owner-id]");

            if (!transferButton) {
                return;
            }

            pendingOwnershipTransfer = {
                userId: transferButton.dataset.transferOwnerId,
                name: transferButton.dataset.transferOwnerName
            };

            document.getElementById("transferOwnerName").textContent =
                pendingOwnershipTransfer.name;

            document.getElementById("transferOwnershipError").classList.add("hidden");

            openModal(transferFamilyOwnershipModal.id);

        }
    );


document
    .getElementById("confirmRemoveFamilyMemberBtn")
    ?.addEventListener(
        "click",
        async () => {

            if (!pendingFamilyMemberRemoval) {
                return;
            }

            const confirmButton =
                document.getElementById("confirmRemoveFamilyMemberBtn");

            const errorMessage =
                document.getElementById("removeFamilyMemberError");

            confirmButton.disabled = true;
            errorMessage.classList.add("hidden");

            try {

                await removeFamilyMember(
                    pendingFamilyMemberRemoval.userId
                );

                closeModal("removeFamilyMemberModal");
                pendingFamilyMemberRemoval = null;

            } catch (error) {

                console.error("Unable to remove family member:", error);

                errorMessage.textContent =
                    error.code === "permission-denied"
                        ? "You don't have permission to remove this member. Check that the latest Firestore rules are deployed."
                        : error.message ||
                          "Unable to remove family member.";

                errorMessage.classList.remove("hidden");

            } finally {

                confirmButton.disabled = false;

            }

        }
    );


document
    .getElementById("dismissFamilyRemovalNotificationBtn")
    ?.addEventListener(
        "click",
        async () => {

            const notification =
                pendingRemovalNotifications[0];

            if (!notification) {
                closeModal("familyRemovalNotificationModal");
                return;
            }

            const dismissButton =
                document.getElementById("dismissFamilyRemovalNotificationBtn");

            const errorMessage =
                document.getElementById("familyRemovalNotificationError");

            dismissButton.disabled = true;
            errorMessage.classList.add("hidden");

            try {

                await updateDoc(
                    doc(db, "userNotifications", notification.id),
                    { dismissed: true }
                );

                pendingRemovalNotifications.shift();
                showNextRemovalNotification();

            } catch (error) {

                console.error("Unable to dismiss family removal notification:", error);

                errorMessage.textContent =
                    error.code === "permission-denied"
                        ? "Unable to save this dismissal. Check that the latest Firestore rules are deployed, then try again."
                        : error.message ||
                          "Unable to dismiss this message. Please try again.";

                errorMessage.classList.remove("hidden");

            } finally {

                dismissButton.disabled = false;

            }

        }
    );


document
    .getElementById("confirmOwnershipTransferBtn")
    ?.addEventListener(
        "click",
        async () => {

            if (!pendingOwnershipTransfer) {
                return;
            }

            const confirmButton =
                document.getElementById("confirmOwnershipTransferBtn");

            const errorMessage =
                document.getElementById("transferOwnershipError");

            confirmButton.disabled = true;
            errorMessage.classList.add("hidden");

            try {

                await transferFamilyOwnership(
                    pendingOwnershipTransfer.userId
                );

            } catch (error) {

                console.error("Unable to transfer family ownership:", error);

                errorMessage.textContent =
                    error.message ||
                    "Unable to transfer family ownership.";

                errorMessage.classList.remove("hidden");

            } finally {

                confirmButton.disabled = false;

            }

        }
    );


document
    .getElementById(
        "confirmLeaveFamilyBtn"
    )
    ?.addEventListener(
        "click",
        async () => {

            try {

                await leaveFamily();

            } catch (error) {

                console.error(error);

                const errorMessage =
                    document.getElementById("leaveFamilyError");

                errorMessage.textContent =
                    error.code === "permission-denied"
                        ? "Firestore denied this request. Publish the latest security rules with `firebase deploy --only firestore:rules`, then try again."
                        : error.message ||
                          "Unable to leave family.";

                errorMessage.classList.remove("hidden");

            }

        }
    );



/* =========================================================
   LOGOUT
========================================================= */

profileButton
    ?.addEventListener(
        "click",
        () => {

            profileDropdown.classList.toggle(
                "hidden"
            );

        }
    );


logoutBtn
    ?.addEventListener(
        "click",
        () => {

            profileDropdown.classList.add(
                "hidden"
            );

            openModal(
                "logoutModal"
            );

        }
    );


confirmLogoutBtn
    ?.addEventListener(
        "click",
        async () => {

            try {

                await signOut(
                    auth
                );

                window.location.href =
                    "./login.html";

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

                showMessageModal(
                    "Unable to logout. Please try again."
                );

            }

        }
    );



/* =========================================================
   CLOSE MODALS
========================================================= */

document
    .querySelectorAll(
        "[data-close-modal]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    closeModal(
                        button.dataset.closeModal
                    );

                }
            );

        }
    );



/* Close modal by clicking outside */

document
    .querySelectorAll(
        ".modal-overlay"
    )
    .forEach(
        overlay => {

            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        overlay &&
                        overlay.id !== "familyRemovalNotificationModal"
                    ) {
                        if (overlay.id === "permanentDeleteConfirmModal") {
                            finishPermanentDeleteConfirmation(false);
                        } else {
                            closeModal(overlay.id);
                        }

                    }

                }
            );

        }
    );


/* =========================================================
   UPLOAD DOCUMENT
========================================================= */

const uploadDocumentModal =
    document.getElementById(
        "uploadDocumentModal"
    );


const uploadDocumentForm =
    document.getElementById(
        "uploadDocumentForm"
    );


const documentFileInput =
    document.getElementById(
        "documentFileInput"
    );

const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024;
const MAX_UPLOAD_FILE_SIZE_LABEL = "10 MB";


const selectedFileName =
    document.getElementById(
        "selectedFileName"
    );


const uploadDocumentMessage =
    document.getElementById(
        "uploadDocumentMessage"
    );


const confirmUploadDocumentBtn =
    document.getElementById(
        "confirmUploadDocumentBtn"
    );

const documentAccessInput =
    document.getElementById("documentAccessInput");

const familyAccessHint =
    document.getElementById("familyAccessHint");

const selectedMembersPicker =
    document.getElementById("selectedMembersPicker");

const selectedMembersList =
    document.getElementById("selectedMembersList");

const selectedMembersHint =
    document.getElementById("selectedMembersHint");

const editDocumentModal =
    document.getElementById("editDocumentModal");

const editDocumentForm =
    document.getElementById("editDocumentForm");

const editDocumentNameInput =
    document.getElementById("editDocumentNameInput");

const editDocumentCategoryInput =
    document.getElementById("editDocumentCategoryInput");

const editDocumentExpiryInput =
    document.getElementById("editDocumentExpiryInput");

const editDocumentAccessInput =
    document.getElementById("editDocumentAccessInput");

const editDocumentFamilyHint =
    document.getElementById("editDocumentFamilyHint");

const editSelectedMembersPicker =
    document.getElementById("editSelectedMembersPicker");

const editSelectedMembersList =
    document.getElementById("editSelectedMembersList");

const editSelectedMembersHint =
    document.getElementById("editSelectedMembersHint");

const saveDocumentDetailsBtn =
    document.getElementById("saveDocumentDetailsBtn");

let editingDocument = null;


/* ---------------------------------------------------------
   OPEN UPLOAD MODAL
--------------------------------------------------------- */

function getFamilyMemberDisplayName(member) {

    const savedName =
        (member.name || "").trim();

    const nameParts =
        savedName.split(/\s+/).filter(Boolean);

    const email =
        member.email || "";

    const emailName =
        email.includes("@")
            ? email.slice(0, email.indexOf("@"))
            : "";

    const firstName =
        member.firstName ||
        nameParts[0] ||
        emailName ||
        "HomeVault";

    const lastName =
        member.lastName ||
        nameParts.slice(1).join(" ");

    return savedName || `${firstName} ${lastName}`.trim();

}


function updateSelectedMembersPicker() {

    if (!selectedMembersPicker || !selectedMembersList) {
        return;
    }

    const availableMembers =
        currentFamilyMembers.filter(
            member => member.id !== currentUser?.uid
        );

    selectedMembersPicker.classList.toggle(
        "hidden",
        documentAccessInput?.value !== "selected"
    );

    if (!currentFamilyData) {
        selectedMembersList.innerHTML = "";

        if (selectedMembersHint) {
            selectedMembersHint.textContent =
                "Join or create a family before choosing members.";
        }

        return;
    }

    if (!availableMembers.length) {
        selectedMembersList.innerHTML = "";

        if (selectedMembersHint) {
            selectedMembersHint.textContent =
                "No other family members are available to share with.";
        }

        return;
    }

    selectedMembersList.innerHTML =
        availableMembers.map(
            member => `
                <label class="selected-member-option">
                    <input
                        type="checkbox"
                        name="selectedMemberIds"
                        value="${escapeHTML(member.id)}"
                    >
                    <span>${escapeHTML(getFamilyMemberDisplayName(member))}</span>
                </label>
            `
        ).join("");

    updateSelectedMembersHint();

}


function updateSelectedMembersHint() {

    if (!selectedMembersHint || !selectedMembersList) {
        return;
    }

    const selectedCount =
        selectedMembersList.querySelectorAll(
            'input[name="selectedMemberIds"]:checked'
        ).length;

    selectedMembersHint.textContent =
        selectedCount
            ? `${selectedCount} family ${selectedCount === 1 ? "member" : "members"} selected.`
            : "Select at least one family member.";

}


function updateUploadAccessOptions() {

    if (!documentAccessInput) {
        return;
    }

    const hasFamily =
        Boolean(currentUserData?.familyId);

    if (!hasFamily) {

        documentAccessInput.value = "private";

        documentAccessInput.disabled = true;

        if (familyAccessHint) {
            familyAccessHint.textContent =
                "Join or create a family to share documents.";
        }

        updateSelectedMembersPicker();
        return;
    }

    documentAccessInput.disabled = false;

    const selectedOption =
        documentAccessInput.querySelector('option[value="selected"]');

    if (selectedOption) {
        selectedOption.disabled =
            !currentFamilyMembers.some(
                member => member.id !== currentUser?.uid
            );
    }

    if (familyAccessHint) {
        familyAccessHint.textContent = "";
    }

    updateSelectedMembersPicker();

}


function updateEditDocumentAccessOptions(selectedMemberIds = []) {
    if (!editDocumentAccessInput || !editSelectedMembersList) {
        return;
    }

    const availableMembers =
        currentFamilyMembers.filter(
            member => member.id !== currentUser?.uid
        );

    const hasFamily =
        Boolean(currentUserData?.familyId && currentFamilyData);

    editDocumentAccessInput.disabled = !hasFamily;

    if (!hasFamily) {
        editDocumentAccessInput.value = "private";
        editDocumentFamilyHint.textContent =
            "Join or create a family to share documents.";
    } else {
        editDocumentFamilyHint.textContent = "";
    }

    const selectedOption =
        editDocumentAccessInput.querySelector('option[value="selected"]');

    if (selectedOption) {
        selectedOption.disabled = availableMembers.length === 0;
    }

    editSelectedMembersPicker.classList.toggle(
        "hidden",
        editDocumentAccessInput.value !== "selected"
    );

    if (!availableMembers.length) {
        editSelectedMembersList.innerHTML = "";
        editSelectedMembersHint.textContent =
            "No other family members are available to share with.";
        return;
    }

    editSelectedMembersList.innerHTML =
        availableMembers.map(
            member => `
                <label class="selected-member-option">
                    <input
                        type="checkbox"
                        name="editSelectedMemberIds"
                        value="${escapeHTML(member.id)}"
                        ${selectedMemberIds.includes(member.id) ? "checked" : ""}
                    >
                    <span>${escapeHTML(getFamilyMemberDisplayName(member))}</span>
                </label>
            `
        ).join("");

    updateEditSelectedMembersHint();
}


function updateEditSelectedMembersHint() {
    const selectedCount =
        editSelectedMembersList?.querySelectorAll(
            'input[name="editSelectedMemberIds"]:checked'
        ).length || 0;

    editSelectedMembersHint.textContent =
        selectedCount
            ? `${selectedCount} family ${selectedCount === 1 ? "member" : "members"} selected.`
            : "Select at least one family member.";
}


function openEditDocumentModal(documentRecord) {
    editingDocument = documentRecord;
    editDocumentNameInput.value =
        documentRecord.fileName || documentRecord.name || "";
    editDocumentCategoryInput.value =
        documentRecord.category || "Other";
    editDocumentExpiryInput.value =
        documentRecord.expiryDate || "";
    editDocumentAccessInput.value =
        documentRecord.accessLevel || "private";

    updateEditDocumentAccessOptions(
        documentRecord.sharedWithMemberIds || []
    );

    saveDocumentDetailsBtn.disabled = false;
    saveDocumentDetailsBtn.textContent = "Save changes";
    openModal("editDocumentModal");
}


editDocumentAccessInput?.addEventListener(
    "change",
    () => updateEditDocumentAccessOptions(
        Array.from(
            editSelectedMembersList.querySelectorAll(
                'input[name="editSelectedMemberIds"]:checked'
            )
        ).map(input => input.value)
    )
);

editSelectedMembersList?.addEventListener(
    "change",
    updateEditSelectedMembersHint
);


editDocumentForm?.addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        if (!editingDocument || editingDocument.ownerId !== currentUser?.uid) {
            showMessageModal(
                "Only the document owner can update its details.",
                "Unable to edit document"
            );
            return;
        }

        const name =
            editDocumentNameInput.value.trim();

        const category =
            editDocumentCategoryInput.value;

        const expiryDate =
            editDocumentExpiryInput.value || null;

        const accessLevel =
            editDocumentAccessInput.value;

        const selectedMemberIds =
            Array.from(
                editSelectedMembersList.querySelectorAll(
                    'input[name="editSelectedMemberIds"]:checked'
                )
            ).map(input => input.value);

        if (!name) {
            showMessageModal(
                "Enter a name for this document.",
                "Document name required"
            );
            return;
        }

        const validFamilyMemberIds =
            new Set(
                currentFamilyMembers
                    .filter(member => member.id !== currentUser.uid)
                    .map(member => member.id)
            );

        if (
            accessLevel === "selected" &&
            (
                !selectedMemberIds.length ||
                selectedMemberIds.some(
                    memberId => !validFamilyMemberIds.has(memberId)
                )
            )
        ) {
            showMessageModal(
                "Choose at least one current family member to share with.",
                "Choose family members"
            );
            return;
        }

        saveDocumentDetailsBtn.disabled = true;
        saveDocumentDetailsBtn.textContent = "Saving...";

        const documentRef =
            doc(db, "documents", editingDocument.id);

        const documentNameKey =
            encodeURIComponent(normalizeDocumentName(name));

        const oldDocumentNameKey =
            editingDocument.documentNameKey ||
            encodeURIComponent(
                normalizeDocumentName(
                    editingDocument.fileName || editingDocument.name || ""
                )
            );

        const newReservationRef =
            doc(
                db,
                "users",
                currentUser.uid,
                "documentNameReservations",
                documentNameKey
            );

        const oldReservationRef =
            doc(
                db,
                "users",
                currentUser.uid,
                "documentNameReservations",
                oldDocumentNameKey
            );

        let accessControlChanged = false;
        const newFamilyId =
            accessLevel === "private"
                ? null
                : currentUserData?.familyId || null;

        try {
            const existingDocumentsSnapshot =
                await getDocs(
                    query(
                        collection(db, "documents"),
                        where("ownerId", "==", currentUser.uid)
                    )
                );

            const duplicate =
                existingDocumentsSnapshot.docs.some(
                    existingDocument =>
                        existingDocument.id !== editingDocument.id &&
                        normalizeDocumentName(
                            existingDocument.data().fileName ||
                            existingDocument.data().name ||
                            ""
                        ) === normalizeDocumentName(name)
                );

            if (duplicate) {
                throw new Error(
                    "A document with this name already exists. Choose a different name."
                );
            }

            accessControlChanged =
                await syncSupabaseDocumentAccess(
                    editingDocument,
                    accessLevel,
                    newFamilyId,
                    selectedMemberIds
                );

            await runTransaction(db, async transaction => {
                const [
                    currentSnapshot,
                    newReservationSnapshot,
                    oldReservationSnapshot
                ] = await Promise.all([
                    transaction.get(documentRef),
                    transaction.get(newReservationRef),
                    documentNameKey === oldDocumentNameKey
                        ? Promise.resolve(null)
                        : transaction.get(oldReservationRef)
                ]);

                if (
                    !currentSnapshot.exists() ||
                    currentSnapshot.data().ownerId !== currentUser.uid ||
                    currentSnapshot.data().isDeleted === true
                ) {
                    throw new Error(
                        "This document is unavailable or you no longer own it."
                    );
                }

                if (
                    newReservationSnapshot.exists() &&
                    newReservationSnapshot.data().documentId !== editingDocument.id
                ) {
                    throw new Error(
                        "A document with this name already exists. Choose a different name."
                    );
                }

                if (!newReservationSnapshot.exists()) {
                    transaction.set(
                        newReservationRef,
                        {
                            ownerId: currentUser.uid,
                            documentId: editingDocument.id,
                            createdAt: serverTimestamp()
                        }
                    );
                }

                if (
                    oldReservationSnapshot?.exists() &&
                    oldReservationSnapshot.data().documentId === editingDocument.id
                ) {
                    transaction.delete(oldReservationRef);
                }

                transaction.update(
                    documentRef,
                    {
                        fileName: name,
                        documentNameKey,
                        category,
                        expiryDate,
                        accessLevel,
                        sharedWithMemberIds:
                            accessLevel === "selected"
                                ? selectedMemberIds
                                : [],
                        familyId: newFamilyId,
                        sharedWithFamily: accessLevel !== "private",
                        updatedAt: serverTimestamp()
                    }
                );
            });

            closeModal("editDocumentModal");
            await loadDocuments();
            showSuccessModal(
                "Document details were updated successfully.",
                "Changes saved"
            );
        } catch (error) {
            let accessRollbackFailed = false;

            if (accessControlChanged) {
                try {
                    await syncExistingSupabaseDocumentAccess(
                        editingDocument
                    );
                } catch (rollbackError) {
                    console.error(
                        "Unable to restore previous document access:",
                        rollbackError
                    );
                    accessRollbackFailed = true;
                    showMessageModal(
                        "Document details were not saved, and the previous file-sharing permissions could not be restored. Review Supabase access policies before sharing this file again.",
                        "Sharing permissions need attention"
                    );
                }
            }

            console.error("Unable to update document details:", error);
            if (!accessRollbackFailed) {
                showMessageModal(
                    error instanceof Error
                        ? error.message
                        : "Unable to update this document. Please try again.",
                    "Changes not saved"
                );
            }
        } finally {
            saveDocumentDetailsBtn.disabled = false;
            saveDocumentDetailsBtn.textContent = "Save changes";
        }
    }
);


function normalizeDocumentName(name) {
    return name
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}


documentAccessInput?.addEventListener(
    "change",
    updateSelectedMembersPicker
);

selectedMembersList?.addEventListener(
    "change",
    updateSelectedMembersHint
);


function openUploadModal() {

    if (!uploadDocumentModal) {
        return;
    }

    uploadDocumentForm?.reset();

    if (selectedFileName) {
        selectedFileName.textContent =
            "No file selected";
    }

    if (uploadDocumentMessage) {
        uploadDocumentMessage.textContent =
            "";

        uploadDocumentMessage.className =
            "upload-document-message";
    }

    if (confirmUploadDocumentBtn) {
        confirmUploadDocumentBtn.disabled =
            false;

        confirmUploadDocumentBtn.textContent =
            "Upload Document";
    }

            updateUploadAccessOptions();

    uploadDocumentModal.classList.remove(
        "hidden"
    );

}


/* ---------------------------------------------------------
   DASHBOARD UPLOAD BUTTON
--------------------------------------------------------- */

document
    .getElementById("uploadDocumentBtn")
    ?.addEventListener(
        "click",
        openUploadModal
    );


/* ---------------------------------------------------------
   EMPTY STATE UPLOAD BUTTON
--------------------------------------------------------- */

document
    .getElementById("emptyUploadBtn")
    ?.addEventListener(
        "click",
        openUploadModal
    );


/* ---------------------------------------------------------
   MY DOCUMENTS UPLOAD BUTTON
--------------------------------------------------------- */

document
    .getElementById("documentsUploadBtn")
    ?.addEventListener(
        "click",
        openUploadModal
    );


uploadDocumentForm
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const file =
                documentFileInput?.files?.[0];

            const documentName =
                document.getElementById("documentNameInput").value.trim();

            const category =
                document.getElementById("documentCategoryInput").value;

            const expiryDate =
                document.getElementById("documentExpiryInput").value;

            const accessLevel =
                documentAccessInput?.value || "private";

            const selectedMemberIds =
                Array.from(
                    selectedMembersList?.querySelectorAll(
                        'input[name="selectedMemberIds"]:checked'
                    ) || []
                ).map(input => input.value);

            if (!currentUser || !file) {
                showMessageModal(
                    "Choose a document file before uploading.",
                    "Unable to upload document"
                );

                return;
            }

            if (file.size > MAX_UPLOAD_FILE_SIZE) {
                showMessageModal(
                    `The selected file exceeds the ${MAX_UPLOAD_FILE_SIZE_LABEL} limit. Choose a smaller file.`,
                    "File is too large"
                );

                return;
            }

            if (accessLevel === "selected") {
                const currentMemberIds =
                    new Set(
                        currentFamilyMembers
                            .filter(member => member.id !== currentUser.uid)
                            .map(member => member.id)
                    );

                if (
                    !selectedMemberIds.length ||
                    selectedMemberIds.some(
                        memberId => !currentMemberIds.has(memberId)
                    )
                ) {
                    showMessageModal(
                        "Choose at least one current family member to share with.",
                        "Unable to upload document"
                    );

                    return;
                }
            }

            confirmUploadDocumentBtn.disabled = true;
            confirmUploadDocumentBtn.textContent = "Uploading...";
            uploadDocumentMessage.textContent = "Uploading your document...";
            uploadDocumentMessage.className = "upload-document-message";

            const documentRef =
                doc(collection(db, "documents"));

            const sanitizedFileName =
                file.name
                    .replace(/[\\/\u0000-\u001f]/g, "_")
                    .trim() || "document";

            const storagePath =
                `${currentUser.uid}/${documentRef.id}/${sanitizedFileName}`;

            const documentFamilyId =
                accessLevel === "private"
                    ? null
                    : currentUserData?.familyId || null;

            const normalizedDocumentName =
                normalizeDocumentName(documentName);

            const documentNameKey =
                encodeURIComponent(normalizedDocumentName);

            const documentNameReservationRef =
                doc(
                    db,
                    "users",
                    currentUser.uid,
                    "documentNameReservations",
                    documentNameKey
                );

            let fileUploaded = false;
            let accessControlSynced = false;
            let supabase;

            try {
                const existingDocumentsSnapshot =
                    await getDocs(
                        query(
                            collection(db, "documents"),
                            where("ownerId", "==", currentUser.uid)
                        )
                    );

                const hasDuplicateName =
                    existingDocumentsSnapshot.docs.some(
                        existingDocument =>
                            normalizeDocumentName(
                                existingDocument.data().fileName || ""
                            ) === normalizedDocumentName
                    );

                if (hasDuplicateName) {
                    showMessageModal(
                        "A document with this name already exists. Choose a different name.",
                        "Duplicate document name"
                    );

                    return;
                }

                if (accessLevel !== "private") {
                    if (!documentFamilyId) {
                        throw new Error(
                            "Join a family before sharing documents with family members."
                        );
                    }

                    await syncSupabaseFamilyMembershipsFromFirestore(
                        documentFamilyId
                    );
                }

                supabase = getSupabaseClient();

                const { error: uploadError } =
                    await supabase.storage
                        .from(documentStorageBucket)
                        .upload(
                            storagePath,
                            file,
                            {
                                contentType: file.type,
                                upsert: false
                            }
                        );

                if (uploadError) {
                    throw uploadError;
                }

                fileUploaded = true;

                if (accessLevel !== "private") {
                    accessControlSynced =
                        await syncSupabaseDocumentAccess(
                            {
                                storageBucket: documentStorageBucket,
                                storagePath
                            },
                            accessLevel,
                            documentFamilyId,
                            selectedMemberIds
                        );
                }

                const ownerName =
                    currentUserData?.name ||
                    currentUser.displayName ||
                    currentUser.email?.split("@")[0] ||
                    "User";

                const uploaderName =
                    currentUser.displayName ||
                    currentUser.email ||
                    ownerName;

                await runTransaction(db, async transaction => {
                    const reservationSnapshot =
                        await transaction.get(documentNameReservationRef);

                    if (reservationSnapshot.exists()) {
                        throw new Error(
                            "A document with this name already exists. Choose a different name."
                        );
                    }

                    transaction.set(
                        documentNameReservationRef,
                        {
                            ownerId: currentUser.uid,
                            documentId: documentRef.id,
                            createdAt: serverTimestamp()
                        }
                    );

                    transaction.set(
                        documentRef,
                        {
                            ownerId: currentUser.uid,
                            ownerName,
                            uploadedBy: currentUser.uid,
                            uploaderName,
                            uploaderRole: currentUserData?.familyRole === "owner"
                                ? "owner"
                                : currentUserData?.familyId
                                    ? "family_member"
                                    : "owner",
                            fileName: documentName,
                            documentNameKey,
                            originalFileName: file.name,
                            category,
                            expiryDate: expiryDate || null,
                            accessLevel,
                            sharedWithMemberIds: accessLevel === "selected"
                                ? selectedMemberIds
                                : [],
                            familyId: documentFamilyId,
                            sharedWithFamily: accessLevel !== "private",
                            storageBucket: documentStorageBucket,
                            storagePath,
                            filePath: storagePath,
                            contentType: file.type,
                            fileSize: file.size,
                            isDeleted: false,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        }
                    );
                });

                fileUploaded = false;
                accessControlSynced = false;

                uploadDocumentForm.reset();
                selectedFileName.textContent = "No file selected";
                updateUploadAccessOptions();

                await loadDocuments();
                closeModal("uploadDocumentModal");
                showUploadSuccessModal(documentName);

            } catch (error) {

                console.error("Document upload error:", error);

                if (accessControlSynced) {
                    try {
                        await syncSupabaseDocumentAccess(
                            {
                                storageBucket: documentStorageBucket,
                                storagePath
                            },
                            "private",
                            null
                        );
                    } catch (cleanupError) {
                        console.error(
                            "Uploaded document access cleanup error:",
                            cleanupError
                        );
                    }
                }

                if (fileUploaded) {
                    try {
                        const { error: cleanupError } =
                            await supabase.storage
                                .from(documentStorageBucket)
                                .remove([storagePath]);

                        if (cleanupError) {
                            throw cleanupError;
                        }
                    } catch (cleanupError) {
                        console.error("Uploaded file cleanup error:", cleanupError);
                    }
                }

                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : String(error);

                showMessageModal(
                    errorMessage.startsWith(
                        "A document with this name already exists."
                    )
                        ? errorMessage
                        : `Upload failed: ${errorMessage}`,
                    errorMessage.startsWith(
                        "A document with this name already exists."
                    )
                        ? "Duplicate document name"
                        : "Upload failed"
                );

            } finally {

                confirmUploadDocumentBtn.disabled = false;
                confirmUploadDocumentBtn.textContent = "Upload Document";

            }

        }
    );


/* ---------------------------------------------------------
   FILE NAME PREVIEW
--------------------------------------------------------- */

documentFileInput
    ?.addEventListener(
        "change",
        () => {

            const file =
                documentFileInput.files?.[0];

            if (!file) {

                selectedFileName.textContent =
                    "No file selected";

                uploadDocumentMessage.textContent = "";
                uploadDocumentMessage.className =
                    "upload-document-message";

                return;
            }

            selectedFileName.textContent =
                file.name;

            if (file.size > MAX_UPLOAD_FILE_SIZE) {
                uploadDocumentMessage.textContent =
                    `File exceeds the ${MAX_UPLOAD_FILE_SIZE_LABEL} limit. Choose a smaller file.`;
                uploadDocumentMessage.className =
                    "upload-document-message error";

                return;
            }

            uploadDocumentMessage.textContent = "";
            uploadDocumentMessage.className =
                "upload-document-message";

        }
    );

/* =========================================================
   MOBILE SIDEBAR
========================================================= */

const mobileMenuBtn =
    document.getElementById(
        "mobileMenuBtn"
    );

const mobileOverlay =
    document.getElementById(
        "mobileOverlay"
    );

mobileMenuBtn
    ?.addEventListener(
        "click",
        () => {

            sidebar.classList.add(
                "mobile-open"
            );

            mobileOverlay.classList.remove(
                "hidden"
            );

        }
    );


mobileOverlay
    ?.addEventListener(
        "click",
        closeMobileMenu
    );


document
    .querySelectorAll(
        ".nav-item"
    )
    .forEach(
        item => {

            item.addEventListener(
                "click",
                closeMobileMenu
            );

        }
    );


function closeMobileMenu() {

    sidebar.classList.remove(
        "mobile-open"
    );

    mobileOverlay.classList.add(
        "hidden"
    );

}



/* =========================================================
   CLOSE PROFILE DROPDOWN
========================================================= */

document.addEventListener(
    "click",
    event => {

        if (
            !profileButton?.contains(
                event.target
            ) &&
            !profileDropdown?.contains(
                event.target
            )
        ) {

            profileDropdown?.classList.add(
                "hidden"
            );

        }

    }
);



/* =========================================================
   TEMPORARY MESSAGE
========================================================= */

function showTemporaryMessage(
    message
) {
    const notification =
        document.createElement(
            "div"
        );

    notification.textContent =
        message;

    notification.className = "dashboard-toast";
    notification.setAttribute("role", "status");

    document.body.appendChild(
        notification
    );


    setTimeout(
        () => {

            notification.remove();

        },
        2500
    );

}


function showMessageModal(message, heading = "Something went wrong") {

    document.getElementById("appMessageHeading").textContent =
        heading;

    document.getElementById("appMessageText").textContent =
        message;

    openModal("appMessageModal");

}


let resolvePermanentDeleteConfirmation = null;

function requestPermanentDeleteConfirmation(documentName) {
    const name =
        document.getElementById("permanentDeleteConfirmText");
    const confirmButton =
        document.getElementById("confirmPermanentDeleteBtn");

    name.textContent =
        `Permanently delete "${documentName}"? This will remove the file and cannot be undone.`;
    openModal("permanentDeleteConfirmModal");
    confirmButton.focus();

    return new Promise(resolve => {
        resolvePermanentDeleteConfirmation = resolve;
    });
}


function finishPermanentDeleteConfirmation(confirmed) {
    if (!resolvePermanentDeleteConfirmation) {
        return;
    }

    const resolve =
        resolvePermanentDeleteConfirmation;
    resolvePermanentDeleteConfirmation = null;
    closeModal("permanentDeleteConfirmModal");
    resolve(confirmed);
}


document
    .getElementById("cancelPermanentDeleteBtn")
    .addEventListener(
        "click",
        () => finishPermanentDeleteConfirmation(false)
    );

document
    .getElementById("confirmPermanentDeleteBtn")
    .addEventListener(
        "click",
        () => finishPermanentDeleteConfirmation(true)
    );


function showUploadSuccessModal(documentName) {
    showSuccessModal(
        `${documentName} uploaded successfully.`,
        "Upload successful"
    );
}

function showSuccessModal(message, heading) {
    document.getElementById("uploadSuccessHeading").textContent =
        heading;

    document.getElementById("uploadSuccessText").textContent =
        message;

    openModal("uploadSuccessModal");

}