# matimo-hubspot

Matimo provider package for **hubspot**. Bundles YAML tool definitions that plug into the [Matimo SDK](https://pypi.org/project/matimo/).

## Installation

```bash
pip install matimo matimo-hubspot
```

## Usage

```python
from matimo import Matimo
from matimo_hubspot import get_tools_path

matimo = await Matimo.init(get_tools_path())
```
