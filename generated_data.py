from datetime import date
from dataclasses import dataclass, field
from dataclass_wizard import JSONFileWizard
from dataclass_wizard.serial_json import JSONWizard


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
