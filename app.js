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
            const raceResults = await fetchJSON(`data/seasons/${season}/races/${race.result_file}.json`);
            allResults.push({
                race: race,
                results: raceResults
            });
            
            // Add race to race selector
            addRaceOption(race);
        }
        document.getElementById('race').selectedIndex = 0;
        await loadRaceResults();
        
        // Process results to generate standings
        const standings = calculateStandings(allResults, seasonData);
        
        // Update UI with standings data
        updateDriverStandings(standings.drivers).catch(reason => console.error(reason));
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
    if (raceSelect.options.length && raceSelect.options[0].value === '') {
        raceSelect.innerHTML = '';
    }
    
    const option = document.createElement('option');
    option.value = race.result_file;
    option.textContent = `${race.round}. ${race.name}`;
    raceSelect.appendChild(option);
}

// Load race results when a race is selected
async function loadRaceResults() {
    const race = document.getElementById('race').value;
    const season = document.getElementById('season').value;
    
    if (!race) return;
    
    try {
        const seasonInfo = await fetchJSON(`data/seasons/${season}/season-info.json`);
        const selectedRace = seasonInfo.races.find(r => r.result_file === race);
        if (!selectedRace) return;

        const results = await fetchJSON(`data/seasons/${season}/races/${selectedRace.result_file}.json`);
        displayRaceResults(results, seasonInfo.pointsSystem);
    } catch (error) {
        console.error('Error loading race results:', error);
        document.querySelector('#race-results-table tbody').innerHTML = 
            '<tr><td colspan="5" class="loading">Error loading race results</td></tr>';
    }
}

// Helper function to convert milliseconds to a readable time format
function formatTime(milliseconds) {
    if (!milliseconds && milliseconds !== 0) return 'DNF';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = milliseconds % 1000;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// Display race results in the table
function displayRaceResults(raceData, seasonInfo) {
    const tbody = document.querySelector('#race-results-table tbody');
    tbody.innerHTML = '';
    
    // Create a map of CarId to Car data for quick lookup
    const carsMap = new Map(raceData.Cars.map(car => [car.CarId, car]));
    const unclassifiedCarIds = new Set(carsMap.keys())
    const ignoredDrivers = new Set(seasonInfo.ignoredDrivers || [])
    
    // Process results
    raceData.Result.forEach((result, position) => {
        const car = carsMap.get(result.CarId);
        if (!car) return; // Skip if car data not found

        unclassifiedCarIds.delete(car.CarId);
        if (ignoredDrivers.has(car.Driver.Name)) return;
        
        const row = document.createElement('tr');
        const finishTime = result.TotalTime ? formatTime(result.TotalTime) : 'DNF';
        
        row.innerHTML = `
            <td>${position + 1}</td>
            <td>${car.Driver.Name}</td>
            <td>${car.Driver.Team}</td>
            <td>${finishTime}</td>
            <td>${getPoints(position, seasonInfo.pointsSystem)}</td>
        `;
        tbody.appendChild(row);
    });
    let unclassifiedCount = 0;
    unclassifiedCarIds.forEach(carId => {
        const car = carsMap.get(carId);
        if (!car) return;
        if (car.Driver.Name === 'Empty Slot') return;

        const row = document.createElement('tr');
        const finishTime = 'DNF';

        row.innerHTML = `
            <td>${raceData.Result.length + unclassifiedCount + 1}</td>
            <td>${car.Driver.Name}</td>
            <td>${car.Driver.Team}</td>
            <td>${finishTime}</td>
            <td>0</td>
        `;
        tbody.appendChild(row);
        unclassifiedCount+=1;
    })

    // Add fastest lap information if available
    if (raceData.Laps && raceData.Laps.length > 0) {
        // Find fastest lap
        const fastestLap = raceData.Laps.reduce((fastest, lap) => {
            if (!fastest || (lap.LapTime && lap.LapTime < fastest.LapTime)) {
                return lap;
            }
            return fastest;
        });

        if (fastestLap && fastestLap.CarId) {
            const fastestLapCar = carsMap.get(fastestLap.CarId);
            if (fastestLapCar) {
                const fastestLapInfo = document.createElement('tr');
                fastestLapInfo.classList.add('fastest-lap');
                fastestLapInfo.innerHTML = `
                    <td colspan="3">Fastest Lap: ${fastestLapCar.Driver.Name} - ${fastestLapCar.Driver.Team}</td>
                    <td colspan="2">${formatTime(fastestLap.LapTime)}</td>
                `;
                tbody.appendChild(fastestLapInfo);
            }
        }
    }
}

function calculateStandings(allResults, seasonData) {
    let drivers = {};
    const teams = {};
    const stats = {
        fastestLaps: {},
        polePositions: {},
        leadLaps: {},
        dnfs: {},
        dnss: {}
    };

    const ignoredDrivers = new Set(seasonData.ignoredDrivers || [])
    allResults.forEach((raceData, raceIndex) => {
        const race = raceData.race;
        const results = raceData.results;
        
        // Create cars map for quick lookup
        const carsMap = new Map(results.Cars.map(car => [car.CarId, car]));
        const unclassifiedCarIds = new Set(carsMap.keys())

        const total_laps = results.SessionConfig.laps;
        
        // Process each driver's result
        results.Result.forEach((result, position) => {
            const car = carsMap.get(result.CarId);
            if (!car) return;

            unclassifiedCarIds.delete(car.CarId);
            if (ignoredDrivers.has(car.Driver.Name)) return;

            const unique_driver_key = car.Driver.Guid + car.Driver.Name;
            // Initialize driver if not exists
            if (!drivers[unique_driver_key]) {
                drivers[unique_driver_key] = {
                    id: unique_driver_key,
                    name: car.Driver.Name,
                    team: car.Driver.Team,
                    nation: car.Driver.Nation,
                    points: 0,
                    wins: 0,
                    podiums: 0,
                    poles: 0,
                    pointsProgression: Array(allResults.length).fill(0),
                    bonusPointsProgression: Array(allResults.length).fill(0),
                    dropped_rounds: new Set()
                };
            }

            const unique_team_key = car.Model + car.Driver.Team.Name;
            // Initialize team if not exists
            if (!teams[unique_team_key]) {
                teams[unique_team_key] = {
                    id: unique_team_key,
                    name: car.Driver.Team,
                    points: 0,
                    wins: 0,
                    podiums: 0
                };
            }

            // TODO rework stats
            let isDNF = false;
            if (!result.TotalTime) {
                stats.dnfs[car.Driver.Name] = (stats.dnfs[car.Driver.Name] || 0) + 1;
                isDNF = true;
            } else {
                const percent_complete = (result.NumLaps / total_laps) * 100
                if (percent_complete < 75) {
                    stats.dnfs[car.Driver.Name] = (stats.dnfs[car.Driver.Name] || 0) + 1;
                    isDNF = true;
                }
            }

            let pointsEarned = isDNF ? 0 : getPoints(position + 1, seasonData.pointsSystem);
            if (result.GridPosition === 1) {
                drivers[unique_driver_key].poles++;
                stats.polePositions[car.Driver.Name] = (stats.polePositions[car.Driver.Name] || 0) + 1;
                drivers[unique_driver_key].points += (seasonData.polePoints || 0)
                drivers[unique_driver_key].bonusPointsProgression[raceIndex] += (seasonData.polePoints || 0);
            }
            drivers[unique_driver_key].points += pointsEarned;
            teams[unique_team_key].points += pointsEarned;
            drivers[unique_driver_key].pointsProgression[raceIndex] = pointsEarned

            if (!isDNF) {
                // Count wins and podiums
                if (position === 0) {
                    drivers[unique_driver_key].wins++;
                    teams[unique_team_key].wins++;
                }
                if (position < 3) {
                    drivers[unique_driver_key].podiums++;
                    teams[unique_team_key].podiums++;
                }
            }
        });

        unclassifiedCarIds.forEach((carId, index) => {
            const car = carsMap.get(carId);
            if (!car || ignoredDrivers.has(car.Driver.Name)) return;
            const unique_driver_key = car.Driver.Guid + car.Driver.Name;
            // Initialize driver if not exists
            if (!drivers[unique_driver_key]) {
                drivers[unique_driver_key] = {
                    id: unique_driver_key,
                    name: car.Driver.Name,
                    team: car.Driver.Team,
                    nation: car.Driver.Nation,
                    points: 0,
                    championship_points: 0,
                    wins: 0,
                    podiums: 0,
                    poles: 0,
                    pointsProgression: Array(allResults.length).fill(0),
                    bonusPointsProgression: Array(allResults.length).fill(0),
                    dropped_rounds: new Set()
                };
            }

            const unique_team_key = car.Model + car.Driver.Team.Name;
            // Initialize team if not exists
            if (!teams[unique_team_key]) {
                teams[unique_team_key] = {
                    id: unique_team_key,
                    name: car.Driver.Team,
                    points: 0,
                    wins: 0,
                    podiums: 0
                };
            }
            stats.dnss[car.Driver.Name] = (stats.dnss[car.Driver.Name] || 0) + 1;
        });
        
        // Find fastest lap
        if (results.Laps && results.Laps.length > 0) {
            const fastestLap = results.Laps.reduce((fastest, lap) => {
                if (!fastest || (lap.LapTime && lap.LapTime < fastest.LapTime)) {
                    return lap;
                }
                return fastest;
            });
            
            if (fastestLap && fastestLap.CarId) {
                const car = carsMap.get(fastestLap.CarId);
                if (car) {
                    stats.fastestLaps[car.Driver.Name] = (stats.fastestLaps[car.Driver.Name] || 0) + 1;
                }
            }
        }
    });

    for (let driver of Object.values(drivers)) {
        if (seasonData.dropRounds && seasonData.dropRounds > allResults.length) {
            driver.dropped_rounds =
                new Set(Array.from(driver.pointsProgression.keys())
                    .sort((a, b) => driver.pointsProgression[a] - driver.pointsProgression[b])
                    .slice(0, seasonData.dropRounds || 0))
        }
        driver.championship_points =
            driver.pointsProgression
                .filter((value, index, array)=> !(driver.dropped_rounds.has(index)))
                .reduce((total_points, round_points) => total_points + round_points, 0);
        driver.championship_points += driver.bonusPointsProgression.reduce((total_points, round_points) => total_points + round_points, 0);
    }

    // Count pole position points and handle drivers on the same points
    const driverStandings = Object.values(drivers).sort((a, b) => b.championship_points - a.championship_points);
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
async function updateDriverStandings(drivers) {
    const tbody = document.querySelector('#drivers-table tbody');
    tbody.innerHTML = '';

    // Waiting for response isn't a good idea but works for now
    let src;
    for (const driver of drivers) {
        const index = drivers.indexOf(driver);
        const row = document.createElement('tr');

        let nation = driver.nation;
        if (ac_to_country_code.has(nation)) {
            src = `https://flagcdn.com/${ac_to_country_code.get(nation)}.svg`;
        } else {
            const flagData = await fetch(`https://restcountries.com/v3.1/alpha/${nation}`)
                .then(response => response.json()).catch(reason => console.warn(reason));


            const flagImg = document.createElement('img');
            if (flagData.length) {
                src = flagData[0].flags.svg
                // flagImg.src = flagData[0].flags.svg;
                // flagImg.alt = flagData[0].name.common;
                // flagImg.classList.add('flag');
            } else {
                src = "https://upload.wikimedia.org/wikipedia/commons/5/50/OWF_One_World_Flag_by_Thomas_Mandl.svg"
            }
        }

        row.innerHTML = `
            <td>${index + 1}</td>
            <td><img src="${src}" class="flag"/></td>
            <td>${driver.name}</td>
            <td>${driver.team}</td>
            <td>${driver.championship_points}</td>
            <td>${driver.wins}</td>
            <td>${driver.podiums}</td>
            <td>${driver.poles}</td>
            <td>${driver.points}</td>
        `;
        tbody.appendChild(row);
    }
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