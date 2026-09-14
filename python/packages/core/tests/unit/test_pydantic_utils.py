"""Unit tests for the shared LangChain/CrewAI pydantic-model generator.

Regression coverage for: an array parameter with no declared `items` type
used to map to bare `list`, which pydantic serializes as JSON-schema
`{"type": "array", "items": {}}` — an `items` entry with no 'type' key.
OpenAI's function-calling schema validator rejects that outright, most
visibly once an optional array field's schema is wrapped in `anyOf`
(observed via CrewAI's native OpenAI tool calling on `matimo_get_skill_content`).
"""

from __future__ import annotations

import pydantic

from matimo.core.models import Parameter, ParameterType
from matimo.integrations._pydantic_utils import parameter_to_pydantic_field


def _build_model(name: str, param: Parameter) -> type[pydantic.BaseModel]:
    py_type, field_def = parameter_to_pydantic_field(param)
    return pydantic.create_model(f"{name}_model", **{name: (py_type, field_def)})


class TestArrayItemsSchema:
    def test_untyped_optional_array_defaults_items_to_string(self) -> None:
        param = Parameter(type=ParameterType.ARRAY, required=False, description="sections")
        schema = _build_model("sections", param).model_json_schema()

        array_branch = next(
            branch for branch in schema["properties"]["sections"]["anyOf"] if branch.get("type") == "array"
        )
        assert array_branch["items"] == {"type": "string"}

    def test_untyped_required_array_defaults_items_to_string(self) -> None:
        param = Parameter(type=ParameterType.ARRAY, required=True, description="labels")
        schema = _build_model("labels", param).model_json_schema()

        assert schema["properties"]["labels"]["items"] == {"type": "string"}

    def test_declared_items_type_is_honored(self) -> None:
        param = Parameter(
            type=ParameterType.ARRAY,
            required=True,
            description="scores",
            items=Parameter(type=ParameterType.NUMBER),
        )
        schema = _build_model("scores", param).model_json_schema()
        items_schema = schema["properties"]["scores"]["items"]

        # YAML 'number' maps to `int | float`, so pydantic renders items as an
        # anyOf of concrete numeric types rather than a single 'type' — still
        # valid, since every branch carries its own 'type' key.
        types = {branch["type"] for branch in items_schema["anyOf"]}
        assert types == {"integer", "number"}

    def test_array_of_objects_declared_items_is_honored(self) -> None:
        param = Parameter(
            type=ParameterType.ARRAY,
            required=True,
            description="children",
            items=Parameter(type=ParameterType.OBJECT),
        )
        schema = _build_model("children", param).model_json_schema()

        assert schema["properties"]["children"]["items"]["type"] == "object"

    def test_every_array_items_schema_has_a_type_key(self) -> None:
        """The exact OpenAI requirement that triggered this bug."""
        for required in (True, False):
            param = Parameter(type=ParameterType.ARRAY, required=required, description="x")
            schema = _build_model("x", param).model_json_schema()
            prop = schema["properties"]["x"]
            branches = prop.get("anyOf", [prop])
            for branch in branches:
                if branch.get("type") == "array":
                    assert "type" in branch["items"], branch
