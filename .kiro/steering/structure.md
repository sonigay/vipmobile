# Project Structure

## Root Organization

```
/                           # Frontend (React app)
├── src/                    # React source code
├── public/                 # Static assets
├── server/                 # Backend (Express API)
├── android-app/            # Android companion app
├── local-discord-bot/      # Local Discord bot for screenshots
├── docs/                   # Korean documentation
├── scripts/                # Build scripts
└── .kiro/                  # Kiro AI configuration
```

## Frontend Structure (`/src`)

### Core Application
- `App.js` - Main application component with routing and state management
- `index.js` - React entry point
- `api.js` - API client and caching utilities

### Components (`/src/components`)

**Mode Components** (20+ operational modes):
- `InventoryMode.js` - Inventory management
- `SettlementMode.js` - Financial settlement
- `InspectionMode.js` - Quality inspection
- `PolicyMode.js` - Policy document management
- `MeetingMode.js` - Meeting coordination
- `ChartMode.js` - Bond chart OCR processing
- `ReservationMode.js` - Pre-reservation management
- `BudgetMode.js` - Budget tracking
- `SalesMode.js` - Sales performance
- `DirectStoreMode.js` - Direct store operations
- `DirectStoreManagementMode.js` - Direct store admin
- `ObManagementMode.js` - Outbound call management
- `SmsManagementMode.js` - SMS automation
- `OnSaleManagementMode.js` / `OnSaleReceptionMode.js` - Online sales
- `MealAllowanceMode.js` - Meal allowance tracking
- `AttendanceMode.js` - Attendance monitoring
- `RiskManagementMode.js` - Risk analysis
- `QuickServiceManagementMode.js` - Delivery service stats
- `GeneralPolicyMode.js` - Policy viewing

**Core UI Components**:
- `Map.js` - Leaflet map with markers
- `FilterPanel.js` / `AgentFilterPanel.js` - Filtering controls
- `Header.js` - Application header
- `Login.js` - Authentication
- `StoreList.js` / `StoreInfoTable.js` - Store listings
- `MarkerColorSettingsModal.js` - Marker customization

**Feature-Specific Subdirectories**:
- `budget/` - Budget management tabs
- `customer/` - Customer-facing components
- `direct/` - Direct store UI (modern design system)
- `meeting/` - Meeting presentation and capture
- `ob/` - Outbound call panels
- `policy/` - Policy table management
- `screens/` - Full-page screens (assignments, dashboards)

### Configuration (`/src/config`)
- `modeConfig.js` - Mode definitions, colors, icons, permissions
- `modeTabConfig.js` - Tab configurations per mode
- `captureTargets.js` - Screenshot capture targets

### Utilities (`/src/utils`)
- `api.js` - Centralized API calls
- `activationService.js` - Activation data processing
- `assignmentUtils.js` - Inventory assignment logic
- `colorUtils.js` / `markerColorUtils.js` - Color management
- `directStoreUtils.js` / `directStoreCalculationEngine.js` - Direct store business logic
- `obCalculationEngine.js` - OB calculation
- `policyService.js` - Policy operations
- `googleSheetService.js` - Sheets integration
- `notificationUtils.js` / `pushNotificationUtils.js` - Notifications
- `exportUtils.js` - Excel/PDF export
- `distanceUtils.js` - Geolocation calculations
- `logger.js` / `remoteLogger.js` / `debugLogger.js` - Logging

### Hooks (`/src/hooks`)
- `useImageUpload.js` - Image upload logic
- `useMobileTags.js` - Mobile device tagging
- `usePriceCalculation.js` - Price calculation

### Theming (`/src/theme`)
- `DirectStoreTheme.js` / `DirectStoreThemeV2.js` - Direct store styling

## Backend Structure (`/server`)

### Core Files
- `index.js` - Express server, main API routes, Google Sheets integration
- `corsMiddleware.js` - CORS configuration with dynamic origin management
- `corsConfigManager.js` - CORS config persistence

### Route Modules
- `directRoutes.js` - Direct store APIs (customer queue, images, board)
- `meetingRoutes.js` - Meeting management
- `obRoutes.js` - OB management
- `teamRoutes.js` - Team operations
- `policyTableRoutes.js` - Policy table CRUD

### Data Managers
- `UserSheetManager.js` - User/agent data from sheets
- `PhoneklDataManager.js` - Phonekl inventory data

### Utilities
- `monthlyAwardAPI.js` - Monthly award calculations
- `update-extension-version.js` - Chrome extension versioning
- `monitor.js` - Health monitoring

### Testing (`/server/__tests__`)
- `cors.test.js` - CORS middleware tests
- `cors-properties.test.js` - Property-based CORS tests
- `helpers/pbt-helpers.js` - PBT utilities

### Chrome Extension (`/server/vip-extension`)
- Browser extension for VIP system integration

## Android App (`/android-app`)

Kotlin-based Android companion app:
- `MainActivity.kt` - Main activity
- `ManagerService.kt` - Background service
- `MessageReceiver.kt` / `MessageChecker.kt` - SMS handling
- `ApiClient.kt` - API communication
- `BootReceiver.kt` - Auto-start on boot

## Documentation (`/docs`)

Korean-language documentation for features and troubleshooting.

## Configuration Files

- `.env` - Environment variables (not in repo)
- `vercel.json` - Vercel deployment config
- `cloudtype.yml` - Cloudtype deployment config
- `ecosystem.config.js` - PM2 process config
- `config-overrides.js` - Webpack customization
- `.nvmrc` - Node version specification (22.x)

## Key Patterns

### Mode System
All operational modes follow a consistent pattern:
1. Defined in `modeConfig.js` with metadata (title, color, icon, permissions)
2. Implemented as standalone components in `/src/components`
3. Activated via mode selection popup based on user permissions
4. State managed in `App.js` with localStorage persistence

### Data Flow
1. Frontend requests data via `api.js` utilities
2. Backend (`server/index.js`) queries Google Sheets
3. Results cached with TTL (5 minutes default)
4. Rate limiting prevents API quota exhaustion

### Permission Model
- Permissions stored in Google Sheets (`대리점아이디관리` sheet)
- Column-based permission flags (O/M/S roles)
- Mode access controlled by `modePermissions` object
- Sub-permissions for granular feature access

### Styling Approach
- Material-UI theme system
- Emotion for CSS-in-JS
- Mobile-first responsive design (`mobile.css`)
- Direct store uses custom modern theme (`DirectStoreThemeV2.js`)
