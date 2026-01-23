# Technology Stack

## Frontend

### Core Framework
- **React 18.2** - UI library
- **React Router 7.11** - Client-side routing
- **Material-UI (MUI) 5.15** - Component library and theming
- **Emotion** - CSS-in-JS styling

### Map & Visualization
- **Leaflet 1.9** + **React-Leaflet 4.2** - OpenStreetMap integration
- **Chart.js 4.5** + **React-Chartjs-2** - Data visualization
- **Recharts 3.0** - Additional charting

### Data Handling
- **Axios 1.6** - HTTP client
- **ExcelJS 4.4** - Excel file generation/parsing
- **XLSX 0.18** - Spreadsheet operations
- **date-fns 2.30** - Date manipulation

### UI Enhancement
- **@dnd-kit** - Drag and drop functionality
- **react-window** - Virtualized lists for performance
- **html2canvas** + **jspdf** - PDF generation
- **tesseract.js** - OCR for image processing

### Build System
- **react-scripts 5.0.1** (Create React App)
- **react-app-rewired 2.2.1** - Custom webpack config
- Custom build script at `scripts/build.js` with optimization modes

## Backend

### Runtime & Framework
- **Node.js 22.x** (specified in engines)
- **Express 4.18** - Web server framework

### Google Services
- **googleapis 118.0** - Google Sheets/Drive API
- **google-spreadsheet 3.3** - Sheets helper library

### External Integrations
- **discord.js 14.12** - Discord bot for logging/notifications
- **web-push 3.6** - Push notification service
- **node-geocoder 4.2** - Geocoding (Kakao Maps)
- **axios 1.6** - HTTP requests

### File Processing
- **multer 1.4** - File upload handling
- **archiver 5.3** + **jszip 3.10** - Archive creation
- **exceljs 4.4** - Excel manipulation
- **sharp 0.34** - Image processing
- **canvas 3.2** - Server-side canvas rendering
- **pdfjs-dist 3.11** - PDF parsing

### Utilities
- **node-cron 3.0** - Scheduled tasks
- **cheerio 1.0** - HTML parsing
- **xml2js 0.6** - XML parsing
- **uuid 11.1** - Unique ID generation
- **dotenv 16.0** - Environment configuration

### Testing
- **Jest 30.2** - Test framework
- **fast-check 4.5** - Property-based testing
- **supertest 7.2** - HTTP assertion library

## Development Tools

- **nodemon 3.0** - Auto-restart for development
- **PM2** (via ecosystem.config.js) - Process management

## Common Commands

### Frontend
```bash
npm start              # Development server (port 3000)
npm run build          # Production build
npm run build:fast     # Fast build (skip optimizations)
npm run build:ultra-fast  # Ultra-fast build
npm run build:analyze  # Build with bundle analysis
npm test               # Run tests
```

### Backend
```bash
cd server
npm start              # Production server (port 4000)
npm run dev            # Development with nodemon
npm test               # Run Jest tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
npm run update-extension-version  # Update Chrome extension
```

### Environment Variables

**Frontend (.env)**:
- `REACT_APP_API_URL` - Backend API URL
- `REACT_APP_ENV` - Environment (development/production)
- `REACT_APP_LOGGING_ENABLED` - Enable/disable logging

**Backend (server/.env)**:
- `PORT` - Server port (default: 4000)
- `SHEET_ID` - Google Sheets spreadsheet ID
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email
- `GOOGLE_PRIVATE_KEY` - Service account private key
- `DISCORD_BOT_TOKEN` - Discord bot token
- `DISCORD_CHANNEL_ID` - Discord channel for logs
- `DISCORD_LOGGING_ENABLED` - Enable Discord logging
- `KAKAO_API_KEY` - Kakao Maps geocoding API key
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` - Web push keys

## Deployment

- **Frontend**: Vercel (configured via vercel.json)
- **Backend**: Cloudtype (configured via cloudtype.yml)
- **Process Manager**: PM2 (ecosystem.config.js)

## Browser Compatibility

Targets modern browsers (>0.2% market share, not dead, not Opera Mini).
