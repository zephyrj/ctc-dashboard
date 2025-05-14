from datetime import date
from dataclasses import dataclass, field
from dataclass_wizard import JSONFileWizard
from dataclass_wizard.serial_json import JSONWizard


@dataclass
class RaceEvent(JSONWizard, JSONFileWizard, key_case='AUTO'):
    round: int
    name: str
    date: date
    track: str | None = None
    nation: str | None = None
    result_file: str | None = None


@dataclass
class SeasonInfo(JSONWizard, JSONFileWizard, key_case='AUTO'):
    index: int | None
    name: str
    pole_points: int = 0
    drop_rounds: int = 0
    classification_threshold: int = 75
    points_system: list[int] = field(default_factory=lambda: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1])
    races: list[RaceEvent] = field(default_factory=list)
    ignored_drivers: list[str] = field(default_factory=list)

