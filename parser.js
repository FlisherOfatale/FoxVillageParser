const fs = require('fs');
const https = require('https');

// Simple function to make HTTPS requests
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', reject);
    });
}

// Extract rider name from HTML
function extractRiderName(htmlString) {
    const match = htmlString.match(/>([^<]+)</);
    return match ? match[1] : htmlString;
}

// Convert date to French day name
function getFrenchDay(dateString) {
    const date = new Date(dateString);
    const dayMap = {
        'Friday': 'Vendredi',
        'Saturday': 'Samedi',
        'Sunday': 'Dimanche'
    };
    const englishDay = date.toLocaleDateString('en-US', { weekday: 'long' });
    return dayMap[englishDay] || englishDay;
}

// Format time from datetime string
function formatTime(timeString) {
    const time = new Date(timeString);
    return time.toTimeString().slice(0, 5); // HH:MM
}

// Normalize ring names
function normalizeRingName(ringName) {
    if (ringName === 'Combine Obstacle') {
        return 'Combiné';
    }
    return ringName;
}

// Extract class number from HTML
function extractClassNumber(htmlString) {
    const match = htmlString.match(/>(\d+)</);
    return match ? match[1] : htmlString;
}

// Load configuration
function loadConfig() {
    try {
        const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        return config;
    } catch (error) {
        console.log('No config.json found, using defaults');
        return {
            showId: 11474,
            riderNames: [],
            classMapping: {}
        };
    }
}

// Fetch rider data from API
async function fetchRiderData(showId) {
    const url = `https://www.foxvillage.com/show/GetRiderData?id=${showId}&_=${Date.now()}`;

    try {
        console.log(`Fetching rider data: ${url}`);
        const riderData = await fetchUrl(url);
        return riderData;
    } catch (error) {
        console.error('Error fetching rider data:', error);
        throw error;
    }
}

// Find rider IDs by names from API data
function findRidersByNames(riderData, targetNames) {
    const foundRiders = [];

    if (!riderData || !riderData.riderData || !Array.isArray(riderData.riderData)) {
        console.error('Invalid rider data format');
        return foundRiders;
    }

    for (const targetName of targetNames) {
        const rider = riderData.riderData.find(r => {
            const cleanName = extractRiderName(r.riderName);
            return cleanName.includes(targetName) || targetName.includes(cleanName);
        });

        if (rider) {
            foundRiders.push({
                riderID: rider.riderID,
                riderName: extractRiderName(rider.riderName),
                originalName: targetName
            });
            console.log(`✓ Found rider: ${extractRiderName(rider.riderName)} (ID: ${rider.riderID})`);
        } else {
            console.log(`✗ Rider not found: ${targetName}`);
        }
    }

    return foundRiders;
}

// Fetch class data from API
async function fetchClassData(showId) {
    const url = `https://www.foxvillage.com/show/GetClassData?id=${showId}`;

    try {
        console.log(`Fetching class data: ${url}`);
        const classData = await fetchUrl(url);
        return classData;
    } catch (error) {
        console.error('Error fetching class data:', error);
        return null;
    }
}

// Build class lookup map from class data
function buildClassLookup(classData) {
    const lookup = {};

    if (classData && classData.classData && Array.isArray(classData.classData)) {
        for (const cls of classData.classData) {
            lookup[cls.classID] = cls;
        }
    }

    return lookup;
}

// Format class string with detailed information
function formatClassString(classId, test, classLookup, classMapping = {}) {
    let className = '';

    // Get class name from lookup
    if (classLookup[classId] && classLookup[classId].className) {
        className = classLookup[classId].className;
    }

    // Build the full test name for mapping
    let fullTestName = className;
    if (test) {
        fullTestName = test; // Use test name as primary identifier for mapping
    }

    // Apply class mapping first
    let mappedName = fullTestName;
    for (const [originalName, mapped] of Object.entries(classMapping)) {
        if (fullTestName.includes(originalName)) {
            mappedName = mapped;
            break;
        }
    }

    // If we found a mapping, use it. Otherwise build the traditional string
    if (mappedName !== fullTestName) {
        return mappedName;
    }

    // Build traditional string
    let result = classId;
    if (className) {
        result += ' - ' + className;
    }
    if (test) {
        result += ' - ' + test;
    }

    return result;
}

// Extract filtered data from raw API response
function extractRiderSchedule(riderInfo, rawData, classLookup, classMapping = {}) {
    const schedule = [];

    if (rawData.riderPageData && Array.isArray(rawData.riderPageData)) {
        for (const entry of rawData.riderPageData) {
            const classId = extractClassNumber(entry.classText);
            const formattedClass = formatClassString(classId, entry.test, classLookup, classMapping);

            schedule.push({
                rider_name: riderInfo.originalName,
                rider_id: riderInfo.riderID,
                class: formattedClass,
                ring: normalizeRingName(entry.ring),
                day: getFrenchDay(entry.day),
                time: formatTime(entry.rideTime)
            });
        }
    }

    return schedule;
}

// Main function - no longer requires local files
async function parseRiders() {
    try {
        // Load config
        const config = loadConfig();
        const showId = config.showId || 11474;
        const riderNames = config.riderNames || [];
        const classMapping = config.classMapping || {};

        if (riderNames.length === 0) {
            console.log('No rider names provided in config.json');
            return [];
        }

        console.log(`Using show ID: ${showId}`);
        console.log(`Looking for riders: ${riderNames.join(', ')}`);

        // Fetch rider data from API instead of local file
        console.log('Fetching rider data from API...');
        const riderData = await fetchRiderData(showId);
        console.log(`Loaded ${riderData.riderData ? riderData.riderData.length : 0} riders from API`);

        // Find riders by name
        const foundRiders = findRidersByNames(riderData, riderNames);
        if (foundRiders.length === 0) {
            console.log('No matching riders found');
            return [];
        }

        // Fetch class data
        const classData = await fetchClassData(showId);
        const classLookup = buildClassLookup(classData);
        console.log(`Loaded ${Object.keys(classLookup).length} class definitions`);

        const allSchedules = [];

        for (const riderInfo of foundRiders) {
            console.log(`Fetching schedule for ${riderInfo.riderName} (ID: ${riderInfo.riderID})...`);

            // Fetch schedule data
            const url = `https://www.foxvillage.com/show/GetAllRiderData?show=${showId}&id=${riderInfo.riderID}`;
            console.log(`Fetching: ${url}`);

            try {
                const scheduleData = await fetchUrl(url);
                const riderSchedule = extractRiderSchedule(riderInfo, scheduleData, classLookup, classMapping);
                allSchedules.push(...riderSchedule);
                console.log(`Got ${riderSchedule.length} entries for: ${riderInfo.riderName}`);
            } catch (error) {
                console.log(`Failed to fetch data for ${riderInfo.riderName}:`, error.message);
            }

            // Simple delay to be respectful to the server
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return allSchedules;

    } catch (error) {
        console.error('Error in parseRiders:', error);
        throw error;
    }
}

// CLI usage
if (require.main === module) {
    const riderNames = process.argv.slice(2);

    // Load config to check for default rider names
    const config = loadConfig();
    const configRiders = config.riderNames || [];

    if (riderNames.length === 0 && configRiders.length === 0) {
        console.log('create config.json with riderNames array');
        process.exit(1);
    }

    parseRiders(riderNames)
        .then(schedule => {
            console.log('\n=== SCHEDULE ===');
            console.log(JSON.stringify(schedule, null, 2));

            // Save to files - both root and docs for local dev and deployment
            fs.writeFileSync('schedule.json', JSON.stringify(schedule, null, 2));

            // Ensure docs directory exists
            if (!fs.existsSync('docs')) {
                fs.mkdirSync('docs', { recursive: true });
            }
            fs.writeFileSync('docs/schedule.json', JSON.stringify(schedule, null, 2));

            console.log('\nSchedule saved to schedule.json and docs/schedule.json');
        })
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { parseRiders };