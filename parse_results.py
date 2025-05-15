import os
import json
import sys
import pandas as pd
from functools import reduce

from generated_data import DriverStandings, DriverStandingsRow, TeamStandingsRow, TeamStandings, RaceResultRow, \
    RaceResults
from metadata import SeasonInfo, RaceEvent
from server_result_data import ServerSessionData, SessionCarData, SessionLapData, SessionResultData

SEASONS_PATH = './data/seasons'
SEASONS_LIST_PATH = os.path.join(SEASONS_PATH, 'info.json')
PARSE_HISTORY_FILE = './data/parse-history.json'

SEASON_INFO_FILE = 'season-info.json'
SEASON_DRIVERS_FILENAME = 'drivers.json'
SEASON_TEAMS_FILENAME = 'teams.json'


class Team(object):
    @staticmethod
    def from_session_car_data(car_data: SessionCarData):
        return Team(car_data.model, car_data.driver.team)


    @staticmethod
    def get_unique_id_for(model_name, team_name):
        return model_name + '-' + team_name

    def __init__(self, model_name, team_name):
        self.model_name = model_name
        self.team_name = team_name

    def unique_id(self):
        return Team.get_unique_id_for(self.model_name, self.team_name)


class Driver(object):
    @staticmethod
    def from_session_car_data(car_data: SessionCarData):
        driver = Driver()
        driver.guid = car_data.driver.guid
        driver.name = car_data.driver.name
        driver.nation = car_data.driver.nation
        return driver

    @staticmethod
    def get_unique_id(guid, name):
        return guid + '-' + name

    def __init__(self):
        self.guid = None
        self.name = None
        self.nation = None

    @property
    def unique_id(self):
        return Driver.get_unique_id(self.guid, self.name)


class Classification:
    DNF = -1
    DSQ = -2
    DNS = -3
    DNE = -4
    DNQ = -5

    @staticmethod
    def as_str(val):
        match val:
            case Classification.DNS:
                return "DNS"
            case Classification.DNF:
                return "DNF"
            case Classification.DNE:
                return "DNE"
            case Classification.DSQ:
                return "DSQ"
            case Classification.DNQ:
                return "DNQ"
            case _:
                return "N/A"


class SeasonEntrant(object):
    @staticmethod
    def from_session_car_data(car_data: SessionCarData):
        return SeasonEntrant(driver=Driver.from_session_car_data(car_data),
                             team=Team.from_session_car_data(car_data))

    @staticmethod
    def unique_id_from_car_data(car_data: SessionCarData):
        return SeasonEntrant.unique_id_for(car_data.driver.guid,
                                           car_data.driver.name,
                                           car_data.model,
                                           car_data.driver.team)

    @staticmethod
    def unique_id_for(driver_guid, driver_name, car_model_name, team_name):
        return (Driver.get_unique_id(driver_guid, driver_name) + "-" +
                Team.get_unique_id_for(car_model_name, team_name))

    def __init__(self, driver, team):
        self.driver: Driver = driver
        self.team: Team = team
        self.qualify_positions = list()
        self.finish_positions = list()
        self.dropped_round_indexes = set()

    @property
    def unique_id(self):
        return SeasonEntrant.unique_id_for(self.driver.guid,
                                           self.driver.name,
                                           self.team.model_name,
                                           self.team.team_name)

    def get_finish_positions_with_drop_rounds(self, num_drop_rounds: int):
        num_finishes = len(self.finish_positions)
        drop_round_filter_index = num_finishes-num_drop_rounds if num_finishes > num_drop_rounds else num_finishes
        return sorted(filter(lambda pos: pos > 0, self.finish_positions))[0:drop_round_filter_index]

    def get_highest_finish_position(self):
        best_pos = reduce(lambda best, pos: min(best, pos) if pos > 0 else best, self.finish_positions, sys.maxsize)
        if best_pos == sys.maxsize:
            return None
        return best_pos


class RaceEntrantResult(object):
    def __init__(self):
        self.season_entrant_id = None
        self.classification = None
        self.result_data: SessionResultData | None = None


class RaceResult(object):
    def __init__(self):
        self.name = None
        self.track = None
        self.date = None
        self.num_laps = None
        self.entrants: dict[int, SeasonEntrant] = dict()
        self.classifications: list[RaceResultRow] = list()
        self.pole_car_idx = None
        self.winning_time = None
        self.winning_laps_completed = None
        self.fastest_lap_car_idx = None
        self.fastest_lap_time = sys.maxsize
        self.best_lap_by_car: dict[int, int] = dict()

    def add_entrant(self, car_id, season_entrant):
        self.entrants[car_id] = season_entrant

    def calculate_stats_from_lap_data(self, laps: list[SessionLapData]):
        # TODO
        pass

class Season(object):
    def __init__(self, info: SeasonInfo):
        self.info: SeasonInfo = info
        self.entrants: dict[str, SeasonEntrant] = dict()
        self.race_results: list[RaceResult] = list()

    def add_race_result(self, name, session_data: ServerSessionData):
        race_idx = len(self.race_results)
        dns_entrants_ids = set(self.entrants.keys())
        race_result = RaceResult()
        race_result.name = name
        race_result.track = f"{session_data.track_name}-{session_data.track_config}"
        race_result.date = session_data.date
        race_result.num_laps = session_data.session_config.laps
        for car_data in session_data.cars:
            entrant_id = SeasonEntrant.unique_id_from_car_data(car_data)
            if self.get_entrant(entrant_id) is None:
                self.add_entrant(car_data, entered_at=race_idx)
            race_result.add_entrant(car_data.car_id, self.get_entrant(entrant_id))
            dns_entrants_ids.add(entrant_id)

        race_result.winning_time = session_data.result[0].total_time
        race_result.winning_laps_completed = session_data.result[0].num_laps
        for pos_idx, result in enumerate(session_data.result):
            if result.car_id not in race_result.entrants:
                continue
            race_result.best_lap_by_car[result.car_id] = result.best_lap
            if result.best_lap < race_result.fastest_lap_time:
                race_result.fastest_lap_car_idx = result.car_id
                race_result.fastest_lap_time = result.best_lap

            entrant = race_result.entrants[result.car_id]
            if entrant.unique_id in dns_entrants_ids:
                dns_entrants_ids.remove(entrant.unique_id)
            entrant.qualify_positions.insert(race_idx, result.grid_position)
            if result.grid_position == 1:
                race_result.pole_car_idx = result.car_id

            def nano_to_milliseconds(nanosecond):
                return round(nanosecond / 1000000)

            percent_complete = (result.num_laps / race_result.winning_laps_completed) * 100
            if percent_complete < self.info.classification_threshold:
                entrant.finish_positions.insert(race_idx, Classification.DNF)
            else:
                entrant.finish_positions.insert(race_idx, pos_idx+1)
            race_entry = RaceResultRow(
                classification=entrant.finish_positions[race_idx],
                driver_name=entrant.driver.name,
                team_name=entrant.team.team_name,
                total_time=result.total_time,
                num_laps=result.num_laps,
                best_lap=result.best_lap,
                grid_position=result.grid_position,
                penalty_time=nano_to_milliseconds(result.penalty_time)
            )
            race_result.classifications.append(race_entry)

        for entrant_id in dns_entrants_ids:
            entrant = self.entrants[entrant_id]
            entrant.finish_positions.insert(race_idx, Classification.DNS)
            entrant.qualify_positions.insert(race_idx, Classification.DNQ)
            race_entry = RaceResultRow(
                classification=entrant.finish_positions[race_idx],
                driver_name=entrant.driver.name,
                team_name=entrant.team.team_name,
                total_time=None,
                num_laps=None,
                best_lap=None,
                grid_position=entrant.qualify_positions[race_idx],
                penalty_time=0
            )
            race_result.classifications.append(race_entry)

        self.race_results.append(race_result)

    def get_entrant(self, driver_id):
        return self.entrants.get(driver_id, None)

    def add_entrant(self, car_data: SessionCarData, entered_at: int = 0):
        e = SeasonEntrant.from_session_car_data(car_data)
        e.qualify_positions = [Classification.DNE] * entered_at
        e.finish_positions = [Classification.DNE] * entered_at
        self.entrants[e.unique_id] = e

    def generate_standings(self, output_path):
        driver_rows: dict[str, DriverStandingsRow] = dict()
        team_rows: dict[str, TeamStandingsRow] = dict()
        driver_finishing_position_lookup: dict[str, list[int]] = dict()
        # TODO need somthing more fleshed out to handle multiple team scores
        team_finishing_position_lookup: dict[str, list[int]] = dict()

        def count_championship_points(finish_positions):
            return sum(map(lambda pos: self.info.points_system[pos-1] if pos-1 < len(self.info.points_system) else 0,
                           filter(lambda pos: pos > 0, finish_positions)))

        def select_best_finish_pos(first, second):
            if first > 0:
                return min(first, second) if second > 0 else first
            else:
                return second if second > 0 else max(first, second)

        for uid, entrant in self.entrants.items():
            wins = entrant.finish_positions.count(1)
            podiums = reduce(lambda total,pos: total+(pos<=3) if pos>0 else total, entrant.finish_positions, 0)
            poles = entrant.qualify_positions.count(1)
            total_points=count_championship_points(entrant.finish_positions)

            # TODO do we want to handle teams using different cars?
            team_name = entrant.team.team_name
            if team_name not in team_finishing_position_lookup:
                team_finishing_position_lookup[team_name] = entrant.finish_positions
            else:
                team_finishing_position_lookup[team_name] = [select_best_finish_pos(team_finishing_position_lookup[team_name][idx], pos)
                                                             for (idx, pos) in enumerate(entrant.finish_positions)]

            if team_name not in team_rows:
                team_rows[team_name] = TeamStandingsRow(
                    name=team_name,
                    car=entrant.team.model_name,
                    championship_points=0,
                    wins=wins,
                    podiums=podiums,
                    poles=poles,
                    total_points=total_points,
                    best_finish=entrant.get_highest_finish_position()
                )
            else:
                team_rows[team_name].wins += wins
                team_rows[team_name].podiums += podiums
                team_rows[team_name].poles += poles
                team_rows[team_name].total_points += total_points
                current_best_finish = team_rows[team_name].best_finish
                entrant_best_finish = entrant.get_highest_finish_position()
                if entrant_best_finish is not None:
                    team_rows[team_name].best_finish = entrant_best_finish if current_best_finish is None else min(current_best_finish, entrant_best_finish)

            if self.info.drop_rounds:
                champ_points = count_championship_points(entrant.get_finish_positions_with_drop_rounds(self.info.drop_rounds))
            else:
                champ_points = count_championship_points(entrant.finish_positions)

            champ_points += poles*self.info.pole_points
            total_points += poles*self.info.pole_points

            driver_name = entrant.driver.name
            if driver_name not in driver_rows:
                driver_finishing_position_lookup[driver_name] = entrant.finish_positions
                driver_rows[driver_name] = DriverStandingsRow(
                    name=driver_name,
                    team=entrant.team.team_name,
                    nation_code=entrant.driver.nation,
                    championship_points=champ_points,
                    wins=wins,
                    podiums=podiums,
                    poles=poles,
                    total_points=total_points,
                    best_finish=entrant.get_highest_finish_position()
                )
            else:
                # Account for drivers having multiple entries racing for different teams
                driver_rows[driver_name].team = entrant.team.team_name  # use most recent team name
                driver_rows[driver_name].wins += wins
                driver_rows[driver_name].podiums += podiums
                driver_rows[driver_name].poles += poles
                driver_rows[driver_name].championship_points += champ_points
                driver_rows[driver_name].total_points += total_points
                best_finish = entrant.get_highest_finish_position()
                current_best_finish = driver_rows[driver_name].best_finish
                if best_finish is not None:
                    driver_rows[driver_name].best_finish = best_finish if current_best_finish is None else min(current_best_finish, best_finish)
                # merge finish positions
                driver_finishing_position_lookup[driver_name] = [max(driver_finishing_position_lookup[driver_name][idx], pos) for (idx, pos) in enumerate(entrant.finish_positions)]

        for team_name, best_finishing_pos_list in team_finishing_position_lookup.items():
            team_rows[team_name].championship_points = count_championship_points(best_finishing_pos_list)

        write_json_file(calculate_drivers_standings(driver_rows, driver_finishing_position_lookup), os.path.join(output_path, "driver_standings.json"))
        write_json_file(calculate_team_standings(team_rows, team_finishing_position_lookup, len(self.entrants)), os.path.join(output_path, "team_standings.json"))

    def generate_race_results(self, output_path):
        for idx, race in enumerate(self.race_results, 1):
            # TODO we could do a sort over this so we can manually add penalties into the data
            #      for now we can rely on the generated data being correct
            write_json_file(
                RaceResults(
                    round = idx,
                    name=race.name,
                    track=race.track,
                    date=race.date,
                    num_laps=race.num_laps,
                    winning_driver=race.classifications[0].driver_name,
                    winning_team=race.classifications[0].team_name,
                    winning_time=race.winning_time,
                    pole_driver=race.entrants[race.pole_car_idx].driver.name,
                    pole_team=race.entrants[race.pole_car_idx].team.team_name,
                    fast_lap_driver=race.entrants[race.fastest_lap_car_idx].driver.name,
                    fast_lap_team=race.entrants[race.fastest_lap_car_idx].team.team_name,
                    fast_lap_time=race.fastest_lap_time,
                    classifications=race.classifications,
                ),
                os.path.join(output_path, f"round{idx}_results.json"))


def write_json_file(json_data_obj, path):
    if os.path.isfile(path):
        os.remove(path)
    json_data_obj.to_json_file(path)

def calculate_drivers_standings(rows: dict[str, DriverStandingsRow],
                                finish_positions: dict[str, list[int]]) -> DriverStandings:

    dataframe = _create_standings_sorted_dataframe(rows, finish_positions, len(rows))
    return DriverStandings([rows[name] for name in dataframe["name"]])


def calculate_team_standings(rows: dict[str, TeamStandingsRow],
                             finish_positions: dict[str, list[int]],
                             max_finish_pos: int) -> TeamStandings:
    dataframe = _create_standings_sorted_dataframe(rows, finish_positions, max_finish_pos)
    return TeamStandings([rows[name] for name in dataframe["name"]])


def _create_standings_sorted_dataframe(rows, finish_positions: dict[str, list[int]], max_finish_pos: int):
    def create_pos_column_name(pos: int):
        return f"position_{pos}_count"
    dataframe = pd.DataFrame(rows.values())
    for position in range(1, max_finish_pos + 1):
        column_name = create_pos_column_name(position)
        dataframe[column_name] = dataframe['name'].apply(
            lambda name: finish_positions.get(name, []).count(position)
        )
    dataframe.sort_values(['championship_points'] +
                          [create_pos_column_name(pos) for pos in range(1, max_finish_pos + 1)],
                          ascending=[False]+[False]*max_finish_pos, inplace=True)
    return dataframe


def main():
    if not os.path.isfile(SEASONS_LIST_PATH):
        exit(0)

    try:
        with open(SEASONS_LIST_PATH, 'r') as f:
            season_list = json.load(f)
    except FileNotFoundError:
        exit(0)

    for season in season_list:
        season_info_path = os.path.join(SEASONS_PATH, season, SEASON_INFO_FILE)
        season_info = SeasonInfo.from_json_file(season_info_path)
        s = Season(season_info)
        race_dir_path = os.path.join(os.path.dirname(season_info_path), "races")
        for race in season_info.races:
            if not race.result_file:
                continue
            result_path = os.path.join(race_dir_path, race.result_file+".json")
            if not os.path.isfile(result_path):
                continue
            s.add_race_result(race.name, ServerSessionData.from_json_file(result_path))

        s.generate_race_results(os.path.dirname(season_info_path))
        s.generate_race_results(os.path.dirname(season_info_path))


if __name__ == "__main__":
    main()
