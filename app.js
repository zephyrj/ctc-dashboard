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
            seasonSelect.selectedIndex = seasonSelect.options.length-1;
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
    const raceSelect = document.getElementById('race');
    raceSelect.innerHTML = '';

    const season = document.getElementById('season').value;
    try {
        // Load season information
        const seasonData = await fetchJSON(`data/seasons/${season}/season-info.json`);
        
        // Load and process all race results for the season
        const allResults = [];
        for (const race of seasonData.races) {
            if (!race.result_file) {
                continue;
            }
            addRaceOption(race);
        }
        raceSelect.selectedIndex = raceSelect.options.length-1;
        await loadRaceResults();
        
        // Process results to generate standings
        //const standings = calculateStandings(allResults, seasonData);
        
        // Update UI with standings data
        updateDriverStandings(season).catch(reason => console.error(reason));
        updateTeamStandings(season).catch(reason => console.error(reason));

        const stats = {
            fastestLaps: {},
            polePositions: {},
            leadLaps: {},
            dnfs: {},
            dnss: {}
        };
        updateStatistics(stats);
        
        // Create charts
        //createDriverPointsChart(standings.drivers, allResults);
        //createTeamPointsChart(standings.teams);
        
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
    if (raceSelect.options.length && raceSelect.options[0].value === '') {
        raceSelect.innerHTML = '';
    }
    
    const option = document.createElement('option');
    option.value = race.round;
    option.textContent = `${race.round}. ${race.name}`;
    raceSelect.appendChild(option);
}

// Load race results when a race is selected
async function loadRaceResults() {
    const round_num = document.getElementById('race').value;
    const season = document.getElementById('season').value;
    //if (round_num === undefined) return;

    try {
        const seasonInfo = await fetchJSON(`data/seasons/${season}/season-info.json`);
        const race_results = await fetchJSON(`data/seasons/${season}/round${round_num}_results.json`);
        displayRaceResults(race_results, seasonInfo);
    } catch (error) {
        console.error('Error loading race results:', error);
        document.querySelector('#race-results-table tbody').innerHTML = 
            '<tr><td colspan="5" class="loading">Error loading race results</td></tr>';
    }
}

// Helper function to convert milliseconds to a readable time format
function formatTime(milliseconds) {
    if (!milliseconds && milliseconds !== 0) return '--:--.---';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = milliseconds % 1000;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function formatClassification(classification) {
    switch(classification) {
        case -1:
            return "DNF"
        case -2:
            return "DSQ"
        case -3:
            return "DNS"
        case -4:
            return "DNE"
        default:
            return classification
    }
}

// Display race results in the table
function displayRaceResults(raceData, seasonInfo) {

    const summary_body = document.querySelector('#race-results-summary tbody');
    summary_body.innerHTML = '';
    const driver_row = document.createElement('tr');
    driver_row.innerHTML = `
            <td><pre>${raceData.poleDriver}\n${raceData.poleTeam}</pre></td>
            <td><pre>${raceData.winningDriver}\n${raceData.winningTeam}\n${formatTime(raceData.winningTime)}</pre></td>
            <td><pre>${raceData.fastLapDriver}\n${raceData.fastLapTeam}\n${formatTime(raceData.fastLapTime)}</pre></td>
        `;
    summary_body.appendChild(driver_row);

    const tbody = document.querySelector('#race-results-table tbody');
    tbody.innerHTML = '';

    const winner_laps = raceData.classifications[0].numLaps;
    console.log(winner_laps)
    raceData.classifications.forEach((result, position) => {
        let gap;
        if (result.classification < -1) {
            gap = `${formatTime(null)}`
        } else if (result.numLaps !== winner_laps) {
            gap = `+ ${winner_laps-result.numLaps} laps`
        } else {
            gap = `+${formatTime(result.totalTime - raceData.winningTime)}`
        }
        const row = document.createElement('tr');
        let finish_pos = formatClassification(result.classification)
        row.innerHTML = `
            <td>${finish_pos}</td>
            <td>${result.driverName}</td>
            <td>${result.teamName}</td>
            <td>${formatTime(result.totalTime)}</td>
            <td>${gap}</td>
            <td>${formatTime(result.bestLap)}</td>
            <td>${getPoints(position, seasonInfo.points_system)}</td>
        `;
        tbody.appendChild(row);
    });
}

// Get points based on position and points system
function getPoints(position, pointsSystem) {
    // Default F1-style points system if not provided
    const defaultPoints = [
        25, 18, 15, 12, 10, 8, 6, 4, 2, 1
    ];
    const system = pointsSystem || defaultPoints;
    return system[position] || 0;
}
const ac_to_country_code = new Map([
    ["ENG", "gb-eng"],
    ["SCT", "gb-sct"]
]);

// Update driver standings table
async function updateDriverStandings(season_name) {
    const tbody = document.querySelector('#drivers-table tbody');
    tbody.innerHTML = '';

    const response = await fetchJSON(`data/seasons/${season_name}/driver_standings.json`);
    // Waiting for response isn't a good idea but works for now
    let src;
    for (const [index, entry] of response.standings.entries()) {
        const row = document.createElement('tr');

        let nation = entry.nationCode;
        // if (ac_to_country_code.has(nation)) {
        //     src = `https://flagcdn.com/${ac_to_country_code.get(nation)}.svg`;
        // } else {
        //     const flagData = await fetch(`https://restcountries.com/v3.1/alpha/${nation}`)
        //         .then(response => response.json()).catch(reason => console.warn(reason));
        //
        //
        //     const flagImg = document.createElement('img');
        //     if (flagData.length) {
        //         src = flagData[0].flags.svg
        //         // flagImg.src = flagData[0].flags.svg;
        //         // flagImg.alt = flagData[0].name.common;
        //         // flagImg.classList.add('flag');
        //     } else {
        //         src = "https://upload.wikimedia.org/wikipedia/commons/5/50/OWF_One_World_Flag_by_Thomas_Mandl.svg"
        //     }
        // }
        const bestFinish = entry.bestFinish == null ? "---" : entry.bestFinish;
        //<td><img src="${src}" class="flag"/></td>
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${nation}</td>
            <td>${entry.name}</td>
            <td>${entry.team}</td>
            <td>${entry.championshipPoints}</td>
            <td>${entry.wins}</td>
            <td>${entry.podiums}</td>
            <td>${entry.poles}</td>
            <td>${bestFinish}</td>
            <td>${entry.totalPoints}</td>
        `;
        tbody.appendChild(row);
    }
}

// Update team standings table
async function updateTeamStandings(season_name) {
    const tbody = document.querySelector('#teams-table tbody');
    tbody.innerHTML = '';

    const response = await fetchJSON(`data/seasons/${season_name}/team_standings.json`);
    response.standings.forEach((team, index) => {
        const row = document.createElement('tr');
        const bestFinish = team.bestFinish == null ? "---" : team.bestFinish;
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${team.name}</td>
            <td>${team.championshipPoints}</td>
            <td>${team.wins}</td>
            <td>${team.podiums}</td>
            <td>${team.poles}</td>
            <td>${bestFinish}</td>
            <td>${team.totalPoints}</td>
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

    // DNSs
    displayStatList('dnss', stats.dnss, 'DNS');
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
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.driverId}: ${item.value} ${item.value === 1 ? unit : unit + 's'}`;
        list.appendChild(li);
    });
    
    element.appendChild(list);
}

let driver_points_chart;

// Create driver points progression chart
function createDriverPointsChart(drivers, races) {
    const ctx = document.getElementById('driver-points-chart').getContext('2d');

    // Only show top 10 drivers
    const topDrivers = drivers.slice(0, 10);
    
    // Generate colors for each driver
    const driverColors = generateColors(topDrivers.length);

    // Create datasets
    const datasets = topDrivers.map((driver, index) => {
        let cumulative_points = 0;
        let progression = [];
        driver.pointsProgression.forEach((points, round_index) => {
            if (!(driver.dropped_rounds.has(round_index))) {
                cumulative_points += points;
            }
            cumulative_points += driver.bonusPointsProgression[round_index];
            progression.push(cumulative_points);
        });
        return {
            label: driver.name,
            data: progression,
            borderColor: driverColors[index],
            backgroundColor: 'transparent',
            tension: 0.1
        };
    });
    
    // Create labels from race names
    const labels = races.map(race => race.race.name);
    
    // Create chart
    if (driver_points_chart) {
        driver_points_chart.clear();
        driver_points_chart.destroy();
    }
    driver_points_chart = new Chart(ctx, {
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

let team_points_chart;
// Create team points chart
function createTeamPointsChart(teams) {
    const ctx = document.getElementById('team-points-chart').getContext('2d');
    
    // Generate colors
    const colors = generateColors(teams.length);

    if (team_points_chart) {
        team_points_chart.clear();
        team_points_chart.destroy();
    }
    // Create chart
    team_points_chart = new Chart(ctx, {
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