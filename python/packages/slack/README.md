# matimo-slack

Matimo provider package for **slack**. Bundles YAML tool definitions that plug into the [Matimo SDK](https://pypi.org/project/matimo/).

## Installation

```bash
pip install matimo matimo-slack
```

## Usage

```python
from matimo import Matimo
from matimo_slack import get_tools_path

matimo = await Matimo.init(get_tools_path())
```
