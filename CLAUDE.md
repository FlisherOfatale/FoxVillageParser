# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FoxVillageParser is an equestrian competition data parser that fetches and processes rider schedules from the Foxvillage.com API. The project extracts competition schedules for specific riders and outputs formatted data in JSON format with French day names.

## Architecture

The project consists of:

- **parser.js** - Main Node.js parser that fetches data from Foxvillage API endpoints
- **config.json** - Configuration file containing showId and rider names
- **index.html** - Web interface for displaying competition schedules with French translations
- **samples/** - Sample API response files for development/testing
- **schedule.json** - Generated output file containing parsed rider schedules

### Data Flow

1. Parser loads configuration from `config.json` or command line arguments
2. Fetches rider data from `https://www.foxvillage.com/show/GetRiderData?id={showId}`
3. Matches rider names to find rider IDs
4. Fetches class definitions from `https://www.foxvillage.com/show/GetClassData?id={showId}`
5. For each rider, fetches individual schedule from `https://www.foxvillage.com/show/GetAllRiderData?show={showId}&id={riderId}`
6. Processes and formats data with French day names and time formatting
7. Outputs consolidated schedule to JSON file

## Common Commands

```bash
# Run the parser with default config.json riders
npm start

# Run parser with specific rider names
node parser.js 

# View generated schedule
cat schedule.json
```

## Configuration

- **config.json**: Contains `showId` (competition ID) and `riderNames` array
- The parser respects API rate limits with 500ms delays between requests
- Rider names support partial matching for flexibility
- Output includes French day translations (Friday→Vendredi, Saturday→Samedi, Sunday→Dimanche)

## Key Functions

- `fetchRiderData()` - Gets all riders for a show
- `findRidersByNames()` - Matches rider names to IDs using partial matching
- `fetchClassData()` - Gets class definitions and details
- `extractRiderSchedule()` - Processes raw schedule data into formatted entries
- `parseRiders()` - Main orchestration function

The HTML file provides a web interface with day-based tabs and French translations for viewing the parsed schedule data.