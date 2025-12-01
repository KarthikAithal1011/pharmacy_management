# Task: Enable Generate Report Button Only After Purchase Confirm

## Information Gathered
- Frontend has reports section that loads daily report automatically
- Checkout button in cart section confirms purchase
- Need to add "Generate Report" button in reports section, disabled by default
- Button should only be enabled after successful checkout

## Plan
- Add "Generate Report" button to reports-section in frontend/index.html
- Add purchaseConfirmed property to PharmacyApp class in frontend/js/app.js
- Set purchaseConfirmed = true in checkout method on success
- Modify renderDailyReport to include button with enabled/disabled state
- Add event listener for button to load report
- Reset purchaseConfirmed on logout

## Dependent Files to be edited
- frontend/index.html: Add button to reports section
- frontend/js/app.js: Add state management and button logic

## Followup steps
- Test the functionality by logging in, adding to cart, checking out, then going to reports section
