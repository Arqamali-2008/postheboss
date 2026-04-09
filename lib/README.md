# External Libraries for Offline Use

## MS Access File Parser

For MS Access database support, you need to download one of these libraries:

### Option 1: MDB Tools (Recommended for Windows)
- Download from: https://github.com/brianb/mdbtools
- Or use: https://www.npmjs.com/package/mdb-reader
- Place files in `lib/mdb-reader/` folder

### Option 2: node-adodb (Windows only, requires Node.js)
- Download from: https://www.npmjs.com/package/node-adodb
- For browser use, compile to browser-compatible version

### Option 3: File-based Approach (Simpler)
- Use File API to read/write Access files
- Parse MDB/ACCDB format manually
- Store Access file path in settings

## Installation Instructions

1. Download the library files
2. Extract to `lib/mdb-reader/` folder
3. Update `msaccess-handler.js` to use the correct library path
4. All features will work offline

## Note

For fully offline operation, all libraries must be downloaded and stored locally.
CDN links are used as fallback but will not work offline.

