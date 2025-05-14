from datetime import date, datetime
from dataclasses import dataclass, field
from dataclass_wizard import JSONFileWizard, json_field
from dataclass_wizard import JSONPyWizard
from dataclass_wizard.v1 import Alias
from dataclass_wizard.serial_json import JSONWizard


@dataclass
class SessionDriverData(JSONPyWizard, JSONFileWizard, key_case='AUTO'):
    class _(JSONPyWizard.Meta):
        v1 = True

    guid: str
    name: str
    nation: str
    team: str
    class_id: str = Alias('ClassID')


@dataclass
class SessionCarData(JSONPyWizard, JSONFileWizard, key_case='AUTO'):
    class _(JSONPyWizard.Meta):
        v1 = True
    car_id: int
    model: str
    driver: SessionDriverData
    restrictor: int
    ballast_kg: int = Alias('BallastKG')


@dataclass
class SessionResultData(JSONPyWizard, JSONFileWizard, key_case='AUTO'):
    class _(JSONPyWizard.Meta):
        v1 = True
    car_id: int
    total_time: int
    num_laps: int
    has_penalty: bool
    penalty_time: int
    lap_penalty: int
    disqualified: bool
    grid_position: int
    best_lap: int


@dataclass
class SessionLapData(JSONPyWizard, JSONFileWizard, key_case='AUTO'):
    class _(JSONPyWizard.Meta):
        v1 = True
    car_id: int
    lap_time: int
    tyre: str
    sectors: list[int] = field(default_factory=list)


@dataclass
class SessionConfig(JSONPyWizard, JSONFileWizard, key_case='AUTO'):
    session_type: int
    time: int
    laps: int


@dataclass
class ServerSessionData(JSONWizard, JSONFileWizard, key_case='AUTO'):
    version: int
    event_name: str
    date: datetime
    track_name: str
    track_config: str
    session_config: SessionConfig
    cars: list[SessionCarData] = field(default_factory=list)
    laps: list[SessionLapData] = field(default_factory=list)
    result: list[SessionResultData] = field(default_factory=list)
