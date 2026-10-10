# EVE-CONNECT APARTMENT PORTAL — USER MANUAL
**System:** EVE-CONNECT Apartment Rental Operations Platform (`apartment-portal`)  
**Version:** 2.0 (Production Release)  
**Target Audience:** Property Representatives, Accounting Staff, Maintenance Technicians, Marketing Managers, System Administrators, Executives, and Tenants.  
**Currency:** Philippine Peso (`₱`)  

---

## Table of Contents
1. [System Overview & Navigation Basics](#1-system-overview--navigation-basics)
2. [User Roles & Access Permissions](#2-user-roles--access-permissions)
3. [Step-by-Step Guide for Property Representatives (`property_rep`)](#3-property-representative-guide)
   - 3.1 Managing Properties & Units
   - 3.2 Creating & Managing Tenant Profiles
   - 3.3 Executing Digital Leases & Contracts
   - 3.4 Inviting Tenants to the Self-Service Portal
   - 3.5 Conducting Move-In & Move-Out Unit Inspections
   - 3.6 Ingesting Data via Bulk Import Engine (CSV/Excel)
4. [Step-by-Step Guide for Accounting (`accounting`)](#4-accounting-staff-guide)
   - 4.1 Processing Invoices & Multi-Method Payments
   - 4.2 Operating the Interactive Financial Spreadsheet
   - 4.3 Approving Maintenance Cost Thresholds
   - 4.4 Security Deposit Management & Tenant Ledgers
   - 4.5 System Compliance Audit Engine & Health Gauge
5. [Step-by-Step Guide for Maintenance Staff (`maintenance`)](#5-maintenance-staff-guide)
   - 5.1 Submitting & Tracking Job Orders
   - 5.2 Technician Assignment & Logging Work Hours
   - 5.3 Managing Property Assets & Warranties
   - 5.4 Using the Operations Calendar
6. [Step-by-Step Guide for Marketing Staff (`marketing`)](#6-marketing-staff-guide)
   - 6.1 Publishing Unit Listings
   - 6.2 Tracking Prospect Inquiries & Reservations
   - 6.3 Forecasting Unit Availability
7. [Step-by-Step Guide for System Administrators (`system_admin`)](#7-system-administrator-guide)
   - 7.1 User Provisioning & Role Assignments
   - 7.2 Property Scope Configuration & Audit Logs
8. [Step-by-Step Guide for Executives (`executive`)](#8-executive-guide)
   - 8.1 Executive Dashboard & Revenue Analytics
   - 8.2 Portfolio Occupancy Reports
9. [Step-by-Step Guide for Tenants (`tenant`)](#9-tenant-self-service-portal-guide)
   - 9.1 Accepting an Invitation & Account Setup
   - 9.2 Navigating the Tenant Portal
   - 9.3 Reviewing Invoices, Payments, & Receipts
   - 9.4 Tracking Utility Consumption
   - 9.5 Submitting Move-Out Notices
10. [Public Tenant Application Intake (`/intake`)](#10-public-tenant-application-intake)
11. [Utility Metering & Per-Property Bulk Billing](#11-utility-metering--per-property-bulk-billing)
12. [Troubleshooting & Frequently Asked Questions](#12-troubleshooting--faqs)

---

## 1. System Overview & Navigation Basics

The **EVE-CONNECT Apartment Rental Operations Platform** is a full-stack property operations solution tailored for apartment rental management in the Philippines. It features multi-property support, Philippine Peso (`₱`) currency formatting, digital contract execution with canvas signatures, utility meter reading workflows, automated billing notifications, multi-method payment recording, and a tenant self-service portal.

### Navigation Interface
- **Desktop Navigation:** Left sidebar menu tailored to your assigned role, topbar with property scope selector, user profile menu, and theme switcher (Dark/Light mode).
- **Mobile Navigation:** Responsive mobile topbar, collapsible drawer menu, and bottom navigation bar for quick access to primary modules.

---

## 2. User Roles & Access Permissions

The platform supports **7 distinct roles**:
1. **`system_admin`**: Full administrative access, user provisioning, global RBAC assignments, audit logs.
2. **`accounting`**: Invoicing, payment collection, financial spreadsheet, security deposit ledgers, maintenance cost approvals, audit compliance execution.
3. **`property_rep`**: Property and unit inventory management, tenant profiles, lease creation, digital contract signing, tenant invites, unit inspections, bulk imports.
4. **`maintenance`**: Maintenance ticket lifecycle, technician work logs, asset tracking, maintenance calendar.
5. **`marketing`**: Public unit listings, prospect inquiries, unit reservations, availability forecasting calendar.
6. **`executive`**: Portfolio-wide financial metrics, revenue breakdown charts, occupancy trends, operational reports.
7. **`tenant`**: Self-service portal (`/portal`) to review lease details, download contracts, check payment history, track utility bills, and submit move-out notices.

---

## 3. Property Representative Guide (`property_rep`)

### 3.1 Managing Properties & Units
1. Navigate to **Property > Units** (`/property/units`).
2. Click **+ Add Unit**.
3. Select target Property, enter Floor Number, Unit Number, Bedrooms, Bathrooms, Floor Area ($m^2$), and Base Monthly Rent (`₱`).
4. Set status to `vacant`, `occupied`, or `under_maintenance`.
5. Click **Save Unit**.

### 3.2 Creating & Managing Tenant Profiles
1. Navigate to **Property > Tenants** (`/property/tenants`).
2. Click **+ Add Tenant**.
3. Fill out the extended profile form (26 fields):
   - **Personal Details:** Full Name, Date of Birth, Gender, Civil Status, Nationality, Religion.
   - **Contact Information:** Email, Mobile Phone, Permanent Address, Recent Address.
   - **Employment Information:** Company Name, Work Status, Job Position, Office Address, Work Phone, Work Email.
   - **Emergency Contacts:** Primary and Secondary Emergency Contact Name, Phone, Email, and Messenger ID.
   - **Government ID:** SSS/GSIS/Passport/TIN ID Number.
4. Click **Save Tenant Profile**.

### 3.3 Executing Digital Leases & Contracts
1. Navigate to **Property > Leases** (`/property/leases`).
2. Click **+ Create Lease**.
3. Select Tenant and Vacant Unit. Set Start Date, End Date, Monthly Rent (`₱`), Deposit Amount (`₱`), and Notice Period (e.g., 30 days).
4. Click **Generate Draft Contract**.
5. Select a Contract Template (`prep.contract_template`). The system will auto-populate placeholders (`{{tenant_name}}`, `{{unit_number}}`, `{{monthly_rent}}`).
6. **Digital Signing:** Present the contract preview to the tenant. Have them sign on the canvas pad (`signature-pad.tsx`).
7. Click **Submit Signature**. The signed contract updates status to `signed`, transitions unit status to `occupied`, and automatically generates initial rent and deposit invoices.
8. To print a PDF copy, click **Print Contract** (`/property/contracts/[id]/print`).

### 3.4 Inviting Tenants to the Self-Service Portal
1. Open a tenant profile under **Property > Tenants**.
2. Click **Invite Tenant to Portal**.
3. A unique one-time invitation link will be generated (`/portal/accept-invite?token=...`).
4. Copy the link or click **Send Invite Email** to send it directly via Resend to the tenant's registered email address.

### 3.5 Conducting Move-In & Move-Out Unit Inspections
1. Open the active lease detail view.
2. Select **Inspections** tab and click **New Inspection**.
3. Choose Inspection Type: `move_in` or `move_out`.
4. Complete the condition checklist for doors, windows, light fixtures, plumbing, wall paint, and appliances.
5. Capture Staff and Tenant signatures on screen.
6. Click **Save Inspection Report**.

### 3.6 Ingesting Data via Bulk Import Engine (CSV/Excel)
1. Navigate to **Property > Import** (`/property/import`).
2. Select Entity Type to import: **Properties**, **Units**, **Tenants**, **Leases**, or **Contracts**.
3. Drag & drop your CSV or Excel (`.xlsx`) file.
4. **Auto-Mapping:** The engine will map CSV headers to system fields. Adjust mappings if needed.
5. Review validation errors (highlighted per row). Fix data errors in-grid.
6. Click **Commit Import**. All valid records are inserted in an atomic transaction.

---

## 4. Accounting Staff Guide (`accounting`)

### 4.1 Processing Invoices & Multi-Method Payments
1. Navigate to **Accounting > Invoices** (`/accounting/invoices`).
2. Filter invoices by Status (`pending`, `overdue`, `paid`) or Type (`rent`, `utility`, `deposit`).
3. To record a payment, click **Record Payment** next to an invoice.
4. Select Payment Method: `cash`, `bank_transfer`, `gcash`, `maya`, or `check`.
5. Enter Amount Paid (`₱`), Payment Reference Number (GCash reference / Bank transaction ID), and Payment Date.
6. Click **Confirm Payment**.
7. The system marks the invoice as `paid`, posts a credit entry in the tenant's ledger, generates a receipt with a QR code, and queues a payment receipt email with Google Drive backup.

### 4.2 Operating the Interactive Financial Spreadsheet
1. Navigate to **Accounting > Spreadsheet** (`/accounting/spreadsheet`).
2. View all active property billing records in an Excel-like grid.
3. Edit inline fields (due dates, discount amounts, penalty fees).
4. Click **Save Changes** to commit bulk edits directly to the database.

### 4.3 Approving Maintenance Cost Thresholds
1. Navigate to **Accounting > Approvals** (`/accounting/approvals`).
2. Review job orders marked `pending_approval` (job orders whose cost estimate exceeds the task type threshold).
3. Inspect task details, technician notes, and estimated cost (`₱`).
4. Click **Approve Cost** or **Reject Cost**.
5. Upon approval, the job order automatically transitions to `assigned` for technician execution.

### 4.4 Security Deposit Management & Tenant Ledgers
1. Navigate to **Accounting > Deposits** (`/accounting/deposits`).
2. View active security deposit balances per lease.
3. Upon lease termination, click **Process Deposit Refund**.
4. Input deductions for unpaid utilities or maintenance repairs.
5. Click **Finalize Refund** to issue the net deposit refund and record ledger balance clearance.

### 4.5 System Compliance Audit Engine & Health Gauge
1. Navigate to **Accounting > Audit** (`/accounting/audit`).
2. View the system **Health Gauge** (0–100% compliance score).
3. Click **Run Audit Rules**.
4. The system executes compliance checks:
   - Unlinked payments missing invoices.
   - Overdue invoices missing late penalties.
   - Active leases missing signed digital contracts.
   - Meter readings recorded without corresponding invoices.
5. Review the Audit Findings Table to resolve flagged items.

---

## 5. Maintenance Staff Guide (`maintenance`)

### 5.1 Submitting & Tracking Job Orders
1. Navigate to **Maintenance > Job Orders** (`/maintenance/job-orders`).
2. Click **+ New Job Order**.
3. Select Unit, Maintenance Task Type (Plumbing, Electrical, Carpentry, HVAC, General Repair), Priority (`low`, `medium`, `high`, `urgent`), and Description.
4. Enter Estimated Cost (`₱`).
5. Click **Submit Ticket**. If cost exceeds approval threshold, it will automatically queue for Accounting approval.

### 5.2 Technician Assignment & Logging Work Hours
1. Open an `open` or `assigned` job order.
2. Select Assigned Technician from the user dropdown.
3. As work progresses, open the **Work Log** panel.
4. Enter Hours Spent, Replacement Parts Used, and Completion Notes.
5. Click **Mark Job Completed**. Unit status updates and audit logs are recorded.

### 5.3 Managing Property Assets & Warranties
1. Navigate to **Maintenance > Assets** (`/maintenance/assets`).
2. Track appliances and fixtures mapped to units (Air Conditioner, Water Heater, Refrigerator, Fire Extinguisher).
3. Record Installation Date, Serial Number, and Warranty Expiration Date.

### 5.4 Using the Operations Calendar
1. Navigate to **Maintenance > Calendar** (`/maintenance/calendar`).
2. View upcoming maintenance visits, scheduled task deadlines, and expiring asset warranties in Month, Week, or List view.
3. Filter by property or technician.

---

## 6. Marketing Staff Guide (`marketing`)

### 6.1 Publishing Unit Listings
1. Navigate to **Marketing > Listings** (`/marketing/listings`).
2. Click **+ Create Listing** for a vacant unit.
3. Enter Listing Title, Marketing Description, Monthly Asking Rent (`₱`), and upload unit photos.
4. Toggle Status to **Published**.

### 6.2 Tracking Prospect Inquiries & Reservations
1. Navigate to **Marketing > Inquiries** (`/marketing/inquiries`).
2. Record prospect contact details, preferred move-in date, and referral source.
3. **Unit Reservation:** If a prospect pays a holding deposit, click **Reserve Unit**. Input Prospect Name, Holding Deposit (`₱`), and Expiration Date (e.g., 7 days). The unit status switches to `reserved`.

### 6.3 Forecasting Unit Availability
1. Navigate to **Marketing > Availability Forecast** (`/marketing/forecast`).
2. View upcoming lease expiration dates across the portfolio to plan marketing campaigns and listing releases up to 90 days in advance.

---

## 7. System Administrator Guide (`system_admin`)

### 7.1 User Provisioning & Role Assignments
1. Navigate to **Admin > Users** (`/admin/users`).
2. Click **+ Provision User**.
3. Enter Full Name, Email, and Assign Role (`system_admin`, `accounting`, `property_rep`, `maintenance`, `marketing`, `executive`).
4. **Property Scope:** Assign specific property access or select "All Properties".
5. Click **Send Activation Email**.

### 7.2 Property Scope Configuration & Audit Logs
1. Navigate to **Admin > Audit Logs** (`/admin/audit-logs`).
2. Search and filter system-wide audit records by actor, action type (`CREATE`, `UPDATE`, `DELETE`), entity type, or date range.

---

## 8. Executive Guide (`executive`)

### 8.1 Executive Dashboard & Revenue Analytics
1. Navigate to **Executive > Overview** (`/executive`).
2. View portfolio key metrics:
   - Gross Revenue Collected (`₱`).
   - Overall Occupancy Rate (%).
   - Total Active Leases & Total Units.
   - Pending Maintenance Approvals & Outstanding Invoice Delinquencies.
3. Review interactive Revenue Trends and Monthly Occupancy breakdown charts.

### 8.2 Portfolio Occupancy Reports
1. Navigate to **Executive > Reports** (`/executive/reports`).
2. Export comprehensive financial and property performance summaries as CSV or printable report views.

---

## 9. Tenant Self-Service Portal Guide (`tenant`)

### 9.1 Accepting an Invitation & Account Setup
1. Open the invitation link sent to your email (`/portal/accept-invite?token=...`).
2. Review the building rules and Terms of Service.
3. Create your password and click **Complete Registration**.

### 9.2 Navigating the Tenant Portal
Log in at `/portal/login`. The tenant dashboard displays:
- **Active Lease Card:** Unit Number, Property Address, Lease Start/End Dates, Monthly Rent (`₱`).
- **Outstanding Balance:** Current unpaid invoices due.
- **Quick Links:** View Lease Contract, Payment History, Utility Bills, Maintenance Request.

### 9.3 Reviewing Invoices, Payments, & Receipts
1. Click **Invoices & Payments** in the tenant menu.
2. View detailed billing breakdown (Rent, Electric, Water).
3. Click on any payment to view or download the official PDF payment receipt.

### 9.4 Tracking Utility Consumption
1. Click **Utility Bills** in the tenant menu.
2. Monitor monthly electricity and water consumption trends ($kWh$ and $m^3$), rates per unit, and previous vs. current meter reading values.

### 9.5 Submitting Move-Out Notices
1. Click **Lease Options > Submit Move-Out Notice**.
2. Select Intended Move-Out Date (subject to required notice period).
3. Enter Reason for Moving and submit. Property Representatives will be notified automatically.

---

## 10. Public Tenant Application Intake

Prospective tenants can submit applications online without staff pre-creation:
1. Direct applicants to `/intake` or building-specific URLs (e.g., `/intake/tower-a`).
2. Applicants complete the multi-step online form:
   - Personal details, civil status, contact details.
   - Employer details & emergency contacts.
   - Desired building and unit selection.
3. Upon submission, the platform automatically provisions the tenant profile, draft lease, and draft contract.
4. Property Representatives review incoming applications under **Property > Leases** and click **Activate Lease** upon approval.

---

## 11. Utility Metering & Per-Property Bulk Billing

1. Navigate to **Property > Utilities > Billing** (`/property/utilities/billing`).
2. Select Property and Billing Period Month/Year.
3. **Per-Property Meter Reading Grid:**
   - Enter current reading for Electricity ($kWh$) and Water ($m^3$).
   - The system automatically calculates consumption delta ($Current - Previous$).
   - Applies rate snapshot per unit of consumption (`₱/kWh` or `₱/m³`).
   - Computes amount due, adds late penalty fees if applicable, and logs Official Receipt (OR) Number.
4. Click **Generate Utility Bills & Invoices**.
5. Invoices are automatically generated and dispatched to tenant portals and email notifications.

---

## 12. Troubleshooting & FAQs

### Q1: A tenant sees "Account Not Linked" upon login.
- **Cause:** The user's login email is not yet linked to a tenant record in `core.tenant_user`.
- **Solution:** Re-issue an invitation link from the tenant profile (`/property/tenants/[id]`) or manually link the user in **Admin > Users**.

### Q2: Payment receipt email was not received.
- **Solution:** Check **Accounting > Receipts** to verify payment status. Ensure the Resend API key is valid in `.env.local` and check Google Drive backup link status.

### Q3: How do I re-run background event dispatching?
- **Solution:** The event dispatcher runs automatically via cron at `/api/events/dispatch`. System admins can also trigger event processing manually from `/api/audit-debug`.

---
*End of User Manual. For technical architecture and schema details, refer to `HANDOVER_DOCUMENTATION.md`.*
