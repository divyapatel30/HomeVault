# HomeVault

HomeVault is a secure family and personal document organizer designed to keep important records in one place while preserving privacy and controlled sharing.

## Project idea

A secure family document vault where each person can organize their own documents, share selected documents with family members, find files quickly, and track expiry dates.

## Core privacy principle

Each document has an owner. The owner decides who can access it. Family membership does not automatically grant access to everyone else's private files.

## Main user roles

- Family Owner: manages the family and their own documents
- Family Member: manages their own documents and can access documents shared with them

## MVP focus

The first version of HomeVault will include:

- User registration and login
- Family creation, membership, owner-only member removal, ownership transfer, and deletion by a sole-member owner
- Document upload for PDF and image files
- Document organization by family member and category
- Search and filters
- Sharing model: Only Me, Entire Family, or Selected Family Members
- View and download access for shared users
- Expiry tracking and warnings
- Secure family isolation and access control

## Technology stack

- HTML5
- CSS3
- JavaScript
- Firebase Authentication
- Cloud Firestore
- Supabase Storage
- Firebase Security Rules
- Firebase Hosting

## Project structure

- index.html – landing page
- pages/login.html – login page
- pages/signup.html – sign-up page
- css/ – styling for the app
- js/ – frontend logic and Firebase integration
- assets/ – branding and media
- docs/ – product requirements and UI planning

## Getting started

1. Copy `.env.example` to `.env.local` and set the Supabase project URL, publishable/anon key, and private storage bucket ID.
2. Configure Firebase Authentication and Firestore in `js/firebase/firebase.js`.
3. In Supabase, enable Firebase as a third-party authentication provider using the Firebase project ID. The dashboard passes the signed-in Firebase user's ID token to Supabase.
4. Create the private storage bucket named in `VITE_SUPABASE_STORAGE_BUCKET` (defaults to `documents`).
5. In the Supabase SQL Editor, create Storage policies for the private bucket. All uploads use `<firebase-uid>/<document-id>/<filename>` so the Firebase UID remains the first folder to satisfy the ownership policy below. Run:

   ```sql
   create policy "Users can upload their own documents"
   on storage.objects
   for insert
   to public
   with check (
     bucket_id = 'documents'
     and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
   );

   create policy "Users can read their own documents"
   on storage.objects
   for select
   to public
   using (
     bucket_id = 'documents'
     and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
   );

   create policy "Users can update their own documents"
   on storage.objects
   for update
   to public
   using (
     bucket_id = 'documents'
     and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
   )
   with check (
     bucket_id = 'documents'
     and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
   );

   create policy "Users can delete their own documents"
   on storage.objects
   for delete
   to public
   using (
     bucket_id = 'documents'
     and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
   );
   ```

   These policies apply to `public` so they also work if the Firebase JWT is not mapped to Supabase's `authenticated` Postgres role. The `sub` folder check is still required: requests without a verified Firebase subject cannot access an object. If using a bucket ID other than `documents`, replace the bucket ID in every policy. If these policy names already exist, edit the existing policies or choose different names. Never put a Supabase service-role key in the frontend.
6. To enable private family file sharing, run `supabase/family-sharing.sql` in the Supabase SQL Editor. This creates the family membership and per-file access tables, the RLS policies, and the narrowly scoped RPC functions used by the dashboard. Keep the bucket private. The SQL policy uses the default `documents` bucket; if `VITE_SUPABASE_STORAGE_BUCKET` has another value, replace `documents` in that policy before running the script. Re-run the script after pulling SQL updates.
7. Deploy the membership sync Edge Function to the Supabase project referenced by `supabase/config.toml`:

   ```powershell
   npx supabase login
   npx supabase functions deploy sync-family-membership --remote=osbxtvbofudxqerqnhjw --no-verify-jwt --use-api
   ```

   Supabase Edge Functions are used instead of Firebase Cloud Functions. The function verifies the signed-in Firebase user's membership against Firestore before syncing the authoritative roster. Its service-role key is provided server-side by Supabase and must never be copied into frontend configuration. The function explicitly verifies Firebase tokens, so `verify_jwt = false` in `supabase/config.toml` is required.
8. Run `npm install` and `npm run dev`.

The family roster and document metadata remain in Firestore; Supabase stores only active family membership for storage authorization and explicit per-file recipient grants. The Edge Function lets any current family member securely synchronize the Firestore roster when they load the dashboard or upload a shared document, so sharing does not depend on the owner refreshing. Removing a member synchronizes the reduced roster, revokes their grants, and makes their family-shared documents private (including trashed documents). Supabase signed URLs already issued remain usable until they expire (the dashboard creates them for five minutes).

Document preview and download use short-lived Supabase signed URLs and require the read policy above. If you already created the read policy with target role `authenticated`, change its target role to `public` while keeping the owner UID condition:

```sql
alter policy "Users can read their own documents"
on storage.objects
to public;
```

The app continues to use Firebase for authentication and Firestore metadata; only document binary storage and its minimal access-control records are handled by Supabase. Files are stored privately and their bucket/path are saved in Firestore instead of a permanent download URL. Family file reads require both an explicit per-document grant and an active Supabase family-membership row. Only the family owner synchronizes membership; members cannot add themselves to the Supabase roster. Never make the bucket public or put a service-role key in the frontend. Files that were previously stored only in Firebase Storage also need to be migrated to Supabase before they can use the new Supabase file path.

Document names are unique per owner, ignoring case and repeated whitespace. A name remains reserved while its document is in the trash so it cannot collide if the document is restored. Deploy the updated Firestore rules after pulling changes so the name reservation and document metadata are written atomically:

Documents in Trash are soft-deleted and hidden from family members. Owners can restore them or permanently delete them from Trash; permanent deletion removes the Supabase object, Firestore document, and name reservation. The My Documents and Shared Documents views support filename, category, family member, file type, and expiry filters.
If permanent deletion reports a Firestore permission error, deploy the updated Firestore rules below and retry from Trash. The file may already have been removed from Supabase, but retrying completes the Firestore cleanup.

```powershell
npx firebase-tools deploy --only firestore
```

This deploys the Firestore rules and the composite indexes used by the owner and
family document queries. Index creation can take a few minutes.

## Deploying Firestore rules and indexes

The Firestore security rules are defined in `firestore.rules`, and composite
indexes are defined in `firestore.indexes.json`. Deploy them to the configured
Firebase project with `firebase deploy --only firestore`, or publish the rules
in the Firebase Console and create the indexes before using family features.

## Development approach

The project follows a Waterfall-inspired workflow:

1. Requirements
2. Analysis and design
3. Firebase learning and setup
4. Implementation
5. Testing
6. Deployment and documentation

This MVP-first approach keeps the system simple, secure, and easy for the whole team to understand.
