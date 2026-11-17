import json
from pathlib import Path

from app.export_schemas import build_schemas, find_drift, write_schemas

EXPECTED = {
    "route_data",
    "traveller_profile",
    "map_action",
    "agent_turn_request",
    "agent_turn_response",
}


def test_writes_one_file_per_shared_model(tmp_path: Path) -> None:
    written = write_schemas(tmp_path)
    assert {p.stem for p in written} == EXPECTED
    for path in written:
        schema = json.loads(path.read_text(encoding="utf-8"))
        assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
        assert schema["title"]


def test_output_is_deterministic(tmp_path: Path) -> None:
    first, second = tmp_path / "a", tmp_path / "b"
    write_schemas(first)
    write_schemas(second)
    for path in first.iterdir():
        assert path.read_bytes() == (second / path.name).read_bytes()


def test_fact_schema_requires_verified_from() -> None:
    fact = build_schemas()["route_data"]["$defs"]["Fact"]
    assert "verified_from" in fact["required"]
    assert fact["additionalProperties"] is False


def test_map_action_schema_covers_every_tool() -> None:
    schema = build_schemas()["map_action"]
    assert schema["discriminator"]["propertyName"] == "name"
    assert set(schema["discriminator"]["mapping"]) == {
        "set_traveller_profile",
        "select_hotel",
        "show_route",
        "start_walk",
        "fly_to_stop",
        "enter_street_view",
        "exit_street_view",
        "pause_walk",
        "resume_walk",
    }


def test_check_passes_when_up_to_date(tmp_path: Path) -> None:
    write_schemas(tmp_path)
    assert find_drift(tmp_path) == []


def test_check_reports_stale_missing_and_extra_files(tmp_path: Path) -> None:
    write_schemas(tmp_path)
    (tmp_path / "route_data.json").write_text("{}\n", encoding="utf-8")
    (tmp_path / "map_action.json").unlink()
    (tmp_path / "old_model.json").write_text("{}\n", encoding="utf-8")
    assert find_drift(tmp_path) == [
        "out of date: route_data.json",
        "out of date: map_action.json",
        "unexpected: old_model.json",
    ]
