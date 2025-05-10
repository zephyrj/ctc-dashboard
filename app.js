document.addEventListener('DOMContentLoaded', function() {
    // Initialize navigation
    initializeNavigation();

    // Load available seasons
    loadAvailableSeasons().then(() => loadSeasonData());

    // Add event listeners
    document.getElementById('season').addEventListener('change', loadSeasonData);
    document.getElementById('race').addEventListener('change', loadRaceResults);
});

// Navigation functionality
function initializeNavigation() {
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links and views
            navLinks.forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Show corresponding view
            const viewId = this.getAttribute('data-view') + '-view';
            document.getElementById(viewId).classList.add('active');
        });
    });
}

async function loadAvailableSeasons() {
    try {
        // Clear any existing options
        const seasonSelect = document.getElementById('season');
        seasonSelect.innerHTML = '';

        // Get list of seasons
        const response = await fetchJSON('data/seasons/info.json');

        // Process each season directory
        for (const season_path of response) {
            try {
                // Try to load the season-info.json for each directory
                const seasonInfo = await fetchJSON(`data/seasons/${season_path}/season-info.json`);

                // Create and add option only if season-info.json exists and has a name
                if (seasonInfo && seasonInfo.name) {
                    const option = document.createElement('option');
                    option.value = season_path;
                    option.textContent = seasonInfo.name;
                    option.index = seasonInfo.index;
                    seasonSelect.appendChild(option)
                }
            } catch (error) {
                console.log(`Skipping ${season_path}: no valid season-info.json found`);
            }
        }

        // If no seasons were found, add a placeholder option
        if (seasonSelect.options.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No seasons available';
            seasonSelect.appendChild(option);
        } else {
            seasonSelect.selectedIndex = 0;
        }
    } catch (error) {
        console.error('Error loading seasons:', error);
        // Add error option
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Error loading seasons';
        document.getElementById('season').appendChild(option);
    }
}

// Load season data
async function loadSeasonData() {
    const season = document.getElementById('season').value;
    
    try {
        // Load season information
        const seasonData = await fetchJSON(`data/seasons/${season}/season-info.json`);
        
        // Load and process all race results for the season
        const allResults = [];
        for (const race of seasonData.races) {
            const raceResults = await fetchJSON(`data/seasons/${season}/races/${race.id}.json`);
            allResults.push({
                race: race,
                results: raceResults
            });
            
            // Add race to race selector
            addRaceOption(race);
        }
        
        // Process results to generate standings
        const standings = calculateStandings(allResults, seasonData);
        
        // Update UI with standings data
        updateDriverStandings(standings.drivers);
        updateTeamStandings(standings.teams);
        updateStatistics(standings.stats);
        
        // Create charts
        createDriverPointsChart(standings.drivers, allResults);
        createTeamPointsChart(standings.teams);
        
    } catch (error) {
        console.error('Error loading season data:', error);
        document.querySelectorAll('.loading').forEach(el => {
            el.textContent = 'Error loading data. Please check console for details.';
        });
    }
}

// Fetch JSON data
async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
}

// Add race to race selector
function addRaceOption(race) {
    const raceSelect = document.getElementById('race');
    
    // Clear "Loading races..." option if it exists
    if (raceSelect.options[0].value === '') {
        raceSelect.innerHTML = '';
    }
    
    const option = document.createElement('option');
    option.value = race.id;
    option.textContent = `${race.round}. ${race.name}`;
    raceSelect.appendChild(option);
}

// Calculate standings from results
function calculateStandings(allResults, seasonData) {
    // Initialize data structures
    const drivers = {};
    const teams = {};
    const stats = {
        fastestLaps: {},
        polePositions: {},
        leadLaps: {},
        dnfs: {}
    };
    
    // Process each race
    allResults.forEach((raceData, raceIndex) => {
        const race = raceData.race;
        const results = raceData.results;
        
        // Process each driver's result
        results.forEach(result => {
            // Initialize driver if not exists
            if (!drivers[result.driverId]) {
                drivers[result.driverId] = {
                    id: result.driverId,
                    name: result.driver,
                    team: result.team,
                    points: 0,
                    wins: 0,
                    podiums: 0,
                    pointsProgression: Array(allResults.length).fill(0)
                };
            }
            
            // Initialize team if not exists
            if (!teams[result.teamId]) {
                teams[result.teamId] = {
                    id: result.teamId,
                    name: result.team,
                    points: 0,
                    wins: 0,
                    podiums: 0
                };
            }
            
            // Add points
            const pointsEarned = getPoints(result.position, seasonData.pointsSystem);
            drivers[result.driverId].points += pointsEarned;
            teams[result.teamId].points += pointsEarned;
            
            // Update points progression (cumulative)
            if (raceIndex > 0) {
                drivers[result.driverId].pointsProgression[raceIndex] = 
                    drivers[result.driverId].pointsProgression[raceIndex - 1] + pointsEarned;
            } else {
                drivers[result.driverId].pointsProgression[raceIndex] = pointsEarned;
            }
            
            // Count wins and podiums
            if (result.position === 1) {
                drivers[result.driverId].wins++;
                teams[result.teamId].wins++;
            }
            if (result.position <= 3) {
                drivers[result.driverId].podiums++;
                teams[result.teamId].podiums++;
            }
            
            // Process statistics
            if (result.fastestLap) {
                stats.fastestLaps[result.driverId] = (stats.fastestLaps[result.driverId] || 0) + 1;
            }
            if (result.polePosition) {
                stats.polePositions[result.driverId] = (stats.polePositions[result.driverId] || 0) + 1;
            }
            if (result.lapsLed > 0) {
                stats.leadLaps[result.driverId] = (stats.leadLaps[result.driverId] || 0) + result.lapsLed;
            }
            if (result.dnf) {
                stats.dnfs[result.driverId] = (stats.dnfs[result.driverId] || 0) + 1;
            }
        });
    });
    
    // Convert objects to sorted arrays
    const driverStandings = Object.values(drivers).sort((a, b) => b.points - a.points);
    const teamStandings = Object.values(teams).sort((a, b) => b.points - a.points);
    
    return {
        drivers: driverStandings,
        teams: teamStandings,
        stats: stats
    };
}

// Get points based on position and points system
function getPoints(position, pointsSystem) {
    // Default F1-style points system if not provided
    const defaultPoints = {
        1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 
        6: 8, 7: 6, 8: 4, 9: 2, 10: 1
    };
    
    const system = pointsSystem || defaultPoints;
    return system[position] || 0;
}

// Update driver standings table
function updateDriverStandings(drivers) {
    const tbody = document.querySelector('#drivers-table tbody');
    tbody.innerHTML = '';
    
    drivers.forEach((driver, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${driver.name}</td>
            <td>${driver.team}</td>
            <td>${driver.points}</td>
            <td>${driver.wins}</td>
            <td>${driver.podiums}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update team standings table
function updateTeamStandings(teams) {
    const tbody = document.querySelector('#teams-table tbody');
    tbody.innerHTML = '';
    
    teams.forEach((team, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${team.name}</td>
            <td>${team.points}</td>
            <td>${team.wins}</td>
            <td>${team.podiums}</td>
        `;
        tbody.appendChild(row);
    });
}

// Load race results when a race is selected
async function loadRaceResults() {
    const race = document.getElementById('race').value;
    const season = document.getElementById('season').value;
    
    if (!race) return;
    
    try {
        const results = await fetchJSON(`data/${season}/races/${race}.json`);
        displayRaceResults(results);
    } catch (error) {
        console.error('Error loading race results:', error);
        document.querySelector('#race-results-table tbody').innerHTML = 
            '<tr><td colspan="5" class="loading">Error loading race results</td></tr>';
    }
}

// Display race results in the table
function displayRaceResults(results) {
    const tbody = document.querySelector('#race-results-table tbody');
    tbody.innerHTML = '';
    
    results.forEach(result => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${result.position}</td>
            <td>${result.driver}</td>
            <td>${result.team}</td>
            <td>${result.dnf ? 'DNF' : result.time}</td>
            <td>${result.points || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update statistics section
function updateStatistics(stats) {
    // Fastest Laps
    displayStatList('fastest-laps', stats.fastestLaps, 'fastest lap');
    
    // Pole Positions
    displayStatList('pole-positions', stats.polePositions, 'pole');
    
    // Lead Laps
    displayStatList('lead-laps', stats.leadLaps, 'lap');
    
    // DNFs
    displayStatList('dnfs', stats.dnfs, 'DNF');
}

// Display a statistic as a list
function displayStatList(elementId, data, unit) {
    const element = document.getElementById(elementId);
    element.innerHTML = '';
    
    // Convert to array and sort
    const items = Object.entries(data)
        .map(([driverId, value]) => ({ driverId, value }))
        .sort((a, b) => b.value - a.value);
    
    if (items.length === 0) {
        element.innerHTML = '<p>No data available</p>';
        return;
    }
    
    const list = document.createElement('ol');
    items.slice(0, 5).forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.driverId}: ${item.value} ${item.value === 1 ? unit : unit + 's'}`;
        list.appendChild(li);
    });
    
    element.appendChild(list);
}

// Create driver points progression chart
function createDriverPointsChart(drivers, races) {
    const ctx = document.getElementById('driver-points-chart').getContext('2d');
    
    // Only show top 10 drivers
    const topDrivers = drivers.slice(0, 10);
    
    // Generate colors for each driver
    const driverColors = generateColors(topDrivers.length);
    
    // Create datasets
    const datasets = topDrivers.map((driver, index) => {
        return {
            label: driver.name,
            data: driver.pointsProgression,
            borderColor: driverColors[index],
            backgroundColor: 'transparent',
            tension: 0.1
        };
    });
    
    // Create labels from race names
    const labels = races.map(race => race.race.name);
    
    // Create chart
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Points'
                    }
                }
            }
        }
    });
}

// Create team points chart
function createTeamPointsChart(teams) {
    const ctx = document.getElementById('team-points-chart').getContext('2d');
    
    // Generate colors
    const colors = generateColors(teams.length);
    
    // Create chart
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: teams.map(team => team.name),
            datasets: [{
                label: 'Points',
                data: teams.map(team => team.points),
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Points'
                    }
                }
            }
        }
    });
}

// Generate an array of colors
function generateColors(count) {
    const baseColors = [
        '#e6194B', '#3cb44b', '#ffe119', '#4363d8', 
        '#f58231', '#911eb4', '#42d4f4', '#f032e6', 
        '#bfef45', '#fabed4', '#469990', '#dcbeff', 
        '#9A6324', '#800000', '#aaffc3', '#808000', 
        '#ffd8b1', '#000075', '#a9a9a9', '#000000'
    ];
    
    // If we need more colors than in our base array, we'll generate them
    if (count <= baseColors.length) {
        return baseColors.slice(0, count);
    }
    
    // Generate random colors for the excess
    const colors = [...baseColors];
    for (let i = baseColors.length; i < count; i++) {
        const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        colors.push(color);
    }
    
    return colors;
}
