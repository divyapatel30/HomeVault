# HomeVault Requirements

## 1. Project overview

HomeVault is a secure family and personal document organizer. The application allows each person to manage their own documents, share specific files with relatives, locate documents quickly, and track expiry dates.

## 2. Problem statement

Important personal and family documents are often spread across phones, computers, WhatsApp, email, and physical storage. This makes them hard to organize, difficult to find when needed, and easy to lose track of with respect to sharing and expiry.

## 3. Solution statement

HomeVault centralizes personal and family documents into one organized and secure web app. Every document has an owner, and the owner controls access. Family membership does not automatically grant access to private documents.

## 4. Target users

### Family Owner
- Manages the family and family members
- Manages their own documents

### Family Member
- Manages their own documents
- Accesses documents shared with them

## 5. Access model

When uploading a document, the owner chooses who can access it:

- Only Me
- Entire Family
- Selected Family Members

A user who receives access can only view or download the document. They cannot edit, change permissions, delete it, or modify its metadata.

## 6. Example scenario

If Divya is a family member, her dashboard should display the names of her family members and allow her to view documents that those members have shared with her.

Important rule:
- A family member cannot see another person's private documents unless the owner explicitly shares them.
- Shared documents are visible only to the users granted access.

## 7. Permission rules

| Action | Document Owner | Shared Family Member |
| --- | --- | --- |
| View | Yes | Yes |
| Download | Yes | Yes |
| Edit document information | Yes | No |
| Change expiry/category | Yes | No |
| Change who can access it | Yes | No |
| Delete document | Yes | No |

## 8. Functional requirements

### Authentication and user management
- User registration and login
- Create or join a family
- Manage family membership

### Document management
- Upload PDF and image documents
- Add document details such as owner, category, and optional expiry date
- Search and filter documents by member, category, or keyword
- View documents based on permission rules

### Sharing and access control
- Share with only the owner
- Share with the entire family
- Share with selected family members only
- Enforce view/download-only rights for shared users

### Dashboard and organization
- Display family members
- Show documents owned by the user
- Show documents shared with the user by other family members
- Warn users about soon-to-expire documents

## 9. Non-functional requirements

- Secure family isolation and access control
- Responsive UI for desktop and mobile screens
- Simple and user-friendly interaction flow
- Clear document privacy boundaries
- Data reliability for protected records

## 10. MVP scope

The MVP includes:

- Authentication
- Family creation and membership
- Document upload and management
- Member and category organization
- Search and filters
- Document sharing controls
- View/download permissions
- Expiry tracking and warnings
- Security and access control

## 11. Future scope (not in first version)

- OCR or automatic text extraction
- AI-based classification
- WhatsApp or email import
- Advanced AI features
- Native mobile app

These features are deferred until the MVP is stable and working reliably.

## 12. Development approach

The project uses a Waterfall-inspired engineering process:

1. Requirements
2. Analysis and design
3. Firebase learning and setup
4. Implementation
5. Testing
6. Deployment and documentation

## 13. Week 1 plan

- Understand the complete project workflow
- Finalize functional and non-functional requirements
- Confirm access rules for family owners and family members
- Learn Firebase basics: Authentication, Firestore, Storage, Security Rules
- Review and confirm the agreed system before development begins

## 14. Final decisions

- HomeVault is both a personal and family document organizer
- There is no normal Viewer role
- Every document has an owner
- The owner controls sharing
- Shared access gives view and download only
- Shared users cannot edit, delete, or change permissions
- Family members do not automatically see each other's private documents
- The dashboard shows family members and documents they have shared with the current user
- The MVP comes first; future features must not distract from the core system

## 15. Goal

Build a simple, secure, and genuinely useful HomeVault MVP that the whole team understands clearly and can maintain confidently.
