# Pharmacy Management API Conversion Plan

## Backend Changes
- [x] Update package.json to add jsonwebtoken dependency
- [x] Modify server.js to add JWT middleware and API routes under /api/v1/
- [x] Implement API authentication endpoints (login/logout)
- [x] Create API endpoints for medicines (GET, POST)
- [x] Create API endpoints for cart operations (add, get, remove, clear, checkout)
- [x] Create API endpoints for stock management (add stock)
- [x] Create API endpoints for reports (daily collection)
- [x] Keep existing EJS routes for backward compatibility

## Frontend Changes
- [x] Create frontend/ directory structure
- [x] Create frontend/index.html as main page
- [x] Create frontend/js/app.js for API calls and UI logic
- [x] Create frontend/css/styles.css for styling
- [x] Implement client-side authentication
- [x] Implement medicine listing and search
- [x] Implement cart functionality
- [x] Implement checkout and receipt generation
- [x] Implement admin functions (add medicine, add stock, reports)

## Testing and Validation
- [ ] Test all API endpoints with Postman/curl
- [ ] Test frontend integration with APIs
- [ ] Ensure JWT authentication works properly
- [ ] Verify backward compatibility with existing EJS routes
- [ ] Test error handling and edge cases
