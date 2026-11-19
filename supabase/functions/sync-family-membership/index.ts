const firebaseProjectId = "homevault-3d291";
const allowedOrigins = new Set([
    "https://homevault-3d291.web.app",
    "https://homevault-3d291.firebaseapp.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]);

interface FirestoreValue {
    stringValue?: string;
    arrayValue?: {
        values?: FirestoreValue[];
    };
}

interface FirestoreDocument {
    fields?: Record<string, FirestoreValue>;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
    return {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin"
    };
}

function respond(
    body: Record<string, string>,
    status: number,
    origin: string | null
): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...getCorsHeaders(origin),
            "Content-Type": "application/json"
        }
    });
}

function getFirebaseUid(idToken: string): string | null {
    const segments = idToken.split(".");

    if (segments.length !== 3) {
        return null;
    }

    try {
        const base64Payload =
            segments[1]
                .replace(/-/g, "+")
                .replace(/_/g, "/");
        const paddedPayload =
            base64Payload.padEnd(
                Math.ceil(base64Payload.length / 4) * 4,
                "="
            );
        const claims = JSON.parse(atob(paddedPayload));

        if (
            claims.aud !== firebaseProjectId ||
            claims.iss !== `https://securetoken.google.com/${firebaseProjectId}` ||
            typeof claims.sub !== "string" ||
            !claims.sub
        ) {
            return null;
        }

        return claims.sub;
    } catch {
        return null;
    }
}

async function getFirestoreDocument(
    path: string,
    idToken: string
): Promise<FirestoreDocument | null> {
    const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/${path}`,
        {
            headers: {
                Authorization: `Bearer ${idToken}`
            }
        }
    );

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(
            response.status === 401 || response.status === 403
                ? "Firebase could not verify this account's family access."
                : "Firebase family membership could not be checked."
        );
    }

    return await response.json() as FirestoreDocument;
}

Deno.serve(async request => {
    const origin = request.headers.get("origin");

    if (origin && !allowedOrigins.has(origin)) {
        return respond({ error: "Origin is not allowed." }, 403, null);
    }

    if (request.method === "OPTIONS") {
        return new Response("ok", {
            headers: getCorsHeaders(origin)
        });
    }

    if (request.method !== "POST") {
        return respond({ error: "Method not allowed." }, 405, origin);
    }

    const authorization =
        request.headers.get("authorization") || "";
    const tokenMatch =
        authorization.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch) {
        return respond({ error: "A Firebase sign-in is required." }, 401, origin);
    }

    const idToken = tokenMatch[1];
    const callerUid = getFirebaseUid(idToken);

    if (!callerUid) {
        return respond({ error: "The Firebase sign-in token is invalid." }, 401, origin);
    }

    let requestBody: { familyId?: unknown };

    try {
        requestBody = await request.json();
    } catch {
        return respond({ error: "A valid family ID is required." }, 400, origin);
    }

    if (
        typeof requestBody.familyId !== "string" ||
        !requestBody.familyId.trim() ||
        requestBody.familyId.length > 128
    ) {
        return respond({ error: "A valid family ID is required." }, 400, origin);
    }

    const familyId = requestBody.familyId.trim();
    let familyDocument: FirestoreDocument | null;
    let userDocument: FirestoreDocument | null;

    try {
        [familyDocument, userDocument] = await Promise.all([
            getFirestoreDocument(
                `families/${encodeURIComponent(familyId)}`,
                idToken
            ),
            getFirestoreDocument(
                `users/${encodeURIComponent(callerUid)}`,
                idToken
            )
        ]);
    } catch (error) {
        return respond(
            {
                error: error instanceof Error
                    ? error.message
                    : "Firebase family membership could not be checked."
            },
            502,
            origin
        );
    }

    const familyFields = familyDocument?.fields;
    const userFields = userDocument?.fields;
    const ownerUid =
        familyFields?.ownerId?.stringValue;
    const memberIds =
        familyFields?.members?.arrayValue?.values;
    const userFamilyId =
        userFields?.familyId?.stringValue;
    const verifiedMemberIds =
        Array.isArray(memberIds)
            ? memberIds
                .map(member => member.stringValue)
                .filter((member): member is string => typeof member === "string")
            : [];

    if (
        typeof ownerUid !== "string" ||
        userFamilyId !== familyId ||
        !verifiedMemberIds.includes(callerUid) ||
        !verifiedMemberIds.includes(ownerUid)
    ) {
        return respond(
            { error: "This account is not an active member of that family." },
            403,
            origin
        );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
        console.error("Supabase service configuration is unavailable.");
        return respond(
            { error: "Secure family sharing is not configured on the server." },
            500,
            origin
        );
    }

    let syncResponse: Response;

    try {
        syncResponse = await fetch(
            `${supabaseUrl}/rest/v1/rpc/sync_family_members_from_firestore`,
            {
                method: "POST",
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    p_family_id: familyId,
                    p_owner_uid: ownerUid,
                    p_member_ids: [...new Set(verifiedMemberIds)]
                })
            }
        );
    } catch (error) {
        console.error("Supabase family membership sync request failed:", error);
        return respond(
            { error: "Secure family sharing could not be synchronized. Try again." },
            502,
            origin
        );
    }

    if (!syncResponse.ok) {
        console.error(
            "Supabase family membership sync failed with status:",
            syncResponse.status
        );
        return respond(
            { error: "Secure family sharing could not be synchronized. Try again." },
            502,
            origin
        );
    }

    return respond({ success: "Family membership synchronized." }, 200, origin);
});
