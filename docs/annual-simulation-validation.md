# FINORVE: annual fictional scenario validation

Date: 2026-09-30. Public demo: https://finorve.com/demo-anual.html

314 fictional records covering 2025-10 through 2026-09 for Marta Rios and Libreria Horizonte. USD cents are integers. No production account records were changed. The simulation uses a snapshot of app-v4.js, shared financial-engine.js and navigation utilities, and an isolated local store instead of Supabase. Future production UI changes should regenerate the simulation snapshot.

Passed: monthly personal budget, savings withdrawals, loan/card payments, final net worth; business accrual sales and credit collections, supplier payments, separate debt principal/interest, monthly operating results, cash flow and break-even revenue. Browser exercised 22 module destinations across both modes. Personal create/edit/delete and reload passed. Business cobro 10 and pago 4 increased cash by exactly 6 after reload, then deletion restored the initial total.

Annual expected totals USD: personal income 34,590; personal expenses 19,284; available after savings/debt 6,506. Business sales 104,500; operating result 25,490; net cash flow 20,033.50; opening cash 4,000; closing cash 24,033.50.

Fixed in production: cashflowView omitted debt principal/interest from the displayed cash payments and net flow. Both debt rows and outflows now reconcile with the shared engine.

Limit: this simulation verifies UI and local persistence, not authenticated Supabase persistence or production annual payment activation. User already verified production personal-income and business-sales create/edit/delete/reload. Real payment remains deferred.

Run: node annual-scenario-tests.mjs
