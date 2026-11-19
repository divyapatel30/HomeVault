import { createClient } from "@supabase/supabase-js";
import { auth } from "../firebase/firebase.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const documentStorageBucket =
    import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || "documents";

let supabase;

export function getSupabaseClient() {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            "Supabase Storage is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then restart the dev server."
        );
    }

    if (!supabase) {
        supabase = createClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                accessToken: async () => {
                    const user = auth.currentUser;

                    return user ? user.getIdToken() : null;
                }
            }
        );
    }

    return supabase;
}
