from datetime import datetime
from dataclasses import dataclass, field
from dataclass_wizard import JSONFileWizard
from dataclass_wizard.serial_json import JSONWizard

@dataclass
class RaceResultRow(JSONWizard, JSONFileWizard, key_case='AUTO'):
    classification: int
    driver_name: str
    team_name: str
    total_time: int | None
    num_laps: int | None
    best_lap: int | None
    grid_position: int
    penalty_time: int


@dataclass
class RaceResults(JSONWizard, JSONFileWizard, key_case='AUTO'):
    round: int
    name: str
    track: str
    date: datetime
    num_laps: int | None
    winning_driver: str
    winning_team: str
    winning_time: int
    pole_driver: str
    pole_team: str
    fast_lap_driver: str
    fast_lap_team: str
    fast_lap_time: int
    classifications: list[RaceResultRow] = field(default_factory=list)


@dataclass
class DriverStandingsRow(JSONWizard, JSONFileWizard, key_case='AUTO'):
    name: str
    team: str
    nation_code: str
    championship_points: int
    wins: int
    podiums: int
    poles: int
    total_points: int
    best_finish: int | None = None


@dataclass
class DriverStandings(JSONWizard, JSONFileWizard, key_case='AUTO'):
    standings: list[DriverStandingsRow] = field(default_factory=list)


@dataclass
class TeamStandingsRow(JSONWizard, JSONFileWizard, key_case='AUTO'):
    name: str
    car: str
    championship_points: int
    wins: int
    podiums: int
    poles: int
    total_points: int
    best_finish: int | None = None


@dataclass
class TeamStandings(JSONWizard, JSONFileWizard, key_case='AUTO'):
    standings: list[TeamStandingsRow] = field(default_factory=list)


@dataclass
class ModelStandingsRow(JSONWizard, JSONFileWizard, key_case='AUTO'):
    model: str
    championship_points: int
    wins: int
    podiums: int
    poles: int
    total_points: int
    best_finish: int | None = None


@dataclass
class ModelStandings(JSONWizard, JSONFileWizard, key_case='AUTO'):
    standings: list[ModelStandingsRow] = field(default_factory=list)