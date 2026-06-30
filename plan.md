Exactly. What I gave is a **Software Requirements Prompt**, but Claude also needs the **product flow (user journey)**. This is actually the most important part because it tells Claude how every module connects.

Below is the flow story that you should include in the prompt.

---

# CUSTOMER JOURNEY / PRODUCT FLOW

## Story

Raj is a small business owner in India. He sells products through Amazon, Flipkart, and Meesho.

Currently, every time a product is sold, he receives an invoice PDF from the marketplace.

Today, he manually reads the invoice, updates inventory, enters GST details, calculates profit, updates accounting, and prepares GST reports manually. This is time-consuming and error-prone.

He wants a single ERP where uploading an invoice automatically updates every business module.

The goal of the system is to reduce manual work to nearly zero.

---

# COMPLETE USER FLOW

---

## Step 1 — Login

Raj opens the ERP.

He logs in using email/password or Google.

After login, he lands on the Dashboard.

The dashboard shows:

* Today's Sales
* Monthly Sales
* Inventory
* GST Payable
* Profit
* Low Stock Products
* Recent Uploads
* AI Notifications

At first, everything is empty because there are no invoices.

---

## Step 2 — Upload Invoice

Raj clicks

**Upload Invoice**

He drags and drops one or multiple PDFs.

Supported formats:

* PDF
* JPG
* PNG

The upload begins.

Progress bar appears.

---

## Step 3 — AI Processing

The invoice enters the processing pipeline.

Invoice

↓

OCR extracts text

↓

LLM understands invoice

↓

JSON generated

↓

Validation Engine

↓

ERP Database

Raj sees an animation:

Uploading...

Reading Invoice...

Extracting Data...

Checking GST...

Updating Inventory...

Generating Reports...

Done

---

## Step 4 — AI Review Screen

Now Raj sees two panels.

Left side

Original invoice.

Right side

Extracted fields.

Invoice Number

GST Number

Customer

Address

Products

Quantity

Price

Tax

Total

Marketplace

Every extracted field has a confidence score.

Green

95–100%

Yellow

80–95%

Red

Below 80%

If AI is unsure,

Raj edits the field.

Clicks

Approve

---

## Step 5 — Invoice Saved

The invoice is now stored permanently.

Immediately, the ERP starts updating every connected module.

---

# AUTOMATIC MODULE EXECUTION

Invoice Saved

↓

Inventory Module

↓

Sales Module

↓

Accounting Module

↓

GST Module

↓

Reports Module

↓

Dashboard Module

↓

Notification Module

↓

Audit Log

Everything happens automatically.

No manual work.

---

# Inventory Flow

System checks every product.

Match SKU.

If SKU exists

Reduce quantity.

If SKU doesn't exist

Create product suggestion.

Ask user

"This product doesn't exist.

Create it?"

If stock reaches minimum

Send notification.

If stock becomes zero

Show

Out of Stock.

Dashboard updates immediately.

---

# Sales Flow

Create new Sales Order.

Create Invoice Record.

Calculate Revenue.

Assign Marketplace.

Assign Customer.

Update Daily Sales.

Update Monthly Sales.

Update Yearly Sales.

---

# Customer Flow

System checks customer.

If existing

Append purchase history.

If new

Create customer profile.

Store

Name

GST

Address

Phone

Email

Purchase History

Lifetime Revenue

---

# Accounting Flow

Automatically create journal entries.

Debit

Accounts Receivable

Credit

Sales

Debit

COGS

Credit

Inventory

Debit

Marketplace Fees

Credit

Expense

Profit updates automatically.

No accountant intervention.

---

# Expense Flow

AI identifies

Shipping Charges

Commission

Packaging

Marketplace Fees

Handling Charges

These become expenses.

Expense dashboard updates.

---

# Profit Calculation

Revenue

*

Product Cost

*

Shipping

*

Commission

*

GST

*

Expenses

=

Net Profit

Dashboard updates instantly.

---

# GST Flow

Invoice contains GST.

AI extracts

GSTIN

HSN

CGST

SGST

IGST

Taxable Value

GST module automatically updates

Monthly GST Ledger

Quarterly GST

Annual GST

HSN Summary

B2B

B2C

Input Tax

Output Tax

GST Dashboard updates.

User can preview filing data and download GST-ready reports (PDF/Excel/CSV) for review or submission.

---

# Reports Flow

Immediately generate

Sales Report

GST Report

Profit Report

Inventory Report

Marketplace Report

Customer Report

Expense Report

User clicks Download.

Select

PDF

Excel

CSV

Generated instantly.

---

# Dashboard Refresh

Dashboard refreshes in real time.

Revenue card changes.

Profit card changes.

Inventory changes.

Charts animate.

Recent Activity updates.

Everything refreshes automatically.

---

# Notification Flow

System generates notifications.

Low Stock

Duplicate Invoice

GST Mismatch

Invoice Error

AI Low Confidence

New Sales Record

Inventory Warning

GST Due

---

# Audit Trail

Every activity is stored.

Who uploaded invoice

Time

AI confidence

Manual edits

Inventory changes

GST changes

Accounting changes

Reports generated

Nothing is lost.

---

# Future Flow 1 — Email Automation

Instead of uploading,

Raj connects Gmail.

System checks inbox every few minutes.

New Amazon invoice arrives.

↓

Download attachment

↓

OCR

↓

AI

↓

Validation

↓

ERP Update

↓

Dashboard Refresh

Raj never uploads anything.

---

# Future Flow 2 — Marketplace API

Raj connects

Amazon Seller API

Flipkart API

Meesho API

Whenever an order is completed

Marketplace sends webhook.

↓

ERP receives event.

↓

Downloads invoice automatically.

↓

AI extraction.

↓

Validation.

↓

ERP update.

↓

Dashboard refresh.

No emails.

No uploads.

No clicks.

---

# Future Flow 3 — AI Copilot

Raj opens AI.

Types

"How much profit did I make this month?"

AI replies.

"₹2,45,600"

Raj asks

"Which products have low stock?"

AI lists them.

Raj asks

"Generate GST summary."

AI generates it.

Raj asks

"Why is my profit lower this month?"

AI compares expenses.

Suggests improvements.

---

# End-to-End System Flow

```text
Seller logs in

↓

Dashboard

↓

Upload Invoice

↓

OCR

↓

LLM Extraction

↓

Validation

↓

User Review

↓

Approve

↓

Save Invoice

↓

Inventory Updated

↓

Sales Updated

↓

Accounting Updated

↓

Expenses Updated

↓

Customer Updated

↓

GST Updated

↓

Reports Generated

↓

Dashboard Updated

↓

Notifications Sent

↓

Audit Logged

↓

Done
```

---

## Additional feature you should add (highly recommended)

Since your client sells on **Amazon, Flipkart, and Meesho**, create a **Marketplace Analytics** module that combines data from all channels.

It should answer questions like:

* Total sales by marketplace
* Profit by marketplace
* Best-selling products by marketplace
* Commission paid to each marketplace
* Return/refund rates
* Settlement tracking (expected vs. received payments)
* Marketplace-wise GST summary
* Marketplace performance trends over time

This will make the ERP much more valuable than just an invoice-processing tool and give your client actionable business insights.

