# HomeVault Diagrams

## Sequence diagrams

The diagrams below describe the main HomeVault MVP interactions. They show the
intended access-control checks for document sharing; document Firestore and
Storage rules still need to be implemented before shared-document access is
securely enforced.

### User registration

```mermaid
sequenceDiagram
    actor User
    participant UI as HomeVault Web App
    participant Auth as Firebase Authentication
    participant DB as Cloud Firestore
    participant Mail as Email Service

    User->>UI: Submit name, email, and password
    UI->>Auth: Create account
    Auth-->>UI: Return user UID
    UI->>DB: Create users/{uid} profile
    DB-->>UI: Profile saved
    UI->>Mail: Send verification email
    Mail-->>User: Verification link
    UI->>Auth: Sign out until email is verified
```

### Create or join a family

```mermaid
sequenceDiagram
    actor User
    participant UI as HomeVault Web App
    participant DB as Cloud Firestore

    alt Create family
        User->>UI: Enter family name
        UI->>DB: Run transaction with new family code
        DB->>DB: Check family code is unused
        DB->>DB: Create families/{familyId} with owner and members
        DB->>DB: Set users/{uid}.familyId and familyRole = owner
        DB-->>UI: Family created
        UI-->>User: Show family invite code
    else Join family
        User->>UI: Enter family invite code
        UI->>DB: Run transaction for family and user
        DB->>DB: Check family exists and user can join
        DB->>DB: Add UID to family members
        DB->>DB: Set users/{uid}.familyId and familyRole = member
        DB-->>UI: Membership saved
        UI-->>User: Show family dashboard
    end
```

### Upload a document

```mermaid
sequenceDiagram
    actor Owner
    participant UI as HomeVault Web App
    participant Storage as Firebase Storage
    participant DB as Cloud Firestore

    Owner->>UI: Select file and enter details
    Owner->>UI: Choose Only Me or family access
    UI->>Storage: Upload file to owner's document path
    Storage-->>UI: Upload complete
    UI->>Storage: Request download URL
    Storage-->>UI: Return download URL
    UI->>DB: Save owner, file, category, expiry, and access metadata
    DB-->>UI: Document metadata saved
    UI-->>Owner: Show upload success
```

### View a shared document

```mermaid
sequenceDiagram
    actor Member as Family Member
    participant UI as HomeVault Web App
    participant DB as Cloud Firestore
    participant Rules as Firestore and Storage Rules
    participant Storage as Firebase Storage

    Member->>UI: Open shared documents
    UI->>DB: Request documents available to current user
    DB->>Rules: Check authentication and document sharing
    alt User is owner or has been granted access
        Rules-->>DB: Allow read
        DB-->>UI: Return permitted document metadata
        Member->>UI: Open or download document
        UI->>Storage: Request document file
        Storage->>Rules: Check file access
        Rules-->>Storage: Allow read
        Storage-->>UI: Return file
        UI-->>Member: Display or download document
    else User has no access
        Rules-->>DB: Deny read
        DB-->>UI: Return permission error
        UI-->>Member: Show access denied
    end
```

## Class diagram

This domain class diagram reflects the current Firestore data model and the
relationships used by HomeVault.

```mermaid
classDiagram
    class User {
        +string uid
        +string name
        +string firstName
        +string lastName
        +string email
        +string familyId
        +FamilyRole familyRole
        +Timestamp createdAt
    }

    class Family {
        +string familyId
        +string name
        +string ownerId
        +string[] members
        +Timestamp createdAt
    }

    class Document {
        +string documentId
        +string ownerId
        +string ownerName
        +string fileName
        +string originalFileName
        +DocumentCategory category
        +string expiryDate
        +DocumentAccessLevel accessLevel
        +string familyId
        +boolean sharedWithFamily
        +string storagePath
        +string downloadURL
        +string contentType
        +number fileSize
        +boolean isDeleted
        +Timestamp createdAt
        +Timestamp updatedAt
    }

    class UserNotification {
        +string notificationId
        +string recipientId
        +string familyId
        +string familyName
        +NotificationType type
        +boolean dismissed
        +Timestamp createdAt
    }

    class FamilyRole {
        <<enumeration>>
        owner
        member
    }

    class DocumentAccessLevel {
        <<enumeration>>
        private
        family
        selected
    }

    class DocumentCategory {
        <<enumeration>>
        Identity
        Education
        Financial
        Medical
        Insurance
        Property
        Other
    }

    class NotificationType {
        <<enumeration>>
        family_member_removed
    }

    Family "0..1" --> "1..*" User : members
    Family "1" --> "1" User : owner
    User "1" --> "0..*" Document : owns
    Family "0..1" --> "0..*" Document : shared family documents
    User "1" --> "0..*" UserNotification : receives
    Family "0..1" --> "0..*" UserNotification : related family

    User --> FamilyRole
    Document --> DocumentAccessLevel
    Document --> DocumentCategory
    UserNotification --> NotificationType
```

`familyId` is optional for a document because private documents are not linked
to a family. The `selected` access level is present in the upload options, but
the current document record does not yet store the selected member IDs.

## High-level architecture

```mermaid
flowchart LR
    User[Family Member / Owner] --> UI[Web App UI]
    UI --> Auth[Firebase Authentication]
    UI --> DB[Cloud Firestore]
    UI --> Storage[Firebase Storage]
    DB --> Rules[Security Rules]
    Storage --> Rules
    Rules --> Access[Document Access Control]
    Access --> User
```

## Core document-sharing flow

```mermaid
flowchart TD
    A[Upload Document] --> B[Add metadata]
    B --> C[Choose access level]
    C --> D{Access type}
    D -->|Only Me| E[Owner only]
    D -->|Entire Family| F[All family members]
    D -->|Selected Members| G[Chosen members only]
    G --> H[Store permission record]
    E --> H
    F --> H
    H --> I[User can view/download only if permitted]
```

## Planned MVP screens

- Landing page
- Login page
- Sign up page
- Dashboard
- My Documents view
- Family members view
- Shared documents view
- Upload document form
- Document detail and permission panel

## Notes

These diagrams are intended to support system understanding and guide the Firebase data model and permission design for the MVP.
